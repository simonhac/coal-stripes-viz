// Test script to explore OpenElectricity API structure
const apiKey = process.env.OPENELECTRICITY_API_KEY || 'your_api_key_here';
const baseUrl = 'https://api.openelectricity.org.au';

// Test basic API access
async function testApiAccess() {
  console.log('Testing OpenElectricity API access...');
  
  try {
    // Test 1: Basic API health check
    const response = await fetch(`${baseUrl}/health`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Health check status:', response.status);
    console.log('Health check headers:', [...response.headers.entries()]);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Health check data:', data);
    } else {
      console.log('Health check failed:', response.statusText);
    }
    
  } catch (error) {
    console.error('API test error:', error);
  }
  
  // Test 2: Try to get network data
  try {
    const networkResponse = await fetch(`${baseUrl}/network/NEM`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Network data status:', networkResponse.status);
    
    if (networkResponse.ok) {
      const networkData = await networkResponse.json();
      console.log('Network data sample:', JSON.stringify(networkData, null, 2));
    } else {
      console.log('Network data failed:', networkResponse.statusText);
    }
    
  } catch (error) {
    console.error('Network data error:', error);
  }
  
  // Test 3: Try to get facilities
  try {
    const facilitiesResponse = await fetch(`${baseUrl}/facilities`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Facilities status:', facilitiesResponse.status);
    
    if (facilitiesResponse.ok) {
      const facilitiesData = await facilitiesResponse.json();
      console.log('Facilities data sample:', JSON.stringify(facilitiesData, null, 2));
    } else {
      console.log('Facilities failed:', facilitiesResponse.statusText);
    }
    
  } catch (error) {
    console.error('Facilities error:', error);
  }
}

// Run the tests
testApiAccess();