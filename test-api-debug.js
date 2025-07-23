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
      
      console.log('\nTrying getFacilityData with different parameters...');
      
      try {
        // Try with full error capture
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
        console.log('\nFull error object:');
        console.log('Message:', err.message);
        console.log('Name:', err.name);
        console.log('Stack:', err.stack);
        if (err.response) {
          console.log('Response:', JSON.stringify(err.response, null, 2));
        }
        // Log the raw response if available
        if (err.response && err.response.data && err.response.data.detail) {
          console.log('Error details:', JSON.stringify(err.response.data.detail, null, 2));
        }
        if (err.cause) {
          console.log('Cause:', err.cause);
        }
        
        // Try without dates
        console.log('\nTrying without date parameters...');
        try {
          const data2 = await client.getFacilityData(
            facility.facility_network.toLowerCase(),
            facility.facility_code,
            ['energy'],
            {
              interval: 'day'
            }
          );
          console.log('Success without dates! Got data:', data2);
        } catch (err2) {
          console.log('Still failed:', err2.message);
          
          // Try with array of facility codes
          console.log('\nTrying with facility codes as array...');
          try {
            const data3 = await client.getFacilityData(
              facility.facility_network.toLowerCase(),
              [facility.facility_code],
              ['energy'],
              {
                interval: 'day',
                dateStart: '2023-01-01',
                dateEnd: '2023-01-07'
              }
            );
            console.log('Success with array! Got data:', data3);
          } catch (err3) {
            console.log('Failed with array:', err3.message);
            if (err3.response) {
              console.log('Error response:', JSON.stringify(err3.response, null, 2));
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Top-level error:', err);
  }
}

test();