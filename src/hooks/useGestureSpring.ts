import { useRef, useCallback, useEffect } from 'react';
import { useSpring, config, animated } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';
import { CalendarDate } from '@internationalized/date';
import { getDateBoundaries } from '@/shared/date-boundaries';
import { getDaysBetween as daysBetween } from '@/shared/date-utils';
import { DATE_NAV_PHYSICS } from '@/shared/config';
// Session management disabled for now
// import { SessionManager, SessionType, MoveSession, WheelSession, TouchSession } from '@/client/debugging';

interface GestureSpringOptions {
  currentEndDate: CalendarDate;
  onDateNavigate: (date: CalendarDate, isDragging: boolean) => void;
}

interface GestureState {
  // session: MoveSession | WheelSession | TouchSession | null;
  startDate: CalendarDate;
  isDragging: boolean;
  // lastPhase: string;
}

/**
 * Unified gesture handling using @use-gesture/react and @react-spring/web
 * Replaces useMouseDrag, useTouchDrag, useWheelDrag, and useUnifiedDrag
 */
export function useGestureSpring({
  currentEndDate,
  onDateNavigate,
}: GestureSpringOptions) {
  const stateRef = useRef<GestureState>({
    // session: null,
    startDate: currentEndDate,
    isDragging: false,
    // lastPhase: 'INIT',
  });
  const elementRef = useRef<HTMLDivElement>(null);
  
  // Track last updated date to prevent unnecessary updates
  const lastUpdatedDateRef = useRef<CalendarDate | null>(null);
  const frameCountRef = useRef(0);
  const lastDragDisplayRangeRef = useRef<string | null>(null);
  
  // Convert pixel offset to days
  const pixelsToDays = useCallback((pixels: number): number => {
    const containerWidth = window.innerWidth;
    return -(pixels / containerWidth) * 365;
  }, []);

  // Apply rubber band effect for out-of-bounds positions
  const applyRubberBand = useCallback((targetDate: CalendarDate, isWheel: boolean = false): CalendarDate => {
    const boundaries = getDateBoundaries();
    const startDate = targetDate.subtract({ days: 364 });
    
    const beyondRight = targetDate.compare(boundaries.latestDataDay) > 0;
    const beyondLeft = startDate.compare(boundaries.earliestDataDay) < 0;
    
    if (!beyondRight && !beyondLeft) {
      return targetDate;
    }
    
    let boundaryDate: CalendarDate;
    let overshoot: number;
    let maxStretch: number;
    
    if (beyondRight) {
      boundaryDate = boundaries.latestDataDay;
      overshoot = daysBetween(boundaryDate, targetDate);
      maxStretch = daysBetween(boundaries.latestDataDay, boundaries.latestDisplayDay);
    } else {
      boundaryDate = boundaries.earliestDataEndDay;
      overshoot = daysBetween(boundaryDate, targetDate);
      maxStretch = daysBetween(boundaries.earliestDisplayDay, boundaries.earliestDataDay) + 364;
    }
    
    // Apply stiffness factor for wheel (much stiffer rubber band)
    const stiffnessFactor = isWheel ? 0.3 : 1.0; // Wheel is 3x stiffer
    
    // Logarithmic rubber band
    const rubberBandDays = maxStretch * DATE_NAV_PHYSICS.RUBBER_BAND.SCALE_FACTOR * stiffnessFactor *
                          Math.log(1 + Math.abs(overshoot) / maxStretch) * 
                          Math.sign(overshoot);
    
    // Round to nearest integer to avoid fractional day jitter
    const roundedRubberBandDays = Math.round(rubberBandDays);
    
    if (beyondRight) {
      return boundaryDate.add({ days: roundedRubberBandDays });
    } else {
      return boundaryDate.subtract({ days: -roundedRubberBandDays });
    }
  }, []);
  
  // Update date based on spring animation value
  const updateDateFromSpring = useCallback((offset: number, isDragging: boolean = false) => {
    const targetDate = stateRef.current.startDate.add({ days: Math.round(offset) });
    // Only apply rubber band effect during active dragging
    const dateToUse = isDragging ? applyRubberBand(targetDate) : targetDate;
    const boundaries = getDateBoundaries();
    const clampedDate = boundaries.clampEndDateToDisplayBounds(dateToUse);
    
    // Don't update if the date hasn't changed to prevent infinite loops
    if (lastUpdatedDateRef.current && clampedDate.compare(lastUpdatedDateRef.current) === 0) {
      return;
    }
    
    lastUpdatedDateRef.current = clampedDate;
    
    // Session management disabled for now
    
    onDateNavigate(clampedDate, isDragging);
  }, [applyRubberBand, onDateNavigate]);
  
  // Spring animation for date position (in days offset from current)
  const [springProps, springApi] = useSpring(() => ({
    x: 0,
    config: config.default,
    onChange: ({ value }) => {
      // This callback fires for every frame of animation
      if (value.x !== undefined && animatingRef.current && !stateRef.current.isDragging) {
        frameCountRef.current++;
        // Floor the value immediately to reduce jitter
        const flooredValue = Math.floor(value.x);
        // Calculate what date this spring value represents (with rubber band during animation)
        const targetDate = stateRef.current.startDate.add({ days: flooredValue });
        const boundaries = getDateBoundaries();
        // During spring animation, we're not dragging so no rubber band is applied
        const clampedDate = boundaries.clampEndDateToDisplayBounds(targetDate);
        const startDate = clampedDate.subtract({ days: 364 });
        
        // Check if we've reached the boundary or gone back within bounds
        const nowInBounds = clampedDate.compare(boundaries.latestDataDay) <= 0 &&
                           startDate.compare(boundaries.earliestDataDay) >= 0;
        
        // If we're animating back, check if we've crossed or reached the target
        if (animatingRef.current && animationTargetRef.current !== undefined) {
          const currentPos = flooredValue;
          const target = animationTargetRef.current;
          const startPos = frameCountRef.current === 1 ? currentPos : Math.floor(springProps.x.get());
          
          // Check if we've crossed the target (overshot) or reached it
          const crossedTarget = (startPos > target && currentPos <= target) || 
                               (startPos < target && currentPos >= target);
          const reachedTarget = Math.abs(currentPos - target) < 1;
          
          if (crossedTarget || reachedTarget) {
            console.log('🛑 SPRING STOPPED: Reached target boundary', {
              current: currentPos.toFixed(2),
              target: target.toFixed(2)
            });
            animatingRef.current = false;
            springApi.stop();
            springApi.set({ x: target });
            // Ensure we're exactly at the boundary
            const targetDate = stateRef.current.startDate.add({ days: Math.round(target) });
            onDateNavigate(targetDate, false);
            return;
          }
        }
        
        console.log(`🔄 SPRING:`, {
          offset: Math.round(value.x).toString(),
          boundary: animationTargetRef.current !== undefined ? Math.floor(animationTargetRef.current).toString() : undefined,
          rb: '🔴',  // Always show red ball during spring animation as we're returning from out of bounds
          displayRange: `${startDate.toString()} to ${clampedDate.toString()}`,
          ts: Date.now()
        });
        updateDateFromSpring(value.x, false);
      }
    }
  }));
  
  // Track animation state
  const animatingRef = useRef(false);
  const animationTargetRef = useRef(0);
  
  // Poll spring value during animation - removed for clarity
  
  // Prevent browser navigation on horizontal wheel events globally
  useEffect(() => {
    const preventNavigation = (e: WheelEvent) => {
      // Prevent ANY horizontal scrolling from triggering browser navigation anywhere on the page
      if (Math.abs(e.deltaX) > 0) {
        e.preventDefault();
        return false;
      }
    };

    // Add listener to document to prevent all horizontal scroll navigation
    document.addEventListener('wheel', preventNavigation, { passive: false, capture: true });

    return () => {
      document.removeEventListener('wheel', preventNavigation, { capture: true });
    };
  }, []);
  

  const bind = useGesture(
    {
      onDrag: ({ active, movement: [mx], velocity: [vx], last, first, event }) => {
        // Mouse and touch drag handling
        
        // Initialize startDate on first drag event
        if (first) {
          // CRITICAL: Kill any and all animations before starting drag
          stateRef.current.isDragging = true; // Set this FIRST to prevent onChange handlers
          springApi.stop(); // Stop any running animations
          springApi.start({ 
            to: { x: 0 }, 
            immediate: true,
            config: { duration: 0 } // Ensure no animation at all
          });
          // Store the ACTUAL current date, not the one we might have animated to
          stateRef.current.startDate = currentEndDate;
          const startRange = currentEndDate.subtract({ days: 364 });
          lastDragDisplayRangeRef.current = null; // Reset for new drag
          console.log('🎬 DRAG START:', {
            displayRange: `${startRange.toString()} to ${currentEndDate.toString()}`
          });
        }
        
        const dayOffset = pixelsToDays(mx);
        
        if (active) {
          // During drag, update position immediately
          const targetDate = stateRef.current.startDate.add({ days: Math.round(dayOffset) });
          const rubberBandedDate = applyRubberBand(targetDate);
          const rubberBandedStartDate = rubberBandedDate.subtract({ days: 364 });
          const displayRange = `${rubberBandedStartDate.toString()} to ${rubberBandedDate.toString()}`;
          
          // Check if we're back within bounds after being out
          const boundaries = getDateBoundaries();
          const nowInBounds = rubberBandedDate.compare(boundaries.latestDataDay) <= 0 &&
                             rubberBandedStartDate.compare(boundaries.earliestDataDay) >= 0;
          
          // If we were animating (spring back) but now we're in bounds, kill the animation
          if (animatingRef.current && nowInBounds) {
            console.log('🛑 SPRING CANCELLED: Back within bounds');
            animatingRef.current = false;
            springApi.stop();
          }
          
          // Only log if the display range has changed
          if (displayRange !== lastDragDisplayRangeRef.current) {
            console.log('🖱️ DRAG:', {
              offset: dayOffset.toFixed(2),
              displayRange
            });
            lastDragDisplayRangeRef.current = displayRange;
          }
          
          // Use immediate mode for updates during drag, no animations
          springApi.start({ x: dayOffset, immediate: true });
          updateDateFromSpring(dayOffset, true);
        } else if (last) {
          // Drag ended - always reset the last updated ref
          lastUpdatedDateRef.current = null;
          stateRef.current.isDragging = false;
          
          const boundaries = getDateBoundaries();
          const targetDate = stateRef.current.startDate.add({ days: Math.round(dayOffset) });
          
          // Apply rubber band to get the ACTUAL visual position
          const rubberBandedDate = applyRubberBand(targetDate);
          const startDate = rubberBandedDate.subtract({ days: 364 });
          const outOfBounds = rubberBandedDate.compare(boundaries.latestDataDay) > 0 ||
                             startDate.compare(boundaries.earliestDataDay) < 0;
          
          console.log('🏁 DRAG END:', {
            displayRange: `${startDate.toString()} to ${rubberBandedDate.toString()}`,
            outOfBounds
          });
          
          if (outOfBounds) {
            // Spring back to boundary
            const targetBoundary = rubberBandedDate.compare(boundaries.latestDataDay) > 0
              ? boundaries.latestDataDay
              : boundaries.earliestDataEndDay;
            
            // Calculate the target position in our coordinate system
            // The boundary is X days from our original startDate
            const springTargetOffset = daysBetween(stateRef.current.startDate, targetBoundary);
            
            // Set animation state BEFORE stopping/starting
            animatingRef.current = true;
            animationTargetRef.current = springTargetOffset;
            frameCountRef.current = 0; // Reset frame counter
            
            const boundaryStartDate = targetBoundary.subtract({ days: 364 });
            console.log('🚀 SPRING TO BOUNDARY:', {
              targetRange: `${boundaryStartDate.toString()} to ${targetBoundary.toString()}`
            });
            
            // Use react-spring properly: animate from rubber-banded position to target
            springApi.stop();
            
            // Calculate the rubber-banded offset (where we visually are)
            const rubberBandedOffset = daysBetween(stateRef.current.startDate, rubberBandedDate);
            
            // Start spring animation to boundary
            springApi.stop();
            // First set the current position, then animate to target
            springApi.set({ x: rubberBandedOffset });
            
            console.log('🎯 Spring animation setup (drag):', {
              currentPos: rubberBandedOffset,
              targetPos: springTargetOffset,
              startDate: stateRef.current.startDate.toString(),
              targetBoundary: targetBoundary.toString(),
              ts: Date.now()
            });
            
            springApi.start({
              to: { x: springTargetOffset },
              config: {
                ...config.default,
                clamp: true  // Clamp to prevent going past target
              },
              onRest: () => {
                // Animation complete
                animatingRef.current = false;
                const finalStartDate = targetBoundary.subtract({ days: 364 });
                const finalSpringValue = springProps.x.get();
                console.log('✅ SPRING COMPLETE:', {
                  finalRange: `${finalStartDate.toString()} to ${targetBoundary.toString()}`,
                  frames: frameCountRef.current,
                  finalSpringValue: Math.floor(finalSpringValue),
                  expectedTarget: springTargetOffset
                });
                // Only update if we're not already at the right position
                if (Math.abs(finalSpringValue - springTargetOffset) > 1) {
                  console.log('⚠️ Spring ended at wrong position, correcting...');
                  springApi.set({ x: springTargetOffset });
                  onDateNavigate(targetBoundary, false);
                }
                // DON'T reset the coordinate system - keep spring at its current position
                // The next gesture will reset it when it starts
              }
            });
          } else if (Math.abs(vx) > 0.2) {
            // Apply momentum
            const velocityDays = pixelsToDays(vx * 100); // Scale velocity
            const momentumTarget = dayOffset + velocityDays;
            
            // Clamp momentum target to data boundaries (not display boundaries)
            const momentumDate = stateRef.current.startDate.add({ days: Math.round(momentumTarget) });
            // Ensure we stay within data bounds for momentum
            const startDate = momentumDate.subtract({ days: 364 });
            let clampedMomentumDate = momentumDate;
            if (momentumDate.compare(boundaries.latestDataDay) > 0) {
              clampedMomentumDate = boundaries.latestDataDay;
            } else if (startDate.compare(boundaries.earliestDataDay) < 0) {
              clampedMomentumDate = boundaries.earliestDataEndDay;
            }
            const clampedMomentumOffset = daysBetween(stateRef.current.startDate, clampedMomentumDate);
            
            // Session management disabled
            
            springApi.start({
              x: clampedMomentumOffset,
              config: { ...config.default, friction: 50 },
              onRest: () => {
                // Session management disabled
                onDateNavigate(clampedMomentumDate, false);
              },
            });
          } else {
            // No momentum, just end
            // Session management disabled
            const finalDate = stateRef.current.startDate.add({ days: Math.round(dayOffset) });
            const clampedDate = boundaries.clampEndDateToDisplayBounds(finalDate);
            onDateNavigate(clampedDate, false);
          }
        }
      },
      
      onWheel: ({ active, movement: [mx, my], velocity: [, _vy], last, first, event, delta: [dx, dy] }) => {
        // Initialize startDate and determine scroll direction on first wheel event
        if (first) {
          // CRITICAL: Kill any animations and reset spring before starting wheel
          springApi.stop();
          springApi.set({ x: 0 }); // Reset spring to 0 for this new gesture
          stateRef.current.startDate = currentEndDate;
          // Determine scroll direction based on accumulated movement so far
          // Lock it in for the entire gesture
          stateRef.current.wheelIsHorizontal = Math.abs(mx) > Math.abs(my);
          stateRef.current.wheelProcessedLast = false; // Reset the flag for new gesture
          const startRange = currentEndDate.subtract({ days: 364 });
          console.log('🎡 WHEEL START:', {
            displayRange: `${startRange.toString()} to ${currentEndDate.toString()}`,
            direction: stateRef.current.wheelIsHorizontal ? 'horizontal' : 'vertical',
            ts: Date.now()
          });
        }
        
        // Use the locked-in direction for the entire gesture
        const isHorizontal = stateRef.current.wheelIsHorizontal ?? (Math.abs(mx) > Math.abs(my));
        
        // For horizontal, use accumulated movement but scale it up significantly
        // For vertical, use accumulated movement with moderate scaling
        const movement = isHorizontal ? -mx * 10 : -my * 1; // Halved sensitivity
        
        // Use the movement we calculated above
        const dayOffset = pixelsToDays(movement);
        
        // Don't update if the offset is 0 or very small to avoid unnecessary renders
        if (Math.abs(dayOffset) < 0.01) return;
        
        // Calculate the target date and apply rubber band effect (stiffer for wheel)
        const targetDate = stateRef.current.startDate.add({ days: Math.round(dayOffset) });
        const boundaries = getDateBoundaries();
        
        // Check if target is beyond boundaries for rubber band
        const beyondRight = targetDate.compare(boundaries.latestDataDay) > 0;
        const beyondLeft = targetDate.subtract({ days: 364 }).compare(boundaries.earliestDataDay) < 0;
        const isOutOfBounds = beyondRight || beyondLeft;
        
        const rubberBandedDate = applyRubberBand(targetDate, true); // true for wheel = stiffer
        const rubberBandedStartDate = rubberBandedDate.subtract({ days: 364 });
        const displayRange = `${rubberBandedStartDate.toString()} to ${rubberBandedDate.toString()}`;
        
        // Calculate the rubber-banded offset (where we visually are)
        const rubberBandedOffset = daysBetween(stateRef.current.startDate, rubberBandedDate);
        
        // Check if we're back within bounds after being out
        const nowInBounds = rubberBandedDate.compare(boundaries.latestDataDay) <= 0 &&
                           rubberBandedStartDate.compare(boundaries.earliestDataDay) >= 0;
        
        // If we were animating (spring back) but now we're in bounds, kill the animation
        if (animatingRef.current && nowInBounds) {
          console.log('🛑 SPRING CANCELLED: Back within bounds (wheel)');
          animatingRef.current = false;
          springApi.stop();
        }
        
        // Only log significant wheel movements to reduce noise
        if (Math.abs(dayOffset) > 1 || first || last) {
          // Calculate boundary offset when out of bounds
          let boundaryOffset: number | undefined;
          if (isOutOfBounds) {
            const targetBoundary = beyondRight ? boundaries.latestDataDay : boundaries.earliestDataEndDay;
            boundaryOffset = daysBetween(stateRef.current.startDate, targetBoundary);
          }
          
          console.log('🎡 WHEEL:', {
            offset: rubberBandedOffset.toFixed(0),
            boundary: boundaryOffset !== undefined ? boundaryOffset.toFixed(0) : undefined,
            rb: isOutOfBounds ? '🔴' : '',
            displayRange,
            ts: Date.now()
          });
        }
        
        // Update during wheel scrolling - use rubber-banded offset!
        springApi.start({ x: rubberBandedOffset, immediate: true });
        updateDateFromSpring(rubberBandedOffset, false); // false because we already applied rubber band
        
        if (last) {
          // Prevent duplicate processing of last event
          if (stateRef.current.wheelProcessedLast) return;
          stateRef.current.wheelProcessedLast = true;
          
          // Wheel ended - check if we need to spring back (just like drag)
          stateRef.current.isDragging = false;
          
          const outOfBounds = rubberBandedDate.compare(boundaries.latestDataDay) > 0 ||
                             rubberBandedStartDate.compare(boundaries.earliestDataDay) < 0;
          
          console.log('🏁 WHEEL END:', {
            displayRange,
            outOfBounds,
            ts: Date.now()
          });
          
          if (outOfBounds) {
            // Spring back to boundary (same as drag)
            const targetBoundary = rubberBandedDate.compare(boundaries.latestDataDay) > 0
              ? boundaries.latestDataDay
              : boundaries.earliestDataEndDay;
            
            const springTargetOffset = daysBetween(stateRef.current.startDate, targetBoundary);
            
            // Calculate the rubber-banded offset (where we visually are)
            const currentRubberBandedOffset = daysBetween(stateRef.current.startDate, rubberBandedDate);
            
            animatingRef.current = true;
            animationTargetRef.current = springTargetOffset;
            frameCountRef.current = 0;
            
            const boundaryStartDate = targetBoundary.subtract({ days: 364 });
            console.log('🚀 SPRING TO BOUNDARY (wheel):', {
              targetRange: `${boundaryStartDate.toString()} to ${targetBoundary.toString()}`,
              from: currentRubberBandedOffset,
              to: springTargetOffset,
              ts: Date.now()
            });
            
            // Use react-spring to animate to boundary
            springApi.stop();
            // First set the current position, then animate to target
            springApi.set({ x: currentRubberBandedOffset });
            
            console.log('🎯 Spring animation setup:', {
              currentPos: currentRubberBandedOffset,
              targetPos: springTargetOffset,
              startDate: stateRef.current.startDate.toString(),
              targetBoundary: targetBoundary.toString(),
              ts: Date.now()
            });
            
            springApi.start({
              to: { x: springTargetOffset },
              config: {
                ...config.default,
                clamp: true  // Clamp to prevent going past target
              },
              onRest: () => {
                animatingRef.current = false;
                const finalStartDate = targetBoundary.subtract({ days: 364 });
                const finalSpringValue = springProps.x.get();
                console.log('✅ SPRING COMPLETE (wheel):', {
                  finalRange: `${finalStartDate.toString()} to ${targetBoundary.toString()}`,
                  frames: frameCountRef.current,
                  finalSpringValue: Math.floor(finalSpringValue),
                  expectedTarget: springTargetOffset,
                  ts: Date.now()
                });
                // Only update if we're not already at the right position
                if (Math.abs(finalSpringValue - springTargetOffset) > 1) {
                  console.log('⚠️ Spring ended at wrong position, correcting...');
                  springApi.set({ x: springTargetOffset });
                  onDateNavigate(targetBoundary, false);
                }
                // DON'T reset the coordinate system - keep spring at its current position
                // The next gesture will reset it when it starts
              }
            });
          } else {
            // Within bounds - just update the position
            onDateNavigate(rubberBandedDate, false);
            // DON'T reset coordinate system here either - the next gesture will handle it
          }
        }
      },
      
      onPinch: ({ active, movement: [distance], velocity: [vd], last, first, event }) => {
        // Two-finger pinch gesture (touch)
        if (event) {
          event.preventDefault();
        }
        
        // Initialize startDate on first pinch event
        if (first) {
          stateRef.current.startDate = currentEndDate;
        }
        
        // Convert pinch distance to day offset
        const dayOffset = pixelsToDays(distance * 0.5);
        
        if (active) {
          springApi.start({ x: dayOffset, immediate: true });
          updateDateFromSpring(dayOffset, true);
          
          // Session management disabled
        } else if (last) {
          // Touch ended - apply momentum
          const velocityDays = pixelsToDays(vd * 50);
          
          // Session management disabled
          
          if (Math.abs(vd) > 0.1) {
            const momentumTarget = dayOffset + velocityDays;
            
            springApi.start({
              x: momentumTarget,
              config: { ...config.default, friction: 40 },
              onRest: () => {
                // Session management disabled
                const finalDate = stateRef.current.startDate.add({ days: Math.round(momentumTarget) });
                const boundaries = getDateBoundaries();
                const clampedDate = boundaries.clampEndDateToDisplayBounds(finalDate);
                onDateNavigate(clampedDate, false);
              },
            });
          } else {
            // Session management disabled
            const targetDate = stateRef.current.startDate.add({ days: Math.round(dayOffset) });
            const boundaries = getDateBoundaries();
            const clampedDate = boundaries.clampEndDateToDisplayBounds(targetDate);
            onDateNavigate(clampedDate, false);
          }
        }
      },
    },
    {
      drag: {
        from: () => {
          const currentX = springProps.x.get();
          console.log('🎯 Drag from position:', currentX);
          return [currentX, 0];
        },
        filterTaps: true,
        pointer: { touch: true },
      },
      wheel: {
        eventOptions: { passive: false }, // Allow preventDefault
      },
      pinch: {
        from: () => [springProps.x.get(), 0],
        pointer: { touch: true },
      },
    }
  );

  // Navigate to a specific date with animation
  const navigateToDate = useCallback((targetDate: CalendarDate, animate: boolean = true) => {
    const dayOffset = daysBetween(currentEndDate, targetDate);
    
    if (animate) {
      springApi.start({
        x: dayOffset,
        config: config.default,
        onRest: () => {
          onDateNavigate(targetDate, false);
        },
      });
    } else {
      springApi.start({ x: dayOffset, immediate: true });
      onDateNavigate(targetDate, false);
    }
  }, [currentEndDate, onDateNavigate, springApi]);

  return {
    bind,
    elementRef,
    navigateToDate,
  };
}