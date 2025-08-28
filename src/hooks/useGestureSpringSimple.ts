import { useRef, useCallback, useEffect } from 'react';
import { useSpring } from '@react-spring/web';
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
 * Dead simple version - no spring during drag, only for momentum
 */
export function useGestureSpring({
  currentEndDate,
  onDateNavigate,
}: GestureSpringOptions) {
  const elementRef = useRef<HTMLDivElement>(null);
  
  // Get boundaries
  const boundaries = getDateBoundaries();
  const EARLIEST_DATE = boundaries.earliestDataDay;
  
  // Valid display bounds
  const MIN_VALID_POSITION = Math.round(daysBetween(EARLIEST_DATE, boundaries.earliestDataEndDay));
  const MAX_VALID_POSITION = Math.round(daysBetween(EARLIEST_DATE, boundaries.latestDataDay));
  
  // Track current position manually
  const currentPositionRef = useRef(Math.round(daysBetween(EARLIEST_DATE, currentEndDate)));
  
  // Update when date changes externally
  useEffect(() => {
    currentPositionRef.current = Math.round(daysBetween(EARLIEST_DATE, currentEndDate));
  }, [currentEndDate, EARLIEST_DATE]);
  
  // Convert pixels to days
  const pixelsToDays = useCallback((pixels: number): number => {
    const tileCanvas = document.querySelector('.opennem-facility-canvas');
    if (!tileCanvas) return 0;
    const tileWidth = tileCanvas.getBoundingClientRect().width;
    return Math.round((pixels / tileWidth) * 365);
  }, []);
  
  // Track the starting position for spring animations
  const springStartRef = useRef(currentPositionRef.current);
  
  // Simple spring for momentum only
  const [, springApi] = useSpring(() => ({
    x: 0,
    onChange: ({ value }) => {
      if (value.x && Math.abs(value.x) > 0.1) {
        // Apply offset from where the spring started
        const targetPosition = springStartRef.current + Math.round(value.x);
        const clampedPosition = Math.max(MIN_VALID_POSITION, Math.min(MAX_VALID_POSITION, targetPosition));
        
        if (clampedPosition !== currentPositionRef.current) {
          currentPositionRef.current = clampedPosition;
          const endDate = EARLIEST_DATE.add({ days: clampedPosition });
          const clampedDate = boundaries.clampEndDateToDisplayBounds(endDate);
          onDateNavigate(clampedDate, false);
        }
      }
    }
  }));
  
  // Set up gesture handling
  const bind = useGesture(
    {
      onDrag: ({ 
        active, 
        movement: [mx], 
        velocity: [vx], 
        first,
        memo 
      }) => {
        if (first) {
          const startPosition = currentPositionRef.current;
          if (featureFlags.get('gestureLogging')) {
            console.log('🎬 DRAG:', { start: startPosition });
          }
          return startPosition;
        }
        
        const startPosition = memo || currentPositionRef.current;
        const dayDelta = pixelsToDays(mx);
        const newPosition = startPosition - dayDelta; // Drag left = increase position
        
        if (active) {
          // Direct update during drag with elasticity at bounds
          let dragPosition = newPosition;
          
          // Apply rubber-band effect when dragging past bounds
          const ELASTIC_RANGE = 100; // Maximum days past bounds
          const ELASTIC_FACTOR = 0.3; // How much resistance (0-1, lower = more resistance)
          
          if (newPosition < MIN_VALID_POSITION) {
            const overshoot = MIN_VALID_POSITION - newPosition;
            const elasticOvershoot = Math.round(Math.min(overshoot * ELASTIC_FACTOR, ELASTIC_RANGE));
            dragPosition = MIN_VALID_POSITION - elasticOvershoot;
          } else if (newPosition > MAX_VALID_POSITION) {
            const overshoot = newPosition - MAX_VALID_POSITION;
            const elasticOvershoot = Math.round(Math.min(overshoot * ELASTIC_FACTOR, ELASTIC_RANGE));
            dragPosition = MAX_VALID_POSITION + elasticOvershoot;
          }
          
          if (dragPosition !== currentPositionRef.current) {
            currentPositionRef.current = dragPosition;
            const endDate = EARLIEST_DATE.add({ days: dragPosition });
            const clampedDate = boundaries.clampEndDateToDisplayBounds(endDate);
            onDateNavigate(clampedDate, true);
          }
        } else {
          // Released - check for momentum or snapback
          const finalPosition = newPosition;
          const isOutOfBounds = finalPosition < MIN_VALID_POSITION || finalPosition > MAX_VALID_POSITION;
          
          // Don't clamp immediately - let spring handle it
          currentPositionRef.current = finalPosition;
          
          // Only update navigation if in bounds
          if (!isOutOfBounds) {
            const endDate = EARLIEST_DATE.add({ days: finalPosition });
            const clampedDate = boundaries.clampEndDateToDisplayBounds(endDate);
            onDateNavigate(clampedDate, false);
          }
          
          // Apply momentum if we have velocity AND we're in bounds
          if (Math.abs(vx) > 0.2 && !isOutOfBounds) {
            const tileCanvas = document.querySelector('.opennem-facility-canvas');
            const tileWidth = tileCanvas ? tileCanvas.getBoundingClientRect().width : 1000;
            const momentumPixels = vx * 300;
            const momentumDays = Math.round((momentumPixels / tileWidth) * 365);
            
            if (featureFlags.get('gestureLogging')) {
              console.log('🚀 MOMENTUM:', {
                velocity: vx,
                momentumDays: -momentumDays,
                from: finalPosition
              });
            }
            
            springStartRef.current = finalPosition;
            springApi.start({
              from: { x: 0 },
              to: { x: -momentumDays }, // Negative because we subtract for drag direction
              config: { tension: 170, friction: 26 }
            });
          }
          // Snapback if out of bounds (no momentum when out of bounds)
          else if (isOutOfBounds) {
            const targetPosition = finalPosition < MIN_VALID_POSITION 
              ? MIN_VALID_POSITION 
              : MAX_VALID_POSITION;
            const snapbackDays = targetPosition - finalPosition;
            
            if (featureFlags.get('gestureLogging')) {
              console.log('🔙 SNAPBACK:', {
                from: finalPosition,
                to: targetPosition,
                distance: snapbackDays
              });
            }
            
            springStartRef.current = finalPosition;
            springApi.start({
              from: { x: 0 },
              to: { x: snapbackDays },
              config: { tension: 120, friction: 20 } // Gentler, more dampened spring
            });
          }
        }
        
        return memo;
      }
    },
    {
      drag: {
        axis: 'x',
        filterTaps: true,
      }
    }
  );
  
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
  
  return { bind, elementRef };
}