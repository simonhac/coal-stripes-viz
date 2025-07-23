// Simple test to check the actual error
require('dotenv').config({ path: '.env.local' });
const { OpenElectricityClient, OpenElectricityError } = require('openelectricity');

async function test() {
  const client = new OpenElectricityClient({
    apiKey: process.env.OPENELECTRICITY_API_KEY
  });

  try {
    // Get facilities first
    const { table } = await client.getFacilities({
      status_id: ['operating'],
      fueltech_id: ['coal_black']
    });
    
    const facilities = table.getRecords();
    const facility = facilities[0];
    
    console.log('Testing with facility:', facility.facility_code, 'on network:', facility.facility_network);
    
    try {
      const data = await client.getFacilityData(
        facility.facility_network.toLowerCase(),
        facility.facility_code,
        ['energy'],
        {
          interval: 'day',
          dateStart: '2023-01-01',
          dateEnd: '2023-01-07'
        }
      );
      console.log('Success!');
    } catch (err) {
      console.log('\nError caught:');
      console.log('Is OpenElectricityError?', err instanceof OpenElectricityError);
      console.log('Error:', err);
      
      // Check if axios error
      if (err.response && err.response.data) {
        console.log('\nResponse data:', JSON.stringify(err.response.data, null, 2));
      }
      
      // Check if the error has been wrapped
      if (err.cause && err.cause.response && err.cause.response.data) {
        console.log('\nCause response data:', JSON.stringify(err.cause.response.data, null, 2));
      }
    }
  } catch (err) {
    console.error('Top-level error:', err);
  }
}

test();