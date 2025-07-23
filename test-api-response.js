// Test what the API actually returns
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
    
    console.log('Testing with facility:', facility.facility_code);
    
    // Get data
    const response = await client.getFacilityData(
      'NEM',
      facility.facility_code,
      ['energy'],
      {
        interval: '1d',
        dateStart: '2023-01-01',
        dateEnd: '2023-01-07'
      }
    );
    
    console.log('\nResponse structure:', Object.keys(response));
    
    if (response.table) {
      console.log('Table type:', response.table.constructor.name);
      console.log('Table methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(response.table)));
      
      const records = response.table.getRecords();
      console.log('\nRecords count:', records.length);
      if (records.length > 0) {
        console.log('First record:', records[0]);
      }
    }
    
    if (response.data) {
      console.log('\nData array length:', response.data.length);
      if (response.data.length > 0) {
        console.log('First data item:', response.data[0]);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();