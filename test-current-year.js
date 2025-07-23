// Test what the API returns for current year
require('dotenv').config({ path: '.env.local' });
const { OpenElectricityClient } = require('openelectricity');

async function test() {
  const client = new OpenElectricityClient({
    apiKey: process.env.OPENELECTRICITY_API_KEY
  });

  try {
    console.log('Testing current year 2025...');
    
    // Test with adding 1 day to end date (as the service does)
    const response = await client.getFacilityData(
      'NEM',
      'BAYSW',
      ['energy'],
      {
        interval: '1d',
        dateStart: '2025-01-01',
        dateEnd: '2026-01-01'  // Adding 1 day as the service does
      }
    );
    
    console.log('Response datatable rows:', response.datatable.rows.length);
    
    // Group by date to see how many unique dates we have
    const dateMap = new Map();
    response.datatable.rows.forEach(row => {
      const dateStr = row.interval instanceof Date 
        ? row.interval.toISOString().split('T')[0]
        : row.interval.split('T')[0];
      
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, []);
      }
      dateMap.get(dateStr).push(row);
    });
    
    const dates = Array.from(dateMap.keys()).sort();
    console.log('Unique dates:', dates.length);
    console.log('First date:', dates[0]);
    console.log('Last date:', dates[dates.length - 1]);
    
    // Check if we get future dates with null values
    const today = new Date().toISOString().split('T')[0];
    console.log('Today:', today);
    
    const futureDates = dates.filter(d => d > today);
    console.log('Future dates returned:', futureDates.length);
    
    if (futureDates.length > 0) {
      console.log('First future date:', futureDates[0]);
      const futureData = dateMap.get(futureDates[0]);
      console.log('Future date data:', futureData);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();