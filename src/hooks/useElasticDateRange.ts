import { useState, useCallback, useRef, useEffect } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getTodayAEST } from '@/shared/date-utils';
import { DATE_BOUNDARIES } from '@/shared/config';
import { useSpringAnimation } from './useSpringAnimation';

interface UseElasticDateRangeProps {
  endDate: CalendarDate | null;
  onDateChange: (date: CalendarDate) => void;
  isDragging: boolean;
}

export function useElasticDateRange({
  endDate,
  onDateChange,
  isDragging
}: UseElasticDateRangeProps) {
  const [elasticOffset, setElasticOffset] = useState(0);
  const springAnimation = useSpringAnimation(0, {
    stiffness: 200,
    damping: 30,
    mass: 1
  });
  
  const isOverDraggingRef = useRef(false);
  const lastValidDateRef = useRef<CalendarDate | null>(null);

  // Get boundaries
  const yesterday = getTodayAEST().subtract({ days: 1 });
  const earliestDate = DATE_BOUNDARIES.EARLIEST_END_DATE;

  const handleDateNavigate = useCallback((newEndDate: CalendarDate, velocity: number = 0) => {
    if (!endDate) return;

    // Check if we're trying to go beyond boundaries
    if (newEndDate.compare(yesterday) > 0) {
      // Beyond future boundary
      const daysOver = newEndDate.toDate().getTime() - yesterday.toDate().getTime();
      const overDragDays = daysOver / (1000 * 60 * 60 * 24);
      
      if (isDragging) {
        // During drag, allow elastic over-drag
        isOverDraggingRef.current = true;
        lastValidDateRef.current = yesterday;
        
        // Apply resistance factor (logarithmic resistance)
        const resistance = Math.log(Math.abs(overDragDays) + 1) * 0.3;
        setElasticOffset(Math.min(resistance * 50, 100)); // Cap at 100px
        
        // Still update to boundary date
        onDateChange(yesterday);
      } else {
        // Not dragging, spring back
        springAnimation.springTo(0, setElasticOffset, velocity);
        onDateChange(yesterday);
      }
    } else if (newEndDate.compare(earliestDate) < 0) {
      // Beyond past boundary
      const daysOver = earliestDate.toDate().getTime() - newEndDate.toDate().getTime();
      const overDragDays = daysOver / (1000 * 60 * 60 * 24);
      
      if (isDragging) {
        // During drag, allow elastic over-drag
        isOverDraggingRef.current = true;
        lastValidDateRef.current = earliestDate;
        
        // Apply resistance factor (logarithmic resistance)
        const resistance = Math.log(Math.abs(overDragDays) + 1) * 0.3;
        setElasticOffset(-Math.min(resistance * 50, 100)); // Cap at -100px
        
        // Still update to boundary date
        onDateChange(earliestDate);
      } else {
        // Not dragging, spring back
        springAnimation.springTo(0, setElasticOffset, velocity);
        onDateChange(earliestDate);
      }
    } else {
      // Within boundaries
      if (isOverDraggingRef.current && !isDragging) {
        // Was over-dragging, now released - spring back
        springAnimation.springTo(0, setElasticOffset, velocity);
      } else if (!isDragging) {
        // Normal navigation, ensure no offset
        setElasticOffset(0);
        springAnimation.setPosition(0);
      }
      
      isOverDraggingRef.current = false;
      lastValidDateRef.current = null;
      onDateChange(newEndDate);
    }
  }, [endDate, yesterday, earliestDate, isDragging, onDateChange, springAnimation]);

  // Handle drag end - spring back if over-dragged
  useEffect(() => {
    if (!isDragging && isOverDraggingRef.current) {
      springAnimation.springTo(0, setElasticOffset);
      isOverDraggingRef.current = false;
    }
  }, [isDragging, springAnimation]);

  return {
    elasticOffset,
    handleDateNavigate,
    isOverDragging: isOverDraggingRef.current
  };
}