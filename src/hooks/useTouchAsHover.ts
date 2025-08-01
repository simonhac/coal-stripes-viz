import { useRef, useCallback, useEffect } from 'react';

interface TouchAsHoverOptions {
  onHoverStart?: (x: number, y: number) => void;
  onHoverMove?: (x: number, y: number) => void;
  onHoverEnd?: () => void;
}

export function useTouchAsHover({
  onHoverStart,
  onHoverMove,
  onHoverEnd
}: TouchAsHoverOptions) {
  const touchActiveRef = useRef(false);
  const initialTouchRef = useRef<{ x: number; y: number } | null>(null);
  const isHorizontalSwipeRef = useRef(false);
  const hasMovedRef = useRef(false);

  useEffect(() => {
    const handleTouchMovePassive = (e: TouchEvent) => {
      if (isHorizontalSwipeRef.current && e.cancelable) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', handleTouchMovePassive, { passive: false });
    
    return () => {
      document.removeEventListener('touchmove', handleTouchMovePassive);
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault(); // Prevent mouse events from firing
      touchActiveRef.current = true;
      hasMovedRef.current = false;
      isHorizontalSwipeRef.current = false;
      
      const touch = e.touches[0];
      initialTouchRef.current = { x: touch.clientX, y: touch.clientY };
      onHoverStart?.(touch.clientX, touch.clientY);
    }
  }, [onHoverStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchActiveRef.current && initialTouchRef.current) {
      const touch = e.touches[0];
      
      if (!hasMovedRef.current) {
        const deltaX = Math.abs(touch.clientX - initialTouchRef.current.x);
        const deltaY = Math.abs(touch.clientY - initialTouchRef.current.y);
        
        if (deltaX > 5 || deltaY > 5) {
          hasMovedRef.current = true;
          isHorizontalSwipeRef.current = deltaX > deltaY * 1.5;
        }
      }
      
      onHoverMove?.(touch.clientX, touch.clientY);
    }
  }, [onHoverMove]);

  const handleTouchEnd = useCallback(() => {
    if (touchActiveRef.current) {
      touchActiveRef.current = false;
      isHorizontalSwipeRef.current = false;
      hasMovedRef.current = false;
      initialTouchRef.current = null;
      onHoverEnd?.();
    }
  }, [onHoverEnd]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
}