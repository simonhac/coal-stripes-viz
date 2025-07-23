import { TimeSeriesCache } from '@/client/time-series-cache';
import { CoalStripesData } from '@/shared/types';

describe('TimeSeriesCache', () => {
  let cache: TimeSeriesCache;
  
  // Mock data for testing
  const createMockData = (year: number): CoalStripesData => {
    const daysInYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
    
    // Create mock capacity factor data
    const mockData = new Array(daysInYear).fill(null).map((_, i) => {
      // Generate some realistic capacity factors (0-100%)
      return Math.round((70 + Math.sin(i / 30) * 20) * 10) / 10;
    });
    
    return {
      data: [
        {
          facility_name: 'Eraring',
          facility_id: 'eraring-1',
          duid: 'ER01',
          capacity: 720,
          fuel_source_descriptor: 'Black Coal',
          commissioned_date: '1982-08-01',
          decommissioned_date: null,
          latest_carbon_intensity: 0.9,
          history: {
            start: `${year}-01-01`,
            data: mockData
          }
        },
        {
          facility_name: 'Bayswater',
          facility_id: 'bayswater-1',
          duid: 'BW01',
          capacity: 660,
          fuel_source_descriptor: 'Black Coal',
          commissioned_date: '1985-11-01',
          decommissioned_date: null,
          latest_carbon_intensity: 0.91,
          history: {
            start: `${year}-01-01`,
            data: mockData.map(v => v !== null ? v * 0.9 : null)
          }
        }
      ],
      metadata: {
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
        version: '1.0',
        created_at: new Date().toISOString()
      }
    };
  };

  beforeEach(() => {
    cache = new TimeSeriesCache(3); // Max 3 years
  });

  describe('basic operations', () => {
    test('should start with empty cache', () => {
      const stats = cache.getCacheStats();
      expect(stats.yearCount).toBe(0);
      expect(stats.totalMB).toBe(0);
      expect(stats.cachedYears).toEqual([]);
    });

    test('should add a year to cache', () => {
      const mockData = createMockData(2023);
      cache.addYear(2023, mockData);
      
      const stats = cache.getCacheStats();
      expect(stats.yearCount).toBe(1);
      expect(stats.cachedYears).toEqual([2023]);
      expect(stats.totalMB).toBeGreaterThan(0);
    });

    test('should retrieve cached year data', () => {
      const mockData = createMockData(2023);
      cache.addYear(2023, mockData);
      
      const retrieved = cache.getYear(2023);
      expect(retrieved).toEqual(mockData);
    });

    test('should return null for uncached year', () => {
      const result = cache.getYear(2023);
      expect(result).toBeNull();
    });

    test('should check if year exists', () => {
      const mockData = createMockData(2023);
      cache.addYear(2023, mockData);
      
      expect(cache.hasYear(2023)).toBe(true);
      expect(cache.hasYear(2024)).toBe(false);
    });
  });

  describe('LRU eviction', () => {
    test('should evict oldest year when over limit', async () => {
      // Add 3 years (at capacity)
      cache.addYear(2021, createMockData(2021));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      cache.addYear(2022, createMockData(2022));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      cache.addYear(2023, createMockData(2023));
      
      let stats = cache.getCacheStats();
      expect(stats.yearCount).toBe(3);
      expect(stats.cachedYears).toEqual([2021, 2022, 2023]);
      
      // Access 2021 to make it more recent
      cache.getYear(2021);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Add 2024 - should evict 2022 (oldest by access time)
      cache.addYear(2024, createMockData(2024));
      
      stats = cache.getCacheStats();
      expect(stats.yearCount).toBe(3);
      expect(stats.cachedYears).toEqual([2021, 2023, 2024]);
      expect(cache.hasYear(2022)).toBe(false);
    });

    test('should handle multiple evictions correctly', () => {
      // Create a cache with limit of 2
      const smallCache = new TimeSeriesCache(2);
      
      smallCache.addYear(2021, createMockData(2021));
      smallCache.addYear(2022, createMockData(2022));
      smallCache.addYear(2023, createMockData(2023));
      
      const stats = smallCache.getCacheStats();
      expect(stats.yearCount).toBe(2);
      expect(cache.hasYear(2021)).toBe(false); // Should be evicted
    });
  });

  describe('clear operation', () => {
    test('should clear all cached data', () => {
      cache.addYear(2021, createMockData(2021));
      cache.addYear(2022, createMockData(2022));
      cache.addYear(2023, createMockData(2023));
      
      let stats = cache.getCacheStats();
      expect(stats.yearCount).toBe(3);
      
      cache.clear();
      
      stats = cache.getCacheStats();
      expect(stats.yearCount).toBe(0);
      expect(stats.totalMB).toBe(0);
      expect(stats.cachedYears).toEqual([]);
      
      // Verify data is actually gone
      expect(cache.getYear(2021)).toBeNull();
      expect(cache.getYear(2022)).toBeNull();
      expect(cache.getYear(2023)).toBeNull();
    });
  });

  describe('memory statistics', () => {
    test('should calculate reasonable memory estimates', () => {
      const mockData = createMockData(2023);
      cache.addYear(2023, mockData);
      
      const stats = cache.getCacheStats();
      expect(stats.totalMB).toBeGreaterThan(0);
      expect(stats.totalMB).toBeLessThan(10); // Should be less than 10MB for one year
    });
  });

  describe('console logging', () => {
    let consoleSpy: jest.SpyInstance;
    
    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });
    
    afterEach(() => {
      consoleSpy.mockRestore();
    });

    test('should log cache operations', () => {
      const mockData = createMockData(2023);
      cache.addYear(2023, mockData);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('💾 Cached year 2023')
      );
    });

    test('should log evictions', () => {
      // Fill cache to capacity
      cache.addYear(2021, createMockData(2021));
      cache.addYear(2022, createMockData(2022));
      cache.addYear(2023, createMockData(2023));
      
      consoleSpy.mockClear();
      
      // This should trigger eviction
      cache.addYear(2024, createMockData(2024));
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🗑️ Evicted year')
      );
    });

    test('should log clear operations', () => {
      cache.addYear(2023, createMockData(2023));
      
      consoleSpy.mockClear();
      cache.clear();
      
      expect(consoleSpy).toHaveBeenCalledWith('🗑️ Cache cleared');
    });
  });
});