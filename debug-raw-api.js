// Script to fetch raw data from OpenElectricity API and save to file
const { OpenElectricityClient } = require('openelectricity');
const fs = require('fs');

async function fetchRawData() {
  const apiKey = process.env.OPENELECTRICITY_API_KEY;
  if (!apiKey) {
    console.error('OPENELECTRICITY_API_KEY not set');
    process.exit(1);
  }

  const client = new OpenElectricityClient({ apiKey });
  
  console.log('Fetching Bayswater data for July 21-25, 2025...');
  
  try {
    const response = await client.getFacilityData(
      'NEM',
      ['BAYSW'],
      ['energy'],
      {
        interval: '1d',
        dateStart: '2025-07-21',
        dateEnd: '2025-07-26' // API treats end as exclusive
      }
    );
    
    // Save the raw response
    const output = {
      fetchedAt: new Date().toISOString(),
      fetchedAtBrisbane: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' }),
      request: {
        network: 'NEM',
        facility: 'BAYSW',
        metrics: ['energy'],
        dateStart: '2025-07-21',
        dateEnd: '2025-07-26'
      },
      response: {
        status: response.response?.status,
        headers: response.response?.headers,
        datatable: response.datatable
      }
    };
    
    // Write to file with nice formatting
    fs.writeFileSync('oe-raw-response.json', JSON.stringify(output, null, 2));
    console.log('Raw response saved to oe-raw-response.json');
    
    // Also create a simplified view
    if (response.datatable?.rows) {
      const simplified = response.datatable.rows.map(row => ({
        unit: row.unit_code || row.code || row.duid,
        date: row.interval || row.date || row.period,
        energy_MWh: row.energy,
        capacity_MW: row.unit_capacity || row.capacity || 'unknown'
      }));
      
      fs.writeFileSync('oe-simplified.json', JSON.stringify(simplified, null, 2));
      console.log('Simplified data saved to oe-simplified.json');
    }
    
  } catch (error) {
    console.error('Error fetching data:', error);
    fs.writeFileSync('oe-error.json', JSON.stringify({
      error: error.message,
      stack: error.stack,
      fetchedAt: new Date().toISOString()
    }, null, 2));
  }
}

fetchRawData();