import { useRef, useCallback, useEffect } from 'react';
import { useSpring, config } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';
import { CalendarDate } from '@internationalized/date';
import { getDateBoundaries } from '@/shared/date-boundaries';
import { getDaysBetween as daysBetween } from '@/shared/date-utils';
import { featureFlags } from '@/shared/feature-flags';

interface GestureSpringOptions {
  currentEndDate: CalendarDate;
  onDateNavigate: (date: CalendarDate, isDragging: boolean) => void;
}

/**
 * Simplified gesture handling using @use-gesture's built-in bounds and rubberband
 */
export function useGestureSpring({
  currentEndDate,
  onDateNavigate,
}: GestureSpringOptions) {
  const elementRef = useRef<HTMLDivElement>(null);
  const startDateRef = useRef<CalendarDate>(currentEndDate);
  
  // Calculate bounds based on date boundaries
  const boundaries = getDateBoundaries();
  // Maximum days we can scroll forward (negative pixels) or back (positive pixels) from current position
  const maxDaysForward = daysBetween(currentEndDate, boundaries.latestDataDay);
  const maxDaysBack = daysBetween(boundaries.earliestDataEndDay, currentEndDate);
  
  // Track if we're actively dragging or animating
  const isDraggingRef = useRef(false);
  const animatingRef = useRef(false);
  const lastUpdateRef = useRef<number>(0);
  
  // Prevent browser navigation on horizontal scroll
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Only prevent if it's primarily horizontal scrolling
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.deltaX !== 0) {
        e.preventDefault();
      }
    };
    
    // Add at window level with passive: false to allow preventDefault
    window.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);
  
  // Spring for smooth animations
  const [springProps, springApi] = useSpring(() => ({
    x: 0,
    config: config.default,
    onChange: (result) => {
      // Update date during spring animation (momentum)
      if (result.value.x !== undefined && animatingRef.current) {
        const animatedDays = Math.round(result.value.x);
        const animatedDate = startDateRef.current.add({ days: animatedDays });
        const clampedDate = boundaries.clampEndDateToDisplayBounds(animatedDate);
        
        // Debug spring animation
        const startDate = clampedDate.subtract({ days: 364 });
        console.log('🌊 SPRNG:', {
          range: `${startDate.toString()} to ${clampedDate.toString()}`,
          x: Math.round(result.value.x * 1000) / 1000,
          animatedDays,
          ts: Date.now()
        });
        
        onDateNavigate(clampedDate, false);
      }
    }
  }));
  
  
  // Convert pixel offset to days (rounded immediately)
  const pixelsToDays = useCallback((pixels: number): number => {
    // Get the actual width of the tile canvas
    const tileCanvas = document.querySelector('.opennem-facility-canvas');
    if (!tileCanvas) {
      console.error('Could not find tile canvas element');
      return 0;
    }
    const tileWidth = tileCanvas.getBoundingClientRect().width;
    // Round immediately to avoid fractional days
    return Math.round(-(pixels / tileWidth) * 365);
  }, []);
  
  // Set up unified gesture handling with built-in bounds and rubberband
  const bind = useGesture(
    {
      onDrag: ({ offset: [ox], active, last, first, velocity: [vx], movement: [mx] }) => {
        if (first) {
          // Update start position to current position when drag starts
          startDateRef.current = currentEndDate;
          isDraggingRef.current = true;
          if (featureFlags.get('gestureLogging')) {
            console.log('🎬 DRAG START:', {
              range: `${currentEndDate.subtract({ days: 364 }).toString()} to ${currentEndDate.toString()}`,
              ts: Date.now()
            });
          }
        }
        
        // Convert pixel movement to days (already rounded in pixelsToDays)
        const dayOffset = pixelsToDays(mx);
        
        if (active) {
          // During drag, directly update date without spring animation
          // Throttle updates to prevent overwhelming React
          const now = Date.now();
          if (now - lastUpdateRef.current > 16) { // ~60fps
            lastUpdateRef.current = now;
            // Update the date for smooth tracking
            const targetDate = startDateRef.current.add({ days: dayOffset });
            const clampedDate = boundaries.clampEndDateToDisplayBounds(targetDate);
            onDateNavigate(clampedDate, true);
            
            // Keep spring in sync with drag position (but don't animate)
            springApi.set({ x: dayOffset });
          }
          
          // Log drag movement
          const logTarget = startDateRef.current.add({ days: dayOffset });
          const logClamped = boundaries.clampEndDateToDisplayBounds(logTarget);
          const startDate = logClamped.subtract({ days: 364 });
          
          // Calculate overstep (how many days past the boundary we are showing)
          const maxForward = daysBetween(startDateRef.current, boundaries.latestDataDay);
          const maxBackward = daysBetween(boundaries.earliestDataEndDay, startDateRef.current);
          let overstep = 0;
          let mode = 'normal';
          
          if (dayOffset > maxForward) {
            overstep = dayOffset - maxForward;
            mode = 'rubber';
          } else if (dayOffset < -maxBackward) {
            overstep = Math.abs(dayOffset + maxBackward);
            mode = 'rubber';
          }
          
          if (featureFlags.get('gestureLogging')) {
            console.log('✊ DRAG: ', {
              range: `${startDate.toString()} to ${logClamped.toString()}`,
              offset: dayOffset,
              mode,
              overstep,
              ts: Date.now()
            });
          }
        } else if (last) {
          isDraggingRef.current = false;
          
          // Final position based on movement (already rounded in pixelsToDays)
          const finalOffset = pixelsToDays(mx);
          const finalTarget = startDateRef.current.add({ days: finalOffset });
          const finalClamped = boundaries.clampEndDateToDisplayBounds(finalTarget);
          
          // Check if we need to spring back from out of bounds
          const isOutOfBounds = finalTarget.compare(boundaries.latestDataDay) > 0 || 
                                finalTarget.subtract({ days: 364 }).compare(boundaries.earliestDataDay) < 0;
          
          if (featureFlags.get('gestureLogging')) {
            console.log('🏁 DRAG END:', {
              offset: finalOffset,
              velocity: vx,
              springBack: isOutOfBounds,
              momentum: Math.abs(vx) > 0.2,
              ts: Date.now()
            });
          }
          
          if (isOutOfBounds) {
            // Spring back to boundary smoothly
            const clampedOffset = daysBetween(startDateRef.current, finalClamped);
            animatingRef.current = true;
            springApi.start({
              to: { x: clampedOffset },
              config: { tension: 200, friction: 30 },
              onRest: () => {
                animatingRef.current = false;
              }
            });
          } else if (Math.abs(vx) > 0.2) {  // Lower threshold for touch
            // Apply momentum with smooth spring animation
            // Debug: let's see what we're getting (always log this for now)
            console.log('🔍 MOMENTUM DEBUG:', {
              movement_mx: mx,
              finalOffset,
              velocity_vx: vx,
              dragDirection: Math.sign(finalOffset),
              velocityDirection: Math.sign(vx),
            });
            
            // Velocity convention: positive vx when dragging right (backward in time)
            // Movement convention: negative offset when going backward in time
            // We want momentum to continue in the same direction as the drag
            const momentumScale = 300; // Scale for touch momentum
            const tileCanvas = document.querySelector('.opennem-facility-canvas');
            const tileWidth = tileCanvas ? tileCanvas.getBoundingClientRect().width : 1000;
            
            // Use the drag direction to determine momentum direction
            // If we were going backward (negative offset), continue backward
            const dragDirection = Math.sign(finalOffset) || -1; // Default to backward if zero
            const momentumPixels = Math.abs(vx) * momentumScale * dragDirection;
            const momentumDays = Math.round((momentumPixels / tileWidth) * 365);
            const momentumTarget = finalOffset + momentumDays;
            
            // Clamp to boundaries
            const maxForward = daysBetween(startDateRef.current, boundaries.latestDataDay);
            const maxBackward = -daysBetween(boundaries.earliestDataEndDay, startDateRef.current);
            const clampedMomentumTarget = Math.max(maxBackward, Math.min(maxForward, momentumTarget));
            
            if (featureFlags.get('gestureLogging')) {
              console.log('🚀 MOMENTUM:', {
                velocity: vx,
                momentumDays,
                from: finalOffset,
                to: clampedMomentumTarget,
                ts: Date.now()
              });
            }
            
            // Animate to momentum target with physics-based spring
            const currentRange = startDateRef.current.add({ days: finalOffset });
            const targetRange = startDateRef.current.add({ days: clampedMomentumTarget });
            
            console.log('🎯 Starting spring animation:', {
              currentRange: `${currentRange.subtract({ days: 364 }).toString()} to ${currentRange.toString()}`,
              targetRange: `${targetRange.subtract({ days: 364 }).toString()} to ${targetRange.toString()}`,
              from: finalOffset,
              to: clampedMomentumTarget,
              currentSpringValue: springProps.x.get()
            });
            
            // The spring should already be at finalOffset from the drag
            // Just animate to the momentum target
            animatingRef.current = true;
            
            console.log('🚀 STARTING SPRING:', {
              currentX: springProps.x.get(),
              targetX: clampedMomentumTarget,
              animating: animatingRef.current
            });
            
            springApi.start({
              to: { x: clampedMomentumTarget },
              config: { 
                tension: 170,
                friction: 26,
                mass: 1
              },
              onRest: (result) => {
                animatingRef.current = false;
                console.log('🏁 Spring animation complete:', {
                  finalX: result.value.x,
                  targetWas: clampedMomentumTarget,
                  finished: result.finished,
                  cancelled: result.cancelled
                });
              },
              onStart: () => {
                console.log('🏁 Spring animation actually started');
              }
            });
          } else {
            // Just update to final position
            onDateNavigate(finalClamped, false);
            // Don't reset spring here - let it stay at drag position
          }
        }
      },
      
      onWheel: ({ delta: [dx, dy], active, last, first, direction: [dirX, dirY], movement: [mx] }) => {
        // Only process and log horizontal scrolling
        if (Math.abs(dirX) <= Math.abs(dirY)) {
          return; // Vertical scroll, ignore
        }
        
        if (first) {
          startDateRef.current = currentEndDate;
          if (featureFlags.get('gestureLogging')) {
            console.log('🎡 WHEEL START:', {
              range: `${currentEndDate.subtract({ days: 364 }).toString()} to ${currentEndDate.toString()}`,
              ts: Date.now()
            });
          }
        }
        
        // Convert movement to days (already rounded in pixelsToDays)
        const rawDayOffset = pixelsToDays(-mx);
        
        // Calculate the target date and clamp it immediately
        const targetDate = startDateRef.current.add({ days: rawDayOffset });
        const clampedDate = boundaries.clampEndDateToDisplayBounds(targetDate);
        
        // Calculate how many days we can actually move from start
        const maxDaysForward = daysBetween(startDateRef.current, boundaries.latestDataDay);
        const maxDaysBackward = daysBetween(boundaries.earliestDataEndDay, startDateRef.current);
        
        // Strictly limit the offset to valid bounds plus small rubber band
        let finalOffset = rawDayOffset;
        const RUBBER_BAND_DAYS = 10;
        
        if (rawDayOffset > maxDaysForward) {
          // Going too far forward - apply rubber band
          const excess = rawDayOffset - maxDaysForward;
          const rubberBand = Math.min(excess * 0.1, RUBBER_BAND_DAYS);
          finalOffset = maxDaysForward + Math.round(rubberBand);
        } else if (rawDayOffset < -maxDaysBackward) {
          // Going too far backward - apply rubber band
          const excess = Math.abs(rawDayOffset + maxDaysBackward);
          const rubberBand = Math.min(excess * 0.1, RUBBER_BAND_DAYS);
          finalOffset = -maxDaysBackward - Math.round(rubberBand);
        }
        
        // Update during active wheel
        if (active) {
          const now = Date.now();
          if (now - lastUpdateRef.current > 16) { // Throttle to ~60fps
            lastUpdateRef.current = now;
            
            // Calculate display date with rubber band applied
            const displayDate = startDateRef.current.add({ days: finalOffset });
            const displayClamped = boundaries.clampEndDateToDisplayBounds(displayDate);
            onDateNavigate(displayClamped, true);
            
            if (featureFlags.get('gestureLogging')) {
              const range = `${displayClamped.subtract({ days: 364 }).toString()} to ${displayClamped.toString()}`;
              const overstep = Math.abs(finalOffset) > Math.abs(rawDayOffset) ? 0 :
                              finalOffset > maxDaysForward ? finalOffset - maxDaysForward :
                              finalOffset < -maxDaysBackward ? Math.abs(finalOffset + maxDaysBackward) : 0;
              console.log('🎡 WHEEL: ', {
                range,
                offset: finalOffset,
                overstep,
                ts: now
              });
            }
          }
        }
        
        if (last) {
          // Snap back to the valid boundary if we were rubber banding
          const wasRubberBanding = finalOffset > maxDaysForward || finalOffset < -maxDaysBackward;
          
          if (wasRubberBanding) {
            // Snap back to the actual boundary (not including rubber band)
            const snapBackOffset = finalOffset > maxDaysForward ? maxDaysForward : -maxDaysBackward;
            const snapBackDate = startDateRef.current.add({ days: snapBackOffset });
            const snapBackClamped = boundaries.clampEndDateToDisplayBounds(snapBackDate);
            onDateNavigate(snapBackClamped, false);
            
            if (featureFlags.get('gestureLogging')) {
              console.log('🏁 WHEEL END (snapped back):', {
                range: `${snapBackClamped.subtract({ days: 364 }).toString()} to ${snapBackClamped.toString()}`,
                ts: Date.now()
              });
            }
          } else {
            // We're within bounds, stay where we are but update isDragging to false
            const finalDate = startDateRef.current.add({ days: finalOffset });
            const finalClamped = boundaries.clampEndDateToDisplayBounds(finalDate);
            onDateNavigate(finalClamped, false); // Important: set isDragging to false
            
            if (featureFlags.get('gestureLogging')) {
              console.log('🏁 WHEEL END:', {
                range: `${finalClamped.subtract({ days: 364 }).toString()} to ${finalClamped.toString()}`,
                ts: Date.now()
              });
            }
          }
        }
      }
    },
    {
      drag: {
        bounds: () => {
          // Calculate bounds dynamically when gesture starts
          const tileCanvas = document.querySelector('.opennem-facility-canvas');
          if (!tileCanvas) {
            return { left: 0, right: 0 };
          }
          const tileWidth = tileCanvas.getBoundingClientRect().width;
          return {
            // Pixel bounds: negative pixels go forward in time, positive pixels go back
            left: -maxDaysForward * (tileWidth / 365), // Max forward (future) - negative pixels
            right: maxDaysBack * (tileWidth / 365)     // Max back (past) - positive pixels
          };
        },
        rubberband: true, // Enable elastic effect
        axis: 'x', // Only allow horizontal dragging
      },
      wheel: {
        axis: 'lock', // Lock to initial movement direction (horizontal or vertical)
      }
    }
  );
  
  return { bind, elementRef };
}