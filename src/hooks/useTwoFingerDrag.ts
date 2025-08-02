import { useCallback, useRef, useEffect } from 'react';
import { CalendarDate } from '@internationalized/date';
import { DATE_NAV_PHYSICS } from '@/shared/config';

interface DragState {
  isActive: boolean;
  startCenterX: number;
  startCenterY: number;
  startEndDate: CalendarDate;
  wasHorizontalDrag: boolean;
  velocitySamples: Array<{ x: number; time: number }>;
  // For trackpad wheel events
  lastWheelTime: number;
  accumulatedDeltaX: number;
}

interface TwoFingerDragOptions {
  endDate: CalendarDate;
  onDateNavigate: (date: CalendarDate, isDragging: boolean) => void;
}

/**
 * Hook for handling two-finger drag interactions on RegionSection
 * Supports both touch events (mobile) and wheel events (trackpad)
 */
export function useTwoFingerDrag({
  endDate,
  onDateNavigate,
}: TwoFingerDragOptions) {
  const dragStateRef = useRef<DragState>({
    isActive: false,
    startCenterX: 0,
    startCenterY: 0,
    startEndDate: endDate,
    wasHorizontalDrag: false,
    velocitySamples: [],
    lastWheelTime: 0,
    accumulatedDeltaX: 0,
  });

  // Common drag start logic
  const startDrag = useCallback((x: number) => {
    const state = dragStateRef.current;
    state.isActive = true;
    state.startEndDate = endDate;
    state.velocitySamples = [{ x, time: Date.now() }];
    
    // Notify animator that drag is starting
    const startEvent = new CustomEvent('drag-start');
    window.dispatchEvent(startEvent);
  }, [endDate]);

  // Common drag move logic
  const updateDrag = useCallback((deltaX: number) => {
    const state = dragStateRef.current;
    const now = Date.now();
    
    // Track velocity
    state.velocitySamples.push({ x: deltaX, time: now });
    
    // Keep only recent samples
    const cutoff = now - DATE_NAV_PHYSICS.DRAG.VELOCITY_SAMPLE_WINDOW;
    state.velocitySamples = state.velocitySamples.filter(s => s.time > cutoff);
    
    // Convert pixels to days
    const containerWidth = window.innerWidth;
    const daysDelta = -(deltaX / containerWidth) * 365;
    
    // Calculate target date
    const targetDate = state.startEndDate.add({ days: Math.round(daysDelta) });
    
    // Navigate with dragging flag
    onDateNavigate(targetDate, true);
  }, [onDateNavigate]);

  // Common drag end logic
  const endDrag = useCallback(() => {
    const state = dragStateRef.current;
    if (!state.isActive) return;
    
    state.isActive = false;
    
    // Calculate velocity for momentum
    let shouldApplyMomentum = false;
    const samples = state.velocitySamples;
    
    if (state.wasHorizontalDrag && samples.length >= 2) {
      const firstSample = samples[0];
      const lastSample = samples[samples.length - 1];
      const timeDelta = lastSample.time - firstSample.time;
      
      if (timeDelta > 0) {
        const pixelVelocity = (lastSample.x - firstSample.x) / (timeDelta / 1000);
        const containerWidth = window.innerWidth;
        const dayVelocity = -(pixelVelocity / containerWidth) * 365;
        
        shouldApplyMomentum = Math.abs(dayVelocity) > 2;
        
        if (shouldApplyMomentum) {
          const velocityEvent = new CustomEvent('drag-velocity', { 
            detail: { velocity: dayVelocity } 
          });
          window.dispatchEvent(velocityEvent);
        }
      }
    }
    
    // Dispatch drag end event
    const event = new CustomEvent('drag-end', { 
      detail: { 
        currentEndDate: endDate,
        applyMomentum: shouldApplyMomentum
      } 
    });
    window.dispatchEvent(event);
    
    // Reset state
    state.velocitySamples = [];
    state.wasHorizontalDrag = false;
    state.accumulatedDeltaX = 0;
    state.lastWheelTime = 0;
  }, [endDate]);


  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    
    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    
    dragStateRef.current.startCenterX = centerX;
    dragStateRef.current.startCenterY = centerY;
    dragStateRef.current.wasHorizontalDrag = false;
    
    startDrag(0); // Start at position 0
  }, [startDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragStateRef.current.isActive || e.touches.length !== 2) return;
    
    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    
    const deltaX = centerX - dragStateRef.current.startCenterX;
    const deltaY = centerY - dragStateRef.current.startCenterY;
    
    // Check if this is a horizontal drag
    if (!dragStateRef.current.wasHorizontalDrag) {
      if (Math.abs(deltaX) > Math.abs(deltaY) * DATE_NAV_PHYSICS.DRAG.MIN_HORIZONTAL_RATIO) {
        dragStateRef.current.wasHorizontalDrag = true;
      } else if (Math.abs(deltaY) > 20) {
        // Vertical drag, cancel
        dragStateRef.current.isActive = false;
        return;
      }
    }
    
    if (dragStateRef.current.wasHorizontalDrag) {
      updateDrag(deltaX);
    }
  }, [updateDrag]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    endDrag();
  }, [endDrag]);

  const handleTouchCancel = useCallback(() => {
    dragStateRef.current.isActive = false;
    onDateNavigate(endDate, false);
  }, [endDate, onDateNavigate]);

  // Handle wheel events for trackpad
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Only handle horizontal scrolling
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 0.5) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    const state = dragStateRef.current;

    // Check if this is a new gesture
    if (now - state.lastWheelTime > 150) {
      state.accumulatedDeltaX = 0;
      state.wasHorizontalDrag = true;
      startDrag(0);
    }

    state.lastWheelTime = now;
    // Invert the direction - scrolling right should go forward in time
    state.accumulatedDeltaX -= e.deltaX;
    
    updateDrag(state.accumulatedDeltaX);
  }, [startDrag, updateDrag]);

  // Check for wheel gesture end
  useEffect(() => {
    const checkWheelEnd = () => {
      const state = dragStateRef.current;
      const now = Date.now();

      if (state.isActive && state.lastWheelTime > 0 && now - state.lastWheelTime > 150) {
        endDrag();
      }
    };

    const interval = setInterval(checkWheelEnd, 50);
    return () => clearInterval(interval);
  }, [endDrag]);

  // Prevent default scrolling during horizontal drag
  useEffect(() => {
    const handleTouchMovePassive = (e: TouchEvent) => {
      if (dragStateRef.current.isActive && dragStateRef.current.wasHorizontalDrag && e.cancelable) {
        e.preventDefault();
      }
    };

    // Prevent horizontal wheel scrolling on the entire page
    const handleWheelPassive = (e: WheelEvent) => {
      // If there's significant horizontal scroll, prevent it
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', handleTouchMovePassive, { passive: false });
    document.addEventListener('wheel', handleWheelPassive, { passive: false });
    
    return () => {
      document.removeEventListener('touchmove', handleTouchMovePassive);
      document.removeEventListener('wheel', handleWheelPassive);
    };
  }, []);


  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
    onWheel: handleWheel,
  };
}