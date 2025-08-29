import { useCallback, useEffect } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getDateBoundaries } from '@/shared/date-boundaries';
import { DATE_BOUNDARIES } from '@/shared/config';
import { useDateRangeAnimator } from './useDateRangeAnimator';

interface UseKeyboardNavigationOptions {
  currentEndDate: CalendarDate | null;
  onDateNavigate: (date: CalendarDate, isDragging: boolean) => void;
  isDragging?: boolean;
  disabled?: boolean;
}

/**
 * Hook for handling keyboard navigation
 * Uses the DateRangeAnimator for smooth animated transitions
 */
export function useKeyboardNavigation({
  currentEndDate,
  onDateNavigate,
  isDragging = false,
  disabled = false,
}: UseKeyboardNavigationOptions) {
  const animator = useDateRangeAnimator({
    currentEndDate: currentEndDate || getDateBoundaries().latestDataDay,
    onDateNavigate,
  });

  // Navigate by months
  const navigateByMonths = useCallback((months: number) => {
    if (!currentEndDate) return;
    
    const newEndDate = currentEndDate.add({ months });
    const boundaries = getDateBoundaries();
    
    // Clamp to data boundaries
    let targetDate = newEndDate;
    if (newEndDate.compare(boundaries.latestDataDay) > 0) {
      targetDate = boundaries.latestDataDay;
    } else if (newEndDate.compare(boundaries.earliestDataEndDay) < 0) {
      targetDate = boundaries.earliestDataEndDay;
    }
    
    animator.navigateToDate(targetDate);
  }, [currentEndDate, animator]);

  // Navigate to a specific month
  const navigateToMonth = useCallback((year: number, month: number) => {
    const firstOfMonth = new CalendarDate(year, month, 1);
    const newEndDate = firstOfMonth.add({ days: DATE_BOUNDARIES.TILE_WIDTH - 1 });
    const boundaries = getDateBoundaries();
    
    // Clamp to data boundaries
    let targetDate = newEndDate;
    if (newEndDate.compare(boundaries.latestDataDay) > 0) {
      targetDate = boundaries.latestDataDay;
    } else if (newEndDate.compare(boundaries.earliestDataEndDay) < 0) {
      targetDate = boundaries.earliestDataEndDay;
    }
    
    animator.navigateToDate(targetDate);
  }, [animator]);

  // Navigate to today (yesterday actually)
  const navigateToToday = useCallback(() => {
    const boundaries = getDateBoundaries();
    animator.navigateToDate(boundaries.latestDataDay);
  }, [animator]);

  // Navigate to January 1 of a given year
  const navigateToYearStart = useCallback((targetYear: number) => {
    const jan1 = new CalendarDate(targetYear, 1, 1);
    const newEndDate = jan1.add({ days: DATE_BOUNDARIES.TILE_WIDTH - 1 });
    const boundaries = getDateBoundaries();
    
    // Clamp to data boundaries
    let targetDate = newEndDate;
    if (newEndDate.compare(boundaries.latestDataDay) > 0) {
      targetDate = boundaries.latestDataDay;
    } else if (newEndDate.compare(boundaries.earliestDataEndDay) < 0) {
      targetDate = boundaries.earliestDataEndDay;
    }
    
    animator.navigateToDate(targetDate);
  }, [animator]);

  // Navigate to start (earliest data end day)
  const navigateToStart = useCallback(() => {
    const boundaries = getDateBoundaries();
    animator.navigateToDate(boundaries.earliestDataEndDay);
  }, [animator]);

  // Keyboard event handler
  useEffect(() => {
    if (disabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Don't handle keyboard navigation while dragging
      if (isDragging) return;

      // Only handle if we have an end date
      if (!currentEndDate) return;

      const isShift = e.shiftKey;
      const isCmd = e.metaKey || e.ctrlKey; // Support both Mac (Cmd) and Windows/Linux (Ctrl)
      const monthsToMove = isShift ? 6 : 1;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isCmd) {
          // Command+Left: Go to Jan 1 of start year (or previous year if already Jan 1)
          const startDate = currentEndDate.subtract({ days: DATE_BOUNDARIES.TILE_WIDTH - 1 });
          const targetYear = (startDate.month === 1 && startDate.day === 1) 
            ? startDate.year - 1 
            : startDate.year;
          navigateToYearStart(targetYear);
        } else {
          navigateByMonths(-monthsToMove);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isCmd) {
          // Command+Right: Go to Jan 1 of end year (or next year if start date is already Jan 1)
          const startDate = currentEndDate.subtract({ days: DATE_BOUNDARIES.TILE_WIDTH - 1 });
          const targetYear = (startDate.month === 1 && startDate.day === 1) 
            ? currentEndDate.year + 1 
            : currentEndDate.year;
          navigateToYearStart(targetYear);
        } else {
          navigateByMonths(monthsToMove);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        navigateToToday();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        navigateToToday();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        navigateToStart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentEndDate, navigateByMonths, navigateToToday, navigateToYearStart, navigateToStart, isDragging, disabled]);

  return {
    navigateByMonths,
    navigateToMonth,
    navigateToToday,
    navigateToStart,
  };
}