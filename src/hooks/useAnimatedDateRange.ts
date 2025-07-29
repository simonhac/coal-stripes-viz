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
  }>({
    animationDuration: 150, // 150ms animation
    animationStartTime: 0,
    fromStart: null,
    targetStart: null
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
      setIsAnimating(true);
    } else if (Math.abs(daysDiff) > 0) {
      // Jump directly for large changes
      setCurrentRange(targetRange);
      setIsAnimating(false);
    }
  }, [targetEndDate]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Animation loop
  useEffect(() => {
    if (!isAnimating) {
      return;
    }
    
    let frameId: number;
    let frameCount = 0;
    
    const animate = () => {
      const anim = animationRef.current;
      
      if (!isAnimating || !anim.fromStart || !anim.targetStart) {
        return;
      }
      
      // Increment frame counter
      frameCount++;
      
      // Only move every 2 frames (2x slowdown)
      if (frameCount % 2 === 0) {
        // Move one day per 10 frames
        const currentStart = currentRange?.start || anim.fromStart;
        const daysRemaining = getDaysBetween(currentStart, anim.targetStart);
        
        if (daysRemaining === 0) {
          // We've reached the target
          const finalEnd = anim.targetStart.add({ days: 364 });
          setCurrentRange({ start: anim.targetStart, end: finalEnd });
          setIsAnimating(false);
          return; // Stop the animation
        } else {
          // Move one day in the right direction
          const delta = daysRemaining > 0 ? 1 : -1;
          const newStart = currentStart.add({ days: delta });
          const newEnd = newStart.add({ days: 364 }); // always exactly 365 days
          
          // Update current range
          setCurrentRange({ start: newStart, end: newEnd });
        }
      }
      
      // Continue animation
      frameId = requestAnimationFrame(animate);
    };
    
    frameId = requestAnimationFrame(animate);
    
    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isAnimating, currentRange]);
  
  return currentRange;
}