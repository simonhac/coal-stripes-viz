import { useRef, useCallback, useEffect } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getTodayAEST } from '@/shared/date-utils';
import { DATE_BOUNDARIES } from '@/shared/config';

interface TwoFingerDragOptions {
  endDate: CalendarDate;
  onDateNavigate: (newEndDate: CalendarDate, isDragging: boolean) => void;
}

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

interface VelocitySample {
  x: number;
  y: number;
  time: number;
}

export function useTwoFingerDrag({
  endDate,
  onDateNavigate
}: TwoFingerDragOptions) {
  const dragStateRef = useRef<{
    isActive: boolean;
    startCenterX: number;
    startCenterY: number;
    startEndDate: CalendarDate | null;
    touches: Map<number, TouchPoint>;
    isHorizontalDrag: boolean;
    hasMoved: boolean;
    velocitySamples: VelocitySample[];
    lastCenterX: number;
    lastCenterY: number;
    momentumAnimationId: number | null;
  }>({
    isActive: false,
    startCenterX: 0,
    startCenterY: 0,
    startEndDate: null,
    touches: new Map(),
    isHorizontalDrag: false,
    hasMoved: false,
    velocitySamples: [],
    lastCenterX: 0,
    lastCenterY: 0,
    momentumAnimationId: null
  });

  // Add passive touch move handler to prevent scrolling during horizontal drag
  useEffect(() => {
    const handleTouchMovePassive = (e: TouchEvent) => {
      if (dragStateRef.current.isActive && dragStateRef.current.isHorizontalDrag && e.cancelable) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', handleTouchMovePassive, { passive: false });
    
    return () => {
      document.removeEventListener('touchmove', handleTouchMovePassive);
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Cancel any ongoing momentum animation
    if (dragStateRef.current.momentumAnimationId !== null) {
      cancelAnimationFrame(dragStateRef.current.momentumAnimationId);
      dragStateRef.current.momentumAnimationId = null;
    }

    // Store all current touches
    const touches = new Map<number, TouchPoint>();
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      touches.set(touch.identifier, {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY
      });
    }
    dragStateRef.current.touches = touches;

    // Check if we have exactly two touches
    if (e.touches.length === 2) {
      e.preventDefault(); // Prevent default pinch/zoom
      
      // Calculate center point between two fingers
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      dragStateRef.current = {
        ...dragStateRef.current,
        isActive: true,
        startCenterX: centerX,
        startCenterY: centerY,
        startEndDate: endDate,
        isHorizontalDrag: false,
        hasMoved: false,
        velocitySamples: [],
        lastCenterX: centerX,
        lastCenterY: centerY
      };
      
      // Set dragging cursor
      document.body.style.cursor = 'grabbing';
    }
  }, [endDate]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragStateRef.current.isActive || e.touches.length !== 2) return;
    
    e.preventDefault();
    
    // Calculate current center point
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
    const currentCenterY = (touch1.clientY + touch2.clientY) / 2;
    
    // Detect if this is primarily a horizontal drag
    if (!dragStateRef.current.hasMoved) {
      const deltaX = Math.abs(currentCenterX - dragStateRef.current.startCenterX);
      const deltaY = Math.abs(currentCenterY - dragStateRef.current.startCenterY);
      
      if (deltaX > 5 || deltaY > 5) {
        dragStateRef.current.hasMoved = true;
        dragStateRef.current.isHorizontalDrag = deltaX > deltaY * 1.5;
      }
    }
    
    // Track velocity
    const now = Date.now();
    const velocityX = currentCenterX - dragStateRef.current.lastCenterX;
    const velocityY = currentCenterY - dragStateRef.current.lastCenterY;
    
    // Add velocity sample
    dragStateRef.current.velocitySamples.push({
      x: velocityX,
      y: velocityY,
      time: now
    });
    
    // Keep only recent samples (last 100ms)
    const cutoffTime = now - 100;
    dragStateRef.current.velocitySamples = dragStateRef.current.velocitySamples.filter(
      sample => sample.time > cutoffTime
    );
    
    // Update last position
    dragStateRef.current.lastCenterX = currentCenterX;
    dragStateRef.current.lastCenterY = currentCenterY;
    
    // Calculate horizontal movement
    const deltaX = currentCenterX - dragStateRef.current.startCenterX;
    
    // Convert pixel movement to days
    const daysChange = Math.round(deltaX);
    
    if (dragStateRef.current.startEndDate) {
      const newEndDate = dragStateRef.current.startEndDate.add({ days: -daysChange });
      onDateNavigate(newEndDate, true);
    }
  }, [onDateNavigate]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // Update our touch tracking
    const touches = new Map<number, TouchPoint>();
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      touches.set(touch.identifier, {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY
      });
    }
    dragStateRef.current.touches = touches;

    // If we no longer have two touches, end the drag
    if (dragStateRef.current.isActive && e.touches.length < 2) {
      const wasHorizontalDrag = dragStateRef.current.isHorizontalDrag;
      
      dragStateRef.current.isActive = false;
      dragStateRef.current.isHorizontalDrag = false;
      dragStateRef.current.hasMoved = false;
      document.body.style.cursor = '';
      
      // Calculate average velocity from recent samples
      if (wasHorizontalDrag && dragStateRef.current.velocitySamples.length > 0) {
        const avgVelocityX = dragStateRef.current.velocitySamples.reduce(
          (sum, sample) => sum + sample.x, 0
        ) / dragStateRef.current.velocitySamples.length;
        
        // Only apply momentum if velocity is significant
        if (Math.abs(avgVelocityX) > 2) {
          // Start momentum animation
          let currentVelocity = avgVelocityX * 15; // Scale up the velocity
          let currentDate = endDate;
          const friction = 0.92; // Deceleration factor
          const minVelocity = 0.5;
          
          // Calculate boundaries with 6 month buffer
          const yesterday = getTodayAEST().subtract({ days: 1 });
          const upperBoundary = yesterday.add({ months: 6 });
          const lowerBoundary = DATE_BOUNDARIES.EARLIEST_END_DATE.subtract({ months: 6 });
          
          const animate = () => {
            // Apply friction
            currentVelocity *= friction;
            
            // Stop if velocity is too small
            if (Math.abs(currentVelocity) < minVelocity) {
              dragStateRef.current.momentumAnimationId = null;
              onDateNavigate(currentDate, false);
              return;
            }
            
            // Calculate days to move (velocity is in pixels, convert to days)
            const daysChange = Math.round(-currentVelocity / 10); // Round to whole days
            
            // Update date only if we're moving at least 1 day
            if (currentDate && daysChange !== 0) {
              const newDate = currentDate.add({ days: daysChange });
              
              // Check if we're approaching boundaries and stop momentum if so
              if (newDate.compare(upperBoundary) > 0 || newDate.compare(lowerBoundary) < 0) {
                dragStateRef.current.momentumAnimationId = null;
                onDateNavigate(currentDate, false);
                return;
              }
              
              currentDate = newDate;
              onDateNavigate(newDate, true);
            }
            
            // Continue animation
            dragStateRef.current.momentumAnimationId = requestAnimationFrame(animate);
          };
          
          // Start the animation
          dragStateRef.current.momentumAnimationId = requestAnimationFrame(animate);
        } else {
          // No momentum, just emit final navigation event
          if (endDate) {
            onDateNavigate(endDate, false);
          }
        }
      } else {
        // Not a horizontal drag or no velocity data
        if (endDate) {
          onDateNavigate(endDate, false);
        }
      }
    }
  }, [endDate, onDateNavigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any ongoing momentum animation
      if (dragStateRef.current.momentumAnimationId !== null) {
        cancelAnimationFrame(dragStateRef.current.momentumAnimationId);
        dragStateRef.current.momentumAnimationId = null;
      }
      
      if (dragStateRef.current.isActive) {
        dragStateRef.current.isActive = false;
        dragStateRef.current.isHorizontalDrag = false;
        dragStateRef.current.hasMoved = false;
        document.body.style.cursor = '';
      }
    };
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchEnd // Handle cancel same as end
  };
}