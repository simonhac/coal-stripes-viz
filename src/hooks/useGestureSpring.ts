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
  const applyRubberBand = useCallback((targetDate: CalendarDate): CalendarDate => {
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
    
    // Logarithmic rubber band
    const rubberBandDays = maxStretch * DATE_NAV_PHYSICS.RUBBER_BAND.SCALE_FACTOR * 
                          Math.log(1 + Math.abs(overshoot) / maxStretch) * 
                          Math.sign(overshoot);
    
    if (beyondRight) {
      return boundaryDate.add({ days: Math.ceil(rubberBandDays) });
    } else {
      return boundaryDate.subtract({ days: Math.floor(-rubberBandDays) });
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
        // Calculate what date this spring value represents (with rubber band during animation)
        const targetDate = stateRef.current.startDate.add({ days: Math.round(value.x) });
        // During spring animation, we're not dragging so no rubber band is applied
        const clampedDate = getDateBoundaries().clampEndDateToDisplayBounds(targetDate);
        const startDate = clampedDate.subtract({ days: 364 });
        console.log(`🔄 Spring frame ${frameCountRef.current}:`, {
          x: value.x.toFixed(2),
          displayRange: `${startDate.toString()} to ${clampedDate.toString()}`
        });
        updateDateFromSpring(value.x, false);
      }
    }
  }));
  
  // Track animation state
  const animatingRef = useRef(false);
  const animationTargetRef = useRef(0);
  
  // Poll spring value during animation
  useEffect(() => {
    let lastValue: number | null = null;
    let pollFrames = 0;
    const pollInterval = setInterval(() => {
      if (animatingRef.current && !stateRef.current.isDragging) {
        const currentValue = springProps.x.get();
        if (lastValue === null || Math.abs(currentValue - lastValue) > 0.01) {
          pollFrames++;
          console.log(`📍 Poll frame ${pollFrames}: spring.x =`, currentValue.toFixed(2), 'target =', animationTargetRef.current);
          lastValue = currentValue;
          
          // Check if we've reached the target
          if (Math.abs(currentValue - animationTargetRef.current) < 0.1) {
            console.log('📍 Polling detected target reached');
          }
        }
      } else if (!animatingRef.current) {
        pollFrames = 0;
        lastValue = null;
      }
    }, 16); // ~60fps
    
    return () => clearInterval(pollInterval);
  }, [springProps.x]);
  
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
            
            // Manual animation because react-spring has issues with our coordinate system
            // The spring wants to rest at 0, but we need it to animate to a different target
            // This bypasses react-spring's physics and uses direct interpolation
            springApi.stop();
            
            // Calculate the rubber-banded offset (where we visually are)
            const rubberBandedOffset = daysBetween(stateRef.current.startDate, rubberBandedDate);
            const startValue = rubberBandedOffset; // Where we visually are now (after rubber band)
            const endValue = springTargetOffset; // Where we want to be
            const startTime = Date.now();
            const duration = 400; // 400ms animation
            
            const animate = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              
              // Ease-out cubic for smooth deceleration
              const eased = 1 - Math.pow(1 - progress, 3);
              const currentValue = startValue + (endValue - startValue) * eased;
              
              // Set the spring value directly
              springApi.set({ x: currentValue });
              
              if (progress < 1 && animatingRef.current) {
                requestAnimationFrame(animate);
              } else {
                // Animation complete
                animatingRef.current = false;
                const finalStartDate = targetBoundary.subtract({ days: 364 });
                console.log('✅ SPRING COMPLETE:', {
                  finalRange: `${finalStartDate.toString()} to ${targetBoundary.toString()}`,
                  frames: frameCountRef.current
                });
                // Ensure we're exactly at the boundary
                onDateNavigate(targetBoundary, false);
                stateRef.current.startDate = targetBoundary;
                // Reset spring for next gesture
                springApi.set({ x: 0 });
              }
            };
            
            requestAnimationFrame(animate);
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
        // Use delta for more responsive control
        // Check if this is primarily horizontal scrolling based on the current delta
        const isHorizontal = Math.abs(dx) > Math.abs(dy) * 0.5;
        
        // For horizontal, use accumulated movement but scale it up significantly
        // For vertical, use accumulated movement with moderate scaling
        const movement = isHorizontal ? -mx * 10 : -my * 1; // Halved sensitivity
        
        // Initialize startDate on first wheel event
        if (first) {
          stateRef.current.startDate = currentEndDate;
        }
        
        // Use the movement we calculated above
        const dayOffset = pixelsToDays(movement);
        
        // Don't update if the offset is 0 or very small to avoid unnecessary renders
        if (Math.abs(dayOffset) < 0.01) return;
        
        // Calculate the target date to check if we're at boundaries
        const targetDate = stateRef.current.startDate.add({ days: Math.round(dayOffset) });
        const boundaries = getDateBoundaries();
        
        // If we're already at a boundary and trying to go further, don't update
        if (lastUpdatedDateRef.current) {
          const isAtRightBoundary = lastUpdatedDateRef.current.compare(boundaries.latestDataDay) >= 0;
          const isAtLeftBoundary = lastUpdatedDateRef.current.compare(boundaries.earliestDataEndDay) <= 0;
          
          if ((isAtRightBoundary && dayOffset > 0) || (isAtLeftBoundary && dayOffset < 0)) {
            return; // Don't update if we're stuck at a boundary
          }
        }
        
        // Update during wheel scrolling
        springApi.start({ x: dayOffset, immediate: true }); // Set immediately during wheel scroll
        updateDateFromSpring(dayOffset, true);
        
        if (last) {
          // Wheel ended
          const targetDate = stateRef.current.startDate.add({ days: Math.round(dayOffset) });
          const boundaries = getDateBoundaries();
          const clampedDate = boundaries.clampEndDateToDisplayBounds(targetDate);
          onDateNavigate(clampedDate, false);
          
          // Reset for next wheel gesture
          stateRef.current.startDate = clampedDate;
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