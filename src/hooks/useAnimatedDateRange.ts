import { useState, useRef, useEffect } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getDaysBetween } from '@/shared/date-utils';

interface AnimatedDateRange {
  start: CalendarDate;
  end: CalendarDate;
}

export function useAnimatedDateRange(targetEndDate: CalendarDate | null) {
  // Current animated range
  const [currentRange, setCurrentRange] = useState<AnimatedDateRange | null>(
    targetEndDate ? { start: targetEndDate.subtract({ days: 364 }), end: targetEndDate } : null
  );
  
  // Animation state - using state for isAnimating to trigger effect properly
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Animation details in ref
  const animationRef = useRef<{
    animationDuration: number;
    animationStartTime: number;
    fromStart: CalendarDate | null;
    targetStart: CalendarDate | null;
    isActive: boolean;
  }>({
    animationDuration: 300,  // milliseconds 
    animationStartTime: 0,
    fromStart: null,
    targetStart: null,
    isActive: false
  });
  
  // Track last processed goal to avoid loops
  const lastGoalRef = useRef<string>('');
  
  // Handle target date changes - set up animation if appropriate
  useEffect(() => {
    if (!targetEndDate) {
      setCurrentRange(null);
      return;
    }
    
    const targetRange = { 
      start: targetEndDate.subtract({ days: 364 }), 
      end: targetEndDate 
    };
    
    const anim = animationRef.current;
    const newGoal = targetRange.start.toString();
    
    // Check if goal has actually changed
    if (lastGoalRef.current === newGoal) {
      return;
    }

    lastGoalRef.current = newGoal;
    
    // If no current position, jump directly
    if (!currentRange) {
      setCurrentRange(targetRange);
      setIsAnimating(false);
      return;
    }
    
    // Check if we should animate
    const daysDiff = getDaysBetween(currentRange.start, targetRange.start);
    
    // Only animate if change is not "too much"
    if (Math.abs(daysDiff) > 0 && Math.abs(daysDiff) <= 2000) {
      anim.fromStart = currentRange.start;
      anim.targetStart = targetRange.start;
      anim.animationStartTime = performance.now();
      anim.isActive = true;
      setIsAnimating(true);
    } else if (Math.abs(daysDiff) > 0) {
      // Jump directly for large changes
      anim.isActive = false;
      setCurrentRange(targetRange);
      setIsAnimating(false);
    }
  }, [targetEndDate]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Cubic easing function (ease-in-out)
  const cubicEaseInOut = (t: number): number => {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  // Animation loop
  useEffect(() => {
    if (!isAnimating) {
      return;
    }
    
    let frameId: number;
    let animationActive = true;
    
    const animate = () => {
      const anim = animationRef.current;
      
      if (!animationActive || !anim.isActive || !anim.fromStart || !anim.targetStart) {
        return;
      }
      
      // Calculate progress based on elapsed time
      const elapsed = performance.now() - anim.animationStartTime;
      const progress = Math.min(elapsed / anim.animationDuration, 1);
      
      // Apply cubic easing
      const easedProgress = cubicEaseInOut(progress);
      
      // Calculate the total days to move
      const totalDays = getDaysBetween(anim.fromStart, anim.targetStart);
      const daysToMove = Math.round(totalDays * easedProgress);
      
      // Calculate new position
      const newStart = anim.fromStart.add({ days: daysToMove });
      const newEnd = newStart.add({ days: 364 }); // always exactly 365 days
      
      if (progress >= 1) {
        // Animation complete - ensure we're exactly at the target
        anim.isActive = false;
        setCurrentRange({ start: anim.targetStart, end: anim.targetStart.add({ days: 364 }) });
        setIsAnimating(false);
      } else {
        // Update current range
        setCurrentRange({ start: newStart, end: newEnd });
        
        // Continue animation
        frameId = requestAnimationFrame(animate);
      }
    };
    
    frameId = requestAnimationFrame(animate);
    
    return () => {
      animationActive = false;
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isAnimating]);
  
  return currentRange;
}