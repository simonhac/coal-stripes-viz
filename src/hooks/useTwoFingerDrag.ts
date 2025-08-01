import { useRef, useCallback, useEffect } from 'react';
import { CalendarDate } from '@internationalized/date';

interface TwoFingerDragOptions {
  endDate: CalendarDate;
  onDateNavigate: (newEndDate: CalendarDate, isDragging: boolean) => void;
}

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export function useTwoFingerDrag({
  endDate,
  onDateNavigate
}: TwoFingerDragOptions) {
  const dragStateRef = useRef<{
    isActive: boolean;
    startCenterX: number;
    startCenterY: number;
    startEndDate: CalendarDate | null;
    touches: Map<number, TouchPoint>;
    isHorizontalDrag: boolean;
    hasMoved: boolean;
  }>({
    isActive: false,
    startCenterX: 0,
    startCenterY: 0,
    startEndDate: null,
    touches: new Map(),
    isHorizontalDrag: false,
    hasMoved: false
  });

  // Add passive touch move handler to prevent scrolling during horizontal drag
  useEffect(() => {
    const handleTouchMovePassive = (e: TouchEvent) => {
      if (dragStateRef.current.isActive && dragStateRef.current.isHorizontalDrag && e.cancelable) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', handleTouchMovePassive, { passive: false });
    
    return () => {
      document.removeEventListener('touchmove', handleTouchMovePassive);
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Store all current touches
    const touches = new Map<number, TouchPoint>();
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      touches.set(touch.identifier, {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY
      });
    }
    dragStateRef.current.touches = touches;

    // Check if we have exactly two touches
    if (e.touches.length === 2) {
      e.preventDefault(); // Prevent default pinch/zoom
      
      // Calculate center point between two fingers
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      dragStateRef.current = {
        ...dragStateRef.current,
        isActive: true,
        startCenterX: centerX,
        startCenterY: centerY,
        startEndDate: endDate,
        isHorizontalDrag: false,
        hasMoved: false
      };
      
      // Set dragging cursor
      document.body.style.cursor = 'grabbing';
    }
  }, [endDate]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragStateRef.current.isActive || e.touches.length !== 2) return;
    
    e.preventDefault();
    
    // Calculate current center point
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
    const currentCenterY = (touch1.clientY + touch2.clientY) / 2;
    
    // Detect if this is primarily a horizontal drag
    if (!dragStateRef.current.hasMoved) {
      const deltaX = Math.abs(currentCenterX - dragStateRef.current.startCenterX);
      const deltaY = Math.abs(currentCenterY - dragStateRef.current.startCenterY);
      
      if (deltaX > 5 || deltaY > 5) {
        dragStateRef.current.hasMoved = true;
        dragStateRef.current.isHorizontalDrag = deltaX > deltaY * 1.5;
      }
    }
    
    // Calculate horizontal movement
    const deltaX = currentCenterX - dragStateRef.current.startCenterX;
    
    // Convert pixel movement to days
    const daysChange = Math.round(deltaX);
    
    if (dragStateRef.current.startEndDate) {
      const newEndDate = dragStateRef.current.startEndDate.add({ days: -daysChange });
      onDateNavigate(newEndDate, true);
    }
  }, [onDateNavigate]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // Update our touch tracking
    const touches = new Map<number, TouchPoint>();
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      touches.set(touch.identifier, {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY
      });
    }
    dragStateRef.current.touches = touches;

    // If we no longer have two touches, end the drag
    if (dragStateRef.current.isActive && e.touches.length < 2) {
      dragStateRef.current.isActive = false;
      dragStateRef.current.isHorizontalDrag = false;
      dragStateRef.current.hasMoved = false;
      document.body.style.cursor = '';
      
      // Emit final navigation event with isDragging: false
      if (endDate) {
        onDateNavigate(endDate, false);
      }
    }
  }, [endDate, onDateNavigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dragStateRef.current.isActive) {
        dragStateRef.current.isActive = false;
        dragStateRef.current.isHorizontalDrag = false;
        dragStateRef.current.hasMoved = false;
        document.body.style.cursor = '';
      }
    };
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchEnd // Handle cancel same as end
  };
}