import { YearDataVendor } from '../year-data-vendor';
import { GeneratingUnitCapFacHistoryDTO } from '@/shared/types';

// Mock fetch
global.fetch = jest.fn();

describe('YearDataVendor', () => {
  let vendor: YearDataVendor;
  
  beforeEach(() => {
    vendor = new YearDataVendor(3); // Small cache for testing
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    vendor.clear();
  });

  const mockYearData = (year: number): GeneratingUnitCapFacHistoryDTO => ({
    status: 'ok',
    data: [
      {
        duid: 'TEST01',
        facility_name: 'Test Facility',
        capacity: 100,
        history: {
          data: Array(365).fill(50),
          start: `${year}-01-01`,
          last: `${year}-12-31`,
          interval: '1d'
        }
      }
    ]
  });

  describe('requestYear', () => {
    it('should fetch data from server when not cached', async () => {
      const mockData = mockYearData(2023);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await vendor.requestYear(2023);
      
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith('/api/capacity-factors?year=2023', expect.any(Object));
    });

    it('should return cached data immediately', async () => {
      const mockData = mockYearData(2023);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      // First request - fetches from server
      await vendor.requestYear(2023);
      
      // Second request - should return from cache
      jest.clearAllMocks();
      const result = await vendor.requestYear(2023);
      
      expect(result).toEqual(mockData);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should deduplicate concurrent requests', async () => {
      const mockData = mockYearData(2023);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      // Make three concurrent requests
      const promises = [
        vendor.requestYear(2023),
        vendor.requestYear(2023),
        vendor.requestYear(2023)
      ];

      const results = await Promise.all(promises);
      
      // All should get the same data
      expect(results[0]).toEqual(mockData);
      expect(results[1]).toEqual(mockData);
      expect(results[2]).toEqual(mockData);
      
      // But fetch should only be called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle fetch errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(vendor.requestYear(2023)).rejects.toThrow('Network error');
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(vendor.requestYear(2023)).rejects.toThrow('HTTP 404: Not Found');
    });
  });

  describe('hasYear', () => {
    it('should return false for uncached years', () => {
      expect(vendor.hasYear(2023)).toBe(false);
    });

    it('should return true for cached years', async () => {
      const mockData = mockYearData(2023);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      await vendor.requestYear(2023);
      
      expect(vendor.hasYear(2023)).toBe(true);
    });
  });

  describe('getCacheStats', () => {
    it('should return empty stats initially', () => {
      const stats = vendor.getCacheStats();
      
      expect(stats.numItems).toBe(0);
      expect(stats.totalKB).toBe(0);
      expect(stats.labels).toEqual([]);
      expect(stats.pendingLabels).toEqual([]);
    });

    it('should track cached items', async () => {
      const mockData = mockYearData(2023);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      await vendor.requestYear(2023);
      
      const stats = vendor.getCacheStats();
      expect(stats.numItems).toBe(1);
      expect(stats.labels).toContain('2023');
      expect(stats.totalKB).toBeGreaterThan(0);
    });

    it('should track pending requests', async () => {
      const mockData = mockYearData(2023);
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => mockData
        }), 100))
      );

      // Start request but don't await
      vendor.requestYear(2023);
      
      const stats = vendor.getCacheStats();
      expect(stats.pendingLabels).toContain('2023');
      
      // Clean up
      await new Promise(resolve => setTimeout(resolve, 150));
    });
  });

  describe('clear', () => {
    it('should clear cached data', async () => {
      const mockData = mockYearData(2023);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      await vendor.requestYear(2023);
      expect(vendor.hasYear(2023)).toBe(true);
      
      vendor.clear();
      
      expect(vendor.hasYear(2023)).toBe(false);
      expect(vendor.getCacheStats().numItems).toBe(0);
    });

    it('should cancel pending requests', async () => {
      const mockData = mockYearData(2023);
      let aborted = false;
      
      (global.fetch as jest.Mock).mockImplementation((url, options) => {
        options?.signal?.addEventListener('abort', () => {
          aborted = true;
        });
        
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (options?.signal?.aborted) {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            } else {
              resolve({
                ok: true,
                json: async () => mockData
              });
            }
          }, 100);
        });
      });

      // Start request but don't await
      const promise = vendor.requestYear(2023);
      
      // Clear should abort the request
      vendor.clear();
      
      // The promise should reject with cancellation error
      await expect(promise).rejects.toThrow('Request cancelled');
      
      // Wait a bit to ensure abort was processed
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(aborted).toBe(true);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest items when cache is full', async () => {
      // Vendor has maxYears=3
      const years = [2020, 2021, 2022, 2023];
      
      for (const year of years) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockYearData(year)
        });
        await vendor.requestYear(year);
      }
      
      // 2020 should have been evicted
      expect(vendor.hasYear(2020)).toBe(false);
      expect(vendor.hasYear(2021)).toBe(true);
      expect(vendor.hasYear(2022)).toBe(true);
      expect(vendor.hasYear(2023)).toBe(true);
    });
  });
});