// Quick test to see what the API expects
require('dotenv').config({ path: '.env.local' });
const { OpenElectricityClient } = require('openelectricity');

async function test() {
  const client = new OpenElectricityClient({
    apiKey: process.env.OPENELECTRICITY_API_KEY
  });

  try {
    // Test 1: Get facilities
    console.log('Testing getFacilities...');
    const { table } = await client.getFacilities({
      status_id: ['operating'],
      fueltech_id: ['coal_black', 'coal_brown']
    });
    
    const facilities = table.getRecords();
    console.log(`Found ${facilities.length} facilities`);
    console.log('First facility:', facilities[0]);
    
    // Test 2: Try to get data for one facility
    if (facilities.length > 0) {
      const facility = facilities[0];
      console.log('\nTesting getFacilityData...');
      console.log(`Network: ${facility.facility_network}`);
      console.log(`Facility Code: ${facility.facility_code}`);
      console.log(`Unit Code: ${facility.unit_code}`);
      
      // Try with different date formats
      const testCases = [
        { dateStart: '2023-01-01', dateEnd: '2023-01-07', desc: 'Simple date' },
        { dateStart: '2023-01-01T00:00', dateEnd: '2023-01-07T00:00', desc: 'With time no seconds' },
      ];
      
      for (const testCase of testCases) {
        console.log(`\nTrying ${testCase.desc}...`);
        try {
          const data = await client.getFacilityData(
            facility.facility_network.toLowerCase(),
            facility.facility_code, // Try single string
            ['energy'],
            {
              interval: 'day',
              dateStart: testCase.dateStart,
              dateEnd: testCase.dateEnd
            }
          );
          console.log('Success! Got data:', data);
          break;
        } catch (err) {
          console.error(`Failed with ${testCase.desc}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();