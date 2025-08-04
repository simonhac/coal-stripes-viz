import { useEffect, useRef } from 'react';
import { SessionManager, SessionType, WheelSession } from '@/client/debugging';

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
  session: WheelSession | null;
}

/**
 * Hook that converts wheel events (trackpad) to drag operations
 * Returns a ref to attach to the element
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
    lastUpdateTime: 0,
    startX: 0,
    session: null,
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
        // New session
        state.session = SessionManager.getInstance().createSession(SessionType.WHEEL) as WheelSession;
        
        // For wheel events, always use 0 as the reference point
        state.startX = 0;
        state.accumulatedX = 0;
        state.lastUpdateTime = 0;
        state.isActive = true;
        
        // Transition from INIT to SCROLL on first wheel event
        if (state.session.getCurrentPhase() === 'INIT') {
          state.session.startPhase('SCROLL', { 
            deltaX: e.deltaX, 
          });
        }
        startDrag(0);
      }

      state.lastWheelTime = now;
      // Invert direction - scrolling right should go forward in time
      state.accumulatedX -= e.deltaX;
      
      // Throttle updates to prevent overwhelming React
      const timeSinceLastUpdate = now - state.lastUpdateTime;
      if (timeSinceLastUpdate >= 16) { // ~60fps max
        // Create and log wheel event
        const deltaX = parseFloat(e.deltaX.toFixed(1));
        const accumulatedX = Math.round(state.accumulatedX);
        const wheelEvent = state.session!.createWheelEvent(
          state.session!.getCurrentPhase(),
          deltaX,
          accumulatedX
        );
        wheelEvent.log();
        
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
        // Log wheel end using session
        state.session!.endPhase('SCROLL', 'timeout');
        // End the session properly
        state.session!.end();
        state.session = null;
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
