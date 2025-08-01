import { useCallback, useRef, useEffect } from 'react';
import { CalendarDate } from '@internationalized/date';
import { DATE_NAV_PHYSICS } from '@/shared/config';

interface TouchDragState {
  isActive: boolean;
  startCenterX: number;
  startCenterY: number;
  startEndDate: CalendarDate;
  wasHorizontalDrag: boolean;
}

interface TwoFingerDragOptions {
  endDate: CalendarDate;
  onDateNavigate: (date: CalendarDate, isDragging: boolean) => void;
}

/**
 * Hook for handling two-finger touch drag interactions on RegionSection
 * This converts touch movements to date navigation
 */
export function useTwoFingerDrag({
  endDate,
  onDateNavigate,
}: TwoFingerDragOptions) {
  const dragStateRef = useRef<TouchDragState>({
    isActive: false,
    startCenterX: 0,
    startCenterY: 0,
    startEndDate: endDate,
    wasHorizontalDrag: false,
  });


  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    
    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    
    dragStateRef.current = {
      isActive: true,
      startCenterX: centerX,
      startCenterY: centerY,
      startEndDate: endDate,
      wasHorizontalDrag: false,
    };
  }, [endDate]);

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
      // Convert pixels to days (assuming full width = 365 days)
      const containerWidth = window.innerWidth;
      const daysDelta = -(deltaX / containerWidth) * 365;
      
      // Calculate target date
      const targetDate = dragStateRef.current.startEndDate.add({ days: Math.round(daysDelta) });
      
      // Just pass the date through - let the main animator handle physics
      onDateNavigate(targetDate, true);
    }
  }, [onDateNavigate]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragStateRef.current.isActive) return;
    
    dragStateRef.current.isActive = false;
    
    // Dispatch a special event to trigger snap-back check
    const event = new CustomEvent('drag-end', { 
      detail: { 
        currentEndDate: endDate,
        applyMomentum: false // No momentum for two-finger drag
      } 
    });
    window.dispatchEvent(event);
  }, [endDate]);

  const handleTouchCancel = useCallback(() => {
    dragStateRef.current.isActive = false;
    onDateNavigate(endDate, false);
  }, [endDate, onDateNavigate]);

  // Prevent default scrolling during horizontal drag
  useEffect(() => {
    const handleTouchMovePassive = (e: TouchEvent) => {
      if (dragStateRef.current.isActive && dragStateRef.current.wasHorizontalDrag && e.cancelable) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', handleTouchMovePassive, { passive: false });
    
    return () => {
      document.removeEventListener('touchmove', handleTouchMovePassive);
    };
  }, []);


  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  };
}