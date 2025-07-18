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
    console.log('Testing facility filtering...');
    
    // Access the private method through reflection for testing
    const coalFacilities = await (service as any).getAllCoalFacilities();
    
    console.log(`Found ${coalFacilities.length} coal facilities`);
    
    // Check that every facility has at least one coal unit
    const facilitiesWithoutCoal = coalFacilities.filter((facility: any) => {
      const coalUnits = facility.units.filter((unit: any) => 
        unit.fueltech_id === 'coal_black' || unit.fueltech_id === 'coal_brown'
      );
      return coalUnits.length === 0;
    });
    
    if (facilitiesWithoutCoal.length > 0) {
      console.log('❌ Found facilities without coal units:');
      facilitiesWithoutCoal.forEach((facility: any) => {
        console.log(`  - ${facility.name} (${facility.code})`);
        console.log(`    Units: ${facility.units.map((u: any) => `${u.code}:${u.fueltech_id}`).join(', ')}`);
      });
    }
    
    expect(facilitiesWithoutCoal).toHaveLength(0);
  });

  test('should show detailed facility and unit information', async () => {
    console.log('\\n=== DETAILED FACILITY ANALYSIS ===');
    
    const coalFacilities = await (service as any).getAllCoalFacilities();
    
    console.log(`Total coal facilities: ${coalFacilities.length}`);
    
    // Group by region
    const regionGroups: Record<string, any[]> = {};
    coalFacilities.forEach((facility: any) => {
      const region = facility.network_region;
      if (!regionGroups[region]) regionGroups[region] = [];
      regionGroups[region].push(facility);
    });
    
    console.log('\\n=== FACILITIES BY REGION ===');
    Object.entries(regionGroups).forEach(([region, facilities]) => {
      console.log(`\\n${region}: ${facilities.length} facilities`);
      facilities.forEach((facility: any) => {
        console.log(`  ${facility.name} (${facility.code})`);
        facility.units.forEach((unit: any) => {
          console.log(`    - ${unit.code}: ${unit.fueltech_id} (${unit.capacity_registered}MW, ${unit.status_id})`);
        });
      });
    });
    
    // Check for suspicious units
    console.log('\\n=== SUSPICIOUS UNIT ANALYSIS ===');
    let suspiciousUnits: any[] = [];
    
    coalFacilities.forEach((facility: any) => {
      facility.units.forEach((unit: any) => {
        // Check if fueltech matches what we expect
        if (unit.fueltech_id !== 'coal_black' && unit.fueltech_id !== 'coal_brown') {
          suspiciousUnits.push({
            facility: facility.name,
            facilityCode: facility.code,
            unitCode: unit.code,
            fueltech: unit.fueltech_id,
            capacity: unit.capacity_registered,
            status: unit.status_id
          });
        }
      });
    });
    
    if (suspiciousUnits.length > 0) {
      console.log('❓ Found units with non-coal fueltech:');
      suspiciousUnits.forEach(unit => {
        console.log(`  - ${unit.facility}: ${unit.unitCode} (${unit.fueltech})`);
      });
    } else {
      console.log('✅ All units have coal fueltech');
    }
    
    // Check for facilities with mixed fueltechs
    console.log('\\n=== MIXED FUELTECH ANALYSIS ===');
    coalFacilities.forEach((facility: any) => {
      const fueltechs = [...new Set(facility.units.map((u: any) => u.fueltech_id))];
      if (fueltechs.length > 1) {
        console.log(`${facility.name}: ${fueltechs.join(', ')}`);
      }
    });
    
    // This test always passes, it's just for analysis
    expect(true).toBe(true);
  });
});