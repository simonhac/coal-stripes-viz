import { CoalDataService } from '../coal-data-service';

describe('CoalDataService - Facility Filtering', () => {
  let service: CoalDataService;

  beforeAll(() => {
    // Use environment variable for API key
    const apiKey = process.env.OPENELECTRICITY_API_KEY;
    if (!apiKey) {
      throw new Error('OPENELECTRICITY_API_KEY environment variable is required for tests');
    }
    service = new CoalDataService(apiKey);
  });

  test('should only return facilities with coal units', async () => {
    // Access the private method through reflection for testing
    const coalFacilities = await (service as any).getAllCoalFacilities();
    
    console.log(`Facility filter test: Found ${coalFacilities.length} coal facilities`);
    
    // Check that every facility has at least one coal unit
    const facilitiesWithoutCoal = coalFacilities.filter((facility: any) => {
      const coalUnits = facility.units.filter((unit: any) => 
        unit.fueltech_id === 'coal_black' || unit.fueltech_id === 'coal_brown'
      );
      return coalUnits.length === 0;
    });
    
    expect(facilitiesWithoutCoal).toHaveLength(0);
  });

  test('should analyze facility data', async () => {
    const coalFacilities = await (service as any).getAllCoalFacilities();
    
    // Group by region
    const regionGroups: Record<string, any[]> = {};
    let nonCoalCount = 0;
    let mixedFuelCount = 0;
    
    coalFacilities.forEach((facility: any) => {
      const region = facility.network_region;
      if (!regionGroups[region]) regionGroups[region] = [];
      regionGroups[region].push(facility);
      
      // Check for mixed fueltechs
      const fueltechs = [...new Set(facility.units.map((u: any) => u.fueltech_id))];
      if (fueltechs.length > 1) mixedFuelCount++;
      
      // Count non-coal units
      facility.units.forEach((unit: any) => {
        if (unit.fueltech_id !== 'coal_black' && unit.fueltech_id !== 'coal_brown') {
          nonCoalCount++;
        }
      });
    });
    
    // Summary
    const regionSummary = Object.entries(regionGroups)
      .map(([region, facilities]) => `${region}: ${facilities.length}`)
      .join(', ');
    
    console.log(`Facility analysis: ${coalFacilities.length} total (${regionSummary})`);
    
    if (nonCoalCount > 0 || mixedFuelCount > 0) {
      console.log(`  • ${nonCoalCount} non-coal units in ${mixedFuelCount} mixed-fuel facilities`);
    }
    
    expect(coalFacilities.length).toBe(32);
  });
});