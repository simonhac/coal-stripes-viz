import { useRef, useCallback, useEffect } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getDateBoundaries } from '@/shared/date-boundaries';
import { getDaysBetween } from '@/shared/date-utils';
import { SPRING_PHYSICS_CONFIG } from '@/shared/config';

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
      
      // Check if we're beyond data boundaries (not display boundaries)
      const beyondDataBoundary = newEndDate.compare(boundaries.latestDataDay) > 0 || 
                                newEndDate.compare(boundaries.earliestDataEndDay) < 0;
      
      if (beyondDataBoundary) {
        // Apply rubber band effect only when beyond data boundaries
        const dataBoundaryDate = newEndDate.compare(boundaries.latestDataDay) > 0 
          ? boundaries.latestDataDay 
          : boundaries.earliestDataEndDay;
        
        // Calculate overshoot from data boundary
        const overshoot = newEndDate.compare(dataBoundaryDate) > 0 
          ? getDaysBetween(dataBoundaryDate, newEndDate)
          : getDaysBetween(newEndDate, dataBoundaryDate);
        
        // Apply rubber band resistance with increasing difficulty
        // Calculate max stretch based on data-to-display boundary distance
        const maxStretch = newEndDate.compare(dataBoundaryDate) > 0 
          ? getDaysBetween(boundaries.latestDataDay, boundaries.latestDisplayDay)
          : getDaysBetween(boundaries.earliestDisplayEndDay, boundaries.earliestDataEndDay);
        
        // Logarithmic function: more pull = less additional movement
        const scaleFactor = 0.4; // Controls how much you can stretch (0.4 = 40% of max at infinity)
        const rubberBandDays = maxStretch * scaleFactor * Math.log(1 + Math.abs(overshoot) / maxStretch) * Math.sign(overshoot);
        
        // Apply the rubber band effect from the data boundary
        if (newEndDate.compare(dataBoundaryDate) > 0) {
          newEndDate = dataBoundaryDate.add({ days: Math.ceil(rubberBandDays) });
        } else {
          newEndDate = dataBoundaryDate.add({ days: Math.floor(rubberBandDays) });
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
      const beyondDataBoundary = endDate && (endDate.compare(boundaries.latestDataDay) > 0 || 
                                             endDate.compare(boundaries.earliestDataEndDay) < 0);
      
      if (wasHorizontalDrag && beyondDataBoundary) {
        // We're beyond the data boundaries, animate back
        const targetDate = endDate!.compare(boundaries.latestDataDay) > 0 
          ? boundaries.latestDataDay 
          : boundaries.earliestDataEndDay;
        let displacement = getDaysBetween(targetDate, endDate);
        
        // Spring physics parameters from config
        const { STIFFNESS: stiffness, DAMPING: damping, MASS: mass } = SPRING_PHYSICS_CONFIG;
        
        // Calculate initial velocity from drag samples
        let velocity = 0; // Start with zero, but add drag velocity if available
        if (dragStateRef.current.velocitySamples.length > 0) {
          const avgVelocityX = dragStateRef.current.velocitySamples.reduce(
            (sum, sample) => sum + sample.x, 0
          ) / dragStateRef.current.velocitySamples.length;
          // Add drag velocity to initial kick (negative because dragging right = going back in time)
          velocity += -avgVelocityX * 365 / 1000; // Approximate conversion
        }
        
        let lastTime = performance.now();
        
        const animate = () => {
          const currentTime = performance.now();
          const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
          lastTime = currentTime;
          
          // Spring force
          const springForce = -stiffness * displacement;
          const dampingForce = -damping * velocity;
          
          // Update velocity and position
          const acceleration = (springForce + dampingForce) / mass;
          velocity += acceleration * deltaTime;
          const deltaPosition = velocity * deltaTime;
          
          // Update displacement
          displacement += deltaPosition;
          
          // Check if we should stop (very close and very slow)
          if (Math.abs(displacement) < SPRING_PHYSICS_CONFIG.MIN_DISTANCE && 
              Math.abs(velocity) < SPRING_PHYSICS_CONFIG.MIN_VELOCITY) {
            dragStateRef.current.momentumAnimationId = null;
            onDateNavigate(targetDate, false);
          } else {
            // Calculate new position - don't round to preserve smooth motion
            const newDate = targetDate.add({ days: -displacement });
            onDateNavigate(newDate, true);
            dragStateRef.current.momentumAnimationId = requestAnimationFrame(animate);
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
              
              // Check if we're approaching data boundaries  
              const beyondDataBoundary = newDate.compare(boundaries.latestDataDay) > 0 || 
                                        newDate.compare(boundaries.earliestDataEndDay) < 0;
              
              if (beyondDataBoundary) {
                // We've hit the data boundary, start bounce back animation
                const clampedDate = newDate.compare(boundaries.latestDataDay) > 0 
                  ? boundaries.latestDataDay 
                  : boundaries.earliestDataEndDay;
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