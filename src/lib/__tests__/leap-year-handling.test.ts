import { CoalDataService } from '../coal-data-service';
import { SmartCache } from '../smart-cache';
import { parseDate } from '@internationalized/date';

// Mock fetch for SmartCache tests
global.fetch = jest.fn();

// Mock the OpenElectricityClient for CoalDataService tests
jest.mock('openelectricity', () => ({
  OpenElectricityClient: jest.fn().mockImplementation(() => ({
    getFacilities: jest.fn().mockResolvedValue({
      response: {
        data: [{
          code: 'TEST_FACILITY',
          name: 'Test Facility',
          network_region: 'NSW1',
          units: [{
            code: 'TEST01',
            fueltech_id: 'coal_black',
            capacity_registered: 700,
            status_id: 'operating'
          }]
        }]
      }
    }),
    getFacilityData: jest.fn().mockImplementation((network, facilityCodes, metrics, options) => {
      const startDate = parseDate(options.dateStart);
      const endDate = parseDate(options.dateEnd);
      const rows = [];
      
      let currentDate = startDate;
      while (currentDate.compare(endDate) <= 0) {
        rows.push({
          interval: new Date(`${currentDate.toString()}T00:00:00+10:00`),
          facility_code: 'TEST_FACILITY',
          unit_code: 'TEST01',
          energy: 15000
        });
        currentDate = currentDate.add({ days: 1 });
      }
      
      return Promise.resolve({ datatable: { rows } });
    })
  }))
}));

describe('Leap Year Handling', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    await new Promise(resolve => setImmediate(resolve));
  });

  describe('CoalDataService - Middle Tier Leap Year Splitting', () => {
    let service: CoalDataService;

    beforeEach(() => {
      service = new CoalDataService('test-api-key');
    });

    test('should split leap year 2024 into two 6-month chunks', async () => {
      const result = await service.getCoalStripesDataRange(
        parseDate('2024-01-01'),
        parseDate('2024-12-31')
      );

      // Verify leap year is handled server-side with single request
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📡 API fetch: 2024-01-01 → 2024-12-31')
      );

      // Verify result has all 366 days
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].history.data.length).toBe(366);
      expect(result.data[0].history.start).toBe('2024-01-01');
      expect(result.data[0].history.last).toBe('2024-12-31');
      
      // Verify Feb 29 (leap day) data exists at index 59
      expect(result.data[0].history.data[59]).toBeDefined(); // Feb 29
    });

    test('should handle normal year 2023 with single request', async () => {
      const result = await service.getCoalStripesDataRange(
        parseDate('2023-01-01'),
        parseDate('2023-12-31')
      );

      // Should NOT detect leap year
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('🔀 Leap year detected')
      );

      // Should make single request
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📡 API fetch: 2023-01-01 → 2023-12-31')
      );

      // Verify result has 365 days
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].history.data.length).toBe(365);
      expect(result.data[0].history.start).toBe('2023-01-01');
      expect(result.data[0].history.last).toBe('2023-12-31');
    });

    test('should correctly identify leap years', async () => {
      // Test multiple leap years
      const leapYears = [2020, 2024, 2028, 2032];
      
      for (const year of leapYears) {
        consoleSpy.mockClear();
        
        await service.getCoalStripesDataRange(
          parseDate(`${year}-01-01`),
          parseDate(`${year}-12-31`)
        );
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('📡 API fetch: ' + year + '-01-01 → ' + year + '-12-31 (366 days)')
        );
      }
    });
  });

  describe('SmartCache - Client-Side Year Fetching', () => {
    let smartCache: SmartCache;

    beforeEach(() => {
      smartCache = new SmartCache();
      (global.fetch as jest.Mock).mockClear();
    });

    test('should request full leap year from API', async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: "capacity_factors",
          version: "1.0",
          created_at: new Date().toISOString(),
          data: [{
            network: 'nem',
            region: 'NSW1',
            data_type: 'capacity_factor',
            units: 'percentage',
            capacity: 700,
            duid: 'TEST01',
            facility_code: 'TEST_FACILITY',
            facility_name: 'Test Facility',
            fueltech: 'coal_black',
            history: {
              start: '2024-01-01',
              last: '2024-12-31',
              interval: '1d',
              data: new Array(366).fill(50)
            }
          }]
        })
      });

      await smartCache.getDataForDateRange(
        parseDate('2024-03-01'),
        parseDate('2024-03-31')
      );

      // Should request full year
      expect(global.fetch).toHaveBeenCalledWith('/api/coal-stripes?year=2024');
      
      // Should log leap year detection
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Fetching year 2024 from server... (366 days - LEAP YEAR)')
      );
    });

    test('should cache leap year data correctly', async () => {
      // Mock API response for leap year
      const mockLeapYearData = {
        type: "capacity_factors",
        version: "1.0",
        created_at: new Date().toISOString(),
        data: [{
          network: 'nem',
          region: 'NSW1',
          data_type: 'capacity_factor',
          units: 'percentage',
          capacity: 700,
          duid: 'TEST01',
          facility_code: 'TEST_FACILITY',
          facility_name: 'Test Facility',
          fueltech: 'coal_black',
          history: {
            start: '2024-01-01',
            last: '2024-12-31',
            interval: '1d',
            data: new Array(366).fill(50)
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeapYearData
      });

      // First request - should fetch from API
      await smartCache.getDataForDateRange(
        parseDate('2024-02-01'),
        parseDate('2024-02-29')
      );

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear fetch mock
      (global.fetch as jest.Mock).mockClear();

      // Second request - should use cache
      const result = await smartCache.getDataForDateRange(
        parseDate('2024-06-01'),
        parseDate('2024-06-30')
      );

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.data[0].history.data.length).toBe(30); // June has 30 days
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Cache hit')
      );
    });
  });

  describe('End-to-End Leap Year Validation', () => {
    test('should return February 29 for leap year requests', async () => {
      const service = new CoalDataService('test-api-key');
      
      // Request just February 2024
      const result = await service.getCoalStripesDataRange(
        parseDate('2024-02-01'),
        parseDate('2024-02-29')
      );

      expect(result.data[0].history.data.length).toBe(29); // February 2024 has 29 days
      expect(result.data[0].history.start).toBe('2024-02-01');
      expect(result.data[0].history.last).toBe('2024-02-29');
    });

    test('should handle leap year data correctly in cache filtering', async () => {
      const smartCache = new SmartCache();

      // Mock full leap year data
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: "capacity_factors",
          version: "1.0",
          created_at: new Date().toISOString(),
          data: [{
            network: 'nem',
            region: 'NSW1',
            data_type: 'capacity_factor',
            units: 'percentage',
            capacity: 700,
            duid: 'TEST01',
            facility_code: 'TEST_FACILITY',
            facility_name: 'Test Facility',
            fueltech: 'coal_black',
            history: {
              start: '2024-01-01',
              last: '2024-12-31',
              interval: '1d',
              data: new Array(366).fill(50)
            }
          }]
        })
      });

      // Request data spanning the leap day
      const result = await smartCache.getDataForDateRange(
        parseDate('2024-02-28'),
        parseDate('2024-03-01')
      );

      expect(result.data[0].history.data.length).toBe(3);
      expect(result.data[0].history.start).toBe('2024-02-28');
      expect(result.data[0].history.last).toBe('2024-03-01');
    });
  });
});