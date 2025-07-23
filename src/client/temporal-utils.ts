import { CalendarDate, getLocalTimeZone } from '@internationalized/date';

/**
 * Utility functions for working with CalendarDate dates in the frontend
 */
export class DateUtils {
  /**
   * Convert CalendarDate to a string key for React components
   */
  static toKey(date: CalendarDate): string {
    return date.toString();
  }

  /**
   * Convert CalendarDate to formatted display string
   */
  static toDisplayString(date: CalendarDate): string {
    return date.toDate(getLocalTimeZone()).toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  }

  /**
   * Format date range for display
   */
  static formatDateRange(start: CalendarDate, end: CalendarDate): string {
    const startFormatted = start.toDate(getLocalTimeZone()).toLocaleDateString('en-AU', { 
      day: 'numeric',
      month: 'long', 
      year: 'numeric'
    });
    
    const endFormatted = end.toDate(getLocalTimeZone()).toLocaleDateString('en-AU', { 
      day: 'numeric',
      month: 'long', 
      year: 'numeric'
    });
    
    return `${startFormatted} – ${endFormatted}`;
  }

  /**
   * Create a simple date-indexed object from Map for easier frontend usage
   */
  static mapToDateObject(map: Map<CalendarDate, number>): Record<string, number> {
    const obj: Record<string, number> = {};
    for (const [date, value] of map) {
      obj[date.toString()] = value;
    }
    return obj;
  }
}