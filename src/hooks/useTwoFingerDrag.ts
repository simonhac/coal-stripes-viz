import { useCallback, useRef, useEffect } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getDaysBetween as daysBetween } from '@/shared/date-utils';
import { getDateBoundaries } from '@/shared/date-boundaries';
import { DATE_NAV_PHYSICS } from '@/shared/config';

interface TouchDragState {
  isActive: boolean;
  startCenterX: number;
  startCenterY: number;
  startEndDate: CalendarDate;
  velocitySamples: Array<{ x: number; time: number }>;
  wasHorizontalDrag: boolean;
  momentumAnimationId: number | null;
}

interface TwoFingerDragOptions {
  endDate: CalendarDate;
  onDateNavigate: (date: CalendarDate, isDragging: boolean) => void;
}

/**
 * Hook for handling two-finger touch drag interactions on RegionSection
 * This converts touch movements to date navigation
 */
export function useTwoFingerDrag({
  endDate,
  onDateNavigate,
}: TwoFingerDragOptions) {
  const dragStateRef = useRef<TouchDragState>({
    isActive: false,
    startCenterX: 0,
    startCenterY: 0,
    startEndDate: endDate,
    velocitySamples: [],
    wasHorizontalDrag: false,
    momentumAnimationId: null,
  });

  // Cancel any running animation
  const cancelAnimation = useCallback(() => {
    if (dragStateRef.current.momentumAnimationId !== null) {
      cancelAnimationFrame(dragStateRef.current.momentumAnimationId);
      dragStateRef.current.momentumAnimationId = null;
    }
  }, []);

  // Apply rubber band effect for dates outside data boundaries
  const applyRubberBandEffect = useCallback((targetEndDate: CalendarDate): CalendarDate => {
    const boundaries = getDateBoundaries();
    const startDate = targetEndDate.subtract({ days: 364 });
    
    // Check if we're beyond data boundaries
    const beyondRightBoundary = targetEndDate.compare(boundaries.latestDataDay) > 0;
    const beyondLeftBoundary = startDate.compare(boundaries.earliestDataDay) < 0;
    
    if (!beyondRightBoundary && !beyondLeftBoundary) {
      return targetEndDate;
    }
    
    // Determine which boundary we're beyond
    let dataBoundaryDate: CalendarDate;
    let overshoot: number;
    let maxStretch: number;
    
    if (beyondRightBoundary) {
      dataBoundaryDate = boundaries.latestDataDay;
      overshoot = daysBetween(dataBoundaryDate, targetEndDate);
      maxStretch = daysBetween(boundaries.latestDataDay, boundaries.latestDisplayDay);
    } else {
      dataBoundaryDate = boundaries.earliestDataEndDay;
      overshoot = daysBetween(targetEndDate, dataBoundaryDate);
      maxStretch = daysBetween(boundaries.earliestDisplayDay, boundaries.earliestDataDay) + 364;
    }
    
    // Logarithmic rubber band function
    const scaleFactor = 0.4;
    const rubberBandDays = maxStretch * scaleFactor * 
                          Math.log(1 + Math.abs(overshoot) / maxStretch) * 
                          Math.sign(overshoot);
    
    if (beyondRightBoundary) {
      return dataBoundaryDate.add({ days: Math.ceil(rubberBandDays) });
    } else {
      return dataBoundaryDate.subtract({ days: Math.floor(-rubberBandDays) });
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    
    cancelAnimation();
    
    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    
    dragStateRef.current = {
      isActive: true,
      startCenterX: centerX,
      startCenterY: centerY,
      startEndDate: endDate,
      velocitySamples: [{ x: centerX, time: Date.now() }],
      wasHorizontalDrag: false,
      momentumAnimationId: null,
    };
  }, [endDate, cancelAnimation]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragStateRef.current.isActive || e.touches.length !== 2) return;
    
    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    
    const deltaX = centerX - dragStateRef.current.startCenterX;
    const deltaY = centerY - dragStateRef.current.startCenterY;
    
    // Check if this is a horizontal drag
    if (!dragStateRef.current.wasHorizontalDrag) {
      if (Math.abs(deltaX) > Math.abs(deltaY) * DATE_NAV_PHYSICS.DRAG.MIN_HORIZONTAL_RATIO) {
        dragStateRef.current.wasHorizontalDrag = true;
      } else if (Math.abs(deltaY) > 20) {
        // Vertical drag, cancel
        dragStateRef.current.isActive = false;
        return;
      }
    }
    
    if (dragStateRef.current.wasHorizontalDrag) {
      // Track velocity
      const now = Date.now();
      dragStateRef.current.velocitySamples.push({ x: centerX, time: now });
      
      // Keep only recent samples (last 100ms)
      const cutoff = now - DATE_NAV_PHYSICS.DRAG.VELOCITY_SAMPLE_WINDOW;
      dragStateRef.current.velocitySamples = dragStateRef.current.velocitySamples.filter(
        s => s.time > cutoff
      );
      
      // Convert pixels to days (assuming full width = 365 days)
      const containerWidth = window.innerWidth;
      const daysDelta = -(deltaX / containerWidth) * 365;
      
      // Calculate new date
      const rawEndDate = dragStateRef.current.startEndDate.add({ days: Math.round(daysDelta) });
      const rubberBandDate = applyRubberBandEffect(rawEndDate);
      const boundaries = getDateBoundaries();
      const clampedDate = boundaries.clampEndDateToDisplayBounds(rubberBandDate);
      
      onDateNavigate(clampedDate, true);
    }
  }, [onDateNavigate, applyRubberBandEffect]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragStateRef.current.isActive) return;
    
    dragStateRef.current.isActive = false;
    
    // Check if we need snap-back animation
    const boundaries = getDateBoundaries();
    const startDate = endDate.subtract({ days: 364 });
    const beyondDataBoundary = endDate.compare(boundaries.latestDataDay) > 0 || 
                               startDate.compare(boundaries.earliestDataDay) < 0;
    
    if (beyondDataBoundary) {
      // Animate spring back to data boundary
      const targetDate = endDate.compare(boundaries.latestDataDay) > 0 
        ? boundaries.latestDataDay 
        : boundaries.earliestDataEndDay;
      
      let velocity = 0;
      let lastTime = performance.now();
      
      const animate = () => {
        const currentTime = performance.now();
        const dt = Math.min((currentTime - lastTime) / 1000, 1/30);
        lastTime = currentTime;
        
        const displacement = daysBetween(endDate, targetDate);
        
        if (Math.abs(displacement) < DATE_NAV_PHYSICS.SPRING.MIN_DISTANCE && 
            Math.abs(velocity) < DATE_NAV_PHYSICS.SPRING.MIN_VELOCITY) {
          dragStateRef.current.momentumAnimationId = null;
          onDateNavigate(targetDate, false);
          return;
        }
        
        const springForce = -DATE_NAV_PHYSICS.SPRING.STIFFNESS * displacement;
        const dampingForce = -DATE_NAV_PHYSICS.SPRING.DAMPING * velocity;
        const acceleration = (springForce + dampingForce) / DATE_NAV_PHYSICS.SPRING.MASS;
        
        velocity += acceleration * dt;
        const deltaDays = velocity * dt;
        
        const newDate = endDate.add({ days: Math.round(deltaDays) });
        onDateNavigate(newDate, true);
        
        dragStateRef.current.momentumAnimationId = requestAnimationFrame(animate);
      };
      
      dragStateRef.current.momentumAnimationId = requestAnimationFrame(animate);
    } else if (dragStateRef.current.wasHorizontalDrag && dragStateRef.current.velocitySamples.length > 0) {
      // Apply momentum if there's velocity
      const samples = dragStateRef.current.velocitySamples;
      const avgVelocityX = samples.reduce((sum, s) => sum + s.x, 0) / samples.length - samples[0].x;
      
      if (Math.abs(avgVelocityX) > 2) {
        let currentVelocity = avgVelocityX * DATE_NAV_PHYSICS.MOMENTUM.VELOCITY_SCALE;
        let currentDate = endDate;
        const friction = DATE_NAV_PHYSICS.MOMENTUM.FRICTION;
        
        const animate = () => {
          currentVelocity *= friction;
          
          if (Math.abs(currentVelocity) < DATE_NAV_PHYSICS.MOMENTUM.MIN_VELOCITY) {
            dragStateRef.current.momentumAnimationId = null;
            
            // Final check for snap-back
            const boundaries = getDateBoundaries();
            const startDate = currentDate.subtract({ days: 364 });
            
            if (currentDate.compare(boundaries.latestDataDay) > 0) {
              // Start snap-back animation
              handleTouchEnd(e); // Re-trigger with current date
            } else if (startDate.compare(boundaries.earliestDataDay) < 0) {
              handleTouchEnd(e); // Re-trigger with current date
            } else {
              onDateNavigate(currentDate, false);
            }
            return;
          }
          
          const containerWidth = window.innerWidth;
          const daysDelta = -(currentVelocity / containerWidth) * 365 / 60; // 60fps
          const newDate = currentDate.add({ days: Math.round(daysDelta) });
          
          const rubberBandDate = applyRubberBandEffect(newDate);
          const boundaries = getDateBoundaries();
          const clampedDate = boundaries.clampEndDateToDisplayBounds(rubberBandDate);
          
          currentDate = clampedDate;
          onDateNavigate(currentDate, true);
          
          dragStateRef.current.momentumAnimationId = requestAnimationFrame(animate);
        };
        
        dragStateRef.current.momentumAnimationId = requestAnimationFrame(animate);
      } else {
        onDateNavigate(endDate, false);
      }
    } else {
      onDateNavigate(endDate, false);
    }
  }, [endDate, onDateNavigate, applyRubberBandEffect]);

  const handleTouchCancel = useCallback(() => {
    cancelAnimation();
    dragStateRef.current.isActive = false;
    onDateNavigate(endDate, false);
  }, [endDate, onDateNavigate, cancelAnimation]);

  // Prevent default scrolling during horizontal drag
  useEffect(() => {
    const handleTouchMovePassive = (e: TouchEvent) => {
      if (dragStateRef.current.isActive && dragStateRef.current.wasHorizontalDrag && e.cancelable) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', handleTouchMovePassive, { passive: false });
    
    return () => {
      document.removeEventListener('touchmove', handleTouchMovePassive);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimation();
    };
  }, [cancelAnimation]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  };
}