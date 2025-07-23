// Test with raw fetch to see the exact error
require('dotenv').config({ path: '.env.local' });

async function test() {
  const apiKey = process.env.OPENELECTRICITY_API_KEY;
  
  // First let's test what the facilities endpoint returns
  console.log('Testing facilities endpoint...');
  const facilitiesUrl = 'https://api.openelectricity.org.au/facilities/?status_id=operating&fueltech_id=coal_black';
  
  try {
    const response = await fetch(facilitiesUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Facilities response structure:', Object.keys(data));
      if (data.data && data.data.length > 0) {
        console.log('First facility:', data.data[0]);
      }
    }
  } catch (err) {
    console.error('Facilities error:', err);
  }
  
  // Now test the facility data endpoint
  console.log('\nTesting facility data endpoint...');
  const dataUrl = 'https://api.openelectricity.org.au/data/facilities/nem?metrics=energy&interval=day&date_start=2023-01-01&date_end=2023-01-07&facility_code=BAYSW';
  
  console.log('URL:', dataUrl);
  
  try {
    const response = await fetch(dataUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response statusText:', response.statusText);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Data error:', err);
  }
}

test();