import { useCallback, useRef, useEffect } from 'react';
import { logDragEvent, logDragWarning } from '@/utils/drag-logger';

interface WheelDragOptions {
  startDrag: (x: number) => void;
  updateDrag: (x: number) => void;
  endDrag: (options?: { applyMomentum?: boolean }) => void;
}

interface WheelState {
  lastWheelTime: number;
  accumulatedX: number;
  isActive: boolean;
}

/**
 * Hook that converts wheel events (trackpad) to drag operations
 */
export function useWheelDrag({
  startDrag,
  updateDrag,
  endDrag,
}: WheelDragOptions) {
  const wheelStateRef = useRef<WheelState>({
    lastWheelTime: 0,
    accumulatedX: 0,
    isActive: false,
  });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Only handle horizontal scrolling
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 0.5) {
      return;
    }

    // For React synthetic events, we can safely call preventDefault
    if (e.nativeEvent && 'preventDefault' in e) {
      e.preventDefault();
    }
    e.stopPropagation();

    const now = Date.now();
    const state = wheelStateRef.current;

    // Check if this is a new gesture (more than 150ms since last wheel event)
    if (now - state.lastWheelTime > 150) {
      state.accumulatedX = 0;
      state.isActive = true;
      logDragEvent('Wheel drag started', { deltaX: e.deltaX, deltaY: e.deltaY });
      startDrag(0);
    }

    state.lastWheelTime = now;
    // Invert direction - scrolling right should go forward in time
    state.accumulatedX -= e.deltaX;
    
    updateDrag(state.accumulatedX);
  }, [startDrag, updateDrag]);

  // Check for wheel gesture end
  useEffect(() => {
    const checkWheelEnd = () => {
      const state = wheelStateRef.current;
      const now = Date.now();

      if (state.isActive && now - state.lastWheelTime > 150) {
        state.isActive = false;
        logDragEvent('Wheel drag ended (timeout)');
        endDrag({ applyMomentum: true }); // Enable momentum for wheel
        state.accumulatedX = 0;
      }
    };

    const interval = setInterval(checkWheelEnd, 50);
    return () => clearInterval(interval);
  }, [endDrag]);

  // Prevent horizontal wheel scrolling on the entire page
  useEffect(() => {
    const handleWheelPassive = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5) {
        e.preventDefault();
      }
    };

    document.addEventListener('wheel', handleWheelPassive, { passive: false });
    
    return () => {
      document.removeEventListener('wheel', handleWheelPassive);
    };
  }, []);

  return {
    onWheel: handleWheel,
  };
}