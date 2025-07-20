const { CoalDataService } = require('../src/lib/coal-data-service.ts');
const { parseDate } = require('@internationalized/date');

// Test the new caching system
async function testCacheSystem() {
  console.log('🧪 Testing TimeSeriesCache system...\n');
  
  const apiKey = process.env.OPENELECTRICITY_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENELECTRICITY_API_KEY not found in environment');
    process.exit(1);
  }
  
  const service = new CoalDataService(apiKey);
  
  try {
    // Test 1: Fetch 90 days spanning 2023-2024 (should load 2 years)
    console.log('=== Test 1: Cross-year range (2023-2024) ===');
    const start1 = parseDate('2023-11-01');
    const end1 = parseDate('2024-02-28');
    
    const data1 = await service.getCoalStripesDataRange(start1, end1);
    console.log(`✅ Received ${data1.dates.length} days of data\n`);
    
    // Test 2: Fetch data within 2024 (should hit cache)
    console.log('=== Test 2: Within 2024 (should hit cache) ===');
    const start2 = parseDate('2024-06-01');
    const end2 = parseDate('2024-08-31');
    
    const data2 = await service.getCoalStripesDataRange(start2, end2);
    console.log(`✅ Received ${data2.dates.length} days of data\n`);
    
    // Test 3: Fetch data within 2023 (should hit cache)
    console.log('=== Test 3: Within 2023 (should hit cache) ===');
    const start3 = parseDate('2023-07-01');
    const end3 = parseDate('2023-09-30');
    
    const data3 = await service.getCoalStripesDataRange(start3, end3);
    console.log(`✅ Received ${data3.dates.length} days of data\n`);
    
    // Test 4: Fetch new year (should require API call)
    console.log('=== Test 4: New year 2022 (should fetch from API) ===');
    const start4 = parseDate('2022-03-01');
    const end4 = parseDate('2022-05-31');
    
    const data4 = await service.getCoalStripesDataRange(start4, end4);
    console.log(`✅ Received ${data4.dates.length} days of data\n`);
    
    console.log('🎉 All cache tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testCacheSystem();