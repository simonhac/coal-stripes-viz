// Test network case sensitivity
require('dotenv').config({ path: '.env.local' });
const { OpenElectricityClient } = require('openelectricity');

async function test() {
  const client = new OpenElectricityClient({
    apiKey: process.env.OPENELECTRICITY_API_KEY
  });

  try {
    // Get facilities
    const { table } = await client.getFacilities({
      status_id: ['operating'],
      fueltech_id: ['coal_black']
    });
    
    const facilities = table.getRecords();
    const facility = facilities[0];
    
    console.log('Facility network from API:', facility.facility_network);
    console.log('Network value type:', typeof facility.facility_network);
    
    // Try lowercase
    console.log('\nTrying lowercase "nem"...');
    try {
      const data = await client.getFacilityData(
        'nem',
        facility.facility_code,
        ['energy'],
        {
          interval: '1d',
          dateStart: '2023-01-01',
          dateEnd: '2023-01-02'
        }
      );
      console.log('Success with lowercase!');
    } catch (err) {
      console.log('Failed with lowercase:', err.message);
    }
    
    // Try uppercase
    console.log('\nTrying uppercase "NEM"...');
    try {
      const data = await client.getFacilityData(
        'NEM',
        facility.facility_code,
        ['energy'],
        {
          interval: '1d',
          dateStart: '2023-01-01',
          dateEnd: '2023-01-02'
        }
      );
      console.log('Success with uppercase!');
    } catch (err) {
      console.log('Failed with uppercase:', err.message);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();