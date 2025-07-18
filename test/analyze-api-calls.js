// Analyze API call requirements for coal stripes visualisation
require('dotenv').config({ path: '.env.local' });
const { OpenElectricityClient } = require('openelectricity');

const apiKey = process.env.OPENELECTRICITY_API_KEY;

async function analyzeApiCalls() {
  console.log('Analyzing API call requirements for coal stripes...');
  
  try {
    const client = new OpenElectricityClient({ apiKey });
    
    // 1. Get all facilities (1 API call)
    console.log('\n=== STEP 1: Get all facilities ===');
    const facilities = await client.getFacilities({ network: 'NEM' });
    const coalFacilities = facilities.response.data.filter(f => 
      f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
    );
    
    console.log('Total NEM facilities:', facilities.response.data.length);
    console.log('Coal facilities:', coalFacilities.length);
    
    // Analyze coal facilities by region
    const byRegion = coalFacilities.reduce((acc, f) => {
      acc[f.network_region] = acc[f.network_region] || [];
      acc[f.network_region].push(f);
      return acc;
    }, {});
    
    console.log('\nCoal facilities by region:');
    Object.entries(byRegion).forEach(([region, facilities]) => {
      const totalUnits = facilities.reduce((sum, f) => 
        sum + f.units.filter(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown').length, 0
      );
      console.log(`${region}: ${facilities.length} facilities, ${totalUnits} units`);
    });
    
    // Count total coal units
    const allCoalUnits = [];
    coalFacilities.forEach(facility => {
      facility.units.forEach(unit => {
        if (unit.fueltech_id === 'coal_black' || unit.fueltech_id === 'coal_brown') {
          allCoalUnits.push({
            facility_code: facility.code,
            facility_name: facility.name,
            region: facility.network_region,
            unit_code: unit.code,
            capacity: unit.capacity_registered,
            fueltech: unit.fueltech_id,
            status: unit.status_id
          });
        }
      });
    });
    
    console.log('\nTotal coal units:', allCoalUnits.length);
    console.log('Operating coal units:', allCoalUnits.filter(u => u.status === 'operating').length);
    console.log('Retired coal units:', allCoalUnits.filter(u => u.status === 'retired').length);
    
    // 2. Test batch API call efficiency
    console.log('\n=== STEP 2: Test batch API call efficiency ===');
    
    // Test 1: Single facility call
    console.log('\n--- Test 1: Single facility call ---');
    const singleFacilityTest = await client.getFacilityData(
      'NEM',
      'BAYSW',
      ['energy'],
      {
        interval: '1d',
        dateStart: '2024-07-10',
        dateEnd: '2024-07-17'
      }
    );
    console.log('Single facility (BAYSW) response:', {
      success: singleFacilityTest.response?.success,
      rows: singleFacilityTest.datatable?.rows?.length,
      units: [...new Set(singleFacilityTest.datatable?.rows?.map(r => r.unit_code))]
    });
    
    // Test 2: Multiple facility batch call
    console.log('\n--- Test 2: Multiple facility batch call ---');
    const topCoalFacilities = coalFacilities.slice(0, 5).map(f => f.code);
    console.log('Testing batch with facilities:', topCoalFacilities);
    
    const batchTest = await client.getFacilityData(
      'NEM',
      topCoalFacilities,
      ['energy'],
      {
        interval: '1d',
        dateStart: '2024-07-10',
        dateEnd: '2024-07-17'
      }
    );
    
    console.log('Batch facility response:', {
      success: batchTest.response?.success,
      rows: batchTest.datatable?.rows?.length,
      facilities: [...new Set(batchTest.datatable?.rows?.map(r => r.facility_code).filter(Boolean))],
      units: [...new Set(batchTest.datatable?.rows?.map(r => r.unit_code))]
    });
    
    // Test 3: Estimate optimal batch size
    console.log('\n--- Test 3: Estimate optimal batch size ---');
    
    // Calculate API call strategies
    console.log('\n=== API CALL STRATEGIES ===');
    
    console.log('\n1. INDIVIDUAL FACILITY CALLS:');
    console.log(`   - ${coalFacilities.length} API calls (1 per facility)`);
    console.log(`   - Total API calls: ${coalFacilities.length + 1} (including facilities list)`);
    
    console.log('\n2. BATCH CALLS (5 facilities per call):');
    const batchesOf5 = Math.ceil(coalFacilities.length / 5);
    console.log(`   - ${batchesOf5} API calls (5 facilities per call)`);
    console.log(`   - Total API calls: ${batchesOf5 + 1} (including facilities list)`);
    
    console.log('\n3. BATCH CALLS (10 facilities per call):');
    const batchesOf10 = Math.ceil(coalFacilities.length / 10);
    console.log(`   - ${batchesOf10} API calls (10 facilities per call)`);
    console.log(`   - Total API calls: ${batchesOf10 + 1} (including facilities list)`);
    
    console.log('\n4. SINGLE MASSIVE CALL:');
    console.log(`   - 1 API call (all ${coalFacilities.length} facilities)`);
    console.log(`   - Total API calls: 2 (including facilities list)`);
    console.log(`   - Risk: May timeout or hit size limits`);
    
    // Recommended strategy
    console.log('\n=== RECOMMENDED STRATEGY ===');
    console.log('For 365 days of data:');
    console.log(`- Use batch calls with ~10 facilities per call`);
    console.log(`- Total API calls: ~${batchesOf10 + 1}`);
    console.log(`- Expected data volume: ~${allCoalUnits.length * 365} rows`);
    console.log(`- Load time: ~${(batchesOf10 + 1) * 2} seconds (estimated)`);
    
    // Show facility groupings for optimal batching
    console.log('\n=== FACILITY GROUPING FOR BATCHING ===');
    const facilityCodes = coalFacilities.map(f => f.code);
    const batches = [];
    for (let i = 0; i < facilityCodes.length; i += 10) {
      batches.push(facilityCodes.slice(i, i + 10));
    }
    
    console.log('Optimal batch groupings (10 per batch):');
    batches.forEach((batch, i) => {
      console.log(`Batch ${i + 1}: [${batch.join(', ')}]`);
    });
    
  } catch (error) {
    console.error('Analysis error:', error.message);
  }
}

analyzeApiCalls();