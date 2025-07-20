#!/usr/bin/env node

/**
 * Follow-up test for monthly intervals with smaller date ranges
 * Based on the previous test, "1M" seemed to be recognized but had date range limits
 */

import { OpenElectricityClient } from 'openelectricity';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const API_KEY = process.env.OPENELECTRICITY_API_KEY;

if (!API_KEY) {
  console.error('❌ OPENELECTRICITY_API_KEY not found in environment variables');
  process.exit(1);
}

const client = new OpenElectricityClient({ apiKey: API_KEY });

const COAL_FACILITY_CODE = 'ERARING'; // Large NSW coal facility for testing

// Test different date ranges with 1M interval
const TEST_SCENARIOS = [
  {
    name: '1 Year (365 days)',
    dateStart: '2023-01-01',
    dateEnd: '2023-12-31'
  },
  {
    name: '2 Years (730 days - at limit)',
    dateStart: '2022-01-01',
    dateEnd: '2023-12-31'
  },
  {
    name: '2 Years - 1 day (729 days)',
    dateStart: '2022-01-02', 
    dateEnd: '2023-12-31'
  },
  {
    name: '6 Months (180 days)',
    dateStart: '2023-01-01',
    dateEnd: '2023-06-30'
  },
  {
    name: 'Recent 12 months',
    dateStart: '2023-01-01',
    dateEnd: '2023-12-31'
  }
];

/**
 * Test monthly interval with a specific date range
 */
async function testMonthlyInterval(scenario) {
  console.log(`\n🧪 Testing: ${scenario.name}`);
  console.log(`📅 Date range: ${scenario.dateStart} to ${scenario.dateEnd}`);
  console.log('─'.repeat(60));
  
  const daysDiff = Math.ceil((new Date(scenario.dateEnd) - new Date(scenario.dateStart)) / (1000 * 60 * 60 * 24));
  console.log(`📊 Total days: ${daysDiff}`);
  
  try {
    const result = await client.getFacilityData(
      'NEM', 
      [COAL_FACILITY_CODE], 
      ['energy'], 
      {
        interval: '1M',
        dateStart: scenario.dateStart,
        dateEnd: scenario.dateEnd
      }
    );
    
    const rows = result.datatable?.rows || [];
    
    if (rows.length === 0) {
      console.log(`❌ No data returned`);
      return { ...scenario, success: false, error: 'No data returned' };
    }
    
    console.log(`✅ Success! Got ${rows.length} monthly data points`);
    
    // Analyze the monthly data
    console.log('\n📊 Monthly data analysis:');
    rows.forEach((row, index) => {
      const date = new Date(row.interval);
      const monthYear = date.toLocaleDateString('en-AU', { year: 'numeric', month: 'long' });
      console.log(`  ${index + 1}. ${monthYear}: ${row.energy?.toFixed(1)} MWh (Unit: ${row.unit_code})`);
    });
    
    // Calculate monthly statistics
    const energies = rows.map(row => row.energy || 0);
    const totalEnergy = energies.reduce((sum, energy) => sum + energy, 0);
    const avgMonthlyEnergy = totalEnergy / energies.length;
    const minMonthlyEnergy = Math.min(...energies);
    const maxMonthlyEnergy = Math.max(...energies);
    
    console.log(`\n📈 Statistics:`);
    console.log(`  Total energy: ${(totalEnergy / 1000).toFixed(1)} GWh`);
    console.log(`  Average monthly: ${(avgMonthlyEnergy / 1000).toFixed(1)} GWh`);
    console.log(`  Min monthly: ${(minMonthlyEnergy / 1000).toFixed(1)} GWh`);
    console.log(`  Max monthly: ${(maxMonthlyEnergy / 1000).toFixed(1)} GWh`);
    
    // Check if data looks reasonable for monthly aggregation
    const expectedMonths = Math.ceil(daysDiff / 30);
    console.log(`\n🔍 Data validation:`);
    console.log(`  Expected ~${expectedMonths} months, got ${rows.length} data points`);
    
    if (Math.abs(rows.length - expectedMonths) <= 2) {
      console.log(`✅ Data point count looks correct for monthly aggregation`);
    } else {
      console.log(`⚠️  Unexpected number of data points`);
    }
    
    return { 
      ...scenario, 
      success: true, 
      dataPoints: rows.length,
      totalEnergy: totalEnergy,
      avgMonthlyEnergy: avgMonthlyEnergy,
      sampleData: rows.slice(0, 3)
    };
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { ...scenario, success: false, error: error.message };
  }
}

/**
 * Compare 1M vs 1d for performance and data quality
 */
async function compareMonthlyVsDaily() {
  console.log(`\n🔄 Performance Comparison: Monthly (1M) vs Daily (1d)`);
  console.log('═'.repeat(70));
  
  const testRange = {
    start: '2023-01-01',
    end: '2023-12-31'
  };
  
  console.log(`📅 Test period: ${testRange.start} to ${testRange.end}`);
  
  try {
    // Test monthly data
    console.log('\n⏱️  Fetching monthly data...');
    const monthlyStart = Date.now();
    const monthlyData = await client.getFacilityData(
      'NEM', 
      [COAL_FACILITY_CODE], 
      ['energy'], 
      {
        interval: '1M',
        dateStart: testRange.start,
        dateEnd: testRange.end
      }
    );
    const monthlyTime = Date.now() - monthlyStart;
    const monthlyRows = monthlyData.datatable?.rows || [];
    
    // Test daily data
    console.log('⏱️  Fetching daily data...');
    const dailyStart = Date.now();
    const dailyData = await client.getFacilityData(
      'NEM', 
      [COAL_FACILITY_CODE], 
      ['energy'], 
      {
        interval: '1d',
        dateStart: testRange.start,
        dateEnd: testRange.end
      }
    );
    const dailyTime = Date.now() - dailyStart;
    const dailyRows = dailyData.datatable?.rows || [];
    
    // Calculate results
    const monthlyTotal = monthlyRows.reduce((sum, row) => sum + (row.energy || 0), 0);
    const dailyTotal = dailyRows.reduce((sum, row) => sum + (row.energy || 0), 0);
    
    console.log(`\n📊 Performance Results:`);
    console.log(`  Monthly API call: ${monthlyTime}ms (${monthlyRows.length} data points)`);
    console.log(`  Daily API call: ${dailyTime}ms (${dailyRows.length} data points)`);
    console.log(`  Speed improvement: ${((dailyTime - monthlyTime) / dailyTime * 100).toFixed(1)}%`);
    console.log(`  Data reduction: ${((dailyRows.length - monthlyRows.length) / dailyRows.length * 100).toFixed(1)}%`);
    
    console.log(`\n⚡ Energy Comparison:`);
    console.log(`  Monthly total: ${(monthlyTotal / 1000).toFixed(1)} GWh`);
    console.log(`  Daily total: ${(dailyTotal / 1000).toFixed(1)} GWh`);
    console.log(`  Difference: ${Math.abs(monthlyTotal - dailyTotal).toFixed(1)} MWh (${(Math.abs(monthlyTotal - dailyTotal) / dailyTotal * 100).toFixed(2)}%)`);
    
    if (Math.abs(monthlyTotal - dailyTotal) / dailyTotal < 0.01) {
      console.log(`✅ Energy totals match very closely - monthly aggregation is accurate!`);
    } else if (Math.abs(monthlyTotal - dailyTotal) / dailyTotal < 0.05) {
      console.log(`✅ Energy totals match reasonably well`);
    } else {
      console.log(`⚠️  Significant difference in energy totals`);
    }
    
  } catch (error) {
    console.log(`❌ Error in comparison: ${error.message}`);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 OpenElectricity API Monthly Interval Follow-up Testing');
  console.log('═'.repeat(70));
  console.log(`📋 Testing facility: ${COAL_FACILITY_CODE}`);
  console.log(`🎯 Focus: Testing "1M" interval with various date ranges\n`);
  
  const results = [];
  
  // Test each scenario
  for (const scenario of TEST_SCENARIOS) {
    const result = await testMonthlyInterval(scenario);
    results.push(result);
    
    // Add delay to be respectful to API
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  // Summary
  console.log('\n📊 SUMMARY OF RESULTS');
  console.log('═'.repeat(70));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful scenarios: ${successful.length}/${results.length}`);
  console.log(`❌ Failed scenarios: ${failed.length}/${results.length}\n`);
  
  if (successful.length > 0) {
    console.log('🎯 WORKING MONTHLY SCENARIOS:');
    successful.forEach(result => {
      console.log(`  "${result.name}" → ${result.dataPoints} months, ${(result.totalEnergy / 1000).toFixed(1)} GWh total`);
    });
    
    // Run performance comparison if we have a working scenario
    await new Promise(resolve => setTimeout(resolve, 2000));
    await compareMonthlyVsDaily();
  }
  
  if (failed.length > 0) {
    console.log('\n❌ FAILED SCENARIOS:');
    failed.forEach(result => {
      console.log(`  "${result.name}" → ${result.error}`);
    });
  }
  
  // Final assessment
  console.log('\n🎯 FINAL ASSESSMENT:');
  console.log('═'.repeat(70));
  
  if (successful.length > 0) {
    const workingScenario = successful[0];
    console.log(`✅ Monthly intervals ARE supported with "1M" parameter!`);
    console.log(`📋 Limitations:`);
    console.log(`   - Maximum date range: 730 days (~2 years)`);
    console.log(`   - Returns aggregated monthly data points`);
    console.log(`   - Perfect for generating quick previews of multi-year trends`);
    console.log(`\n💡 Use cases for monthly data:`);
    console.log(`   - Initial page load with quick overview`);
    console.log(`   - Long-term trend analysis`);
    console.log(`   - Reduced API response times`);
    console.log(`   - Lower bandwidth usage`);
    console.log(`\n🚀 Implementation strategy:`);
    console.log(`   - Use monthly data for periods > 3 months`);
    console.log(`   - Use daily data for detailed analysis of shorter periods`);
    console.log(`   - Consider monthly data for 'preview mode'`);
    
  } else {
    console.log(`❌ Monthly intervals are NOT supported or have severe limitations`);
    console.log(`📋 Stick with daily intervals ('1d') for reliable data access`);
  }
}

// Run the tests
runTests().catch(console.error);