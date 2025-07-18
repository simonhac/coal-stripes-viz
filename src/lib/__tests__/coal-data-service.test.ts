import { CoalDataService } from '../coal-data-service';
import { CoalUnit } from '../types';
import { parseDate } from '@internationalized/date';

describe('CoalDataService', () => {
  let service: CoalDataService;

  beforeAll(() => {
    // Use environment variable for API key
    const apiKey = process.env.OPENELECTRICITY_API_KEY;
    if (!apiKey) {
      throw new Error('OPENELECTRICITY_API_KEY environment variable is required for tests');
    }
    service = new CoalDataService(apiKey);
  });

  describe('Coal Unit Filtering', () => {
    let coalStripesData: any;

    beforeAll(async () => {
      // Fetch actual data for testing (this may take a while)
      console.log('Fetching coal stripes data for testing...');
      coalStripesData = await service.getCoalStripesData(30); // Use 30 days to ensure we get data
    });

    test('should return only coal units', async () => {
      // Get all units across all regions
      const allUnits: CoalUnit[] = [];
      Object.values(coalStripesData.regions).forEach((region: any) => {
        allUnits.push(...region.units);
      });

      console.log(`Testing ${allUnits.length} total units`);

      // Check that every unit is a coal unit
      const nonCoalUnits = allUnits.filter(unit => 
        unit.fueltech !== 'coal_black' && unit.fueltech !== 'coal_brown'
      );

      if (nonCoalUnits.length > 0) {
        console.log('❌ Found non-coal units:');
        nonCoalUnits.forEach(unit => {
          console.log(`  - ${unit.facility_name}: ${unit.code} (${unit.fueltech})`);
        });
      }

      expect(nonCoalUnits).toHaveLength(0);
    });

    test('should have valid fueltech values', async () => {
      const allUnits: CoalUnit[] = [];
      Object.values(coalStripesData.regions).forEach((region: any) => {
        allUnits.push(...region.units);
      });

      const validFueltechs = ['coal_black', 'coal_brown'];
      
      allUnits.forEach(unit => {
        expect(validFueltechs).toContain(unit.fueltech);
      });
    });

    test('should have valid facility names', async () => {
      const allUnits: CoalUnit[] = [];
      Object.values(coalStripesData.regions).forEach((region: any) => {
        allUnits.push(...region.units);
      });

      allUnits.forEach(unit => {
        expect(unit.facility_name).toBeTruthy();
        expect(typeof unit.facility_name).toBe('string');
        expect(unit.facility_name.length).toBeGreaterThan(0);
      });
    });

    test('should have positive capacity values', async () => {
      const allUnits: CoalUnit[] = [];
      Object.values(coalStripesData.regions).forEach((region: any) => {
        allUnits.push(...region.units);
      });

      allUnits.forEach(unit => {
        expect(unit.capacity).toBeGreaterThan(0);
        expect(typeof unit.capacity).toBe('number');
      });
    });

    test('should have valid unit codes', async () => {
      const allUnits: CoalUnit[] = [];
      Object.values(coalStripesData.regions).forEach((region: any) => {
        allUnits.push(...region.units);
      });

      allUnits.forEach(unit => {
        expect(unit.code).toBeTruthy();
        expect(typeof unit.code).toBe('string');
        expect(unit.code.length).toBeGreaterThan(0);
      });
    });

    test('should not have duplicate units', async () => {
      const allUnits: CoalUnit[] = [];
      Object.values(coalStripesData.regions).forEach((region: any) => {
        allUnits.push(...region.units);
      });

      const unitCodes = allUnits.map(unit => unit.code);
      const uniqueCodes = [...new Set(unitCodes)];
      
      expect(unitCodes.length).toBe(uniqueCodes.length);
    });

    test('should show detailed unit information', async () => {
      const allUnits: CoalUnit[] = [];
      Object.values(coalStripesData.regions).forEach((region: any) => {
        allUnits.push(...region.units);
      });

      console.log('\\n=== DETAILED UNIT ANALYSIS ===');
      
      // Group by fueltech
      const coalBlackUnits = allUnits.filter(u => u.fueltech === 'coal_black');
      const coalBrownUnits = allUnits.filter(u => u.fueltech === 'coal_brown');
      
      console.log(`Total units: ${allUnits.length}`);
      console.log(`Black coal units: ${coalBlackUnits.length}`);
      console.log(`Brown coal units: ${coalBrownUnits.length}`);
      
      // Show all units with their details
      console.log('\\n=== ALL UNITS ===');
      allUnits.forEach(unit => {
        console.log(`${unit.facility_name}: ${unit.code} (${unit.fueltech}, ${unit.capacity}MW)`);
      });
      
      // Check for suspicious patterns
      const suspiciousUnits = allUnits.filter(unit => {
        // Look for units that might not be coal
        const name = unit.facility_name.toLowerCase();
        const code = unit.code.toLowerCase();
        
        return name.includes('gas') || 
               name.includes('solar') || 
               name.includes('wind') || 
               name.includes('hydro') || 
               name.includes('battery') ||
               code.includes('gas') ||
               code.includes('solar') ||
               code.includes('wind') ||
               code.includes('hydro') ||
               code.includes('battery');
      });
      
      if (suspiciousUnits.length > 0) {
        console.log('\\n❓ SUSPICIOUS UNITS (might not be coal):');
        suspiciousUnits.forEach(unit => {
          console.log(`  - ${unit.facility_name}: ${unit.code} (${unit.fueltech})`);
        });
      }
      
      // This test always passes, it's just for information
      expect(true).toBe(true);
    });
  });

  describe('Date Range Validation', () => {
    test('should return exactly 30 days of data when requesting 30 days', async () => {
      // Request 30 days of data
      const requestedDays = 30;
      const coalStripesData = await service.getCoalStripesData(requestedDays);
      
      // Verify we get exactly 30 days in the response
      expect(coalStripesData.actualDays).toBe(requestedDays);
      expect(coalStripesData.dates).toHaveLength(requestedDays);
      
      // Verify date range is correct (30 days)
      const startDate = parseDate(coalStripesData.actualDateStart);
      const endDate = parseDate(coalStripesData.actualDateEnd);
      const daysBetween = endDate.toDate('Australia/Brisbane').getTime() - 
                          startDate.toDate('Australia/Brisbane').getTime();
      const actualDayCount = Math.round(daysBetween / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end
      expect(actualDayCount).toBe(requestedDays);
      
      // Verify at least one unit has data for all 30 days
      let foundUnitWithFullData = false;
      let unitWithMostData = { code: '', dataCount: 0 };
      
      Object.values(coalStripesData.regions).forEach(region => {
        region.units.forEach(unit => {
          const dataCount = coalStripesData.dates.filter(date => 
            unit.data[date] !== undefined && unit.data[date] > 0
          ).length;
          
          if (dataCount > unitWithMostData.dataCount) {
            unitWithMostData = { code: unit.code, dataCount };
          }
          
          if (dataCount === requestedDays) {
            foundUnitWithFullData = true;
            console.log(`Unit ${unit.code} has data for all ${requestedDays} days`);
          }
        });
      });
      
      // Log the unit with most data if no unit has full data
      if (!foundUnitWithFullData) {
        console.log(`No unit has all ${requestedDays} days. Unit with most data: ${unitWithMostData.code} (${unitWithMostData.dataCount}/${requestedDays} days)`);
      }
      
      // At least one unit should have data for all requested days
      expect(foundUnitWithFullData).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should throw error when no data found in date range', async () => {
      // Use a date range from far in the past where no data exists
      // Australian electricity market data doesn't exist from 1990
      const service = new CoalDataService(process.env.OPENELECTRICITY_API_KEY!);
      
      // Mock the service to request a date range with no data
      // We'll override the getRequestDateRange method to return 1990 dates
      const originalGetRequestDateRange = (service as any).getRequestDateRange;
      (service as any).getRequestDateRange = () => {
        return {
          requestStartDate: parseDate('1990-01-01'),
          requestEndDate: parseDate('1990-01-07')
        };
      };

      await expect(service.getCoalStripesData(7)).rejects.toThrow(
        'No data found for the requested parameters'
      );

      // Restore original method
      (service as any).getRequestDateRange = originalGetRequestDateRange;
    });

    test('should throw error when no data rows are available for analysis', async () => {
      // Test our specific error handling by mocking the fetchEnergyData to return empty array
      const service = new CoalDataService(process.env.OPENELECTRICITY_API_KEY!);
      
      // Mock fetchEnergyData to return empty array (simulating no data returned)
      const originalFetchEnergyData = (service as any).fetchEnergyData;
      (service as any).fetchEnergyData = async () => {
        return []; // Return empty array - no data
      };

      await expect(service.getCoalStripesData(7)).rejects.toThrow(
        /No coal data found in the requested date range/
      );

      // Restore original method
      (service as any).fetchEnergyData = originalFetchEnergyData;
    });
  });
});