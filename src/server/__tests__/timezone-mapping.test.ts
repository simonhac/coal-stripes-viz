import { CapFacDataService } from '@/server/cap-fac-data-service';
import { getDayIndex } from '@/shared/date-utils';
import { parseDate } from '@internationalized/date';
import { setupTestLogger } from '../test-helpers';

// Initialize logger for tests
beforeAll(() => {
  setupTestLogger();
});

describe('Timezone Date Mapping', () => {
  let service: any;
  let originalDate: any;
  
  beforeEach(() => {
    service = new CapFacDataService('dummy-key');
    
    // Mock Date to return a fixed date (July 10, 2025) for consistent testing
    originalDate = global.Date;
    const mockDate = new originalDate('2025-07-10T10:00:00+10:00');
    global.Date = jest.fn(() => mockDate) as any;
    global.Date.UTC = originalDate.UTC;
    global.Date.parse = originalDate.parse;
    global.Date.now = originalDate.now;
    // Mock the prototype methods that might be used
    (global.Date as any).prototype = originalDate.prototype;
    
    // Mock toLocaleDateString to return July 10, 2025 in Brisbane time
    mockDate.toLocaleDateString = jest.fn((locale: string, options: any) => {
      if (options?.timeZone === 'Australia/Brisbane') {
        return '2025-07-10';
      }
      return originalDate.prototype.toLocaleDateString.call(mockDate, locale, options);
    });
  });
  
  afterEach(() => {
    // Restore original Date
    global.Date = originalDate;
  });
  
  describe('processGeneratingUnitCapFacHistoryDTO date mapping', () => {
    it('should correctly map AEST timestamps to Brisbane dates', () => {
      // Mock data that simulates what OpenElectricity returns
      // These are AEST timestamps with +10:00 offset
      const mockData = [
        {
          interval: '2025-07-01T00:00:00+10:00',
          unit_code: 'TEST01',
          energy: 1000
        },
        {
          interval: '2025-07-02T00:00:00+10:00',
          unit_code: 'TEST01', 
          energy: 2000
        }
      ];
      
      const mockFacilities = [{
        facility_code: 'TEST',
        facility_name: 'Test Facility',
        facility_network: 'NEM',
        facility_region: 'NSW1',
        units: [{
          unit_code: 'TEST01',
          unit_fueltech: 'coal_black',
          unit_capacity: 100
        }]
      }];
      
      // Call the private processGeneratingUnitCapFacHistoryDTO method
      const result = (service as any).processGeneratingUnitCapFacHistoryDTO(
        mockData,
        mockFacilities,
        parseDate('2025-07-01'),
        parseDate('2025-07-02')
      );
      
      // The data should be mapped correctly
      const unit = result.data[0];
      
      // The data array should be for the requested date range (July 1-2)
      // So index 0 should be July 1, index 1 should be July 2
      expect(unit.history.data[0]).toBe(41.7); // July 1 - from 1000 MWh
      expect(unit.history.data[1]).toBe(83.3); // July 2 - from 2000 MWh
    });
    
    it('should handle date strings with timezone offsets correctly', () => {
      // Test with string dates that include timezone info
      const mockData = [
        {
          interval: '2025-07-01T00:00:00+10:00',
          unit_code: 'TEST01',
          energy: 1000
        },
        {
          interval: '2025-07-02T00:00:00+10:00',
          unit_code: 'TEST01',
          energy: 2000
        }
      ];
      
      const mockFacilities = [{
        facility_code: 'TEST',
        facility_name: 'Test Facility',
        facility_network: 'NEM',
        facility_region: 'NSW1',
        units: [{
          unit_code: 'TEST01',
          unit_fueltech: 'coal_black',
          unit_capacity: 100
        }]
      }];
      
      const result = (service as any).processGeneratingUnitCapFacHistoryDTO(
        mockData,
        mockFacilities,
        parseDate('2025-07-01'),
        parseDate('2025-07-02')
      );
      
      const unit = result.data[0];
      
      // Check that the dates are mapped correctly
      // Data array contains only the requested date range
      expect(unit.history.data[0]).toBe(41.7); // July 1
      expect(unit.history.data[1]).toBe(83.3); // July 2
    });
    
    it('should not have off-by-one errors for complete days', () => {
      // Create data for a full week to ensure no off-by-one errors
      const mockData = [];
      for (let i = 1; i <= 7; i++) {
        mockData.push({
          interval: `2025-07-0${i}T00:00:00+10:00`,
          unit_code: 'TEST01',
          energy: i * 100 // Unique values to track mapping
        });
      }
      
      const mockFacilities = [{
        facility_code: 'TEST',
        facility_name: 'Test Facility',
        facility_network: 'NEM',
        facility_region: 'NSW1',
        units: [{
          unit_code: 'TEST01',
          unit_fueltech: 'coal_black',
          unit_capacity: 100
        }]
      }];
      
      const result = (service as any).processGeneratingUnitCapFacHistoryDTO(
        mockData,
        mockFacilities,
        parseDate('2025-07-01'),
        parseDate('2025-07-07')
      );
      
      const unit = result.data[0];
      
      // Check each day maps correctly
      // The data array contains only the requested date range (July 1-7)
      expect(unit.history.data[0]).toBe(4.2);  // July 1 - 100/24/100*100
      expect(unit.history.data[1]).toBe(8.3);  // July 2 - 200/24/100*100
      expect(unit.history.data[2]).toBe(12.5); // July 3 - 300/24/100*100
      expect(unit.history.data[3]).toBe(16.7); // July 4 - 400/24/100*100
      expect(unit.history.data[4]).toBe(20.8); // July 5 - 500/24/100*100
      expect(unit.history.data[5]).toBe(25);   // July 6 - 600/24/100*100
      expect(unit.history.data[6]).toBe(29.2); // July 7 - 700/24/100*100
    });
    
    it('should handle UTC 23:00 timestamps correctly', () => {
      // Mock data with UTC 23:00 timestamp
      const mockData = [
        {
          interval: '2025-07-01T23:00:00.000Z', // This should map to July 2 Brisbane
          unit_code: 'TEST01',
          energy: 1000
        }
      ];
      
      const mockFacilities = [{
        facility_code: 'TEST',
        facility_name: 'Test Facility',
        facility_network: 'NEM',
        facility_region: 'NSW1',
        units: [{
          unit_code: 'TEST01',
          unit_fueltech: 'coal_black',
          unit_capacity: 100
        }]
      }];
      
      // Should process UTC 23:00 timestamps correctly
      const result = (service as any).processGeneratingUnitCapFacHistoryDTO(
        mockData,
        mockFacilities,
        parseDate('2025-07-02'),
        parseDate('2025-07-02')
      );
      
      const unit = result.data[0];
      // UTC 23:00 on July 1 should map to July 2 Brisbane
      expect(unit.history.data[0]).toBe(41.7); // July 2
    });
  });
});