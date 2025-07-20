import { TimeSeriesCache, CacheEntry } from '../time-series-cache';
import { CoalStripesData } from '../types';
import { parseDate } from '@internationalized/date';

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
    
    const units = [
      {
        network: 'nem',
        region: 'NSW1',
        data_type: 'capacity_factor',
        units: 'percentage',
        capacity: 720,
        duid: 'ER01',
        facility_code: 'ERARING',
        facility_name: 'Eraring',
        fueltech: 'coal_black' as const,
        history: {
          start: `${year}-01-01`,
          last: `${year}-12-31`,
          interval: '1d',
          data: mockData
        }
      },
      {
        network: 'nem',
        region: 'NSW1',
        data_type: 'capacity_factor',
        units: 'percentage',
        capacity: 660,
        duid: 'BW01',
        facility_code: 'BAYSW',
        facility_name: 'Bayswater',
        fueltech: 'coal_black' as const,
        history: {
          start: `${year}-01-01`,
          last: `${year}-12-31`,
          interval: '1d',
          data: mockData.map(v => v !== null ? v * 0.9 : null) // Slightly different values
        }
      }
    ];
    
    return { 
      type: "capacity_factors" as const,
      version: "1.0",
      created_at: new Date().toISOString(),
      data: units 
    };
  };

  beforeEach(() => {
    cache = new TimeSeriesCache(3); // Max 3 chunks for testing
  });

  afterEach(async () => {
    // Clear cache and wait for any pending operations
    cache.clear();
    await new Promise(resolve => setImmediate(resolve));
  });

  describe('basic operations', () => {
    test('should start with empty cache', () => {
      const stats = cache.getCacheStats();
      expect(stats.chunkCount).toBe(0);
      expect(stats.sizeMB).toBe(0);
    });

    test('should add a chunk to cache', () => {
      const data2023 = createMockData(2023);
      
      cache.addChunk(2023, data2023);
      
      const stats = cache.getCacheStats();
      expect(stats.chunkCount).toBe(1);
      expect(stats.sizeMB).toBeGreaterThan(0);
    });

    test('should retrieve cached data for same year', () => {
      const data2023 = createMockData(2023);
      
      cache.addChunk(2023, data2023);
      
      const retrieved = cache.getDataForDateRange(
        parseDate('2023-01-01'),
        parseDate('2023-01-03')
      );
      
      expect(retrieved).toBeTruthy();
      expect(retrieved?.data).toHaveLength(2);
      expect(retrieved?.data[0].duid).toBe('ER01');
    });

    test('should return null for uncached year', () => {
      const retrieved = cache.getDataForDateRange(
        parseDate('2022-01-01'),
        parseDate('2022-12-31')
      );
      
      expect(retrieved).toBeNull();
    });

    test('should return partial data for cross-year queries when years missing', () => {
      const data2023 = createMockData(2023);
      cache.addChunk(2023, data2023);
      
      // Request cross-year range where 2024 is missing
      const retrieved = cache.getDataForDateRange(
        parseDate('2023-11-01'),
        parseDate('2024-02-28')
      );
      
      expect(retrieved).toBeTruthy();
      expect('isPartial' in retrieved!).toBe(true);
      if ('isPartial' in retrieved!) {
        expect(retrieved.isPartial).toBe(true);
        expect(retrieved.missingYears).toEqual([2024]);
        expect(retrieved.availableYears).toEqual([2023]);
      }
    });

    test('should return combined data for cross-year queries when all years cached', () => {
      // Add both required years to cache
      cache.addChunk(2022, createMockData(2022));
      cache.addChunk(2023, createMockData(2023));
      
      // Request cross-year range where both years are available
      const retrieved = cache.getDataForDateRange(
        parseDate('2022-11-01'),
        parseDate('2023-02-28')
      );
      
      // Should successfully combine the data
      expect(retrieved).toBeTruthy();
      expect('isPartial' in retrieved!).toBe(false);
      // Should have units from the cache
      expect(retrieved!.data.length).toBeGreaterThan(0);
    });
  });

  describe('hasDataForDate', () => {
    test('should correctly identify cached dates', () => {
      const data2023 = createMockData(2023);
      cache.addChunk(2023, data2023);
      
      expect(cache.hasDataForDate(parseDate('2023-06-15'))).toBe(true);
      expect(cache.hasDataForDate(parseDate('2023-01-01'))).toBe(true);
      expect(cache.hasDataForDate(parseDate('2023-12-31'))).toBe(true);
      expect(cache.hasDataForDate(parseDate('2022-12-31'))).toBe(false);
      expect(cache.hasDataForDate(parseDate('2024-01-01'))).toBe(false);
    });
  });

  describe('LRU eviction', () => {
    test('should evict oldest chunk when over limit', async () => {
      // Add 3 chunks (at max capacity)
      cache.addChunk(2021, createMockData(2021));
      cache.addChunk(2022, createMockData(2022));
      cache.addChunk(2023, createMockData(2023));
      
      let stats = cache.getCacheStats();
      expect(stats.chunkCount).toBe(3);
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Access 2021 and 2022 to update their access times
      cache.getDataForDateRange(parseDate('2021-06-01'), parseDate('2021-06-30'));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      cache.getDataForDateRange(parseDate('2022-06-01'), parseDate('2022-06-30'));
      
      // Don't access 2023, so it remains least recently used
      
      // Add 2024, should evict 2023 (least recently used)
      cache.addChunk(2024, createMockData(2024));
      
      stats = cache.getCacheStats();
      expect(stats.chunkCount).toBe(3);
      
      // 2023 should be evicted
      expect(cache.hasDataForDate(parseDate('2023-06-15'))).toBe(false);
      expect(cache.hasDataForDate(parseDate('2021-06-15'))).toBe(true);
      expect(cache.hasDataForDate(parseDate('2022-06-15'))).toBe(true);
      expect(cache.hasDataForDate(parseDate('2024-06-15'))).toBe(true);
    });

    test('should handle multiple evictions correctly', () => {
      // Fill cache
      cache.addChunk(2020, createMockData(2020));
      cache.addChunk(2021, createMockData(2021));
      cache.addChunk(2022, createMockData(2022));
      
      // Access only 2022
      cache.getDataForDateRange(parseDate('2022-06-01'), parseDate('2022-06-30'));
      
      // Add two more years, should evict 2020 and 2021
      cache.addChunk(2023, createMockData(2023));
      cache.addChunk(2024, createMockData(2024));
      
      const stats = cache.getCacheStats();
      expect(stats.chunkCount).toBe(3);
      
      // Only most recent 3 should remain
      expect(cache.hasDataForDate(parseDate('2020-06-15'))).toBe(false);
      expect(cache.hasDataForDate(parseDate('2021-06-15'))).toBe(false);
      expect(cache.hasDataForDate(parseDate('2022-06-15'))).toBe(true);
      expect(cache.hasDataForDate(parseDate('2023-06-15'))).toBe(true);
      expect(cache.hasDataForDate(parseDate('2024-06-15'))).toBe(true);
    });
  });

  describe('clear operation', () => {
    test('should clear all cached data', () => {
      cache.addChunk(2021, createMockData(2021));
      cache.addChunk(2022, createMockData(2022));
      cache.addChunk(2023, createMockData(2023));
      
      let stats = cache.getCacheStats();
      expect(stats.chunkCount).toBe(3);
      expect(stats.sizeMB).toBeGreaterThan(0);
      
      cache.clear();
      
      stats = cache.getCacheStats();
      expect(stats.chunkCount).toBe(0);
      expect(stats.sizeMB).toBe(0);
      
      expect(cache.hasDataForDate(parseDate('2023-06-15'))).toBe(false);
    });
  });

  describe('memory statistics', () => {
    test('should calculate reasonable memory estimates', () => {
      const data = createMockData(2023);
      
      cache.addChunk(2023, data);
      
      const stats = cache.getCacheStats();
      expect(stats.sizeMB).toBeGreaterThan(0);
      expect(stats.sizeMB).toBeLessThan(100); // Reasonable upper bound
    });
  });

  describe('console logging', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(async () => {
      consoleSpy.mockRestore();
      // Wait for any pending operations to complete
      await new Promise(resolve => setImmediate(resolve));
    });

    test('should log cache operations', () => {
      const data = createMockData(2023);
      cache.addChunk(2023, data);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('💾 Cached 2023')
      );
      
      // TimeSeriesCache no longer logs lookup operations - that's handled by SmartCache
      cache.getDataForDateRange(parseDate('2023-06-01'), parseDate('2023-06-30'));
      
      // Just verify the caching message was called
      expect(consoleSpy).toHaveBeenCalledTimes(1);
    });

    test('should handle cache misses silently', () => {
      const result = cache.getDataForDateRange(parseDate('2023-06-01'), parseDate('2023-06-30'));
      expect(result).toBeNull();
    });
    
    test('should return partial data when years missing', () => {
      // Add 2023 but not 2024, then request cross-year range
      cache.addChunk(2023, createMockData(2023));
      
      const result = cache.getDataForDateRange(parseDate('2023-11-01'), parseDate('2024-02-28'));
      
      // Should return partial result
      expect(result).toBeTruthy();
      expect('isPartial' in result!).toBe(true);
      if ('isPartial' in result!) {
        expect(result.isPartial).toBe(true);
        expect(result.missingYears).toEqual([2024]);
        expect(result.availableYears).toEqual([2023]);
      }
    });
    
    test('should combine data when all years cached', () => {
      // Add both years to cache
      cache.addChunk(2022, createMockData(2022));
      cache.addChunk(2023, createMockData(2023));
      
      const result = cache.getDataForDateRange(parseDate('2022-11-01'), parseDate('2023-02-28'));
      
      // Should successfully combine the data
      expect(result).toBeTruthy();
      expect('isPartial' in result!).toBe(false);
      // Should have units from the cache
      expect(result!.data.length).toBeGreaterThan(0);
      
      // Verify both caching messages were logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('💾 Cached 2022')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('💾 Cached 2023')
      );
    });

    test('should log evictions', () => {
      // Fill cache beyond limit
      cache = new TimeSeriesCache(1); // Only 1 chunk allowed
      cache.addChunk(2022, createMockData(2022));
      cache.addChunk(2023, createMockData(2023));
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('♻️  Evicted year 2022')
      );
    });
  });
});