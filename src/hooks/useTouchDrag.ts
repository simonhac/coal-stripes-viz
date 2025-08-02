import { useCallback, useRef, useEffect } from 'react';
import { DATE_NAV_PHYSICS } from '@/shared/config';

interface TouchDragOptions {
  startDrag: (x: number) => void;
  updateDrag: (x: number) => void;
  endDrag: (options?: { applyMomentum?: boolean }) => void;
  cancelDrag: () => void;
}

interface TouchState {
  startCenterX: number;
  startCenterY: number;
  wasHorizontalDrag: boolean;
}

/**
 * Hook that converts two-finger touch events to drag operations
 */
export function useTouchDrag({
  startDrag,
  updateDrag,
  endDrag,
  cancelDrag,
}: TouchDragOptions) {
  const touchStateRef = useRef<TouchState>({
    startCenterX: 0,
    startCenterY: 0,
    wasHorizontalDrag: false,
  });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    
    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    
    touchStateRef.current = {
      startCenterX: centerX,
      startCenterY: centerY,
      wasHorizontalDrag: false,
    };
    
    startDrag(centerX);
  }, [startDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    
    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    
    const deltaX = centerX - touchStateRef.current.startCenterX;
    const deltaY = centerY - touchStateRef.current.startCenterY;
    
    // Check if this is a horizontal drag
    if (!touchStateRef.current.wasHorizontalDrag) {
      if (Math.abs(deltaX) > Math.abs(deltaY) * DATE_NAV_PHYSICS.DRAG.MIN_HORIZONTAL_RATIO) {
        touchStateRef.current.wasHorizontalDrag = true;
      } else if (Math.abs(deltaY) > 20) {
        // Vertical drag, cancel
        cancelDrag();
        return;
      }
    }
    
    if (touchStateRef.current.wasHorizontalDrag) {
      updateDrag(centerX);
    }
  }, [updateDrag, cancelDrag]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStateRef.current.wasHorizontalDrag) {
      endDrag({ applyMomentum: true }); // Enable momentum for touch
    }
  }, [endDrag]);

  const handleTouchCancel = useCallback(() => {
    cancelDrag();
  }, [cancelDrag]);

  // Prevent default scrolling during horizontal drag
  useEffect(() => {
    const handleTouchMovePassive = (e: TouchEvent) => {
      if (touchStateRef.current.wasHorizontalDrag && e.cancelable) {
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