import { SmartCache } from '@/client/smart-cache';
import { parseDate } from '@internationalized/date';
import { CoalStripesData } from '@/shared/types';

// Mock fetch for testing
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('Year-based Cache Tests', () => {
  let smartCache: SmartCache;
  
  // Helper to create mock year data
  const createMockYearData = (year: number): CoalStripesData => {
    const isLeapYear = year % 4 === 0;
    const daysInYear = isLeapYear ? 366 : 365;
    
    return {
      data: [{
        facility_name: 'Test Facility',
        facility_id: 'test-1',
        duid: 'TEST01',
        capacity: 720,
        fuel_source_descriptor: 'Black Coal',
        commissioned_date: '2000-01-01',
        decommissioned_date: null,
        latest_carbon_intensity: 0.9,
        history: {
          start: `${year}-01-01`,
          data: new Array(daysInYear).fill(null).map((_, i) => {
            // Generate realistic capacity factors
            return Math.round((70 + Math.sin(i / 30) * 20) * 10) / 10;
          })
        }
      }],
      metadata: {
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
        version: '1.0',
        created_at: new Date().toISOString()
      }
    };
  };
  
  beforeEach(() => {
    smartCache = new SmartCache(5, false); // Disable preloading in tests
    jest.clearAllMocks();
  });

  afterEach(() => {
    smartCache.clear();
  });

  test('should fetch a single year', async () => {
    const mockData = createMockYearData(2023);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    } as Response);
    
    const data = await smartCache.getYearData(2023);
    
    expect(data).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith('/api/capacity-factors?year=2023');
  });

  test('should handle date ranges within a single year', async () => {
    const mockData = createMockYearData(2023);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    } as Response);
    
    const start = parseDate('2023-03-01');
    const end = parseDate('2023-09-30');
    
    const data = await smartCache.getDataForDateRange(start, end);
    
    expect(data).toEqual(mockData);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/capacity-factors?year=2023');
  });

  test('should handle date ranges spanning multiple years', async () => {
    const mock2022 = createMockYearData(2022);
    const mock2023 = createMockYearData(2023);
    
    (global.fetch as jest.MockedFunction<typeof fetch>)
      .mockResolvedValueOnce({ ok: true, json: async () => mock2022 } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => mock2023 } as Response);
    
    const start = parseDate('2022-07-01');
    const end = parseDate('2023-06-30');
    
    const data = await smartCache.getDataForDateRange(start, end);
    
    // Should fetch both years
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith('/api/capacity-factors?year=2022');
    expect(fetch).toHaveBeenCalledWith('/api/capacity-factors?year=2023');
    
    // Currently returns first year's data (simplified behavior)
    expect(data).toEqual(mock2022);
  });

  test('should handle leap years correctly', async () => {
    const mock2024 = createMockYearData(2024); // Leap year
    
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mock2024
    } as Response);
    
    const data = await smartCache.getYearData(2024);
    
    expect(data).toBeDefined();
    expect(data!.data[0].history.data).toHaveLength(366);
  });

  test('should handle non-leap years correctly', async () => {
    const mock2023 = createMockYearData(2023); // Non-leap year
    
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mock2023
    } as Response);
    
    const data = await smartCache.getYearData(2023);
    
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
    await smartCache.getYearData(2023);
    expect(fetch).toHaveBeenCalledTimes(1);
    
    // Second request - should use cache
    const cachedData = await smartCache.getYearData(2023);
    expect(fetch).toHaveBeenCalledTimes(1); // No additional call
    expect(cachedData).toEqual(mock2023);
  });

  test('should evict old years when cache is full', async () => {
    // Create a small cache
    const smallCache = new SmartCache(2, false);
    
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
    expect(stats.yearCount).toBe(2);
    expect(stats.cachedYears).not.toContain(2021); // 2021 should be evicted
    
    smallCache.clear();
  });

  test('should provide accurate cache statistics', async () => {
    // Fetch several years
    for (let year = 2020; year <= 2022; year++) {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => createMockYearData(year)
      } as Response);
      await smartCache.getYearData(year);
    }
    
    const stats = smartCache.getCacheStats();
    expect(stats.yearCount).toBe(3);
    expect(stats.cachedYears).toEqual([2020, 2021, 2022]);
    expect(stats.totalMB).toBeGreaterThan(0);
  });
});