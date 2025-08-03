import { useEffect, useRef } from 'react';
import { logDragEvent, logDragWarning, logDragPhaseStart, logDragPhaseEnd, DragPhase, dragLogger } from '@/utils/drag-logger';
import { startWheelSession, endSession, incrementEventCount, getCurrentSession } from '@/utils/interaction-session';

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
        startWheelSession();
        dragLogger.reset(); // Reset timing for new session
        
        // For wheel events, always use 0 as the reference point
        state.startX = 0;
        state.accumulatedX = 0;
        state.lastUpdateTime = 0;
        state.isActive = true;
        
        // Log wheel start using shared phase logging
        logDragPhaseStart(DragPhase.DRAG_START, { 
          deltaX: e.deltaX, 
          deltaZ: e.deltaZ,
          deltaMode: e.deltaMode,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
        });
        startDrag(0);
      }

      state.lastWheelTime = now;
      // Invert direction - scrolling right should go forward in time
      state.accumulatedX -= e.deltaX;
      
      // Throttle updates to prevent overwhelming React
      const timeSinceLastUpdate = now - state.lastUpdateTime;
      if (timeSinceLastUpdate >= 16) { // ~60fps max
        // Only log and increment sequence when we're actually sending an update
        const eventSeq = incrementEventCount() - 1;
        const sessionInfo = getCurrentSession();
        const sessionSeq = sessionInfo?.seq ?? 0;
        const deltaX = parseFloat(e.deltaX.toFixed(1));
        const accumulatedX = Math.round(state.accumulatedX);
        logDragEvent(`WHEEL ${sessionSeq}.${eventSeq}`, 
          `deltaX: ${deltaX}, accumX: ${accumulatedX}`
        );
        
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
        // Log wheel end using shared phase logging
        logDragPhaseEnd(DragPhase.DRAGGING, {
          endReason: 'timeout'
        });
        endSession();
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