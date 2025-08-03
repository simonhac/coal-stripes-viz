import { useEffect, useRef } from 'react';
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
  lastUpdateTime: number;
  startX: number;
  lastScreenX: number;
  lastScreenY: number;
}

/**
 * Hook that converts wheel events (trackpad) to drag operations
 * Returns a ref to attach to the element
 */
export function useWheelDragNonPassive({
  startDrag,
  updateDrag,
  endDrag,
}: WheelDragOptions) {
  const wheelStateRef = useRef<WheelState>({
    lastWheelTime: 0,
    accumulatedX: 0,
    isActive: false,
    lastUpdateTime: 0,
    startX: 0,
    lastScreenX: 0,
    lastScreenY: 0,
  });
  
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleWheel = (e: WheelEvent) => {
      // Only handle horizontal scrolling
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 0.5) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      const state = wheelStateRef.current;

      // Check if this is a new gesture (more than 150ms since last wheel event)
      if (now - state.lastWheelTime > 150 || !state.isActive) {
        // For wheel events, always use 0 as the reference point
        state.startX = 0;
        state.accumulatedX = 0;
        state.lastUpdateTime = 0;
        state.isActive = true;
        logDragEvent('Wheel drag started', { 
          deltaX: e.deltaX, 
          deltaY: e.deltaY,
          deltaZ: e.deltaZ,
          deltaMode: e.deltaMode,
          screenX: e.screenX,
          screenY: e.screenY,
          clientX: e.clientX,
          clientY: e.clientY,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          buttons: e.buttons,
          wheelDelta: (e as any).wheelDelta,
          wheelDeltaX: (e as any).wheelDeltaX,
          wheelDeltaY: (e as any).wheelDeltaY,
          detail: (e as any).detail
        });
        startDrag(0);
      }

      state.lastWheelTime = now;
      // Invert direction - scrolling right should go forward in time
      state.accumulatedX -= e.deltaX;
      
      // Log every wheel event to see the pattern
      const didntMove = e.screenX === state.lastScreenX && e.screenY === state.lastScreenY;
      logDragEvent('Wheel event', {
        deltaX: parseFloat(e.deltaX.toFixed(1)),
        deltaY: parseFloat(e.deltaY.toFixed(1)),
        screenX: e.screenX,
        screenY: e.screenY,
        accumulatedX: Math.round(state.accumulatedX),
        timeSinceStart: now - (state.lastUpdateTime || now),
        ...(didntMove && { status: "DIDN'T MOVE" })
      });
      
      state.lastScreenX = e.screenX;
      state.lastScreenY = e.screenY;
      
      // Throttle updates to prevent overwhelming React
      const timeSinceLastUpdate = now - state.lastUpdateTime;
      if (timeSinceLastUpdate >= 16) { // ~60fps max
        state.lastUpdateTime = now;
        // Pass accumulated value directly - it represents position relative to start
        updateDrag(state.accumulatedX);
      }
    };

    // Add the wheel event listener as non-passive
    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [startDrag, updateDrag]);

  // Check for wheel gesture end
  useEffect(() => {
    const checkWheelEnd = () => {
      const state = wheelStateRef.current;
      const now = Date.now();

      if (state.isActive && now - state.lastWheelTime > 150) {
        state.isActive = false;
        // Ensure final position is updated
        updateDrag(state.accumulatedX);
        logDragEvent('Wheel drag ended (timeout)');
        endDrag({ applyMomentum: true }); // Enable momentum for wheel
        // Reset accumulated position after drag ends
        state.accumulatedX = 0;
        state.lastUpdateTime = 0;
      }
    };

    const interval = setInterval(checkWheelEnd, 50);
    return () => clearInterval(interval);
  }, [endDrag]);

  return elementRef;
}