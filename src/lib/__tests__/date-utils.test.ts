import { getAESTDateTimeString, getDaysBetween, getDayIndex, getDateFromIndex, isLeapYear, parseAESTDateString, getTodayAEST } from '@/shared/date-utils';
import { CalendarDate, today } from '@internationalized/date';

describe('Date Utilities', () => {
  describe('getAESTDateTimeString', () => {
    test('should return current time in AEST format without milliseconds when called without arguments', () => {
      const result = getAESTDateTimeString();
      
      // Check format: YYYY-MM-DDTHH:mm:ss+10:00
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+10:00$/);
      
      // Should not contain milliseconds
      expect(result).not.toContain('.');
      
      // Should not contain timezone identifier
      expect(result).not.toContain('[');
      expect(result).not.toContain('Australia/Brisbane');
      
      // Should contain the AEST offset
      expect(result).toContain('+10:00');
    });
    
    test('should convert a specific date to AEST format without milliseconds', () => {
      // Test with a known date/time
      const testDate = new Date('2023-07-21T06:30:45.123Z'); // UTC time
      const result = getAESTDateTimeString(testDate);
      
      // Check format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+10:00$/);
      
      // Should not contain milliseconds
      expect(result).not.toContain('.');
      
      // Should not contain timezone identifier
      expect(result).not.toContain('[');
      expect(result).not.toContain('Australia/Brisbane');
      
      // Should contain the AEST offset
      expect(result).toContain('+10:00');
      
      // The time should be 10 hours ahead of UTC
      // UTC: 2023-07-21T06:30:45
      // AEST: 2023-07-21T16:30:45+10:00
      expect(result).toBe('2023-07-21T16:30:45+10:00');
    });

    test('should handle dates across year boundaries', () => {
      // Test New Year's Eve UTC which becomes New Year's Day in AEST
      const newYearUTC = new Date('2023-12-31T14:30:00.000Z');
      const result = getAESTDateTimeString(newYearUTC);
      
      // UTC 14:30 on Dec 31 = AEST 00:30 on Jan 1
      expect(result).toBe('2024-01-01T00:30:00+10:00');
    });

    test('should handle dates during daylight saving time', () => {
      // Note: Brisbane doesn't observe DST, so it's always +10:00
      const summerDate = new Date('2024-01-15T12:00:00.000Z');
      const winterDate = new Date('2024-07-15T12:00:00.000Z');
      
      const summerResult = getAESTDateTimeString(summerDate);
      const winterResult = getAESTDateTimeString(winterDate);
      
      // Both should have +10:00 offset (no DST in Brisbane)
      expect(summerResult).toContain('+10:00');
      expect(winterResult).toContain('+10:00');
      
      // Verify the times
      expect(summerResult).toBe('2024-01-15T22:00:00+10:00');
      expect(winterResult).toBe('2024-07-15T22:00:00+10:00');
    });

  });

  describe('getDaysBetween', () => {
    test('should calculate days between two dates in the same year', () => {
      const start = new CalendarDate(2024, 1, 1);
      const end = new CalendarDate(2024, 1, 31);
      expect(getDaysBetween(start, end)).toBe(30);
    });

    test('should calculate days between two dates across years', () => {
      const start = new CalendarDate(2023, 12, 31);
      const end = new CalendarDate(2024, 1, 1);
      expect(getDaysBetween(start, end)).toBe(1);
    });

    test('should return negative days when end is before start', () => {
      const start = new CalendarDate(2024, 1, 31);
      const end = new CalendarDate(2024, 1, 1);
      expect(getDaysBetween(start, end)).toBe(-30);
    });

    test('should return 0 for the same date', () => {
      const date = new CalendarDate(2024, 3, 15);
      expect(getDaysBetween(date, date)).toBe(0);
    });

    test('should handle leap years correctly', () => {
      // 2024 is a leap year
      const start = new CalendarDate(2024, 2, 28);
      const end = new CalendarDate(2024, 3, 1);
      expect(getDaysBetween(start, end)).toBe(2); // Feb 29 exists

      // 2023 is not a leap year
      const start2 = new CalendarDate(2023, 2, 28);
      const end2 = new CalendarDate(2023, 3, 1);
      expect(getDaysBetween(start2, end2)).toBe(1); // Feb 29 doesn't exist
    });

    test('should calculate days for a full year correctly', () => {
      const start = new CalendarDate(2024, 1, 1);
      const end = new CalendarDate(2024, 12, 31);
      expect(getDaysBetween(start, end)).toBe(365); // 366 days in leap year minus 1

      const start2 = new CalendarDate(2023, 1, 1);
      const end2 = new CalendarDate(2023, 12, 31);
      expect(getDaysBetween(start2, end2)).toBe(364); // 365 days in regular year minus 1
    });

    test('should handle large date ranges', () => {
      const start = new CalendarDate(2020, 1, 1);
      const end = new CalendarDate(2025, 1, 1);
      // 2020 (leap): 366, 2021: 365, 2022: 365, 2023: 365, 2024 (leap): 366 = 1827 days
      expect(getDaysBetween(start, end)).toBe(1827);
    });
  });

  describe('getDayIndex', () => {
    test('should return 0 for January 1st', () => {
      const date = new CalendarDate(2024, 1, 1);
      expect(getDayIndex(date)).toBe(0);
    });

    test('should return 364 for December 31st in non-leap year', () => {
      const date = new CalendarDate(2023, 12, 31);
      expect(getDayIndex(date)).toBe(364);
    });

    test('should return 365 for December 31st in leap year', () => {
      const date = new CalendarDate(2024, 12, 31);
      expect(getDayIndex(date)).toBe(365);
    });

    test('should handle February 29th in leap year', () => {
      const date = new CalendarDate(2024, 2, 29);
      expect(getDayIndex(date)).toBe(59); // Jan: 31, Feb: 28 days before = 59
    });

    test('should handle mid-year dates correctly', () => {
      const date = new CalendarDate(2024, 7, 1); // July 1st
      // Jan: 31, Feb: 29, Mar: 31, Apr: 30, May: 31, Jun: 30 = 182
      expect(getDayIndex(date)).toBe(182);
    });
  });

  describe('getDateFromIndex', () => {
    test('should return January 1st for index 0', () => {
      const date = getDateFromIndex(2024, 0);
      expect(date.year).toBe(2024);
      expect(date.month).toBe(1);
      expect(date.day).toBe(1);
    });

    test('should return December 31st for index 364 in non-leap year', () => {
      const date = getDateFromIndex(2023, 364);
      expect(date.year).toBe(2023);
      expect(date.month).toBe(12);
      expect(date.day).toBe(31);
    });

    test('should return December 31st for index 365 in leap year', () => {
      const date = getDateFromIndex(2024, 365);
      expect(date.year).toBe(2024);
      expect(date.month).toBe(12);
      expect(date.day).toBe(31);
    });

    test('should return February 29th for index 59 in leap year', () => {
      const date = getDateFromIndex(2024, 59);
      expect(date.year).toBe(2024);
      expect(date.month).toBe(2);
      expect(date.day).toBe(29);
    });

    test('should throw error for invalid index', () => {
      expect(() => getDateFromIndex(2023, 365)).toThrow('Day index 365 is out of range for year 2023 (0-364)');
      expect(() => getDateFromIndex(2024, 366)).toThrow('Day index 366 is out of range for year 2024 (0-365)');
      expect(() => getDateFromIndex(2024, -1)).toThrow('Day index -1 is out of range for year 2024 (0-365)');
    });

    test('should be inverse of getDayIndex', () => {
      const testDates = [
        new CalendarDate(2024, 1, 1),
        new CalendarDate(2024, 2, 29),
        new CalendarDate(2024, 7, 15),
        new CalendarDate(2024, 12, 31),
        new CalendarDate(2023, 6, 15),
        new CalendarDate(2023, 12, 31)
      ];

      testDates.forEach(originalDate => {
        const index = getDayIndex(originalDate);
        const reconstructedDate = getDateFromIndex(originalDate.year, index);
        expect(reconstructedDate.toString()).toBe(originalDate.toString());
      });
    });
  });

  describe('isLeapYear', () => {
    test('should correctly identify leap years', () => {
      expect(isLeapYear(2024)).toBe(true);  // Divisible by 4
      expect(isLeapYear(2000)).toBe(true);  // Divisible by 400
      expect(isLeapYear(2020)).toBe(true);  // Divisible by 4
    });

    test('should correctly identify non-leap years', () => {
      expect(isLeapYear(2023)).toBe(false); // Not divisible by 4
      expect(isLeapYear(1900)).toBe(false); // Divisible by 100 but not 400
      expect(isLeapYear(2100)).toBe(false); // Divisible by 100 but not 400
    });
  });

  describe('parseAESTDateString', () => {
    test('should parse plain date format YYYY-MM-DD', () => {
      const date = parseAESTDateString('2025-07-21');
      expect(date.year).toBe(2025);
      expect(date.month).toBe(7);
      expect(date.day).toBe(21);
    });

    test('should parse AEST datetime format with +10:00 offset', () => {
      const date = parseAESTDateString('2025-07-21T00:00:00+10:00');
      expect(date.year).toBe(2025);
      expect(date.month).toBe(7);
      expect(date.day).toBe(21);
    });

    test('should extract date part from datetime string', () => {
      const date = parseAESTDateString('2025-12-31T23:59:59+10:00');
      expect(date.year).toBe(2025);
      expect(date.month).toBe(12);
      expect(date.day).toBe(31);
    });

    test('should handle UTC timestamps by converting to Brisbane time', () => {
      // UTC 23:00 on July 22 is July 23 in Brisbane
      const date = parseAESTDateString('2025-07-22T23:00:00.000Z');
      expect(date.year).toBe(2025);
      expect(date.month).toBe(7);
      expect(date.day).toBe(23);
      
      // UTC 00:00 on July 23 is July 23 in Brisbane (10:00)
      const date2 = parseAESTDateString('2025-07-23T00:00:00.000Z');
      expect(date2.year).toBe(2025);
      expect(date2.month).toBe(7);
      expect(date2.day).toBe(23);
      
      // UTC 14:00 on July 22 is July 23 in Brisbane (00:00)
      const date3 = parseAESTDateString('2025-07-22T14:00:00.000Z');
      expect(date3.year).toBe(2025);
      expect(date3.month).toBe(7);
      expect(date3.day).toBe(23);
      
      // UTC 13:59 on July 22 is still July 22 in Brisbane (23:59)
      const date4 = parseAESTDateString('2025-07-22T13:59:00.000Z');
      expect(date4.year).toBe(2025);
      expect(date4.month).toBe(7);
      expect(date4.day).toBe(22);
      
      // Test year boundary
      const date5 = parseAESTDateString('2025-12-31T23:00:00.000Z');
      expect(date5.year).toBe(2026);
      expect(date5.month).toBe(1);
      expect(date5.day).toBe(1);
    });

    test('should throw error for invalid formats', () => {
      // Wrong offset
      expect(() => parseAESTDateString('2025-07-21T00:00:00+11:00'))
        .toThrow('Invalid date format: "2025-07-21T00:00:00+11:00". Expected either "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss+10:00", or "YYYY-MM-DDTHH:mm:ss[.sss]Z"');
      
      // Missing time
      expect(() => parseAESTDateString('2025-07-21T'))
        .toThrow('Invalid date format: "2025-07-21T". Expected either "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss+10:00", or "YYYY-MM-DDTHH:mm:ss[.sss]Z"');
      
      // Wrong separator
      expect(() => parseAESTDateString('2025/07/21'))
        .toThrow('Invalid date format: "2025/07/21". Expected either "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss+10:00", or "YYYY-MM-DDTHH:mm:ss[.sss]Z"');
      
      // Extra characters
      expect(() => parseAESTDateString('2025-07-21 extra'))
        .toThrow('Invalid date format: "2025-07-21 extra". Expected either "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss+10:00", or "YYYY-MM-DDTHH:mm:ss[.sss]Z"');
    });

    test('should handle edge cases correctly', () => {
      // Leap year date
      const leapDate = parseAESTDateString('2024-02-29');
      expect(leapDate.year).toBe(2024);
      expect(leapDate.month).toBe(2);
      expect(leapDate.day).toBe(29);
      
      // Year boundaries
      const newYear = parseAESTDateString('2025-01-01T00:00:00+10:00');
      expect(newYear.year).toBe(2025);
      expect(newYear.month).toBe(1);
      expect(newYear.day).toBe(1);
    });
  });

  describe('getTodayAEST', () => {
    test('should return a CalendarDate object', () => {
      const result = getTodayAEST();
      expect(result).toBeInstanceOf(CalendarDate);
    });

    test('should return today in AEST timezone', () => {
      const result = getTodayAEST();
      const expectedToday = today('Australia/Brisbane');
      
      expect(result.year).toBe(expectedToday.year);
      expect(result.month).toBe(expectedToday.month);
      expect(result.day).toBe(expectedToday.day);
    });

    test('should match the date part of a formatted AEST datetime', () => {
      const todayAEST = getTodayAEST();
      const nowAEST = getAESTDateTimeString();
      
      // Extract date part from the datetime string
      const datePart = nowAEST.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      
      expect(todayAEST.year).toBe(year);
      expect(todayAEST.month).toBe(month);
      expect(todayAEST.day).toBe(day);
    });

    test('should be consistent across multiple calls', () => {
      const result1 = getTodayAEST();
      const result2 = getTodayAEST();
      
      expect(result1.toString()).toBe(result2.toString());
    });
  });
});