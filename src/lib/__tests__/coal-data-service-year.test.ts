import { CoalDataService } from '../coal-data-service';
import { parseDate } from '@internationalized/date';

// Mock the OpenElectricityClient
jest.mock('openelectricity', () => ({
  OpenElectricityClient: jest.fn().mockImplementation(() => ({
    getFacilities: jest.fn().mockResolvedValue({
      response: {
        data: [
          {
            code: 'ERARING',
            name: 'Eraring Power Station',
            network_region: 'NSW1',
            units: [{
              code: 'ER01',
              fueltech_id: 'coal_black',
              capacity_registered: 720,
              status_id: 'operating'
            }]
          },
          {
            code: 'BAYSW',
            name: 'Bayswater Power Station',
            network_region: 'NSW1',
            units: [{
              code: 'BW01',
              fueltech_id: 'coal_black',
              capacity_registered: 660,
              status_id: 'operating'
            }]
          }
        ]
      }
    }),
    getFacilityData: jest.fn().mockImplementation((network, facilityCodes, metrics, options) => {
      // Generate mock data for the requested date range
      const startDate = parseDate(options.dateStart);
      const endDate = parseDate(options.dateEnd);
      const rows = [];
      
      let currentDate = startDate;
      while (currentDate.compare(endDate) <= 0) {
        facilityCodes.forEach(facilityCode => {
          const unitCode = facilityCode === 'ERARING' ? 'ER01' : 'BW01';
          rows.push({
            interval: new Date(`${currentDate.toString()}T00:00:00+10:00`),
            facility_code: facilityCode,
            unit_code: unitCode,
            energy: 15000 + Math.random() * 1000
          });
        });
        currentDate = currentDate.add({ days: 1 });
      }
      
      return Promise.resolve({
        datatable: { rows }
      });
    })
  }))
}));

describe('CoalDataService - Year-based Fetching', () => {
  let service: CoalDataService;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new CoalDataService('test-api-key');
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    jest.clearAllMocks();
    await new Promise(resolve => setImmediate(resolve));
  });

  describe('getCoalStripesDataRange - Year Fetching', () => {
    test('should fetch a full normal year (365 days)', async () => {
      const startDate = parseDate('2023-01-01');
      const endDate = parseDate('2023-12-31');
      
      const result = await service.getCoalStripesDataRange(startDate, endDate);
      
      expect(result).toBeTruthy();
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      
      // Check the first unit's data
      const firstUnit = result.data[0];
      expect(firstUnit.history.data.length).toBe(365);
      expect(firstUnit.history.start).toBe('2023-01-01');
      expect(firstUnit.history.last).toBe('2023-12-31');
      expect(firstUnit.network).toBe('nem');
      expect(firstUnit.region).toBe('NSW1');
      
      // Verify single API request for normal year
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📡 API fetch: 2023-01-01 → 2023-12-31')
      );
    });

    test('should fetch a full leap year (366 days) with 6-month chunks', async () => {
      const startDate = parseDate('2024-01-01');
      const endDate = parseDate('2024-12-31');
      
      const result = await service.getCoalStripesDataRange(startDate, endDate);
      
      expect(result).toBeTruthy();
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      
      // Check the first unit's data
      const firstUnit = result.data[0];
      expect(firstUnit.history.data.length).toBe(366);
      expect(firstUnit.history.start).toBe('2024-01-01');
      expect(firstUnit.history.last).toBe('2024-12-31');
      
      // Verify leap year is now handled server-side as single request
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📡 API fetch: 2024-01-01 → 2024-12-31')
      );
    });

    test('should cache year data and reuse on subsequent requests', async () => {
      // First request
      await service.getCoalStripesDataRange(
        parseDate('2023-01-01'),
        parseDate('2023-12-31')
      );
      
      consoleSpy.mockClear();
      
      // Second request for same year
      const result = await service.getCoalStripesDataRange(
        parseDate('2023-06-01'),
        parseDate('2023-08-31')
      );
      
      // Should hit cache
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Cache hit')
      );
      
      // Should NOT fetch again
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('🔄 Fetching year 2023')
      );
      
      // Should return filtered data for requested range
      expect(result.data[0].history.data.length).toBe(92); // June + July + August
      expect(result.data[0].history.start).toBe('2023-06-01');
      expect(result.data[0].history.last).toBe('2023-08-31');
    });

    test('should handle cross-year requests by fetching multiple years', async () => {
      const startDate = parseDate('2023-11-01');
      const endDate = parseDate('2024-02-29');
      
      const result = await service.getCoalStripesDataRange(startDate, endDate);
      
      expect(result).toBeTruthy();
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      
      // Should fetch both years
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⏳ Fetching 2 year(s) of data...')
      );
      
      // Should have combined data spanning the cross-year range
      const expectedDays = parseDate('2024-02-29').compare(parseDate('2023-11-01')) + 1;
      expect(result.data[0].history.data.length).toBe(expectedDays);
      expect(result.data[0].history.start).toBe('2023-11-01');
      expect(result.data[0].history.last).toBe('2024-02-29');
    });
  });

  describe('Data Structure', () => {
    test('should return properly structured coal stripes data', async () => {
      const result = await service.getCoalStripesDataRange(
        parseDate('2023-01-01'),
        parseDate('2023-12-31')
      );
      
      // Check structure
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('created_at');
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
      
      // Check first unit structure
      const firstUnit = result.data[0];
      expect(firstUnit).toHaveProperty('network');
      expect(firstUnit).toHaveProperty('region');
      expect(firstUnit).toHaveProperty('duid');
      expect(firstUnit).toHaveProperty('facility_name');
      expect(firstUnit).toHaveProperty('capacity');
      expect(firstUnit).toHaveProperty('history');
      expect(firstUnit.history).toHaveProperty('data');
      expect(firstUnit.history).toHaveProperty('start');
      expect(firstUnit.history).toHaveProperty('last');
      
      // Check unit data
      expect(firstUnit.history.data).toBeInstanceOf(Array);
      expect(firstUnit.history.data.length).toBe(365);
      
      // Check that data contains numbers or nulls
      const sampleValue = firstUnit.history.data[0];
      expect(typeof sampleValue === 'number' || sampleValue === null).toBe(true);
    });
  });
});