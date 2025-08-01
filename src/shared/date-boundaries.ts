import { CalendarDate } from '@internationalized/date';
import { getTodayAEST } from '@/shared/date-utils';
import { DATE_BOUNDARIES } from '@/shared/config';

/**
 * Centralized date boundary calculations for the application
 * All date boundary logic should use this module to ensure consistency
 */

/**
 * Get the date boundaries for the application
 * @returns Object with all relevant date boundaries
 */
export function getDateBoundaries() {
  // Data boundaries
  const earliestDataDay = DATE_BOUNDARIES.EARLIEST_START_DATE;
  const earliestDataEndDay = earliestDataDay.add({ days: 364 }); // 365 days from start for end date navigation
  const latestDataDay = getTodayAEST().subtract({ days: 1 }); // Yesterday AEST
  
  // Display boundaries (with slop buffer)
  const slopMonths = DATE_BOUNDARIES.DISPLAY_SLOP_MONTHS;
  const earliestDisplayDay = earliestDataDay.subtract({ months: slopMonths });
  const latestDisplayDay = latestDataDay.add({ months: slopMonths });
  
  // Year boundaries
  const earliestDataYear = earliestDataDay.year;
  const latestDataYear = latestDataDay.year;
  
  return {
    // Data boundaries (hard limits for actual data)
    earliestDataDay,
    earliestDataEndDay, // Use this for end date navigation boundaries
    latestDataDay,
    earliestDataYear,
    latestDataYear,
    
    // Display boundaries (soft limits with buffer for UI)
    earliestDisplayDay,
    latestDisplayDay,
    
    // Utility methods
    isWithinDataBounds(date: CalendarDate): boolean {
      return date.compare(earliestDataDay) >= 0 && date.compare(latestDataDay) <= 0;
    },
    
    isWithinDisplayBounds(date: CalendarDate): boolean {
      return date.compare(earliestDisplayDay) >= 0 && date.compare(latestDisplayDay) <= 0;
    },
    
    clampToDataBounds(date: CalendarDate): CalendarDate {
      if (date.compare(earliestDataDay) < 0) return earliestDataDay;
      if (date.compare(latestDataDay) > 0) return latestDataDay;
      return date;
    },
    
    clampToDisplayBounds(date: CalendarDate): CalendarDate {
      if (date.compare(earliestDisplayDay) < 0) return earliestDisplayDay;
      if (date.compare(latestDisplayDay) > 0) return latestDisplayDay;
      return date;
    }
  };
}

// Export a type for the return value
export type DateBoundaries = ReturnType<typeof getDateBoundaries>;