// Test getFacilityData() method for individual unit data
require('dotenv').config({ path: '.env.local' });
const { OpenElectricityClient } = require('openelectricity');

const apiKey = process.env.OPENELECTRICITY_API_KEY;

async function testFacilityData() {
  console.log('Testing getFacilityData() method...');
  
  try {
    const client = new OpenElectricityClient({ apiKey });
    
    // First, let's identify some major coal facilities from our previous test
    const facilities = await client.getFacilities({ network: 'NEM' });
    const coalFacilities = facilities.response.data.filter(f => 
      f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
    );
    
    console.log('Found coal facilities:', coalFacilities.length);
    console.log('Sample coal facilities:', coalFacilities.slice(0, 3).map(f => ({
      code: f.code,
      name: f.name,
      region: f.network_region,
      units: f.units.filter(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown').map(u => ({
        code: u.code,
        fueltech: u.fueltech_id,
        capacity: u.capacity_registered
      }))
    })));
    
    // Test facility-specific data for a major coal facility
    const bayswater = coalFacilities.find(f => f.code === 'BAYSW');
    if (bayswater) {
      console.log('\n--- Testing Bayswater facility data ---');
      console.log('Bayswater units:', bayswater.units.filter(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown'));
      
      try {
        const facilityData = await client.getFacilityData(
          'NEM',
          'BAYSW',
          ['energy'],
          {
            interval: '1d',
            dateStart: '2024-07-10',
            dateEnd: '2024-07-17'
          }
        );
        
        console.log('Bayswater facility data response:', {
          version: facilityData.response?.version,
          success: facilityData.response?.success,
          dataLength: facilityData.response?.data?.length,
          datatableRows: facilityData.datatable?.rows?.length,
          sampleRows: facilityData.datatable?.rows?.slice(0, 5)
        });
        
        // Check if we get individual unit data
        if (facilityData.datatable?.rows?.length > 0) {
          const sampleRow = facilityData.datatable.rows[0];
          console.log('Sample row structure:', Object.keys(sampleRow));
          console.log('Sample row data:', sampleRow);
          
          // Check if we have unit-level breakdown
          const uniqueUnits = [...new Set(facilityData.datatable.rows.map(r => r.unit_code || 'no_unit'))];
          console.log('Unique units in response:', uniqueUnits);
        }
        
      } catch (facilityError) {
        console.log('Bayswater facility data error:', facilityError.message);
      }
    }
    
    // Test with multiple facility codes to see if we can get batch data
    console.log('\n--- Testing multiple facilities ---');
    const topCoalFacilities = coalFacilities.slice(0, 3).map(f => f.code);
    console.log('Testing facilities:', topCoalFacilities);
    
    try {
      const multipleFacilityData = await client.getFacilityData(
        'NEM',
        topCoalFacilities,
        ['energy'],
        {
          interval: '1d',
          dateStart: '2024-07-15',
          dateEnd: '2024-07-17'
        }
      );
      
      console.log('Multiple facility data response:', {
        success: multipleFacilityData.response?.success,
        datatableRows: multipleFacilityData.datatable?.rows?.length,
        sampleRows: multipleFacilityData.datatable?.rows?.slice(0, 5)
      });
      
      // Check what facility codes we get back
      if (multipleFacilityData.datatable?.rows?.length > 0) {
        const facilities = [...new Set(multipleFacilityData.datatable.rows.map(r => r.facility_code))];
        console.log('Facilities in response:', facilities);
      }
      
    } catch (multiError) {
      console.log('Multiple facility data error:', multiError.message);
    }
    
  } catch (error) {
    console.error('Facility data test error:', error.message);
  }
}

testFacilityData();