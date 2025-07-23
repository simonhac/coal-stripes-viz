// Test datatable structure
require('dotenv').config({ path: '.env.local' });
const { OpenElectricityClient } = require('openelectricity');

async function test() {
  const client = new OpenElectricityClient({
    apiKey: process.env.OPENELECTRICITY_API_KEY
  });

  try {
    const response = await client.getFacilityData(
      'NEM',
      'BAYSW',
      ['energy'],
      {
        interval: '1d',
        dateStart: '2023-01-01',
        dateEnd: '2023-01-03'
      }
    );
    
    console.log('Response keys:', Object.keys(response));
    console.log('Datatable keys:', Object.keys(response.datatable));
    console.log('Datatable rows type:', typeof response.datatable.rows);
    console.log('Datatable rows length:', response.datatable.rows.length);
    
    if (response.datatable.rows.length > 0) {
      console.log('\nFirst row:', response.datatable.rows[0]);
      console.log('\nAll rows:');
      response.datatable.rows.forEach((row, i) => {
        console.log(`Row ${i}:`, row);
      });
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();