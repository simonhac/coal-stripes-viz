import { useCallback, useRef } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getDaysBetween as daysBetween } from '@/shared/date-utils';
import { getDateBoundaries } from '@/shared/date-boundaries';
import { DATE_NAV_PHYSICS } from '@/shared/config';
import { SessionManager, SessionType, MoveSession } from '@/client/debugging';

export interface AnimatorState {
  velocity: number;
  animationId: number | null;
  isDragging: boolean;
  currentPosition: CalendarDate | null;
  lastDisplacement: number | null;
  session: MoveSession | null;
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
    currentPosition: null,
    lastDisplacement: null,
    session: null,
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
    // Ensure we have an active session (creates new one if current has timed out)
    if (!stateRef.current.session || !stateRef.current.session.isActive()) {
      stateRef.current.session = SessionManager.getInstance().createSession(SessionType.MOVE) as MoveSession;
    }
    
    // Apply rubber band effect and clamp to display boundaries
    const rubberBandDate = applyRubberBandEffect(targetDate);
    const boundaries = getDateBoundaries();
    const clampedDate = boundaries.clampEndDateToDisplayBounds(rubberBandDate);
    
    stateRef.current.currentPosition = clampedDate;
    
    // Check if rubber band is active
    const isRubberBanding = targetDate.compare(clampedDate) !== 0;
    
    // If we've hit the display boundary, zero out velocity to prevent stuck behavior
    if (rubberBandDate.compare(clampedDate) !== 0) {
      stateRef.current.velocity = 0;
    }
    
    // Apply velocity damping when rubber banding
    if (isRubberBanding) {
      // Calculate how far we are into the rubber band zone
      const startDate = targetDate.subtract({ days: 364 });
      const beyondRightBoundary = targetDate.compare(boundaries.latestDataDay) > 0;
      const beyondLeftBoundary = startDate.compare(boundaries.earliestDataDay) < 0;
      
      let overshootRatio = 0;
      if (beyondRightBoundary) {
        const overshoot = daysBetween(boundaries.latestDataDay, targetDate);
        const maxStretch = daysBetween(boundaries.latestDataDay, boundaries.latestDisplayDay);
        overshootRatio = Math.min(overshoot / maxStretch, 1);
      } else if (beyondLeftBoundary) {
        const overshoot = Math.abs(daysBetween(boundaries.earliestDataEndDay, targetDate));
        const maxStretch = daysBetween(boundaries.earliestDisplayDay, boundaries.earliestDataDay) + 364;
        overshootRatio = Math.min(overshoot / maxStretch, 1);
      }
      
      // Apply damping based on how far into the rubber band we are
      // Use a gentler curve to avoid getting stuck with low velocity
      // At boundary (ratio=0): dampingFactor = 1 (no damping)
      // Deep in rubber band (ratio=1): dampingFactor = 0.3 (70% reduction)
      const dampingFactor = 1 - (0.7 * overshootRatio);
      stateRef.current.velocity *= dampingFactor;
    }
    
    // Calculate displacement for logging
    // For rubber band: show stretch beyond data boundary
    // For normal drag: 0 (we're at target)
    const displacement = isRubberBanding ? 
      Math.abs(daysBetween(rubberBandDate, targetDate)) : 0;
    const acceleration = 0; // No acceleration during drag - it's direct control
    
    // Check if displacement is stuck (same as last frame)
    const isStuck = isRubberBanding && 
        stateRef.current.lastDisplacement !== null && 
        displacement === stateRef.current.lastDisplacement &&
        stateRef.current.velocity !== 0;
    
    if (isStuck) {
      stateRef.current.velocity = 0;
    }
    
    stateRef.current.lastDisplacement = displacement;
    
    // Set phase if it changed
    const currentPhase = stateRef.current.session!.getCurrentPhase();
    if (currentPhase === 'INIT') {
      // First movement after init - transition to appropriate phase
      stateRef.current.session!.startPhase(isRubberBanding ? 'RUBBER' : 'DRAG');
    } else if (isRubberBanding && currentPhase !== 'RUBBER') {
      stateRef.current.session!.startPhase('RUBBER');
    } else if (!isRubberBanding && currentPhase === 'RUBBER') {
      stateRef.current.session!.startPhase('DRAG');
    }
    
    const event = stateRef.current.session!.createMoveEvent(
      stateRef.current.session!.getCurrentPhase(),
      clampedDate,
      targetDate,
      stateRef.current.velocity,
      acceleration,
      displacement
    );
    
    // Add warnings if needed
    if (isRubberBanding) {
      event.addWarning('IN_SLOP');
    }
    if (isStuck) {
      event.addWarning('STUCK');
    }
    
    event.log();
    
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
    stateRef.current.lastDisplacement = null;
    stateRef.current.session = SessionManager.getInstance().createSession(SessionType.MOVE) as MoveSession;
    // Session starts in INIT phase by default, no need to set it
  }, [cancelAnimation]);

  // Update velocity during drag
  const updateVelocity = useCallback((velocity: number) => {
    stateRef.current.velocity = velocity;
  }, []);

  // Momentum animation (for in-bounds coasting)
  const animateMomentum = useCallback((initialVelocity: number) => {
    cancelAnimation();
    
    let velocity = initialVelocity;
    let fractionalDays = 0;
    const startDate = currentEndDate;
    
    // Start MOMENTUM phase
    if (stateRef.current.session) {
      stateRef.current.session.startPhase('MOMENTUM', {
        initialVelocity: velocity.toFixed(1),
        startDate: startDate.toString()
      });
    }
    
    const animate = () => {
      // Apply friction
      velocity *= DATE_NAV_PHYSICS.MOMENTUM.FRICTION;
      
      // Stop if velocity is too low
      if (Math.abs(velocity) < DATE_NAV_PHYSICS.MOMENTUM.MIN_VELOCITY) {
        if (stateRef.current.session) {
          stateRef.current.session.endPhase('MOMENTUM', 'velocity_too_low');
        }
        return;
      }
      
      // Update position
      fractionalDays += velocity * (1/60); // Assuming 60fps
      const newDate = startDate.add({ days: Math.round(fractionalDays) });
      
      // Check bounds
      const boundaries = getDateBoundaries();
      const endDate = newDate;
      const displayStartDate = endDate.subtract({ days: 364 });
      
      if (endDate.compare(boundaries.latestDataDay) > 0 || 
          displayStartDate.compare(boundaries.earliestDataDay) < 0) {
        // Hit boundary - stop momentum
        if (stateRef.current.session) {
          stateRef.current.session.endPhase('MOMENTUM', 'hit_boundary');
        }
        // Snap to boundary
        const clampedDate = boundaries.clampEndDateToDisplayBounds(newDate);
        onDateNavigate(clampedDate, false);
        return;
      }
      
      // Log momentum frame
      if (stateRef.current.session && stateRef.current.session.isActive()) {
        const event = stateRef.current.session.createMoveMessage(
          'MOMENTUM',
          `v=${velocity.toFixed(1)}, pos=${newDate.toString()}`
        );
        event.log();
      }
      
      // Update display
      onDateNavigate(newDate, false);
      
      // Continue animation
      stateRef.current.animationId = requestAnimationFrame(animate);
    };
    
    animate();
  }, [currentEndDate, onDateNavigate, cancelAnimation]);

  // Spring physics animation (handles momentum and snap-back)
  const animateSpring = useCallback((targetDate: CalendarDate, initialVelocity: number = 0) => {
    // Capture the current position at animation start
    const animationStartDate = stateRef.current.currentPosition || currentEndDate;
    let velocity = initialVelocity;
    let lastTime = performance.now();
    let fractionalDays = 0; // Accumulate fractional days
    
    stateRef.current.session!.startPhase('SPRING', {
      animationStartDate: animationStartDate.toString(),
      targetDate: targetDate.toString(),
      initialVelocity: velocity,
      currentEndDate: currentEndDate.toString()
    });
    
    const animate = () => {
      const currentTime = performance.now();
      const dt = Math.min((currentTime - lastTime) / 1000, 1/30); // Cap at 30fps min
      lastTime = currentTime;
      
      // Calculate current date from accumulated position
      // Use proper rounding instead of floor to avoid dead zones
      const wholeDays = Math.round(fractionalDays);
      const currentDate = animationStartDate.add({ days: wholeDays });
      
      // Calculate displacement from current to target
      const displacement = daysBetween(currentDate, targetDate);
      
      // Log rounding details when velocity is low
      // if (Math.abs(velocity) < 20) {
      //   logDragEvent('Rounding details', {
      //     fractionalDays: fractionalDays.toFixed(6),
      //     wholeDays,
      //     velocity: velocity.toFixed(6),
      //     displacement: displacement.toFixed(6)
      //   });
      // }
      
      // Check if we're close enough to stop
      // If we've rounded to the exact target position, stop immediately
      if (currentDate.compare(targetDate) === 0 || 
          (Math.abs(displacement) < DATE_NAV_PHYSICS.SPRING.MIN_DISTANCE && 
           Math.abs(velocity) < DATE_NAV_PHYSICS.SPRING.MIN_VELOCITY)) {
        stateRef.current.session!.endPhase('SPRING', 'reached_target', {
          finalPosition: targetDate.toString(),
          finalDisplacement: displacement,
          finalVelocity: velocity
        });
        // Session will auto-end after 1s timeout
        stateRef.current.animationId = null;
        onDateNavigate(targetDate, false);
        return;
      }
      
      // Spring physics - spring pulls towards target (displacement is days to move)
      const springForce = DATE_NAV_PHYSICS.SPRING.STIFFNESS * displacement;
      const dampingForce = -DATE_NAV_PHYSICS.SPRING.DAMPING * velocity;
      const acceleration = (springForce + dampingForce) / DATE_NAV_PHYSICS.SPRING.MASS;
      
      // Apply additional friction when within bounds (simulates momentum decay)
      const boundaries = getDateBoundaries();
      const withinBounds = currentDate.compare(boundaries.latestDataDay) <= 0 && 
                          currentDate.subtract({ days: 364 }).compare(boundaries.earliestDataDay) >= 0;
      if (withinBounds && Math.abs(displacement) < 1) {
        // When near target and within bounds, apply friction
        velocity *= DATE_NAV_PHYSICS.MOMENTUM.FRICTION;
      }
      
      velocity += acceleration * dt;
      fractionalDays += velocity * dt;
      
      // Update to new position
      const newWholeDays = Math.round(fractionalDays);
      const newDate = animationStartDate.add({ days: newWholeDays });
      
      // Log frame
      const moveEvent = stateRef.current.session!.createMoveEvent(
        stateRef.current.session!.getCurrentPhase(),
        newDate,
        targetDate,
        velocity,
        acceleration,
        displacement
      );
      moveEvent.log();
      
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


  // End drag and start appropriate animation
  const endDrag = useCallback((applyMomentum: boolean = true) => {
    stateRef.current.isDragging = false;
    
    // Check if we have an active session
    if (!stateRef.current.session || !stateRef.current.session.isActive()) {
      // No active session - just update the position and return
      onDateNavigate(currentEndDate, false);
      return;
    }
    
    const boundaries = getDateBoundaries();
    const startDate = currentEndDate.subtract({ days: 364 });
    const pastMaxBoundary = currentEndDate.compare(boundaries.latestDataDay) > 0;
    const beforeMinBoundary = startDate.compare(boundaries.earliestDataDay) < 0;
    const outOfBounds = pastMaxBoundary || beforeMinBoundary;
    
    // Determine target position and initial velocity
    let targetDate = currentEndDate;
    const initialVelocity = applyMomentum ? stateRef.current.velocity * DATE_NAV_PHYSICS.MOMENTUM.VELOCITY_SCALE : 0;
    
    if (outOfBounds) {
      // If out of bounds, target is the boundary
      if (pastMaxBoundary) {
        targetDate = boundaries.latestDataDay;
      } else {
        targetDate = boundaries.earliestDataEndDay;
      }
      const springStartEvent = stateRef.current.session.createMoveMessage(
        stateRef.current.session.getCurrentPhase(),
        `Starting spring animation to boundary, target=${targetDate.toString()}, v=${initialVelocity.toFixed(1)}`
      );
      springStartEvent.log();
    } else {
      // In bounds - no spring animation needed, just let momentum coast to a stop
      if (Math.abs(initialVelocity) > 2) {
        const momentumEvent = stateRef.current.session.createMoveMessage(
          stateRef.current.session.getCurrentPhase(),
          `Drag ended with momentum (no spring needed), v=${initialVelocity.toFixed(1)}`
        );
        momentumEvent.log();
      } else {
        const noAnimEvent = stateRef.current.session.createMoveMessage(
          stateRef.current.session.getCurrentPhase(),
          'Drag ended without animation'
        );
        noAnimEvent.log();
      }
    }
    
    stateRef.current.session.endPhase(stateRef.current.session.getCurrentPhase(), 'user_released', {
      currentEndDate: currentEndDate.toString(),
      velocity: stateRef.current.velocity,
      outOfBounds,
      applyMomentum
    });
    
    // Don't end session here - let timeout handle it after all animations complete
    
    if (outOfBounds) {
      animateSpring(targetDate, initialVelocity);
    } else if (Math.abs(initialVelocity) > DATE_NAV_PHYSICS.MOMENTUM.MIN_VELOCITY) {
      // Apply momentum animation when in bounds
      animateMomentum(initialVelocity);
    } else {
      onDateNavigate(currentEndDate, false);
    }
  }, [currentEndDate, onDateNavigate, animateSpring, animateMomentum]);

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