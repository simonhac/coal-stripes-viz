import { CoalDataService } from '../coal-data-service';
import { parseDate, today } from '@internationalized/date';

describe('Real API Year-based Tests', () => {
  let coalDataService: CoalDataService;
  
  beforeAll(() => {
    const apiKey = process.env.OPENELECTRICITY_API_KEY;
    if (!apiKey) {
      throw new Error('OPENELECTRICITY_API_KEY environment variable is required for integration tests');
    }
    coalDataService = new CoalDataService(apiKey);
  });

  afterEach(async () => {
    // Wait for any pending operations
    await new Promise(resolve => setImmediate(resolve));
  });

  afterAll(async () => {
    // Final cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  test('should fetch full year 2023 from real API', async () => {
    console.log('\n🌐 Testing full year 2023 with REAL API...');
    
    const startDate = parseDate('2023-01-01');
    const endDate = parseDate('2023-12-31');
    
    const result = await coalDataService.getCoalStripesDataRange(startDate, endDate);
    
    console.log(`📊 Result: ${result.data.length} units with ${result.data[0]?.history.data.length} days each`);
    console.log(`📊 Date range: ${result.data[0]?.history.start} → ${result.data[0]?.history.last}`);
    
    expect(result.data).toBeDefined();
    expect(result.data.length).toBeGreaterThan(40); // Should have many coal units
    expect(result.data[0].history.data.length).toBe(365);
    expect(result.data[0].history.start).toBe('2023-01-01');
    expect(result.data[0].history.last).toBe('2023-12-31');
    
    // Verify unit structure
    expect(result.data[0]).toHaveProperty('network');
    expect(result.data[0]).toHaveProperty('duid');
    expect(result.data[0]).toHaveProperty('facility_name');
    expect(result.data[0]).toHaveProperty('capacity');
    
    console.log('✅ Full year 2023 fetched successfully!');
  }, 30000);

  test('should fetch leap year 2024 with 6-month splitting from real API', async () => {
    console.log('\n🌐 Testing leap year 2024 with REAL API...');
    
    const startDate = parseDate('2024-01-01');
    const endDate = parseDate('2024-12-31');
    
    const result = await coalDataService.getCoalStripesDataRange(startDate, endDate);
    
    console.log(`📊 Result: ${result.data.length} units with ${result.data[0]?.history.data.length} days each`);
    console.log(`📊 Date range: ${result.data[0]?.history.start} → ${result.data[0]?.history.last}`);
    
    expect(result.data).toBeDefined();
    expect(result.data.length).toBeGreaterThan(40);
    expect(result.data[0].history.data.length).toBe(366);
    expect(result.data[0].history.start).toBe('2024-01-01');
    expect(result.data[0].history.last).toBe('2024-12-31');
    
    // Verify leap day data exists (Feb 29 at index 59)
    expect(result.data[0].history.data[59]).toBeDefined(); // Feb 29
    
    console.log('✅ Leap year 2024 fetched and merged successfully!');
  }, 30000); // Longer timeout for two API requests (leap year splits)

  test('should fetch current year 2025 (partial) from real API', async () => {
    console.log('\n🌐 Testing current year 2025 with REAL API...');
    
    const startDate = parseDate('2025-01-01');
    const endDate = parseDate('2025-12-31');
    
    const result = await coalDataService.getCoalStripesDataRange(startDate, endDate);
    
    console.log(`📊 Result: ${result.data.length} units with ${result.data[0]?.history.data.length} days each`);
    console.log(`📊 Date range: ${result.data[0]?.history.start} → ${result.data[0]?.history.last}`);
    
    // Should have all days for the year (API returns null data for future dates)
    expect(result.data).toBeDefined();
    expect(result.data.length).toBeGreaterThan(40);
    expect(result.data[0].history.data.length).toBe(365);
    expect(result.data[0].history.start).toBe('2025-01-01');
    
    // Verify we have actual data (not just null values)
    // Focus on NEM units only as WEM has known data issues
    const nemUnits = result.data.filter(u => u.network === 'nem');
    console.log(`\n📊 Found ${nemUnits.length} NEM units`);
    
    // Check a sample of NEM units
    console.log('\n📊 Data availability for NEM units:');
    const sampleNemUnits = nemUnits.slice(0, 5);
    sampleNemUnits.forEach(unit => {
      const nonNullDays = unit.history.data.filter(val => val !== null).length;
      const nullDays = unit.history.data.filter(val => val === null).length;
      console.log(`  ${unit.duid} (${unit.region}): ${nonNullDays}/${unit.history.data.length} days with data (${nullDays} nulls) - ${unit.facility_name}`);
    });
    
    // For NEM units, check that we have data up to yesterday (in AEST)
    // Today in AEST
    const todayAEST = today('Australia/Brisbane');
    const yesterdayAEST = todayAEST.subtract({ days: 1 });
    const yearStart = parseDate('2025-01-01');
    const expectedDaysWithData = yesterdayAEST.compare(yearStart) + 1; // Days from Jan 1 to yesterday inclusive
    
    console.log(`\n📅 Today (AEST): ${todayAEST.toString()}`);
    console.log(`📅 Expected data through: ${yesterdayAEST.toString()}`);
    console.log(`📅 Expected days with data: ${expectedDaysWithData}`);
    
    // Check the first NEM unit
    const firstNemUnit = nemUnits[0];
    const nonNullDays = firstNemUnit.history.data.filter(val => val !== null).length;
    
    console.log(`\n✅ First NEM unit (${firstNemUnit.duid}) has ${nonNullDays} days of non-null data`);
    
    // NEM units should have data for every day up to yesterday
    expect(nonNullDays).toBe(expectedDaysWithData);
    
    console.log('✅ Current year 2025 fetched successfully!');
  }, 30000);

  test('should handle cross-year requests by fetching multiple years', async () => {
    console.log('\n🌐 Testing cross-year request (2023-2024) with REAL API...');
    
    const startDate = parseDate('2023-10-01');
    const endDate = parseDate('2024-03-31');
    
    const result = await coalDataService.getCoalStripesDataRange(startDate, endDate);
    
    console.log(`📊 Result: ${result.data.length} units with ${result.data[0]?.history.data.length} days each`);
    console.log(`📊 Date range: ${result.data[0]?.history.start} → ${result.data[0]?.history.last}`);
    
    // Oct-Dec 2023 (92 days) + Jan-Mar 2024 (91 days) = 183 days
    expect(result.data).toBeDefined();
    expect(result.data.length).toBeGreaterThan(40);
    expect(result.data[0].history.data.length).toBe(183);
    expect(result.data[0].history.start).toBe('2023-10-01');
    expect(result.data[0].history.last).toBe('2024-03-31');
    
    console.log('✅ Cross-year request handled successfully!');
  }, 30000); // Longer timeout for multiple year requests

  test('should validate coal unit data structure from real API', async () => {
    console.log('\n🌐 Validating data structure with REAL API...');
    
    const result = await coalDataService.getCoalStripesDataRange(
      parseDate('2023-07-01'),
      parseDate('2023-07-31')
    );
    
    // Check unit structure
    expect(result.data).toBeDefined();
    expect(result.data.length).toBeGreaterThan(40);
    
    // Find units from different regions
    const nswUnits = result.data.filter(u => u.region === 'NSW1');
    const qldUnits = result.data.filter(u => u.region === 'QLD1');
    const vicUnits = result.data.filter(u => u.region === 'VIC1');
    const wemUnits = result.data.filter(u => u.network === 'wem');
    
    expect(nswUnits.length).toBeGreaterThan(5);
    expect(qldUnits.length).toBeGreaterThan(5);
    expect(vicUnits.length).toBeGreaterThan(3);
    expect(wemUnits.length).toBeGreaterThan(3);
    
    // Check first unit structure
    const firstUnit = result.data[0];
    expect(firstUnit).toHaveProperty('duid');
    expect(firstUnit).toHaveProperty('facility_name');
    expect(firstUnit).toHaveProperty('facility_code');
    expect(firstUnit).toHaveProperty('capacity');
    expect(firstUnit).toHaveProperty('fueltech');
    expect(firstUnit).toHaveProperty('history');
    
    // Check data for all days in July
    expect(firstUnit.history.data.length).toBe(31);
    firstUnit.history.data.forEach((value, index) => {
      expect(typeof value === 'number' || value === null).toBe(true);
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
    });
    
    console.log('✅ Data structure validated successfully!');
  }, 30000);

  test('should verify caching works with real API', async () => {
    console.log('\n🌐 Testing caching with REAL API...');
    
    // Create a fresh service instance to ensure clean cache
    const apiKey = process.env.OPENELECTRICITY_API_KEY;
    if (!apiKey) {
      throw new Error('OPENELECTRICITY_API_KEY environment variable is required');
    }
    const freshService = new CoalDataService(apiKey);
    
    // First request - will hit API
    const start1 = Date.now();
    await freshService.getCoalStripesDataRange(
      parseDate('2023-01-01'),
      parseDate('2023-12-31')
    );
    const time1 = Date.now() - start1;
    console.log(`⏱️  First request took ${time1}ms (API call)`);
    
    // Second request - should hit cache
    const start2 = Date.now();
    const result = await freshService.getCoalStripesDataRange(
      parseDate('2023-06-01'),
      parseDate('2023-06-30')
    );
    const time2 = Date.now() - start2;
    console.log(`⏱️  Second request took ${time2}ms (cache hit)`);
    
    // Cache should be significantly faster
    // But be realistic - sometimes API is very fast too
    expect(time2).toBeLessThan(Math.max(time1 * 0.8, 10)); // At least 20% faster or under 10ms
    expect(result.data[0].history.data.length).toBe(30); // June has 30 days
    
    console.log(`✅ Caching verified! Speed improvement: ${Math.round((1 - time2/time1) * 100)}%`);
  }, 30000);
});