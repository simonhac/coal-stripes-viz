import { CapFacCache } from '@/client/cap-fac-cache';
import { parseDate } from '@internationalized/date';
import { GeneratingUnitCapFacHistoryDTO } from '@/shared/types';

// Mock fetch for testing - provide a default mock that always works
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    type: 'capacity_factors',
    version: '1.0',
    created_at: new Date().toISOString(),
    data: []
  })
} as Response) as jest.MockedFunction<typeof fetch>;

// Helper to create mock year data
const createMockYearData = (year: number): GeneratingUnitCapFacHistoryDTO => {
  const daysInYear = year % 4 === 0 ? 366 : 365;
  
  return {
    type: 'capacity_factors',
    version: '1.0',
    created_at: new Date().toISOString(),
    data: [
      {
        network: 'nem',
        region: 'NSW1',
        data_type: 'energy',
        units: 'MW',
        capacity: 720,
        duid: 'TEST01',
        facility_code: 'TEST',
        facility_name: 'Test Facility',
        fueltech: 'coal_black' as const,
        history: {
          start: `${year}-01-01`,
          last: `${year}-12-31`,
          interval: '1d',
          data: new Array(daysInYear).fill(null).map(() => Math.random() * 100)
        }
      }
    ]
  };
};

describe('CapFacCache Architecture', () => {
  let capFacCache: CapFacCache;
  let consoleErrorSpy: jest.SpyInstance;
  
  beforeEach(() => {
    capFacCache = new CapFacCache(3, false); // Disable preloading in tests
    jest.clearAllMocks();
    // Reset fetch mock and provide default implementation
    (global.fetch as jest.MockedFunction<typeof fetch>).mockReset();
    (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async (url) => {
      // Default mock implementation for any unexpected fetches
      const yearMatch = (url as string).match(/year=(\d+)/);
      const year = yearMatch ? parseInt(yearMatch[1]) : 2023;
      return {
        ok: true,
        json: async () => createMockYearData(year)
      } as Response;
    });
    // Suppress console.error in tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(async () => {
    // Wait for any pending operations to complete
    await capFacCache.waitForPendingOperations();
    capFacCache.clear();
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  test('should be the single interface between component and data', async () => {
    // Mock server response
    const mockData = createMockYearData(2023);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    } as Response);
    
    // Component should only interact with CapFacCache
    const data = await capFacCache.getYearData(2023);
    
    expect(data).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith('/api/capacity-factors?year=2023');
  });

  test('should handle cache hits without server calls', async () => {
    // First call - should hit server
    const mockData = createMockYearData(2023);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    } as Response);
    
    const data1 = await capFacCache.getYearData(2023);
    expect(fetch).toHaveBeenCalledTimes(1);
    
    // Second call - should hit cache
    const data2 = await capFacCache.getYearData(2023);
    expect(fetch).toHaveBeenCalledTimes(1); // No additional call
    expect(data2).toEqual(data1);
  });

  test('should handle concurrent requests for same year', async () => {
    const mockData = createMockYearData(2023);
    let resolveResponse: (value: any) => void;
    const responsePromise = new Promise(resolve => {
      resolveResponse = resolve;
    });
    
    (global.fetch as jest.MockedFunction<typeof fetch>).mockReturnValueOnce(Promise.resolve({
      ok: true,
      json: async () => {
        await responsePromise;
        return mockData;
      }
    } as Response));
    
    // Start two requests before the first completes
    const promise1 = capFacCache.getYearData(2023);
    const promise2 = capFacCache.getYearData(2023);
    
    // Should only make one fetch call
    expect(fetch).toHaveBeenCalledTimes(1);
    
    // Resolve the response
    resolveResponse!(null);
    
    const [data1, data2] = await Promise.all([promise1, promise2]);
    expect(data1).toEqual(mockData);
    expect(data2).toEqual(mockData);
    expect(fetch).toHaveBeenCalledTimes(1);
  });


  test('should preload adjacent years when enabled', async () => {
    // Create cache with preloading enabled
    const preloadCache = new CapFacCache(3, true);
    
    try {
      const mock2023 = createMockYearData(2023);
      const mock2022 = createMockYearData(2022);
      const mock2024 = createMockYearData(2024);
      
      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({ ok: true, json: async () => mock2023 } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mock2022 } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mock2024 } as Response);
      
      // Get 2023 data
      await preloadCache.getYearData(2023);
      
      // Trigger preloading
      preloadCache.preloadAdjacentYears(2023);
      
      // Wait for preloading to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Flush all pending promises
      await new Promise(resolve => setImmediate(resolve));
      
      // Should have fetched 2022 and 2024
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(fetch).toHaveBeenCalledWith('/api/capacity-factors?year=2023');
      expect(fetch).toHaveBeenCalledWith('/api/capacity-factors?year=2022');
      expect(fetch).toHaveBeenCalledWith('/api/capacity-factors?year=2024');
    } finally {
      // Always clean up - wait for pending operations first
      await preloadCache.waitForPendingOperations();
      preloadCache.clear();
    }
  });

  test('should notify subscribers of background updates', async () => {
    const updateCallback = jest.fn();
    const unsubscribe = capFacCache.onBackgroundUpdate(updateCallback);
    
    const mockData = createMockYearData(2023);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    } as Response);
    
    await capFacCache.getYearData(2023);
    
    expect(updateCallback).toHaveBeenCalledWith(2023);
    
    // Test unsubscribe
    unsubscribe();
    updateCallback.mockClear();
    
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => createMockYearData(2024)
    } as Response);
    
    await capFacCache.getYearData(2024);
    expect(updateCallback).not.toHaveBeenCalled();
  });


  test('should provide cache statistics', async () => {
    const mock2022 = createMockYearData(2022);
    const mock2023 = createMockYearData(2023);
    
    (global.fetch as jest.MockedFunction<typeof fetch>)
      .mockResolvedValueOnce({ ok: true, json: async () => mock2022 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => mock2023 } as Response);
    
    await capFacCache.getYearData(2022);
    await capFacCache.getYearData(2023);
    
    const stats = capFacCache.getCacheStats();
    expect(stats.numItems).toBe(2);
    const cachedYears = stats.labels.map(label => parseInt(label)).filter(year => !isNaN(year)).sort();
    expect(cachedYears).toEqual([2022, 2023]);
    expect(stats.totalKB / 1024).toBeGreaterThan(0);
  });

  test('should clear cache on demand', async () => {
    const mockData = createMockYearData(2023);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    } as Response);
    
    await capFacCache.getYearData(2023);
    expect(capFacCache.hasYear(2023)).toBe(true);
    
    capFacCache.clear();
    expect(capFacCache.hasYear(2023)).toBe(false);
    
    const stats = capFacCache.getCacheStats();
    expect(stats.numItems).toBe(0);
  });
});