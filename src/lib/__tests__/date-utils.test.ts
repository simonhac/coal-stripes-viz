import { getCurrentTimeInAEST, getTimeInAEST } from '../date-utils';

describe('Date Utilities', () => {
  describe('getCurrentTimeInAEST', () => {
    test('should return current time in AEST format without milliseconds', () => {
      const result = getCurrentTimeInAEST();
      
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
  });

  describe('getTimeInAEST', () => {
    test('should convert a specific date to AEST format without milliseconds', () => {
      // Test with a known date/time
      const testDate = new Date('2023-07-21T06:30:45.123Z'); // UTC time
      const result = getTimeInAEST(testDate);
      
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
      const result = getTimeInAEST(newYearUTC);
      
      // UTC 14:30 on Dec 31 = AEST 00:30 on Jan 1
      expect(result).toBe('2024-01-01T00:30:00+10:00');
    });

    test('should handle dates during daylight saving time', () => {
      // Note: Brisbane doesn't observe DST, so it's always +10:00
      const summerDate = new Date('2024-01-15T12:00:00.000Z');
      const winterDate = new Date('2024-07-15T12:00:00.000Z');
      
      const summerResult = getTimeInAEST(summerDate);
      const winterResult = getTimeInAEST(winterDate);
      
      // Both should have +10:00 offset (no DST in Brisbane)
      expect(summerResult).toContain('+10:00');
      expect(winterResult).toContain('+10:00');
      
      // Verify the times
      expect(summerResult).toBe('2024-01-15T22:00:00+10:00');
      expect(winterResult).toBe('2024-07-15T22:00:00+10:00');
    });

    test('should maintain consistency between getCurrentTimeInAEST and getTimeInAEST', () => {
      const now = new Date();
      const currentResult = getCurrentTimeInAEST();
      const specificResult = getTimeInAEST(now);
      
      // They should be very close (within a second due to execution time)
      const currentTime = new Date(currentResult);
      const specificTime = new Date(specificResult);
      const timeDiff = Math.abs(currentTime.getTime() - specificTime.getTime());
      
      expect(timeDiff).toBeLessThan(1000); // Less than 1 second difference
    });
  });
});