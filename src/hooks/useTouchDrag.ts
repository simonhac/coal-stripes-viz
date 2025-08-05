import { useCallback, useRef, useEffect } from 'react';
import { DATE_NAV_PHYSICS } from '@/shared/config';
import { SessionManager, SessionType, TouchSession } from '@/client/debugging';

interface TouchDragOptions {
  startDrag: (x: number) => void;
  updateDrag: (x: number) => void;
  endDrag: (options?: { applyMomentum?: boolean }) => void;
  cancelDrag: () => void;
}

interface TouchState {
  startCenterX: number;
  startCenterY: number;
  scaledStartX: number;  // Scaled position for drag system
  wasHorizontalDrag: boolean;
  session: TouchSession | null;
  velocitySamples: Array<{ x: number; time: number }>;
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
    scaledStartX: 0,
    wasHorizontalDrag: false,
    session: null,
    velocitySamples: [],
  });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    
    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    
    // Create new session
    const session = SessionManager.getInstance().createSession(SessionType.TOUCH) as TouchSession;
    
    // Scale the touch position for the drag system
    const scaledX = centerX * DATE_NAV_PHYSICS.TOUCH.MOVEMENT_SCALE;
    
    touchStateRef.current = {
      startCenterX: centerX,
      startCenterY: centerY,
      scaledStartX: scaledX,
      wasHorizontalDrag: false,
      session,
      velocitySamples: [{ x: centerX, time: Date.now() }],
    };
    
    // Start DRAG phase
    session.startPhase('DRAG', { 
      centerX: centerX.toFixed(0), 
      centerY: centerY.toFixed(0),
      scale: DATE_NAV_PHYSICS.TOUCH.MOVEMENT_SCALE
    });
    
    // Log initial touch event
    const touchEvent = session.createTouchEvent(
      'DRAG',
      centerX,
      centerY,
      0,
      0,
      2
    );
    touchEvent.log();
    
    startDrag(scaledX);
  }, [startDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    
    const state = touchStateRef.current;
    if (!state.session) return;
    
    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    
    const deltaX = centerX - state.startCenterX;
    const deltaY = centerY - state.startCenterY;
    
    // Check if this is a horizontal drag
    if (!state.wasHorizontalDrag) {
      if (Math.abs(deltaX) > Math.abs(deltaY) * DATE_NAV_PHYSICS.DRAG.MIN_HORIZONTAL_RATIO) {
        state.wasHorizontalDrag = true;
        
        // Log that we detected horizontal drag
        const event = state.session.createTouchMessage(
          'DRAG',
          `Horizontal drag detected: |Δx|=${Math.abs(deltaX).toFixed(0)} > |Δy|×${DATE_NAV_PHYSICS.DRAG.MIN_HORIZONTAL_RATIO}=${(Math.abs(deltaY) * DATE_NAV_PHYSICS.DRAG.MIN_HORIZONTAL_RATIO).toFixed(0)}`
        );
        event.log();
      } else if (Math.abs(deltaY) > 20) {
        // Vertical drag, cancel
        const event = state.session.createTouchMessage(
          'DRAG',
          `Vertical drag detected, cancelling: |Δy|=${Math.abs(deltaY).toFixed(0)} > 20`
        );
        event.log();
        
        state.session.endPhase('DRAG', 'vertical drag');
        state.session.end();
        state.session = null;
        cancelDrag();
        return;
      }
    }
    
    if (state.wasHorizontalDrag) {
      // Track velocity
      const now = Date.now();
      state.velocitySamples.push({ x: centerX, time: now });
      
      // Keep only recent samples (last 100ms)
      const cutoff = now - 100;
      state.velocitySamples = state.velocitySamples.filter(s => s.time > cutoff);
      
      // Log touch move with velocity if we have enough samples
      if (state.velocitySamples.length >= 2) {
        const first = state.velocitySamples[0];
        const last = state.velocitySamples[state.velocitySamples.length - 1];
        const timeDelta = last.time - first.time;
        
        if (timeDelta > 0) {
          const pixelVelocity = (last.x - first.x) / (timeDelta / 1000);
          const containerWidth = window.innerWidth;
          const dayVelocity = -(pixelVelocity / containerWidth) * 365;
          
          // Log velocity event every 50ms or so
          const velocityEvent = state.session.createVelocityEvent(
            'DRAG',
            pixelVelocity,
            dayVelocity,
            state.velocitySamples.length,
            timeDelta
          );
          velocityEvent.log();
        }
      }
      
      // Scale the touch position for the drag system
      const scaledX = state.scaledStartX + (centerX - state.startCenterX) * DATE_NAV_PHYSICS.TOUCH.MOVEMENT_SCALE;
      updateDrag(scaledX);
    }
  }, [updateDrag, cancelDrag]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    const state = touchStateRef.current;
    
    if (state.wasHorizontalDrag && state.session) {
      // Calculate final velocity
      if (state.velocitySamples.length >= 2) {
        const first = state.velocitySamples[0];
        const last = state.velocitySamples[state.velocitySamples.length - 1];
        const timeDelta = last.time - first.time;
        
        if (timeDelta > 0) {
          const pixelVelocity = (last.x - first.x) / (timeDelta / 1000);
          const containerWidth = window.innerWidth;
          const dayVelocity = -(pixelVelocity / containerWidth) * 365;
          // Apply touch scaling to velocity (since we scaled the movement)
          const scaledDayVelocity = dayVelocity * DATE_NAV_PHYSICS.TOUCH.MOVEMENT_SCALE;
          const momentumVelocity = scaledDayVelocity * DATE_NAV_PHYSICS.TOUCH.MOMENTUM_SCALE;
          
          // Log final velocity and momentum
          const event = state.session.createTouchMessage(
            'DRAG',
            `Touch end - final velocity: pixelV=${pixelVelocity.toFixed(1)}px/s, dayV=${dayVelocity.toFixed(1)}d/s, scaled=${scaledDayVelocity.toFixed(1)}d/s, momentum=${momentumVelocity.toFixed(1)}d/s`
          );
          event.log();
        }
      } else {
        const event = state.session.createTouchMessage(
          'DRAG',
          'Touch end - no velocity data'
        );
        event.log();
      }
      
      state.session.endPhase('DRAG', 'touch end');
      state.session.end();
      state.session = null;
      
      endDrag({ applyMomentum: true }); // Enable momentum for touch
    } else if (state.session) {
      // Session exists but wasn't a horizontal drag
      state.session.endPhase('DRAG', 'not horizontal');
      state.session.end();
      state.session = null;
    }
  }, [endDrag]);

  const handleTouchCancel = useCallback(() => {
    const state = touchStateRef.current;
    
    if (state.session) {
      const event = state.session.createTouchMessage(
        'DRAG',
        'Touch cancelled'
      );
      event.log();
      
      state.session.endPhase('DRAG', 'cancelled');
      state.session.end();
      state.session = null;
    }
    
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