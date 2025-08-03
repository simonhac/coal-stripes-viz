import { useCallback, useRef, useState } from 'react';
import { CalendarDate } from '@internationalized/date';
import { useDateRangeAnimator } from './useDateRangeAnimator';

interface UnifiedDragOptions {
  currentEndDate: CalendarDate;
  onDateNavigate: (date: CalendarDate, isDragging: boolean) => void;
}

interface DragState {
  isActive: boolean;
  startDate: CalendarDate;
  startX: number;
  velocitySamples: Array<{ x: number; time: number }>;
}

/**
 * Core drag hook that handles physics but knows nothing about input methods
 * Provides a unified interface for mouse, touch, and wheel dragging
 */
export function useUnifiedDrag({
  currentEndDate,
  onDateNavigate,
}: UnifiedDragOptions) {
  const [isActive, setIsActive] = useState(false);
  const dragStateRef = useRef<DragState>({
    isActive: false,
    startDate: currentEndDate,
    startX: 0,
    velocitySamples: [],
  });

  // Use the date range animator for physics
  const animator = useDateRangeAnimator({
    currentEndDate,
    onDateNavigate,
  });

  // Start a drag operation
  const startDrag = useCallback((startX: number) => {
    const state = dragStateRef.current;
    state.isActive = true;
    state.startDate = currentEndDate;
    state.startX = startX;
    state.velocitySamples = [{ x: startX, time: Date.now() }];
    
    setIsActive(true);
    animator.startDrag();
  }, [currentEndDate, animator]);

  // Update drag position
  const updateDrag = useCallback((currentX: number) => {
    const state = dragStateRef.current;
    if (!state.isActive) return;
    
    const now = Date.now();
    
    // Track velocity
    state.velocitySamples.push({ x: currentX, time: now });
    
    // Keep only recent samples
    const cutoff = now - 100; // Last 100ms
    state.velocitySamples = state.velocitySamples.filter(s => s.time > cutoff);
    
    // Convert pixels to days
    const deltaX = currentX - state.startX;
    const containerWidth = window.innerWidth;
    const daysDelta = -(deltaX / containerWidth) * 365;
    
    // Calculate target date
    const targetDate = state.startDate.add({ days: Math.round(daysDelta) });
    
    // Let animator handle rubber band and bounds
    animator.navigateToDragDate(targetDate);
    
    // Update velocity for the animator
    if (state.velocitySamples.length >= 2) {
      const first = state.velocitySamples[0];
      const last = state.velocitySamples[state.velocitySamples.length - 1];
      const timeDelta = last.time - first.time;
      
      if (timeDelta > 0) {
        const pixelVelocity = (last.x - first.x) / (timeDelta / 1000);
        const dayVelocity = -(pixelVelocity / containerWidth) * 365;
        animator.updateVelocity(dayVelocity);
      }
    }
  }, [animator]);

  // End drag operation
  const endDrag = useCallback((options?: { applyMomentum?: boolean }) => {
    const state = dragStateRef.current;
    if (!state.isActive) return;
    
    state.isActive = false;
    setIsActive(false);
    
    // Default to momentum for touch/wheel, no momentum for mouse
    const applyMomentum = options?.applyMomentum ?? true;
    
    // Let animator handle snap-back and momentum
    animator.endDrag(applyMomentum);
    
    // Reset state
    state.velocitySamples = [];
  }, [animator]);

  // Cancel drag operation
  const cancelDrag = useCallback(() => {
    const state = dragStateRef.current;
    if (!state.isActive) return;
    
    state.isActive = false;
    setIsActive(false);
    state.velocitySamples = [];
    animator.cancelAnimation();
  }, [animator]);

  return {
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    isActive,
  };
}