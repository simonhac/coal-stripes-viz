import { useRef, useCallback } from 'react';

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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault(); // Prevent mouse events from firing
      touchActiveRef.current = true;
      const touch = e.touches[0];
      onHoverStart?.(touch.clientX, touch.clientY);
    }
  }, [onHoverStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchActiveRef.current) {
      const touch = e.touches[0];
      onHoverMove?.(touch.clientX, touch.clientY);
    }
  }, [onHoverMove]);

  const handleTouchEnd = useCallback(() => {
    if (touchActiveRef.current) {
      touchActiveRef.current = false;
      onHoverEnd?.();
    }
  }, [onHoverEnd]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
}