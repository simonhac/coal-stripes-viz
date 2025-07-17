// Test script using the OpenElectricity TypeScript client
require('dotenv').config({ path: '.env.local' });
const { OpenElectricityClient } = require('openelectricity');

const apiKey = process.env.OPENELECTRICITY_API_KEY || 'your_api_key_here';
console.log('Using API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND');

async function testOpenElectricityClient() {
  console.log('Testing OpenElectricity TypeScript client...');
  
  try {
    // Initialize the client
    const client = new OpenElectricityClient({
      apiKey: apiKey
    });
    
    console.log('Client initialized successfully');
    
    // Test 1: Get current user
    console.log('\n--- Testing current user ---');
    const user = await client.getCurrentUser();
    console.log('User data:', JSON.stringify(user, null, 2));
    
    // Test 2: Get facilities data (basic)
    console.log('\n--- Testing facilities data ---');
    const facilities = await client.getFacilities({
      network: 'NEM'
    });
    console.log('Facilities response:', JSON.stringify(facilities, null, 2));
    
    if (facilities.data) {
      console.log('Facilities count:', facilities.data.length);
      
      // Filter for coal facilities
      const coalFacilities = facilities.data.filter(f => 
        f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
      );
      console.log('Coal facilities count:', coalFacilities.length);
      console.log('Sample coal facility:', JSON.stringify(coalFacilities[0], null, 2));
      
      // List all coal units
      const coalUnits = [];
      coalFacilities.forEach(facility => {
        facility.units.forEach(unit => {
          if (unit.fueltech_id === 'coal_black' || unit.fueltech_id === 'coal_brown') {
            coalUnits.push({
              facility: facility.name,
              facility_code: facility.code,
              region: facility.network_region,
              unit_code: unit.code,
              capacity: unit.capacity_registered,
              fueltech: unit.fueltech_id,
              status: unit.status_id
            });
          }
        });
      });
      
      console.log('Coal units summary:', coalUnits.length);
      console.log('Sample coal units:', JSON.stringify(coalUnits.slice(0, 5), null, 2));
    }
    
    // Test 3: Get 365 days of historical generation data
    console.log('\n--- Testing 365 days of generation data ---');
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      const today = new Date();
      
      const dateStart = oneYearAgo.toISOString().split('T')[0];
      const dateEnd = today.toISOString().split('T')[0];
      
      console.log(`Requesting data from ${dateStart} to ${dateEnd}`);
      
      const networkData = await client.getNetworkData(
        'NEM',
        ['energy'],
        {
          fueltech: ['coal_black', 'coal_brown'],
          interval: '1d',
          dateStart: dateStart,
          dateEnd: dateEnd
        }
      );
      
      console.log('Network data response structure:', {
        success: networkData.success,
        dataLength: networkData.data?.length,
        firstRecord: networkData.data?.[0],
        lastRecord: networkData.data?.[networkData.data?.length - 1]
      });
      
    } catch (networkError) {
      console.log('Network data error:', networkError.message);
      
      // Try with a specific facility instead
      console.log('\n--- Testing facility-specific data ---');
      try {
        const facilityData = await client.getFacilityData(
          'NEM',
          'BAYSW', // Bayswater facility
          ['energy'],
          {
            interval: '1d',
            dateStart: '2024-07-01',
            dateEnd: '2024-07-17'
          }
        );
        
        console.log('Facility data response:', JSON.stringify(facilityData, null, 2));
      } catch (facilityError) {
        console.log('Facility data also denied:', facilityError.message);
      }
    }
    
  } catch (error) {
    console.error('Client test error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
  }
}

// Run the tests
testOpenElectricityClient();