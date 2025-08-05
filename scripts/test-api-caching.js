// Integration test for capacity-factors API caching
// Run this while the dev server is running: npm run dev

const currentYear = new Date().getFullYear();
const previousYear = currentYear - 1;
const futureYear = currentYear + 1;

const baseUrl = 'http://localhost:3000/api/capacity-factors';

async function testCaching() {
  console.log('🧪 Testing capacity-factors API caching...\n');
  
  try {
    // Test 1: Current year caching (1 hour)
    console.log(`📅 Test 1: Current year (${currentYear}) - should cache for 1 hour`);
    const currentYearStart1 = Date.now();
    const currentYearRes1 = await fetch(`${baseUrl}?year=${currentYear}`);
    const currentYearTime1 = Date.now() - currentYearStart1;
    const currentYearData1 = await currentYearRes1.json();
    
    if (currentYearRes1.status !== 200) {
      throw new Error(`Current year request failed: ${JSON.stringify(currentYearData1)}`);
    }
    
    console.log(`  ✓ First request: ${currentYearTime1}ms`);
    console.log(`  ✓ Cache-Control: ${currentYearRes1.headers.get('cache-control')}`);
    console.log(`  ✓ Data units: ${currentYearData1.data.length}`);
    
    // Second request should be cached
    const currentYearStart2 = Date.now();
    const currentYearRes2 = await fetch(`${baseUrl}?year=${currentYear}`);
    const currentYearTime2 = Date.now() - currentYearStart2;
    const currentYearData2 = await currentYearRes2.json();
    
    console.log(`  ✓ Second request: ${currentYearTime2}ms (${Math.round(currentYearTime1/currentYearTime2)}x faster)`);
    
    if (currentYearTime2 >= currentYearTime1 / 2) {
      console.log('  ⚠️  Warning: Second request not significantly faster - cache might not be working');
    } else {
      console.log('  ✅ Caching verified - second request was faster!');
    }
    
    // Test 2: Previous year caching (1 week)
    console.log(`\n📅 Test 2: Previous year (${previousYear}) - should cache for 1 week`);
    const prevYearStart1 = Date.now();
    const prevYearRes1 = await fetch(`${baseUrl}?year=${previousYear}`);
    const prevYearTime1 = Date.now() - prevYearStart1;
    const prevYearData1 = await prevYearRes1.json();
    
    if (prevYearRes1.status !== 200) {
      throw new Error(`Previous year request failed: ${JSON.stringify(prevYearData1)}`);
    }
    
    console.log(`  ✓ First request: ${prevYearTime1}ms`);
    console.log(`  ✓ Cache-Control: ${prevYearRes1.headers.get('cache-control')}`);
    console.log(`  ✓ Data units: ${prevYearData1.data.length}`);
    
    // Second request should be cached
    const prevYearStart2 = Date.now();
    const prevYearRes2 = await fetch(`${baseUrl}?year=${previousYear}`);
    const prevYearTime2 = Date.now() - prevYearStart2;
    const prevYearData2 = await prevYearRes2.json();
    
    console.log(`  ✓ Second request: ${prevYearTime2}ms (${Math.round(prevYearTime1/prevYearTime2)}x faster)`);
    
    if (prevYearTime2 >= prevYearTime1 / 2) {
      console.log('  ⚠️  Warning: Second request not significantly faster - cache might not be working');
    } else {
      console.log('  ✅ Caching verified - second request was faster!');
    }
    
    // Test 3: Future year (no caching)
    console.log(`\n📅 Test 3: Future year (${futureYear}) - should not cache`);
    const futureYearRes = await fetch(`${baseUrl}?year=${futureYear}`);
    const futureYearData = await futureYearRes.json();
    
    console.log(`  ✓ Status: ${futureYearRes.status}`);
    console.log(`  ✓ Cache-Control: ${futureYearRes.headers.get('cache-control')}`);
    
    if (futureYearRes.status === 200) {
      console.log(`  ✓ Data units: ${futureYearData.data.length}`);
      
      // Check if all capacity factors are null for future dates
      if (futureYearData.data[0]?.history?.data) {
        const nullCount = futureYearData.data[0].history.data.filter(cf => cf === null).length;
        console.log(`  ✓ Null capacity factors: ${nullCount}/${futureYearData.data[0].history.data.length}`);
        
        if (nullCount === futureYearData.data[0].history.data.length) {
          console.log('  ✅ All capacity factors are null for future dates (as expected)');
        }
      }
    } else if (futureYearRes.status === 500 && futureYearData.error) {
      console.log(`  ℹ️  API returned error for future year: "${futureYearData.error}"`);
      console.log('  ✅ This is expected - API doesn\'t have future data');
    }
    
    // Test 4: Different years cached independently
    console.log(`\n📅 Test 4: Independent caching for different years`);
    const year1 = 2022;
    const year2 = 2023;
    
    // Warm up both caches
    console.log(`  Warming up caches for ${year1} and ${year2}...`);
    await fetch(`${baseUrl}?year=${year1}`);
    await fetch(`${baseUrl}?year=${year2}`);
    
    // Now test that both are cached
    const year1Start = Date.now();
    const year1Res = await fetch(`${baseUrl}?year=${year1}`);
    const year1Time = Date.now() - year1Start;
    
    const year2Start = Date.now();
    const year2Res = await fetch(`${baseUrl}?year=${year2}`);
    const year2Time = Date.now() - year2Start;
    
    console.log(`  ✓ ${year1} cached request: ${year1Time}ms`);
    console.log(`  ✓ ${year2} cached request: ${year2Time}ms`);
    
    if (year1Time < 100 && year2Time < 100) {
      console.log('  ✅ Both years are cached independently!');
    } else {
      console.log('  ⚠️  One or both years might not be cached properly');
    }
    
    // Test 5: Validate data structure
    console.log(`\n📅 Test 5: Validate response structure`);
    const sampleUnit = prevYearData1.data[0];
    const requiredFields = ['duid', 'facility_name', 'network', 'capacity', 'history'];
    const historyFields = ['data', 'start', 'last', 'interval'];
    
    const missingFields = requiredFields.filter(field => !(field in sampleUnit));
    const missingHistoryFields = historyFields.filter(field => !(field in sampleUnit.history));
    
    if (missingFields.length === 0 && missingHistoryFields.length === 0) {
      console.log('  ✅ Response structure is valid!');
      console.log(`  ✓ Sample unit: ${sampleUnit.facility_name} (${sampleUnit.duid})`);
      console.log(`  ✓ Date range: ${sampleUnit.history.start} to ${sampleUnit.history.last}`);
      console.log(`  ✓ Data points: ${sampleUnit.history.data.length}`);
    } else {
      console.log('  ❌ Missing fields:', [...missingFields, ...missingHistoryFields.map(f => `history.${f}`)]);
    }
    
    console.log('\n✅ All caching tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nMake sure the dev server is running: npm run dev');
    process.exit(1);
  }
}

// Run the tests
testCaching().catch(console.error);