import { useEffect, useCallback } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getTodayAEST } from '@/shared/date-utils';
import { yearDataVendor } from '@/client/year-data-vendor';

interface NavigationOptions {
  endDate: CalendarDate | null;
  onDateChange: (newEndDate: CalendarDate) => void;
  onBoundaryHit?: () => void;
  isDragging?: boolean;
}

export function useNavigation({ endDate, onDateChange, onBoundaryHit, isDragging }: NavigationOptions) {
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

  // Navigate to a specific date (used by drag navigation)
  const navigateToDate = useCallback((newEndDate: CalendarDate) => {
    const yesterday = getTodayAEST().subtract({ days: 1 });
    
    // Don't go past yesterday
    if (newEndDate.compare(yesterday) > 0) {
      if (!endDate || endDate.compare(yesterday) < 0) {
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
    navigateToDate(yesterday);
  }, [navigateToDate]);

  // Navigate to January 1 of a given year
  const navigateToYearStart = useCallback((targetYear: number) => {
    const jan1 = new CalendarDate(targetYear, 1, 1);
    const newEndDate = jan1.add({ days: 364 });
    const yesterday = getTodayAEST().subtract({ days: 1 });
    
    // Don't go past yesterday
    if (newEndDate.compare(yesterday) > 0) {
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Don't handle keyboard navigation while dragging
      if (isDragging) return;

      // Only handle if we have an end date
      if (!endDate) return;

      const isShift = e.shiftKey;
      const isCmd = e.metaKey || e.ctrlKey; // Support both Mac (Cmd) and Windows/Linux (Ctrl)
      const monthsToMove = isShift ? 6 : 1;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isCmd) {
          // Command+Left: Go to Jan 1 of start year (or previous year if already Jan 1)
          const startDate = endDate.subtract({ days: 364 });
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
          const startDate = endDate.subtract({ days: 364 });
          const targetYear = (startDate.month === 1 && startDate.day === 1) 
            ? endDate.year + 1 
            : endDate.year;
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [endDate, navigateByMonths, navigateToToday, navigateToYearStart, isDragging]);

  return {
    navigateByMonths,
    navigateToMonth,
    navigateToToday,
    navigateToDate,
  };
}