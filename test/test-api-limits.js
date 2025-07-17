// Test API limits to find optimal batch size
require('dotenv').config({ path: '.env.local' });
const { OpenElectricityClient } = require('openelectricity');

const apiKey = process.env.OPENELECTRICITY_API_KEY;

async function testApiLimits() {
  console.log('Testing API limits to find optimal batch size...');
  
  try {
    const client = new OpenElectricityClient({ apiKey });
    
    // Get coal facilities
    const facilities = await client.getFacilities({ network: 'NEM' });
    const coalFacilities = facilities.response.data.filter(f => 
      f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
    );
    
    const coalFacilityCodes = coalFacilities.map(f => f.code);
    console.log(`Total coal facilities: ${coalFacilityCodes.length}`);
    
    // Test different batch sizes to find the limit
    const testSizes = [5, 10, 15, 20, 25, 30, 32];
    
    for (const batchSize of testSizes) {
      console.log(`\n=== Testing batch size: ${batchSize} ===`);
      
      const testFacilities = coalFacilityCodes.slice(0, batchSize);
      console.log(`Testing with: ${testFacilities.join(', ')}`);
      
      try {
        const startTime = Date.now();
        const result = await client.getFacilityData(
          'NEM',
          testFacilities,
          ['energy'],
          {
            interval: '1d',
            dateStart: '2024-07-15',
            dateEnd: '2024-07-17'
          }
        );
        const duration = Date.now() - startTime;
        
        console.log(`✅ SUCCESS - Batch size ${batchSize}:`);
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Rows: ${result.datatable?.rows?.length || 0}`);
        console.log(`   Units: ${[...new Set(result.datatable?.rows?.map(r => r.unit_code) || [])].length}`);
        
      } catch (error) {
        console.log(`❌ FAILED - Batch size ${batchSize}:`);
        console.log(`   Error: ${error.message}`);
        
        // If this batch size failed, we found the limit
        if (batchSize > 5) {
          const maxBatchSize = testSizes[testSizes.indexOf(batchSize) - 1];
          console.log(`\n🎯 MAXIMUM BATCH SIZE FOUND: ${maxBatchSize}`);
          
          // Calculate optimal strategy
          const totalBatches = Math.ceil(coalFacilityCodes.length / maxBatchSize);
          console.log(`\n=== OPTIMAL STRATEGY ===`);
          console.log(`Max batch size: ${maxBatchSize} facilities`);
          console.log(`Total batches needed: ${totalBatches}`);
          console.log(`Total API calls: ${totalBatches + 1} (including facilities list)`);
          
          // Show batch breakdown
          console.log(`\nBatch breakdown:`);
          for (let i = 0; i < totalBatches; i++) {
            const start = i * maxBatchSize;
            const end = Math.min(start + maxBatchSize, coalFacilityCodes.length);
            const batch = coalFacilityCodes.slice(start, end);
            console.log(`  Batch ${i + 1}: ${batch.length} facilities - [${batch.join(', ')}]`);
          }
          
          return { maxBatchSize, totalBatches, totalApiCalls: totalBatches + 1 };
        }
        
        break;
      }
    }
    
  } catch (error) {
    console.error('API limits test error:', error.message);
  }
}

testApiLimits();