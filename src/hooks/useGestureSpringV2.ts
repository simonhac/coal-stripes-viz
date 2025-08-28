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
 * Absolute positioning approach: Spring value represents days since earliest date
 * This avoids relative offset issues and spring resets
 */
export function useGestureSpring({
  currentEndDate,
  onDateNavigate,
}: GestureSpringOptions) {
  const elementRef = useRef<HTMLDivElement>(null);
  
  // Get boundaries dynamically
  const boundaries = getDateBoundaries();
  const EARLIEST_DATE = boundaries.earliestDataDay;
  const LATEST_DATE = boundaries.latestDataDay;
  const TOTAL_DAYS = Math.round(daysBetween(EARLIEST_DATE, LATEST_DATE));
  
  // Valid display bounds (where we can show a full year of data) - work with integers throughout
  const MIN_VALID_POSITION = Math.round(daysBetween(EARLIEST_DATE, boundaries.earliestDataEndDay)); // ~365
  const MAX_VALID_POSITION = Math.round(daysBetween(EARLIEST_DATE, boundaries.latestDataDay));       // TOTAL_DAYS
  
  // Initial position based on current date - as integer
  const initialPosition = Math.round(daysBetween(EARLIEST_DATE, currentEndDate));
  
  // Track if we're actively dragging or animating
  const isDraggingRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const justFinishedDragRef = useRef(false);
  
  // Track last position to prevent duplicate renders - integer
  const lastPositionRef = useRef<number>(initialPosition);
  // Track the current drag position separately
  const currentDragPositionRef = useRef<number>(initialPosition);
  
  // Spring for momentum/snapback animations ONLY - not used during drag
  const [{ momentum }, springApi] = useSpring(() => ({
    momentum: 0,
    config: config.default,
    onChange: ({ value }) => {
      // Only process if we have meaningful momentum
      const MOMENTUM_THRESHOLD = 0.01; // Ignore tiny momentum values to prevent jitter
      if (value.momentum !== undefined && Math.abs(value.momentum) > MOMENTUM_THRESHOLD) {
        // Apply momentum as offset from wherever we are now
        const currentPosition = lastPositionRef.current;
        const targetPosition = currentPosition + Math.round(value.momentum);
        
        // Skip if position hasn't changed
        if (targetPosition === lastPositionRef.current) {
          return;
        }
        
        // Update position and navigate
        lastPositionRef.current = targetPosition;
        const endDate = EARLIEST_DATE.add({ days: targetPosition });
        const clampedDate = boundaries.clampEndDateToDisplayBounds(endDate);
        
        // Debug logging
        if (featureFlags.get('gestureLogging')) {
          const startDate = clampedDate.subtract({ days: 364 });
          console.log('🌊 SPRNG:', {
            range: `${startDate.toString()} to ${clampedDate.toString()}`,
            position: targetPosition,
            momentum: value.momentum,
            ts: Date.now()
          });
        }
        
        onDateNavigate(clampedDate, false);
      }
    }
  }));
  
  // Update position when currentEndDate changes externally
  // ONLY do this for external navigation (keyboard, month clicks, etc)
  useEffect(() => {
    // NEVER update during drag or animation
    if (isDraggingRef.current || isAnimatingRef.current) {
      return;
    }
    
    // Also skip if we just finished dragging (prevents feedback loop)
    if (justFinishedDragRef.current) {
      justFinishedDragRef.current = false;
      return;
    }
    
    const newPosition = Math.round(daysBetween(EARLIEST_DATE, currentEndDate));
    
    // Only update if position actually changed
    if (newPosition !== lastPositionRef.current) {
      // This is an external navigation (like keyboard nav or month click)
      lastPositionRef.current = newPosition;
      // No spring to update - just track the position
    }
  }, [currentEndDate, EARLIEST_DATE]);
  
  // Convert pixel offset to days
  const pixelsToDays = useCallback((pixels: number): number => {
    const tileCanvas = document.querySelector('.opennem-facility-canvas');
    if (!tileCanvas) {
      console.error('Could not find tile canvas element');
      return 0;
    }
    const tileWidth = tileCanvas.getBoundingClientRect().width;
    // Positive pixels (drag right) = positive days
    // Negative pixels (drag left) = negative days
    const DAYS_PER_YEAR = 365; // One full tile width represents a year
    return Math.round((pixels / tileWidth) * DAYS_PER_YEAR);
  }, []);
  
  // Calculate maximum drag distance in pixels
  const calculateDragBounds = useCallback(() => {
    const tileCanvas = document.querySelector('.opennem-facility-canvas');
    if (!tileCanvas) return { left: -10000, right: 10000 }; // Fallback if canvas not found
    
    const tileWidth = tileCanvas.getBoundingClientRect().width;
    const DAYS_PER_YEAR = 365;
    const pixelsPerDay = tileWidth / DAYS_PER_YEAR;
    
    // Calculate how many days we can move from current position
    const currentPos = lastPositionRef.current;
    const daysToMin = currentPos - MIN_VALID_POSITION;
    const daysToMax = MAX_VALID_POSITION - currentPos;
    
    // Convert to pixels and add some buffer for elasticity
    const ELASTICITY_DAYS = 100; // Allow dragging 100 days past bounds for rubber-band effect
    return {
      left: -((daysToMax + ELASTICITY_DAYS) * pixelsPerDay),  // Negative because left drag is negative pixels
      right: (daysToMin + ELASTICITY_DAYS) * pixelsPerDay
    };
  }, [MIN_VALID_POSITION, MAX_VALID_POSITION]);
  
  // Prevent browser navigation on horizontal scroll
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.deltaX !== 0) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);
  
  // Set up unified gesture handling
  const bind = useGesture(
    {
      onDrag: ({ 
        active, 
        movement: [mx], 
        velocity: [vx], 
        first, 
        last,
        memo 
      }) => {
        if (first) {
          isDraggingRef.current = true;
          memo = lastPositionRef.current; // Store starting position from our tracked position
          currentDragPositionRef.current = memo; // Initialize current drag position
          
          if (featureFlags.get('gestureLogging')) {
            const startDate = EARLIEST_DATE.add({ days: memo });
            console.log('🎬 DRAG START:', {
              range: `${startDate.subtract({ days: 364 }).toString()} to ${startDate.toString()}`,
              position: memo,
              ts: Date.now()
            });
          }
        }
        
        // Calculate new position based on drag movement - all integers
        // Drag left (negative mx) = go forward in time = increase position
        // Drag right (positive mx) = go back in time = decrease position
        const dayDelta = pixelsToDays(mx);
        const newPosition = memo - dayDelta; // Subtract: left drag gives negative delta, subtracting increases position
        
        if (active) {
          // During drag: update date directly WITHOUT touching the spring
          // This prevents spring onChange from creating feedback loops
          if (newPosition !== lastPositionRef.current) {
            lastPositionRef.current = newPosition;
            currentDragPositionRef.current = newPosition; // Track where we actually are
            
            // Calculate date directly
            const endDate = EARLIEST_DATE.add({ days: newPosition });
            const clampedDate = boundaries.clampEndDateToDisplayBounds(endDate);
            
            // Navigate directly - DO NOT update spring during drag
            onDateNavigate(clampedDate, true);
          }
          
          if (featureFlags.get('gestureLogging')) {
            const dragDate = EARLIEST_DATE.add({ days: newPosition });
            const isOutOfBounds = newPosition < MIN_VALID_POSITION || newPosition > MAX_VALID_POSITION;
            console.log('✊ DRAG:', {
              range: `${dragDate.subtract({ days: 364 }).toString()} to ${dragDate.toString()}`,
              position: Math.round(newPosition),
              dayDelta,
              outOfBounds: isOutOfBounds,
              ts: Date.now()
            });
          }
        } else if (last) {
          isDraggingRef.current = false;
          justFinishedDragRef.current = true;
          
          // Use the tracked position
          const finalPosition = currentDragPositionRef.current;
          
          // Check if we're out of bounds
          const isOutOfBounds = finalPosition < MIN_VALID_POSITION || finalPosition > MAX_VALID_POSITION;
          const VELOCITY_THRESHOLD = 0.2; // Minimum velocity to trigger momentum animation
          const hasMomentum = Math.abs(vx) > VELOCITY_THRESHOLD;
          
          if (featureFlags.get('gestureLogging')) {
            console.log('🏁 DRAG END:', {
              position: Math.round(finalPosition),
              velocity: vx,
              outOfBounds: isOutOfBounds,
              momentum: !isOutOfBounds && hasMomentum,
              ts: Date.now()
            });
          }
          
          // No animation needed for normal drag without momentum
          if (!isOutOfBounds && !hasMomentum) {
            return memo;
          }
          
          if (isOutOfBounds) {
            // Spring back to nearest valid boundary
            isAnimatingRef.current = true;
            const targetPosition = finalPosition < MIN_VALID_POSITION 
              ? MIN_VALID_POSITION 
              : MAX_VALID_POSITION;
            
            const snapbackDistance = targetPosition - finalPosition;
            
            if (featureFlags.get('gestureLogging')) {
              console.log('🔙 SPRING BACK:', {
                from: Math.round(finalPosition),
                to: targetPosition,
                distance: snapbackDistance,
                ts: Date.now()
              });
            }
            
            // Animate using momentum spring (from 0 to snapback distance)
            springApi.start({
              from: { momentum: 0 },
              to: { momentum: snapbackDistance },
              config: { tension: 200, friction: 30 },
              onRest: () => {
                isAnimatingRef.current = false;
                springApi.set({ momentum: 0 }); // Reset momentum
                if (featureFlags.get('gestureLogging')) {
                  console.log('🏁 Spring back complete');
                }
              }
            });
          } else if (hasMomentum) { // Apply momentum if velocity exceeds threshold
            // Apply momentum
            isAnimatingRef.current = true;
            const tileCanvas = document.querySelector('.opennem-facility-canvas');
            const tileWidth = tileCanvas ? tileCanvas.getBoundingClientRect().width : 1000;
            const momentumScale = 300; // Pixels of momentum per unit velocity
            
            // Calculate momentum in days
            // Positive vx = dragging right = going back in time = decrease position
            const momentumPixels = vx * momentumScale;
            const DAYS_PER_YEAR = 365;
            const momentumDays = Math.round((momentumPixels / tileWidth) * DAYS_PER_YEAR);
            const targetPosition = finalPosition - momentumDays; // Subtract because positive vx means going back
            
            // Clamp to valid bounds
            const clampedTarget = Math.max(MIN_VALID_POSITION, Math.min(MAX_VALID_POSITION, targetPosition));
            const actualMomentum = clampedTarget - finalPosition;
            
            if (featureFlags.get('gestureLogging')) {
              console.log('🚀 MOMENTUM:', {
                velocity: vx,
                momentumDays: actualMomentum,
                from: Math.round(finalPosition),
                to: clampedTarget,
                ts: Date.now()
              });
            }
            
            // Start momentum animation (from 0 to momentum distance)
            springApi.start({
              from: { momentum: 0 },
              to: { momentum: actualMomentum },
              config: { tension: 170, friction: 26 },
              onRest: () => {
                isAnimatingRef.current = false;
                springApi.set({ momentum: 0 }); // Reset momentum
                if (featureFlags.get('gestureLogging')) {
                  console.log('🏁 Momentum complete');
                }
              }
            });
          }
        }
        
        return memo; // Return for next gesture
      },
      
      onWheel: ({ 
        delta: [dx, dy], 
        active, 
        first, 
        last,
        direction: [dirX, dirY],
        memo
      }) => {
        // Only process horizontal scrolling
        if (Math.abs(dirX) <= Math.abs(dirY)) return;
        
        if (first) {
          memo = lastPositionRef.current; // Use our tracked position
          if (featureFlags.get('gestureLogging')) {
            const startDate = EARLIEST_DATE.add({ days: memo });
            console.log('🎡 WHEEL START:', {
              range: `${startDate.subtract({ days: 364 }).toString()} to ${startDate.toString()}`,
              position: memo,
              ts: Date.now()
            });
          }
        }
        
        // Calculate scroll delta in days - integer result
        const SCROLL_SENSITIVITY = 0.5; // How many days per pixel of scroll (lower = less sensitive)
        const dayDelta = Math.round(dx * SCROLL_SENSITIVITY);
        const newPosition = memo + dayDelta; // Integer arithmetic
        
        // Apply bounds with some elasticity - all integers
        const ELASTIC_RANGE_DAYS = 30; // Max days of elasticity beyond bounds
        const ELASTICITY_FACTOR = 0.3; // How much of the overshoot is allowed (0-1)
        
        // Apply rubber band effect manually - integer math
        let finalPosition = newPosition;
        if (newPosition < MIN_VALID_POSITION) {
          const overshoot = MIN_VALID_POSITION - newPosition;
          finalPosition = MIN_VALID_POSITION - Math.min(Math.round(overshoot * ELASTICITY_FACTOR), ELASTIC_RANGE_DAYS);
        } else if (newPosition > MAX_VALID_POSITION) {
          const overshoot = newPosition - MAX_VALID_POSITION;
          finalPosition = MAX_VALID_POSITION + Math.min(Math.round(overshoot * ELASTICITY_FACTOR), ELASTIC_RANGE_DAYS);
        }
        
        if (active) {
          // During scroll: update date directly WITHOUT touching spring (like drag)
          if (finalPosition !== lastPositionRef.current) {
            lastPositionRef.current = finalPosition;
            
            // Calculate date directly
            const endDate = EARLIEST_DATE.add({ days: finalPosition });
            const clampedDate = boundaries.clampEndDateToDisplayBounds(endDate);
            
            // Navigate directly - DO NOT update spring during scroll
            onDateNavigate(clampedDate, false);
          }
          
          if (featureFlags.get('gestureLogging')) {
            const scrollDate = EARLIEST_DATE.add({ days: finalPosition });
            console.log('🎡 WHEEL:', {
              range: `${scrollDate.subtract({ days: 364 }).toString()} to ${scrollDate.toString()}`,
              position: finalPosition,
              dayDelta,
              ts: Date.now()
            });
          }
        }
        
        if (last) {
          // Spring back if out of bounds
          const isOutOfBounds = finalPosition < MIN_VALID_POSITION || finalPosition > MAX_VALID_POSITION;
          
          if (isOutOfBounds) {
            const targetPosition = finalPosition < MIN_VALID_POSITION 
              ? MIN_VALID_POSITION 
              : MAX_VALID_POSITION;
            
            const snapbackDistance = targetPosition - finalPosition;
            
            // Start spring-back animation using momentum spring
            springApi.start({
              from: { momentum: 0 },
              to: { momentum: snapbackDistance },
              config: { tension: 200, friction: 30 }
            });
          }
          
          if (featureFlags.get('gestureLogging')) {
            const roundedFinal = Math.round(finalPosition);
            console.log('🏁 WHEEL END:', {
              position: roundedFinal,
              springBack: isOutOfBounds,
              ts: Date.now()
            });
          }
        }
        
        return memo;
      }
    },
    {
      drag: {
        bounds: calculateDragBounds(), // Calculate bounds once at setup
        rubberband: 0.15, // 15% elasticity when dragging past bounds
        axis: 'x',
      },
      wheel: {
        axis: 'lock',
      }
    }
  );
  
  return { bind, elementRef };
}