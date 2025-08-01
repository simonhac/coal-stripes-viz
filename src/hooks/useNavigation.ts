import { useEffect, useCallback } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getTodayAEST } from '@/shared/date-utils';
import { yearDataVendor } from '@/client/year-data-vendor';
import { DATE_BOUNDARIES } from '@/shared/config';

interface NavigationOptions {
  endDate: CalendarDate | null;
  onDateChange: (newEndDate: CalendarDate) => void;
  isDragging?: boolean;
}

export function useNavigation({ endDate, onDateChange, isDragging }: NavigationOptions) {
  // Preload years for a given date range
  const preloadYearsForDate = useCallback((newEndDate: CalendarDate) => {
    const startDate = newEndDate.subtract({ days: 364 });
    const years = new Set([startDate.year, newEndDate.year]);
    
    // Add year before and after
    const yearBefore = startDate.year - 1;
    const yearAfter = newEndDate.year + 1;
    
    // Get current year to check upper boundary
    const currentYear = getTodayAEST().year;
    
    // Add adjacent years if they're within valid bounds
    // Lower bound: 2006 (earliest data is from 2006)
    if (yearBefore >= 2006) {
      years.add(yearBefore);
    }
    
    // Upper bound: current year (can't have data for future years)
    if (yearAfter <= currentYear) {
      years.add(yearAfter);
    }
    
    // Filter out years that are already cached
    const yearsToLoad = Array.from(years).filter(year => !yearDataVendor.hasYear(year));
    
    if (yearsToLoad.length > 0) {
      console.log(`📅 Preloading years: ${yearsToLoad.sort().join(', ')}`);
      
      yearsToLoad.forEach(year => {
        yearDataVendor.requestYear(year).catch(err => {
          console.error(`Failed to preload year ${year}:`, err);
        });
      });
    }
  }, []);

  // Navigate to a specific date (used by drag navigation)
  const navigateToDate = useCallback((newEndDate: CalendarDate) => {
    const yesterday = getTodayAEST().subtract({ days: 1 });
    const earliestDate = DATE_BOUNDARIES.EARLIEST_END_DATE;
    
    // Check both boundaries
    if (newEndDate.compare(yesterday) > 0) {
      // Trying to go past yesterday
      if (!endDate || endDate.compare(yesterday) < 0) {
        onDateChange(yesterday);
        preloadYearsForDate(yesterday);
      }
    } else if (newEndDate.compare(earliestDate) < 0) {
      // Trying to go before earliest date
      if (!endDate || endDate.compare(earliestDate) > 0) {
        onDateChange(earliestDate);
        preloadYearsForDate(earliestDate);
      }
    } else {
      // Date is within valid range
      onDateChange(newEndDate);
      preloadYearsForDate(newEndDate);
    }
  }, [endDate, onDateChange, preloadYearsForDate]);

  // Navigate by months (used by keyboard navigation)
  const navigateByMonths = useCallback((months: number) => {
    if (!endDate) return;
    
    const newEndDate = endDate.add({ months });
    const yesterday = getTodayAEST().subtract({ days: 1 });
    const earliestDate = DATE_BOUNDARIES.EARLIEST_END_DATE;
    
    // Check both boundaries
    if (newEndDate.compare(yesterday) > 0) {
      // Trying to go past yesterday
      if (endDate.compare(yesterday) < 0) {
        onDateChange(yesterday);
        preloadYearsForDate(yesterday);
      }
    } else if (newEndDate.compare(earliestDate) < 0) {
      // Trying to go before earliest date
      if (endDate.compare(earliestDate) > 0) {
        onDateChange(earliestDate);
        preloadYearsForDate(earliestDate);
      }
    } else {
      // Date is within valid range
      onDateChange(newEndDate);
      preloadYearsForDate(newEndDate);
    }
  }, [endDate, onDateChange, preloadYearsForDate]);

  // Navigate to a specific month (used by clicking month boxes)
  const navigateToMonth = useCallback((year: number, month: number) => {
    // Set the end date to be 364 days after the first of the clicked month
    // This gives us a 365-day range starting from the first of that month
    const firstOfMonth = new CalendarDate(year, month, 1);
    const newEndDate = firstOfMonth.add({ days: 364 });
    
    navigateToDate(newEndDate);
  }, [navigateToDate]);

  // Navigate to today (minus one day)
  const navigateToToday = useCallback(() => {
    const yesterday = getTodayAEST().subtract({ days: 1 });
    navigateToDate(yesterday);
  }, [navigateToDate]);

  // Navigate to January 1 of a given year
  const navigateToYearStart = useCallback((targetYear: number) => {
    const jan1 = new CalendarDate(targetYear, 1, 1);
    const newEndDate = jan1.add({ days: 364 });
    
    navigateToDate(newEndDate);
  }, [navigateToDate]);

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