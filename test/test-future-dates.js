// Test script to check how OpenElectricity API handles future dates
require('dotenv').config({ path: '.env.local' });
const { OpenElectricityClient } = require('openelectricity');

const apiKey = process.env.OPENELECTRICITY_API_KEY;
if (!apiKey) {
  console.error('❌ API key not found in .env.local');
  process.exit(1);
}

console.log('Using API key:', `${apiKey.substring(0, 10)}...`);

async function testFutureDates() {
  console.log('🔬 Testing OpenElectricity API behavior with future dates...\n');
  
  try {
    // Initialize the client
    const client = new OpenElectricityClient({ apiKey });
    console.log('✅ Client initialized successfully\n');
    
    // Get a coal facility to test with
    console.log('📋 Getting coal facilities...');
    const facilities = await client.getFacilities();
    const coalFacilities = facilities.response.data.filter(f => 
      f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
    );
    
    if (coalFacilities.length === 0) {
      console.error('❌ No coal facilities found');
      return;
    }
    
    // Find a NEM coal facility (not WEM or VIC1)
    const nemCoalFacilities = coalFacilities.filter(f => 
      f.network_region === 'NSW1' || 
      f.network_region === 'QLD1' || 
      f.network_region === 'SA1'
    );
    
    if (nemCoalFacilities.length === 0) {
      console.error('❌ No NEM coal facilities found');
      return;
    }
    
    const testFacility = nemCoalFacilities[0];
    console.log(`✅ Using facility: ${testFacility.name} (${testFacility.code}) in ${testFacility.network_region}\n`);
    
    // Test 1: Full year 2025 (far future)
    console.log('🧪 Test 1: Full year 2025 (2025-01-01 to 2025-12-31)');
    console.log('------------------------------------------------');
    try {
      const startTime = Date.now();
      const network = testFacility.network_region === 'WEM' ? 'WEM' : 'NEM';
      const result = await client.getFacilityData(
        network,
        [testFacility.code],
        ['energy'],
        {
          interval: '1d',
          dateStart: '2025-01-01',
          dateEnd: '2025-12-31'
        }
      );
      const duration = Date.now() - startTime;
      
      console.log(`✅ Request completed in ${duration}ms`);
      console.log(`📊 Data rows returned: ${result.datatable?.rows?.length || 0}`);
      
      if (result.datatable?.rows?.length > 0) {
        console.log(`   First row: ${JSON.stringify(result.datatable.rows[0])}`);
        console.log(`   Last row: ${JSON.stringify(result.datatable.rows[result.datatable.rows.length - 1])}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Test 2: Near future (next 30 days from today)
    console.log('\n🧪 Test 2: Near future (next 30 days)');
    console.log('------------------------------------------------');
    try {
      const today = new Date();
      const in30Days = new Date(today);
      in30Days.setDate(today.getDate() + 30);
      
      const dateStart = today.toISOString().split('T')[0];
      const dateEnd = in30Days.toISOString().split('T')[0];
      
      console.log(`   Date range: ${dateStart} to ${dateEnd}`);
      
      const startTime = Date.now();
      const network = testFacility.network_region === 'WEM' ? 'WEM' : 'NEM';
      const result = await client.getFacilityData(
        network,
        [testFacility.code],
        ['energy'],
        {
          interval: '1d',
          dateStart,
          dateEnd
        }
      );
      const duration = Date.now() - startTime;
      
      console.log(`✅ Request completed in ${duration}ms`);
      console.log(`📊 Data rows returned: ${result.datatable?.rows?.length || 0}`);
      
      if (result.datatable?.rows?.length > 0) {
        console.log(`   First row: ${JSON.stringify(result.datatable.rows[0])}`);
        console.log(`   Last row: ${JSON.stringify(result.datatable.rows[result.datatable.rows.length - 1])}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Test 3: Mixed range (past to future)
    console.log('\n🧪 Test 3: Mixed range (30 days ago to 30 days future)');
    console.log('------------------------------------------------');
    try {
      const today = new Date();
      const ago30Days = new Date(today);
      ago30Days.setDate(today.getDate() - 30);
      const in30Days = new Date(today);
      in30Days.setDate(today.getDate() + 30);
      
      const dateStart = ago30Days.toISOString().split('T')[0];
      const dateEnd = in30Days.toISOString().split('T')[0];
      
      console.log(`   Date range: ${dateStart} to ${dateEnd}`);
      
      const startTime = Date.now();
      const network = testFacility.network_region === 'WEM' ? 'WEM' : 'NEM';
      const result = await client.getFacilityData(
        network,
        [testFacility.code],
        ['energy'],
        {
          interval: '1d',
          dateStart,
          dateEnd
        }
      );
      const duration = Date.now() - startTime;
      
      console.log(`✅ Request completed in ${duration}ms`);
      console.log(`📊 Data rows returned: ${result.datatable?.rows?.length || 0}`);
      
      if (result.datatable?.rows?.length > 0) {
        // Find where data stops
        const dates = result.datatable.rows.map(row => row.interval);
        const sortedDates = dates.sort();
        console.log(`   First data date: ${sortedDates[0]}`);
        console.log(`   Last data date: ${sortedDates[sortedDates.length - 1]}`);
        
        // Check if we got any future data
        const todayStr = new Date().toISOString().split('T')[0];
        const futureDates = sortedDates.filter(date => date > todayStr);
        console.log(`   Future dates returned: ${futureDates.length}`);
        if (futureDates.length > 0) {
          console.log(`   Future dates: ${futureDates.join(', ')}`);
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Test 4: Immediate future (tomorrow only)
    console.log('\n🧪 Test 4: Immediate future (tomorrow only)');
    console.log('------------------------------------------------');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const dateStart = tomorrow.toISOString().split('T')[0];
      const dateEnd = dateStart;
      
      console.log(`   Date range: ${dateStart} to ${dateEnd}`);
      
      const startTime = Date.now();
      const network = testFacility.network_region === 'WEM' ? 'WEM' : 'NEM';
      const result = await client.getFacilityData(
        network,
        [testFacility.code],
        ['energy'],
        {
          interval: '1d',
          dateStart,
          dateEnd
        }
      );
      const duration = Date.now() - startTime;
      
      console.log(`✅ Request completed in ${duration}ms`);
      console.log(`📊 Data rows returned: ${result.datatable?.rows?.length || 0}`);
      
      if (result.datatable?.rows?.length > 0) {
        console.log(`   Data: ${JSON.stringify(result.datatable.rows)}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Test 5: Different intervals for future dates
    console.log('\n🧪 Test 5: Future dates with different intervals (5-minute vs daily)');
    console.log('------------------------------------------------');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    // Test 5a: 5-minute interval
    console.log('\n   5a) 5-minute interval for tomorrow:');
    try {
      const startTime = Date.now();
      const network = testFacility.network_region === 'WEM' ? 'WEM' : 'NEM';
      const result = await client.getFacilityData(
        network,
        [testFacility.code],
        ['energy'],
        {
          interval: '5m',
          dateStart: dateStr,
          dateEnd: dateStr
        }
      );
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ Request completed in ${duration}ms`);
      console.log(`   📊 Data rows returned: ${result.datatable?.rows?.length || 0}`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Test 5b: Monthly interval for 2025
    console.log('\n   5b) Monthly interval for 2025:');
    try {
      const startTime = Date.now();
      const network = testFacility.network_region === 'WEM' ? 'WEM' : 'NEM';
      const result = await client.getFacilityData(
        network,
        [testFacility.code],
        ['energy'],
        {
          interval: '1M',
          dateStart: '2025-01-01',
          dateEnd: '2025-12-31'
        }
      );
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ Request completed in ${duration}ms`);
      console.log(`   📊 Data rows returned: ${result.datatable?.rows?.length || 0}`);
      
      if (result.datatable?.rows?.length > 0) {
        console.log(`   Data: ${JSON.stringify(result.datatable.rows, null, 2)}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
  }
}

// Run the tests
testFutureDates();