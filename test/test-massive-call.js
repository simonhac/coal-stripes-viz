// Test "single massive call" strategy for all coal facilities
require('dotenv').config({ path: '.env.local' });
const { OpenElectricityClient } = require('openelectricity');

const apiKey = process.env.OPENELECTRICITY_API_KEY;

async function testMassiveCall() {
  console.log('Testing "single massive call" strategy...');
  
  try {
    const client = new OpenElectricityClient({ apiKey });
    
    // Step 1: Get all facilities (1 API call)
    console.log('\n=== STEP 1: Get all coal facilities ===');
    const facilities = await client.getFacilities({ network: 'NEM' });
    const coalFacilities = facilities.response.data.filter(f => 
      f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
    );
    
    const coalFacilityCodes = coalFacilities.map(f => f.code);
    console.log(`Found ${coalFacilities.length} coal facilities`);
    console.log('Coal facility codes:', coalFacilityCodes);
    
    // Count total units for validation
    const totalUnits = coalFacilities.reduce((sum, f) => 
      sum + f.units.filter(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown').length, 0
    );
    console.log(`Total coal units: ${totalUnits}`);
    
    // Step 2: Single massive call - test with shorter period first
    console.log('\n=== STEP 2: Test with 30 days first ===');
    console.log('Making single API call for all coal facilities (30 days)...');
    
    const startTime = Date.now();
    const shortTest = await client.getFacilityData(
      'NEM',
      coalFacilityCodes,
      ['energy'],
      {
        interval: '1d',
        dateStart: '2024-07-01',
        dateEnd: '2024-07-30'
      }
    );
    const shortDuration = Date.now() - startTime;
    
    console.log('30-day test results:', {
      success: shortTest.response?.success,
      duration: `${shortDuration}ms`,
      totalRows: shortTest.datatable?.rows?.length,
      expectedRows: `${totalUnits * 30} (${totalUnits} units × 30 days)`,
      facilities: [...new Set(shortTest.datatable?.rows?.map(r => r.facility_code).filter(Boolean))].length,
      units: [...new Set(shortTest.datatable?.rows?.map(r => r.unit_code))].length
    });
    
    if (shortTest.response?.success) {
      console.log('\n✅ 30-day test successful! Proceeding with 365-day test...');
      
      // Step 3: Single massive call for full year
      console.log('\n=== STEP 3: Single massive call for 365 days ===');
      console.log('Making single API call for all coal facilities (365 days)...');
      console.log('⏳ This may take a while...');
      
      const fullStartTime = Date.now();
      const fullTest = await client.getFacilityData(
        'NEM',
        coalFacilityCodes,
        ['energy'],
        {
          interval: '1d',
          dateStart: '2024-01-01',
          dateEnd: '2024-12-31'
        }
      );
      const fullDuration = Date.now() - fullStartTime;
      
      console.log('\n🎉 365-day test results:', {
        success: fullTest.response?.success,
        duration: `${fullDuration}ms (${(fullDuration / 1000).toFixed(1)}s)`,
        totalRows: fullTest.datatable?.rows?.length,
        expectedRows: `${totalUnits * 365} (${totalUnits} units × 365 days)`,
        facilities: [...new Set(fullTest.datatable?.rows?.map(r => r.facility_code).filter(Boolean))].length,
        units: [...new Set(fullTest.datatable?.rows?.map(r => r.unit_code))].length
      });
      
      // Sample data analysis
      if (fullTest.datatable?.rows?.length > 0) {
        console.log('\n=== DATA ANALYSIS ===');
        
        // Check data completeness
        const actualRows = fullTest.datatable.rows.length;
        const expectedRows = totalUnits * 365;
        const completeness = (actualRows / expectedRows * 100).toFixed(1);
        console.log(`Data completeness: ${completeness}%`);
        
        // Sample records
        console.log('\nSample records:');
        fullTest.datatable.rows.slice(0, 3).forEach(row => {
          console.log(`  ${row.interval?.toISOString()?.split('T')[0]} | ${row.unit_code} | ${row.energy?.toFixed(1)} MWh`);
        });
        
        // Units by facility
        const unitsByFacility = fullTest.datatable.rows.reduce((acc, row) => {
          if (!acc[row.facility_code]) acc[row.facility_code] = new Set();
          acc[row.facility_code].add(row.unit_code);
          return acc;
        }, {});
        
        console.log('\nUnits per facility:');
        Object.entries(unitsByFacility).forEach(([facility, units]) => {
          console.log(`  ${facility}: ${units.size} units`);
        });
        
        // Date range
        const dates = fullTest.datatable.rows.map(r => r.interval);
        const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
        const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
        console.log(`Date range: ${minDate} to ${maxDate}`);
        
        console.log('\n=== FINAL STRATEGY SUMMARY ===');
        console.log('✅ Single massive call SUCCESS!');
        console.log(`📊 Total API calls needed: 2 (1 facilities + 1 data)`);
        console.log(`⚡ Total load time: ~${((Date.now() - fullStartTime) / 1000).toFixed(1)}s`);
        console.log(`💾 Data volume: ${actualRows.toLocaleString()} rows`);
        console.log(`🎯 Perfect for coal stripes visualization!`);
      }
      
    } else {
      console.log('❌ 30-day test failed - massive call strategy not viable');
    }
    
  } catch (error) {
    console.error('❌ Massive call test error:', error.message);
    console.log('\n💡 Recommendation: Fall back to batch strategy');
  }
}

testMassiveCall();