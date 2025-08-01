import { useRef, useCallback, useEffect } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getDateBoundaries } from '@/shared/date-boundaries';
import { getDaysBetween } from '@/shared/date-utils';

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
      let newEndDate = dragStateRef.current.startEndDate.add({ days: -daysChange });
      
      // Get display boundaries
      const boundaries = getDateBoundaries();
      
      // Apply rubber band effect if beyond display boundaries (for end dates)
      if (!boundaries.isEndDateWithinDisplayBounds(newEndDate)) {
        // Calculate how far beyond the boundary we are
        const clampedDate = boundaries.clampEndDateToDisplayBounds(newEndDate);
        const overshoot = newEndDate.compare(clampedDate) > 0 
          ? newEndDate.toDate().getTime() - clampedDate.toDate().getTime()
          : clampedDate.toDate().getTime() - newEndDate.toDate().getTime();
        
        // Convert overshoot to days
        const overshootDays = overshoot / (1000 * 60 * 60 * 24);
        
        // Apply rubber band resistance (logarithmic scaling)
        const resistance = 0.12; // Lower value = more resistance, slightly stiffer
        const rubberBandDays = Math.sign(overshootDays) * Math.log(1 + Math.abs(overshootDays)) * resistance;
        
        // Apply the rubber band effect
        if (newEndDate.compare(clampedDate) > 0) {
          newEndDate = clampedDate.add({ days: Math.ceil(rubberBandDays) });
        } else {
          newEndDate = clampedDate.add({ days: Math.floor(rubberBandDays) });
        }
      }
      
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
      
      // Get display boundaries
      const boundaries = getDateBoundaries();
      
      // Check if we need to bounce back from rubber band
      if (wasHorizontalDrag && endDate && !boundaries.isEndDateWithinDisplayBounds(endDate)) {
        // We're beyond the boundaries, animate back
        const targetDate = boundaries.clampEndDateToDisplayBounds(endDate);
        const totalDays = getDaysBetween(endDate, targetDate);
        const startTime = Date.now();
        const duration = 250; // Faster animation
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Use ease-out cubic for smooth deceleration
          const easeOut = 1 - Math.pow(1 - progress, 3);
          
          if (progress < 1) {
            // Interpolate between current position and target
            const daysToMove = Math.round(totalDays * easeOut);
            const interpolatedDate = endDate.add({ days: daysToMove });
            
            onDateNavigate(interpolatedDate, true);
            dragStateRef.current.momentumAnimationId = requestAnimationFrame(animate);
          } else {
            // Animation complete
            dragStateRef.current.momentumAnimationId = null;
            onDateNavigate(targetDate, false);
          }
        };
        
        dragStateRef.current.momentumAnimationId = requestAnimationFrame(animate);
      } else if (wasHorizontalDrag && dragStateRef.current.velocitySamples.length > 0) {
        // Calculate average velocity from recent samples
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
              
              // Check if we're approaching boundaries  
              if (!boundaries.isEndDateWithinDisplayBounds(newDate)) {
                // We've hit the boundary, start bounce back animation
                const clampedDate = boundaries.clampEndDateToDisplayBounds(newDate);
                const startTime = Date.now();
                const duration = 300;
                const startDate = currentDate;
                
                const bounceAnimate = () => {
                  const elapsed = Date.now() - startTime;
                  const progress = Math.min(elapsed / duration, 1);
                  
                  // Use ease-out cubic
                  const easeOut = 1 - Math.pow(1 - progress, 3);
                  
                  if (progress < 1) {
                    const totalDays = getDaysBetween(startDate, clampedDate);
                    const daysToMove = Math.round(totalDays * easeOut);
                    const interpolatedDate = startDate.add({ days: daysToMove });
                    
                    onDateNavigate(interpolatedDate, true);
                    dragStateRef.current.momentumAnimationId = requestAnimationFrame(bounceAnimate);
                  } else {
                    dragStateRef.current.momentumAnimationId = null;
                    onDateNavigate(clampedDate, false);
                  }
                };
                
                dragStateRef.current.momentumAnimationId = requestAnimationFrame(bounceAnimate);
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