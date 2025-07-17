// Test script specifically for historical generation data
require('dotenv').config({ path: '.env.local' });
const { OpenElectricityClient } = require('openelectricity');

const apiKey = process.env.OPENELECTRICITY_API_KEY;

async function testHistoricalData() {
  console.log('Testing historical generation data access...');
  
  try {
    const client = new OpenElectricityClient({ apiKey });
    
    // Test with a shorter period first
    console.log('\n--- Testing 7 days of data ---');
    const shortData = await client.getNetworkData(
      'NEM',
      ['energy'],
      {
        fueltech: ['coal_black', 'coal_brown'],
        interval: '1d',
        dateStart: '2024-07-10',
        dateEnd: '2024-07-17'
      }
    );
    
    console.log('Short data response structure:', {
      version: shortData.response?.version,
      success: shortData.response?.success,
      dataLength: shortData.response?.data?.length,
      datatableRows: shortData.datatable?.rows?.length,
      sampleDataTableRow: shortData.datatable?.rows?.[0]
    });
    
    if (shortData.response?.success) {
      console.log('\n--- Testing 365 days of data ---');
      const longData = await client.getNetworkData(
        'NEM',
        ['energy'],
        {
          fueltech: ['coal_black', 'coal_brown'],
          interval: '1d',
          dateStart: '2024-01-01',
          dateEnd: '2024-12-31'
        }
      );
      
      console.log('Long data response structure:', {
        version: longData.response?.version,
        success: longData.response?.success,
        dataLength: longData.response?.data?.length,
        datatableRows: longData.datatable?.rows?.length,
        firstRow: longData.datatable?.rows?.[0],
        lastRow: longData.datatable?.rows?.[longData.datatable?.rows?.length - 1]
      });
      
      // Check if we have daily data for the full year
      if (longData.datatable?.rows && longData.datatable.rows.length > 0) {
        console.log('\n--- Data Analysis ---');
        console.log('Total records:', longData.datatable.rows.length);
        console.log('Expected records (365 days):', 365);
        console.log('Data coverage:', `${(longData.datatable.rows.length / 365 * 100).toFixed(1)}%`);
        
        // Sample some records
        const sampleRecords = longData.datatable.rows.slice(0, 5);
        console.log('Sample records:', JSON.stringify(sampleRecords, null, 2));
        
        // Check unique fuel types
        const fuelTypes = [...new Set(longData.datatable.rows.map(r => r.fueltech))];
        console.log('Fuel types in data:', fuelTypes);
      }
    }
    
  } catch (error) {
    console.error('Historical data test error:', error.message);
  }
}

testHistoricalData();