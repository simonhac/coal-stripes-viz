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
 * Simplified approach: Let react-spring handle everything
 * The spring value IS our absolute position
 */
export function useGestureSpring({
  currentEndDate,
  onDateNavigate,
}: GestureSpringOptions) {
  const elementRef = useRef<HTMLDivElement>(null);
  
  // Get boundaries
  const boundaries = getDateBoundaries();
  const EARLIEST_DATE = boundaries.earliestDataDay;
  
  // Valid display bounds (where we can show a full year of data)
  const MIN_VALID_POSITION = Math.round(daysBetween(EARLIEST_DATE, boundaries.earliestDataEndDay));
  const MAX_VALID_POSITION = Math.round(daysBetween(EARLIEST_DATE, boundaries.latestDataDay));
  
  // Initial position based on current date
  const initialPosition = Math.round(daysBetween(EARLIEST_DATE, currentEndDate));
  
  // Spring represents absolute position in days from earliest date
  // This is THE source of truth
  const [springValues, springApi] = useSpring(() => ({
    position: initialPosition,
    config: config.default,
    onChange: ({ value }) => {
      if (value.position !== undefined) {
        const intPosition = Math.round(value.position);
        const endDate = EARLIEST_DATE.add({ days: intPosition });
        const clampedDate = boundaries.clampEndDateToDisplayBounds(endDate);
        
        // Always update - let the spring be the source of truth
        onDateNavigate(clampedDate, false);
        
        if (featureFlags.get('gestureLogging')) {
          const startDate = clampedDate.subtract({ days: 364 });
          console.log('🌊 SPRING:', {
            range: `${startDate.toString()} to ${clampedDate.toString()}`,
            position: intPosition,
            ts: Date.now()
          });
        }
      }
    }
  }));
  
  // Update spring when date changes externally (keyboard nav, month clicks)
  useEffect(() => {
    const newPosition = Math.round(daysBetween(EARLIEST_DATE, currentEndDate));
    const currentPosition = Math.round(springValues.position.get());
    
    if (newPosition !== currentPosition) {
      // External navigation - update spring to match
      springApi.set({ position: newPosition });
    }
  }, [currentEndDate, EARLIEST_DATE, springValues.position, springApi]);
  
  // Convert pixels to days
  const pixelsToDays = useCallback((pixels: number): number => {
    const tileCanvas = document.querySelector('.opennem-facility-canvas');
    if (!tileCanvas) return 0;
    const tileWidth = tileCanvas.getBoundingClientRect().width;
    return Math.round((pixels / tileWidth) * 365);
  }, []);
  
  // Set up gesture handling - simple and direct
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
          // Store starting position
          memo = springValues.position.get();
          if (featureFlags.get('gestureLogging')) {
            console.log('🎬 DRAG START:', { position: Math.round(memo) });
          }
        }
        
        // Calculate new position
        const dayDelta = pixelsToDays(mx);
        const newPosition = memo - dayDelta; // Subtract: drag left increases position
        
        if (featureFlags.get('gestureLogging')) {
          console.log('DRAG CALC:', {
            mx,
            dayDelta,
            memo,
            newPosition,
            isNaN: isNaN(newPosition)
          });
        }
        
        if (active) {
          // During drag: update spring immediately (no animation)
          springApi.start({ to: { position: newPosition }, immediate: true });
        } else {
          // Released: apply momentum or snap back
          const isOutOfBounds = newPosition < MIN_VALID_POSITION || newPosition > MAX_VALID_POSITION;
          
          if (isOutOfBounds) {
            // Snap back to nearest valid boundary
            const targetPosition = newPosition < MIN_VALID_POSITION 
              ? MIN_VALID_POSITION 
              : MAX_VALID_POSITION;
            
            springApi.start({ 
              to: { position: targetPosition },
              config: { tension: 200, friction: 30 }
            });
          } else if (Math.abs(vx) > 0.2) {
            // Apply momentum
            const momentumScale = 300;
            const tileCanvas = document.querySelector('.opennem-facility-canvas');
            const tileWidth = tileCanvas ? tileCanvas.getBoundingClientRect().width : 1000;
            const momentumPixels = vx * momentumScale;
            const momentumDays = Math.round((momentumPixels / tileWidth) * 365);
            const targetPosition = newPosition - momentumDays;
            
            // Clamp to valid bounds
            const clampedTarget = Math.max(MIN_VALID_POSITION, Math.min(MAX_VALID_POSITION, targetPosition));
            
            springApi.start({ 
              to: { position: clampedTarget },
              config: { tension: 170, friction: 26 }
            });
          } else {
            // Just stay where we are - spring is already at newPosition
            springApi.set({ position: newPosition });
          }
        }
        
        return memo;
      },
      
      onWheel: ({ 
        delta: [dx], 
        direction: [dirX, dirY]
      }) => {
        // Only process horizontal scrolling
        if (Math.abs(dirX) <= Math.abs(dirY)) return;
        
        const currentPos = springValues.position.get();
        const scrollSensitivity = 0.5;
        const dayDelta = Math.round(dx * scrollSensitivity);
        const newPosition = currentPos + dayDelta;
        
        // Clamp to bounds
        const clampedPosition = Math.max(MIN_VALID_POSITION, Math.min(MAX_VALID_POSITION, newPosition));
        
        // Update spring smoothly
        springApi.start({ 
          to: { position: clampedPosition },
          config: { tension: 300, friction: 30 }
        });
      }
    },
    {
      drag: {
        axis: 'x',
        filterTaps: true,
        preventScroll: true,
      },
      wheel: {
        axis: 'x',
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