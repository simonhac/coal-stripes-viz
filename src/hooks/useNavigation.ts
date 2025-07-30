import { useEffect, useCallback } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getTodayAEST } from '@/shared/date-utils';
import { yearDataVendor } from '@/client/year-data-vendor';

interface NavigationOptions {
  endDate: CalendarDate | null;
  onDateChange: (newEndDate: CalendarDate) => void;
  onBoundaryHit?: () => void;
}

export function useNavigation({ endDate, onDateChange, onBoundaryHit }: NavigationOptions) {
  // Preload years for a given date range
  const preloadYearsForDate = useCallback((newEndDate: CalendarDate) => {
    const startDate = newEndDate.subtract({ days: 364 });
    const years = new Set([startDate.year, newEndDate.year]);
    years.forEach(year => {
      yearDataVendor.requestYear(year).catch(err => {
        console.error(`Failed to preload year ${year}:`, err);
      });
    });
  }, []);

  // Navigate by months (used by keyboard navigation)
  const navigateByMonths = useCallback((months: number) => {
    if (!endDate) return;
    
    const newEndDate = endDate.add({ months });
    const yesterday = getTodayAEST().subtract({ days: 1 });
    
    // Don't go past yesterday
    if (newEndDate.compare(yesterday) > 0) {
      if (endDate.compare(yesterday) < 0) {
        onDateChange(yesterday);
        preloadYearsForDate(yesterday);
      } else if (onBoundaryHit) {
        onBoundaryHit();
      }
    } else {
      onDateChange(newEndDate);
      preloadYearsForDate(newEndDate);
    }
  }, [endDate, onDateChange, preloadYearsForDate, onBoundaryHit]);

  // Navigate to a specific month (used by clicking month boxes)
  const navigateToMonth = useCallback((year: number, month: number) => {
    // Set the end date to be 364 days after the first of the clicked month
    // This gives us a 365-day range starting from the first of that month
    const firstOfMonth = new CalendarDate(year, month, 1);
    const newEndDate = firstOfMonth.add({ days: 364 });
    
    const yesterday = getTodayAEST().subtract({ days: 1 });
    
    // Don't go past yesterday
    if (newEndDate.compare(yesterday) > 0) {
      // Check if we would actually move the date
      if (endDate && endDate.compare(yesterday) >= 0 && onBoundaryHit) {
        onBoundaryHit();
      } else {
        onDateChange(yesterday);
        preloadYearsForDate(yesterday);
      }
    } else {
      onDateChange(newEndDate);
      preloadYearsForDate(newEndDate);
    }
  }, [endDate, onDateChange, preloadYearsForDate, onBoundaryHit]);

  // Navigate to today (minus one day)
  const navigateToToday = useCallback(() => {
    const yesterday = getTodayAEST().subtract({ days: 1 });
    onDateChange(yesterday);
    preloadYearsForDate(yesterday);
  }, [onDateChange, preloadYearsForDate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Only handle if we have an end date
      if (!endDate) return;

      const isShift = e.shiftKey;
      const monthsToMove = isShift ? 6 : 1;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateByMonths(-monthsToMove);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateByMonths(monthsToMove);
      } else if (e.key === 'Home') {
        e.preventDefault();
        navigateToToday();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [endDate, navigateByMonths, navigateToToday]);

  return {
    navigateByMonths,
    navigateToMonth,
    navigateToToday,
  };
}