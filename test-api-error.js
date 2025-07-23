// Debug script to understand OpenElectricity API errors
require('dotenv').config({ path: '.env.local' });
const { OpenElectricityClient } = require('openelectricity');

async function test() {
  const client = new OpenElectricityClient({
    apiKey: process.env.OPENELECTRICITY_API_KEY
  });

  try {
    // Get facilities first
    console.log('Testing getFacilities...');
    const { table } = await client.getFacilities({
      status_id: ['operating'],
      fueltech_id: ['coal_black', 'coal_brown']
    });
    
    const facilities = table.getRecords();
    console.log(`Found ${facilities.length} facilities`);
    
    // Test with a single facility
    if (facilities.length > 0) {
      const facility = facilities[0];
      console.log('\nTesting facility:', {
        code: facility.facility_code,
        name: facility.facility_name,
        network: facility.facility_network,
        unit: facility.unit_code
      });
      
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
        console.log('Success! Got data:', data);
      } catch (err) {
        console.log('\nCaught error - examining structure...');
        console.log('Error type:', err.constructor.name);
        console.log('Error message:', err.message);
        
        // Check all properties
        console.log('\nError properties:');
        for (const key in err) {
          if (err.hasOwnProperty(key)) {
            console.log(`  ${key}:`, typeof err[key] === 'object' ? JSON.stringify(err[key], null, 2) : err[key]);
          }
        }
        
        // Try accessing response property specifically
        if ('response' in err) {
          console.log('\nError has response property:');
          console.log(JSON.stringify(err.response, null, 2));
        }
      }
    }
  } catch (err) {
    console.error('Top-level error:', err);
  }
}

test();