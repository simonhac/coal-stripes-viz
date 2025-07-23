// Test unit code vs facility code
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
    
    console.log('Facility details:');
    console.log('  facility_code:', facility.facility_code);
    console.log('  unit_code:', facility.unit_code);
    console.log('  facility_network:', facility.facility_network);
    
    // Try with unit code instead of facility code
    console.log('\nTrying with unit_code:', facility.unit_code);
    try {
      const data = await client.getFacilityData(
        facility.facility_network.toLowerCase(),
        facility.unit_code,  // Use unit_code instead
        ['energy'],
        {
          interval: 'day',
          dateStart: '2023-01-01',
          dateEnd: '2023-01-07'
        }
      );
      console.log('Success with unit_code!');
      console.log('Data response keys:', Object.keys(data));
      if (data.table) {
        console.log('Table records:', data.table.getRecords().length);
        console.log('First record:', data.table.getRecords()[0]);
      }
    } catch (err) {
      console.log('Failed with unit_code:', err.message);
    }
    
    // Try with both
    console.log('\nTrying with both facility_code and unit_code:');
    try {
      const data = await client.getFacilityData(
        facility.facility_network.toLowerCase(),
        [facility.facility_code, facility.unit_code],
        ['energy'],
        {
          interval: 'day',
          dateStart: '2023-01-01',
          dateEnd: '2023-01-07'
        }
      );
      console.log('Success with both!');
    } catch (err) {
      console.log('Failed with both:', err.message);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();