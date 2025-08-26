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
  
  // Track if we're actively dragging or animating to prevent update loops
  const isDraggingRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const lastUpdateRef = useRef<number>(0);
  const wheelAccumulatedRef = useRef<number>(0);
  
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
  
  // Spring for smooth animations with onChange to update date during animation
  const [springProps, springApi] = useSpring(() => ({
    x: 0,
    config: config.default,
    onChange: (result) => {
      // Only update during spring animation, not during direct sets or dragging
      if (result.value.x !== undefined && isAnimatingRef.current) {
        const animatedDays = Math.round(result.value.x);
        const animatedDate = startDateRef.current.add({ days: animatedDays });
        const clampedDate = boundaries.clampEndDateToDisplayBounds(animatedDate);
        
        // Throttle updates during animation
        const now = Date.now();
        if (now - lastUpdateRef.current > 16) { // ~60fps
          lastUpdateRef.current = now;
          onDateNavigate(clampedDate, false);
        }
      }
    }
  }));
  
  
  // Convert pixel offset to days
  const pixelsToDays = useCallback((pixels: number): number => {
    // Get the actual width of the tile canvas
    const tileCanvas = document.querySelector('.opennem-facility-canvas');
    if (!tileCanvas) {
      console.error('Could not find tile canvas element');
      return 0;
    }
    const tileWidth = tileCanvas.getBoundingClientRect().width;
    return -(pixels / tileWidth) * 365;
  }, []);
  
  // Set up unified gesture handling with built-in bounds and rubberband
  const bind = useGesture(
    {
      onDrag: ({ offset: [ox], active, last, first, velocity: [vx] }) => {
        if (first) {
          // Update start position to current position when drag starts
          startDateRef.current = currentEndDate;
          if (featureFlags.get('gestureLogging')) {
            console.log('🎬 DRAG START:', {
              range: `${currentEndDate.subtract({ days: 364 }).toString()} to ${currentEndDate.toString()}`,
              ts: Date.now()
            });
          }
        }
        
        // Convert pixel offset to days and round
        const dayOffset = Math.round(pixelsToDays(ox));
        
        if (active) {
          isDraggingRef.current = true;
          // During drag, update immediately
          springApi.set({ x: dayOffset });
          
          // Throttle updates to prevent overwhelming React
          const now = Date.now();
          if (now - lastUpdateRef.current > 16) { // ~60fps
            lastUpdateRef.current = now;
            // Update the date for smooth tracking
            const targetDate = startDateRef.current.add({ days: Math.round(dayOffset) });
            const clampedDate = boundaries.clampEndDateToDisplayBounds(targetDate);
            onDateNavigate(clampedDate, true);
          }
          
          // Log drag movement
          const logTarget = startDateRef.current.add({ days: Math.round(dayOffset) });
          const logClamped = boundaries.clampEndDateToDisplayBounds(logTarget);
          const startDate = logClamped.subtract({ days: 364 });
          
          // Determine mode based on position and rubber band state
          let mode = 'normal';
          // Check if raw position would be out of bounds (rubber band is modifying it)
          const rawDayOffset = Math.round(pixelsToDays(ox));
          const rawTarget = startDateRef.current.add({ days: rawDayOffset });
          const isRawOutOfBounds = rawTarget.compare(boundaries.latestDataDay) > 0 || 
                                   rawTarget.subtract({ days: 364 }).compare(boundaries.earliestDataDay) < 0;
          
          // If raw is out of bounds but we're getting a different offset, rubber band is active
          if (isRawOutOfBounds && rawDayOffset !== dayOffset) {
            mode = 'rubber';
          }
          
          // Calculate overstep for drag
          const clampedDayOffset = daysBetween(startDateRef.current, logClamped);
          const overstep = isRawOutOfBounds ? dayOffset - clampedDayOffset : 0;
          
          if (featureFlags.get('gestureLogging')) {
            console.log('✊ DRAG: ', {
              range: `${startDate.toString()} to ${logClamped.toString()}`,
              offset: dayOffset,
              raw: rawDayOffset,
              mode,
              overstep,
              ts: Date.now()
            });
          }
        } else if (last) {
          isDraggingRef.current = false;
          
          // Send final position
          const finalTarget = startDateRef.current.add({ days: Math.round(dayOffset) });
          const finalClamped = boundaries.clampEndDateToDisplayBounds(finalTarget);
          onDateNavigate(finalClamped, false);
          
          // Check if we'll spring back
          const willSpringBack = finalTarget.compare(boundaries.latestDataDay) > 0 || 
                                finalTarget.subtract({ days: 364 }).compare(boundaries.earliestDataDay) < 0;
          
          if (featureFlags.get('gestureLogging')) {
            console.log('🏁 DRAG END:', {
              offset: Math.round(dayOffset),
              velocity: vx,
              springBack: willSpringBack,
              momentum: Math.abs(vx) > 0.2,
              ts: Date.now()
            });
          }
          
          // Apply momentum if velocity is significant
          if (Math.abs(vx) > 0.2) {
            const velocityDays = pixelsToDays(vx * 100);
            const momentumTarget = dayOffset + velocityDays;
            
            springApi.start({
              to: { x: momentumTarget },
              config: { ...config.default, friction: 50 }
            });
          }
        }
      },
      
      onWheel: ({ delta: [dx, dy], active, last, first, direction: [dirX, dirY] }) => {
        // Only process and log horizontal scrolling
        if (Math.abs(dirX) <= Math.abs(dirY)) {
          return; // Vertical scroll, ignore
        }
        
        if (first) {
          // Reset accumulated offset when wheel starts
          wheelAccumulatedRef.current = 0;
          startDateRef.current = currentEndDate;
          const tileCanvas = document.querySelector('.opennem-facility-canvas');
          const tileWidth = tileCanvas ? tileCanvas.getBoundingClientRect().width : 0;
          if (featureFlags.get('gestureLogging')) {
            console.log('🎡 WHEEL START:', {
              range: `${currentEndDate.subtract({ days: 364 }).toString()} to ${currentEndDate.toString()}`,
              maxDaysForward,
              maxDaysBack,
              tileWidth,
              expectedMaxPixels: maxDaysForward * (tileWidth / 365),
              ts: Date.now()
            });
          }
        }
        
        // Accumulate the delta ourselves to avoid reset issues
        // With axis: 'lock', dx should be the locked horizontal value
        // Reverse it for natural scrolling direction
        wheelAccumulatedRef.current += -dx;
        let dayOffset = Math.round(pixelsToDays(wheelAccumulatedRef.current));
        
        // Manually apply rubber band effect for wheel since built-in isn't working
        // Only clamp the portion that's beyond bounds
        const targetDate = startDateRef.current.add({ days: dayOffset });
        const clampedDate = boundaries.clampEndDateToDisplayBounds(targetDate);
        const clampedDayOffset = daysBetween(startDateRef.current, clampedDate);
        
        // If we're beyond bounds, apply rubber band effect
        if (dayOffset !== clampedDayOffset) {
          const excessDays = dayOffset - clampedDayOffset;
          // Much stiffer rubber band for wheel - only allow 30 days excess
          const MAX_EXCESS_DAYS = 30;
          // Apply exponential decay to make it harder to push further
          const resistance = Math.pow(0.3, Math.abs(excessDays) / 100);
          const clampedExcess = Math.sign(excessDays) * Math.min(Math.abs(excessDays) * resistance, MAX_EXCESS_DAYS);
          dayOffset = clampedDayOffset + clampedExcess;
        }
        
        // Update spring position
        springApi.set({ x: dayOffset });
        
        // Throttle date updates during wheel
        const now = Date.now();
        if (now - lastUpdateRef.current > 16) { // ~60fps throttle
          lastUpdateRef.current = now;
          
          // Update the date  
          const updateTarget = startDateRef.current.add({ days: Math.round(dayOffset) });
          const updateClamped = boundaries.clampEndDateToDisplayBounds(updateTarget);
          onDateNavigate(updateClamped, true);
        }
        
        // Log wheel movement with debug info
        const logTarget = startDateRef.current.add({ days: Math.round(dayOffset) });
        const logClamped = boundaries.clampEndDateToDisplayBounds(logTarget);
        const startDate = logClamped.subtract({ days: 364 });
        const isOutOfBounds = logTarget.compare(boundaries.latestDataDay) > 0 || 
                             startDate.compare(boundaries.earliestDataDay) < 0;
        
        // Determine mode (normal or rubber)
        let mode = 'normal';
        if (dayOffset !== clampedDayOffset) {
          mode = 'rubber';
        }
        
        // Calculate overstep (how many days beyond bounds)
        const overstep = isOutOfBounds ? dayOffset - clampedDayOffset : 0;
        
        // Debug: log raw offset vs day offset
        if (featureFlags.get('gestureLogging')) {
          console.log('🎡 WHEEL: ', {
            range: `${startDate.toString()} to ${logClamped.toString()}`,
            offset: dayOffset,
            raw: Math.round(wheelAccumulatedRef.current),
            mode,
            maxDays: maxDaysForward,
            boundary: isOutOfBounds ? dayOffset : undefined,
            overstep,
            ts: Date.now()
          });
        }
        
        if (last) {
          // When wheel ends, spring back to valid position if we're out of bounds
          const targetDate = startDateRef.current.add({ days: Math.round(dayOffset) });
          const clampedDate = boundaries.clampEndDateToDisplayBounds(targetDate);
          
          // Check if we're out of bounds
          const isOutOfBounds = targetDate.compare(boundaries.latestDataDay) > 0 || 
                               targetDate.subtract({ days: 364 }).compare(boundaries.earliestDataDay) < 0;
          
          if (isOutOfBounds) {
            // Calculate the clamped position in days relative to start
            const clampedDayOffset = daysBetween(startDateRef.current, clampedDate);
            
            // Enable animation mode and spring back with heavy damping
            isAnimatingRef.current = true;
            springApi.start({
              to: { x: clampedDayOffset },
              config: { 
                tension: 300,  // Stiffer spring
                friction: 40,  // More friction
                clamp: true    // Prevent overshoot
              },
              onRest: () => {
                isAnimatingRef.current = false;
              }
            });
          } else {
            // We're in bounds, just update final position
            onDateNavigate(clampedDate, false);
          }
          
          if (featureFlags.get('gestureLogging')) {
            console.log('🏁 WHEEL END:', {
              range: `${clampedDate.subtract({ days: 364 }).toString()} to ${clampedDate.toString()}`,
              ts: Date.now()
            });
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
        from: () => [0, 0], // Always start from current position
        axis: 'x', // Only allow horizontal dragging
      },
      wheel: {
        axis: 'lock', // Lock to initial movement direction (horizontal or vertical)
      }
    }
  );
  
  return { bind, elementRef };
}