#!/usr/bin/env node

/**
 * Test script to reproduce WEM data "groupings" bug in OpenElectricity client
 */

const { OpenElectricityClient } = require('openelectricity');
const packageJson = require('openelectricity/package.json');

async function testWEMBug() {
  const version = packageJson.version || 'unknown';
  console.log(`🧪 Testing WEM data bug in OpenElectricity client v${version}\n`);
  
  const apiKey = process.env.OPENELECTRICITY_API_KEY;
  if (!apiKey) {
    console.error('❌ Please set OPENELECTRICITY_API_KEY environment variable');
    process.exit(1);
  }
  
  const client = new OpenElectricityClient(apiKey);
  
  // Test parameters
  const testCases = [
    {
      name: 'NEM data (should work)',
      network: 'NEM',
      facilities: ['BAYSW'],
      dateStart: '2024-01-01',
      dateEnd: '2024-01-08'
    },
    {
      name: 'WEM data (may fail with groupings error)',
      network: 'WEM',
      facilities: ['COLLIE'],
      dateStart: '2024-01-01', 
      dateEnd: '2024-01-08'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📊 Test: ${testCase.name}`);
    console.log(`   Network: ${testCase.network}`);
    console.log(`   Facilities: ${testCase.facilities.join(', ')}`);
    console.log(`   Date range: ${testCase.dateStart} to ${testCase.dateEnd}`);
    
    try {
      const startTime = Date.now();
      
      const result = await client.getFacilityData(
        testCase.network,
        testCase.facilities,
        ['energy'],
        {
          interval: '1d',
          dateStart: testCase.dateStart,
          dateEnd: testCase.dateEnd
        }
      );
      
      const elapsed = Date.now() - startTime;
      
      if (result.datatable) {
        console.log(`   ✅ Success! Got ${result.datatable.rows.length} rows in ${elapsed}ms`);
        
        // Show sample data
        if (result.datatable.rows.length > 0) {
          const sample = result.datatable.rows[0];
          console.log(`   Sample row:`, JSON.stringify(sample, null, 2).split('\n').map(l => '      ' + l).join('\n').trim());
        }
      } else if (result.data) {
        console.log(`   ✅ Success! Got alternative format response in ${elapsed}ms`);
        console.log(`   Data sections: ${result.data.length}`);
      } else {
        console.log(`   ⚠️  Unexpected response format in ${elapsed}ms`);
        console.log(`   Response keys: ${Object.keys(result).join(', ')}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      
      // Check if it's the groupings error
      if (error.message.includes('groupings')) {
        console.error(`   🐛 This is the "groupings" bug!`);
        console.error(`   Stack trace:`);
        console.error(error.stack.split('\n').map(l => '      ' + l).join('\n'));
      }
    }
  }
  
  console.log('\n✨ Test complete\n');
}

// Run if called directly
if (require.main === module) {
  testWEMBug().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { testWEMBug };