import { CapFacCache } from '@/client/cap-fac-cache';
import { parseDate } from '@internationalized/date';
import { GeneratingUnitCapFacHistoryDTO } from '@/shared/types';

// Mock fetch for testing
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('Year-based Cache Tests', () => {
  let capFacCache: CapFacCache;
  
  // Helper to create mock year data
  const createMockYearData = (year: number): GeneratingUnitCapFacHistoryDTO => {
    const isLeapYear = year % 4 === 0;
    const daysInYear = isLeapYear ? 366 : 365;
    
    return {
      type: 'capacity_factors' as const,
      version: '1.0',
      created_at: new Date().toISOString(),
      data: [{
        network: 'NEM',
        region: 'NSW1',
        data_type: 'capacity_factor',
        units: 'MW',
        capacity: 720,
        duid: 'TEST01',
        facility_code: 'TESTFAC',
        facility_name: 'Test Facility',
        fueltech: 'black_coal',
        history: {
          start: `${year}-01-01`,
          last: `${year}-12-31`,
          interval: '1D',
          data: new Array(daysInYear).fill(null).map((_, i) => {
            // Generate realistic capacity factors
            return Math.round((70 + Math.sin(i / 30) * 20) * 10) / 10;
          })
        }
      }]
    };
  };
  
  beforeEach(() => {
    capFacCache = new CapFacCache(5, false); // Disable preloading in tests
    jest.clearAllMocks();
  });

  afterEach(() => {
    capFacCache.clear();
  });

  test('should fetch a single year', async () => {
    const mockData = createMockYearData(2023);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    } as Response);
    
    const data = await capFacCache.getYearData(2023);
    
    expect(data).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith('/api/capacity-factors?year=2023');
  });



  test('should handle leap years correctly', async () => {
    const mock2024 = createMockYearData(2024); // Leap year
    
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mock2024
    } as Response);
    
    const data = await capFacCache.getYearData(2024);
    
    expect(data).toBeDefined();
    expect(data!.data[0].history.data).toHaveLength(366);
  });

  test('should handle non-leap years correctly', async () => {
    const mock2023 = createMockYearData(2023); // Non-leap year
    
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mock2023
    } as Response);
    
    const data = await capFacCache.getYearData(2023);
    
    expect(data).toBeDefined();
    expect(data!.data[0].history.data).toHaveLength(365);
  });

  test('should cache years for subsequent requests', async () => {
    const mock2023 = createMockYearData(2023);
    
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mock2023
    } as Response);
    
    // First request
    await capFacCache.getYearData(2023);
    expect(fetch).toHaveBeenCalledTimes(1);
    
    // Second request - should use cache
    const cachedData = await capFacCache.getYearData(2023);
    expect(fetch).toHaveBeenCalledTimes(1); // No additional call
    expect(cachedData).toEqual(mock2023);
  });

  test('should evict old years when cache is full', async () => {
    // Create a small cache
    const smallCache = new CapFacCache(2, false);
    
    // Mock responses for 3 years
    for (let year = 2021; year <= 2023; year++) {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockYearData(year)
      } as Response);
    }
    
    // Fetch 3 years (cache limit is 2)
    await smallCache.getYearData(2021);
    await smallCache.getYearData(2022);
    await smallCache.getYearData(2023);
    
    const stats = smallCache.getCacheStats();
    expect(stats.numItems).toBe(2);
    const cachedYears = stats.labels.map(label => parseInt(label)).filter(year => !isNaN(year));
    expect(cachedYears).not.toContain(2021); // 2021 should be evicted
    
    smallCache.clear();
  });

  test('should provide accurate cache statistics', async () => {
    // Fetch several years
    for (let year = 2020; year <= 2022; year++) {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockYearData(year)
      } as Response);
      await capFacCache.getYearData(year);
    }
    
    const stats = capFacCache.getCacheStats();
    expect(stats.numItems).toBe(3);
    const cachedYears = stats.labels.map(label => parseInt(label)).filter(year => !isNaN(year)).sort();
    expect(cachedYears).toEqual([2020, 2021, 2022]);
    expect(stats.totalKB / 1024).toBeGreaterThan(0);
  });
});