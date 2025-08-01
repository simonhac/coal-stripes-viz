import { useCallback, useRef } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getDaysBetween as daysBetween } from '@/shared/date-utils';
import { getDateBoundaries } from '@/shared/date-boundaries';
import { DATE_NAV_PHYSICS } from '@/shared/config';

export interface AnimatorState {
  velocity: number;
  animationId: number | null;
  isDragging: boolean;
}

interface DateRangeAnimatorOptions {
  currentEndDate: CalendarDate;
  onDateNavigate: (date: CalendarDate, isDragging: boolean) => void;
}

/**
 * Central animator for date range navigation with physics-based animations
 * Handles rubber band effects, momentum, and spring animations
 */
export function useDateRangeAnimator({
  currentEndDate,
  onDateNavigate,
}: DateRangeAnimatorOptions) {
  const stateRef = useRef<AnimatorState>({
    velocity: 0,
    animationId: null,
    isDragging: false,
  });

  // Cancel any running animation
  const cancelAnimation = useCallback(() => {
    if (stateRef.current.animationId !== null) {
      cancelAnimationFrame(stateRef.current.animationId);
      stateRef.current.animationId = null;
    }
  }, []);

  // Calculate rubber band effect for positions outside data range
  const applyRubberBandEffect = useCallback((targetEndDate: CalendarDate): CalendarDate => {
    const boundaries = getDateBoundaries();
    const startDate = targetEndDate.subtract({ days: 364 });
    
    // Check if we're beyond data boundaries
    const beyondRightBoundary = targetEndDate.compare(boundaries.latestDataDay) > 0;
    const beyondLeftBoundary = startDate.compare(boundaries.earliestDataDay) < 0;
    
    if (!beyondRightBoundary && !beyondLeftBoundary) {
      return targetEndDate; // Within data range, no rubber band needed
    }
    
    // Determine which boundary we're beyond and calculate rubber band
    let dataBoundaryDate: CalendarDate;
    let overshoot: number;
    let maxStretch: number;
    
    if (beyondRightBoundary) {
      // Beyond right data boundary
      dataBoundaryDate = boundaries.latestDataDay;
      overshoot = daysBetween(dataBoundaryDate, targetEndDate);
      maxStretch = daysBetween(boundaries.latestDataDay, boundaries.latestDisplayDay);
    } else {
      // Beyond left data boundary - use earliestDataEndDay as boundary
      dataBoundaryDate = boundaries.earliestDataEndDay;
      overshoot = daysBetween(dataBoundaryDate, targetEndDate); // This will be negative when dragging left
      maxStretch = daysBetween(boundaries.earliestDisplayDay, boundaries.earliestDataDay) + 364;
    }
    
    // Logarithmic rubber band function: more pull = less additional movement
    const rubberBandDays = maxStretch * DATE_NAV_PHYSICS.RUBBER_BAND.SCALE_FACTOR * 
                          Math.log(1 + Math.abs(overshoot) / maxStretch) * 
                          Math.sign(overshoot);
    
    // Apply the rubber band effect from the data boundary
    if (beyondRightBoundary) {
      return dataBoundaryDate.add({ days: Math.ceil(rubberBandDays) });
    } else {
      // For left boundary, rubberBandDays is negative, so subtract to move left
      return dataBoundaryDate.subtract({ days: Math.floor(-rubberBandDays) });
    }
  }, []);

  // Navigate to a specific date during drag (with rubber band effect)
  const navigateToDragDate = useCallback((targetDate: CalendarDate) => {
    // Apply rubber band effect and clamp to display boundaries
    const rubberBandDate = applyRubberBandEffect(targetDate);
    const boundaries = getDateBoundaries();
    const clampedDate = boundaries.clampEndDateToDisplayBounds(rubberBandDate);
    
    
    onDateNavigate(clampedDate, true);
  }, [applyRubberBandEffect, onDateNavigate]);

  // Smooth cubic easing function (ease-in-out)
  const cubicEaseInOut = useCallback((t: number): number => {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }, []);

  // Navigate directly to a date (used by keyboard nav and month clicks)
  const navigateToDate = useCallback((targetDate: CalendarDate, shouldAnimate: boolean = true) => {
    cancelAnimation();
    
    if (!shouldAnimate) {
      onDateNavigate(targetDate, false);
      return;
    }
    
    // Smooth animation to the target date
    const startDate = currentEndDate;
    const totalDistance = daysBetween(startDate, targetDate);
    const duration = 300; // ms
    const startTime = performance.now();
    
    // Set target immediately (for DateRange display)
    onDateNavigate(targetDate, false);
    
    // Then animate the visual transition
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Apply cubic easing
      const eased = cubicEaseInOut(progress);
      
      const currentDistance = Math.round(totalDistance * eased);
      const currentDate = startDate.add({ days: currentDistance });
      
      // During animation, we need to update the animated date range
      // This will be handled by a new event type
      const event = new CustomEvent('date-animate', { 
        detail: { 
          animatedEndDate: currentDate,
          targetEndDate: targetDate,
          isAnimating: progress < 1
        } 
      });
      window.dispatchEvent(event);
      
      if (progress < 1) {
        stateRef.current.animationId = requestAnimationFrame(animate);
      } else {
        stateRef.current.animationId = null;
      }
    };
    
    stateRef.current.animationId = requestAnimationFrame(animate);
  }, [currentEndDate, onDateNavigate, cancelAnimation, cubicEaseInOut]);

  // Start a drag operation
  const startDrag = useCallback(() => {
    cancelAnimation();
    stateRef.current.isDragging = true;
    stateRef.current.velocity = 0;
  }, [cancelAnimation]);

  // Update velocity during drag
  const updateVelocity = useCallback((velocity: number) => {
    stateRef.current.velocity = velocity;
  }, []);

  // Spring animation for snap-back to data boundaries
  const animateSpringBack = useCallback((targetDate: CalendarDate) => {
    let velocity = 0;
    let lastTime = performance.now();
    let fractionalDays = 0; // Accumulate fractional days
    const startDate = currentEndDate;
    
    // Immediately set the target date (updates DateRange)
    onDateNavigate(targetDate, false);
    
    const animate = () => {
      const currentTime = performance.now();
      const dt = Math.min((currentTime - lastTime) / 1000, 1/30); // Cap at 30fps min
      lastTime = currentTime;
      
      // Calculate current date from accumulated position
      const wholeDays = Math.floor(fractionalDays);
      const currentDate = startDate.add({ days: wholeDays });
      
      // Calculate displacement from current to target
      const displacement = daysBetween(currentDate, targetDate);
      
      
      // Check if we're close enough to stop
      if (Math.abs(displacement) < DATE_NAV_PHYSICS.SPRING.MIN_DISTANCE && 
          Math.abs(velocity) < DATE_NAV_PHYSICS.SPRING.MIN_VELOCITY) {
        stateRef.current.animationId = null;
        onDateNavigate(targetDate, false);
        return;
      }
      
      // Spring physics - spring pulls towards target (displacement is days to move)
      const springForce = DATE_NAV_PHYSICS.SPRING.STIFFNESS * displacement;
      const dampingForce = -DATE_NAV_PHYSICS.SPRING.DAMPING * velocity;
      const acceleration = (springForce + dampingForce) / DATE_NAV_PHYSICS.SPRING.MASS;
      
      velocity += acceleration * dt;
      fractionalDays += velocity * dt;
      
      // Update to new position
      const newWholeDays = Math.floor(fractionalDays);
      const newDate = startDate.add({ days: newWholeDays });
      
      // Emit animation event for visual update
      const event = new CustomEvent('date-animate', { 
        detail: { 
          animatedEndDate: newDate,
          targetEndDate: targetDate,
          isAnimating: true
        } 
      });
      window.dispatchEvent(event);
      
      stateRef.current.animationId = requestAnimationFrame(animate);
    };
    
    animate();
  }, [currentEndDate, onDateNavigate]);

  // Momentum animation
  const animateMomentum = useCallback(() => {
    let currentVelocity = stateRef.current.velocity * DATE_NAV_PHYSICS.MOMENTUM.VELOCITY_SCALE;
    let currentDate = currentEndDate;
    
    const animate = () => {
      // Apply friction
      currentVelocity *= DATE_NAV_PHYSICS.MOMENTUM.FRICTION;
      
      // Stop if velocity is too small
      if (Math.abs(currentVelocity) < DATE_NAV_PHYSICS.MOMENTUM.MIN_VELOCITY) {
        stateRef.current.animationId = null;
        
        // Check if we need snap-back
        const boundaries = getDateBoundaries();
        const startDate = currentDate.subtract({ days: 364 });
        
        if (currentDate.compare(boundaries.latestDataDay) > 0) {
          animateSpringBack(boundaries.latestDataDay);
        } else if (startDate.compare(boundaries.earliestDataDay) < 0) {
          animateSpringBack(boundaries.earliestDataEndDay);
        } else {
          onDateNavigate(currentDate, false);
        }
        return;
      }
      
      // Calculate new position with momentum (velocity is in days/second)
      const deltaDays = currentVelocity / 60; // 60fps
      const rawDate = currentDate.add({ days: Math.round(deltaDays) });
      
      // Apply rubber band and boundaries
      const rubberBandDate = applyRubberBandEffect(rawDate);
      const boundaries = getDateBoundaries();
      const clampedDate = boundaries.clampEndDateToDisplayBounds(rubberBandDate);
      
      currentDate = clampedDate;
      onDateNavigate(currentDate, true);
      
      stateRef.current.animationId = requestAnimationFrame(animate);
    };
    
    animate();
  }, [currentEndDate, onDateNavigate, applyRubberBandEffect, animateSpringBack]);

  // End drag and start appropriate animation
  const endDrag = useCallback((applyMomentum: boolean = true) => {
    stateRef.current.isDragging = false;
    
    const boundaries = getDateBoundaries();
    const startDate = currentEndDate.subtract({ days: 364 });
    const needsSnapBack = currentEndDate.compare(boundaries.latestDataDay) > 0 ||
                         startDate.compare(boundaries.earliestDataDay) < 0;
    
    
    if (applyMomentum && Math.abs(stateRef.current.velocity) > 2) {
      // Start momentum animation
      animateMomentum();
    } else if (needsSnapBack) {
      // Snap back to data boundaries
      if (currentEndDate.compare(boundaries.latestDataDay) > 0) {
        animateSpringBack(boundaries.latestDataDay);
      } else {
        animateSpringBack(boundaries.earliestDataEndDay);
      }
    } else {
      // Just end the drag
      onDateNavigate(currentEndDate, false);
    }
  }, [currentEndDate, onDateNavigate, animateMomentum, animateSpringBack]);

  return {
    navigateToDragDate,
    navigateToDate,
    startDrag,
    updateVelocity,
    endDrag,
    cancelAnimation,
    isDragging: stateRef.current.isDragging,
  };
}