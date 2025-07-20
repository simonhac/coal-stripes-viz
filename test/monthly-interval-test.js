#!/usr/bin/env node

/**
 * Test script to check if OpenElectricity API supports monthly data intervals
 * 
 * This script tests various monthly interval parameters to see what the API supports
 */

import { OpenElectricityClient } from 'openelectricity';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const API_KEY = process.env.OPENELECTRICITY_API_KEY;

if (!API_KEY) {
  console.error('❌ OPENELECTRICITY_API_KEY not found in environment variables');
  console.error('Please add it to your .env file');
  process.exit(1);
}

const client = new OpenElectricityClient({ apiKey: API_KEY });

// Test parameters
const TEST_DATE_START = '2020-01-01';
const TEST_DATE_END = '2023-12-31';
const COAL_FACILITY_CODE = 'ERARING'; // Large NSW coal facility for testing

// Different monthly interval variations to test
const MONTHLY_INTERVALS = [
  '1M',        // Standard monthly notation
  'monthly',   // Plain English
  '1m',        // Lowercase monthly
  'M',         // Just M
  'm',         // Just m
  '1mo',       // Month abbreviation
  'month',     // Full word
  '30d',       // 30 days (approximate month)
  '1month',    // Combined
];

/**
 * Test a specific interval parameter
 */
async function testInterval(interval) {
  console.log(`\n🧪 Testing interval: "${interval}"`);
  console.log('─'.repeat(50));
  
  try {
    const result = await client.getFacilityData(
      'NEM', 
      [COAL_FACILITY_CODE], 
      ['energy'], 
      {
        interval: interval,
        dateStart: TEST_DATE_START,
        dateEnd: TEST_DATE_END
      }
    );
    
    const rows = result.datatable?.rows || [];
    
    if (rows.length === 0) {
      console.log(`❌ No data returned for interval "${interval}"`);
      return { interval, success: false, error: 'No data returned' };
    }
    
    console.log(`✅ Success! Got ${rows.length} data points`);
    
    // Analyze the first few data points
    console.log('\n📊 Sample data points:');
    rows.slice(0, 5).forEach((row, index) => {
      console.log(`  ${index + 1}. Date: ${row.interval}, Energy: ${row.energy} MWh, Unit: ${row.unit_code}`);
    });
    
    // Analyze time intervals between data points
    if (rows.length >= 2) {
      const firstDate = new Date(rows[0].interval);
      const secondDate = new Date(rows[1].interval);
      const daysDiff = Math.round((secondDate - firstDate) / (1000 * 60 * 60 * 24));
      
      console.log(`\n⏰ Time gap between first two data points: ${daysDiff} days`);
      
      // Check if this looks like monthly data
      if (daysDiff >= 28 && daysDiff <= 31) {
        console.log(`🎯 This appears to be monthly data! (${daysDiff} day intervals)`);
      } else if (daysDiff === 1) {
        console.log(`📅 This appears to be daily data (${daysDiff} day intervals)`);
      } else {
        console.log(`❓ Unusual interval: ${daysDiff} days between data points`);
      }
    }
    
    // Check date range coverage
    const firstDate = new Date(rows[0].interval);
    const lastDate = new Date(rows[rows.length - 1].interval);
    console.log(`📅 Date range: ${firstDate.toISOString().split('T')[0]} to ${lastDate.toISOString().split('T')[0]}`);
    
    return { 
      interval, 
      success: true, 
      dataPoints: rows.length, 
      firstDate: firstDate.toISOString().split('T')[0],
      lastDate: lastDate.toISOString().split('T')[0],
      averageEnergy: rows.reduce((sum, row) => sum + (row.energy || 0), 0) / rows.length,
      sampleData: rows.slice(0, 3)
    };
    
  } catch (error) {
    console.log(`❌ Error with interval "${interval}":`, error.message);
    return { interval, success: false, error: error.message };
  }
}

/**
 * Compare daily vs potential monthly data
 */
async function compareDailyVsMonthly(monthlyInterval) {
  console.log(`\n🔄 Comparing daily ('1d') vs monthly ('${monthlyInterval}') data...`);
  console.log('═'.repeat(70));
  
  const shortDateRange = {
    start: '2022-01-01',
    end: '2022-12-31'
  };
  
  try {
    // Get daily data
    console.log('\n📅 Fetching daily data...');
    const dailyData = await client.getFacilityData(
      'NEM', 
      [COAL_FACILITY_CODE], 
      ['energy'], 
      {
        interval: '1d',
        dateStart: shortDateRange.start,
        dateEnd: shortDateRange.end
      }
    );
    
    // Get monthly data
    console.log(`📊 Fetching monthly data (${monthlyInterval})...`);
    const monthlyData = await client.getFacilityData(
      'NEM', 
      [COAL_FACILITY_CODE], 
      ['energy'], 
      {
        interval: monthlyInterval,
        dateStart: shortDateRange.start,
        dateEnd: shortDateRange.end
      }
    );
    
    const dailyRows = dailyData.datatable?.rows || [];
    const monthlyRows = monthlyData.datatable?.rows || [];
    
    console.log(`\n📈 Results:`);
    console.log(`  Daily data points: ${dailyRows.length}`);
    console.log(`  Monthly data points: ${monthlyRows.length}`);
    
    if (dailyRows.length > 0 && monthlyRows.length > 0) {
      const dailyTotal = dailyRows.reduce((sum, row) => sum + (row.energy || 0), 0);
      const monthlyTotal = monthlyRows.reduce((sum, row) => sum + (row.energy || 0), 0);
      
      console.log(`\n⚡ Energy totals (2022):`);
      console.log(`  Daily sum: ${(dailyTotal / 1000).toFixed(1)} GWh`);
      console.log(`  Monthly sum: ${(monthlyTotal / 1000).toFixed(1)} GWh`);
      console.log(`  Difference: ${Math.abs(dailyTotal - monthlyTotal).toFixed(1)} MWh (${(Math.abs(dailyTotal - monthlyTotal) / dailyTotal * 100).toFixed(2)}%)`);
      
      if (Math.abs(dailyTotal - monthlyTotal) / dailyTotal < 0.05) {
        console.log(`✅ Totals match closely - monthly aggregation appears correct!`);
      } else {
        console.log(`⚠️  Significant difference in totals - may indicate data processing differences`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Error in comparison:`, error.message);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 OpenElectricity API Monthly Interval Testing');
  console.log('═'.repeat(70));
  console.log(`📋 Testing facility: ${COAL_FACILITY_CODE}`);
  console.log(`📅 Date range: ${TEST_DATE_START} to ${TEST_DATE_END}`);
  console.log(`🔍 Testing ${MONTHLY_INTERVALS.length} different interval parameters\n`);
  
  const results = [];
  
  // Test each interval
  for (const interval of MONTHLY_INTERVALS) {
    const result = await testInterval(interval);
    results.push(result);
    
    // Add delay to be respectful to API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n📊 SUMMARY OF RESULTS');
  console.log('═'.repeat(70));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful intervals: ${successful.length}/${results.length}`);
  console.log(`❌ Failed intervals: ${failed.length}/${results.length}\n`);
  
  if (successful.length > 0) {
    console.log('🎯 WORKING MONTHLY INTERVALS:');
    successful.forEach(result => {
      console.log(`  "${result.interval}" → ${result.dataPoints} data points (${result.firstDate} to ${result.lastDate})`);
      console.log(`    Average energy: ${result.averageEnergy?.toFixed(1)} MWh`);
    });
    
    // Test comparison with the first working monthly interval
    const firstWorking = successful[0];
    if (firstWorking) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await compareDailyVsMonthly(firstWorking.interval);
    }
  }
  
  if (failed.length > 0) {
    console.log('\n❌ FAILED INTERVALS:');
    failed.forEach(result => {
      console.log(`  "${result.interval}" → ${result.error}`);
    });
  }
  
  // Final recommendations
  console.log('\n🎯 RECOMMENDATIONS:');
  console.log('═'.repeat(70));
  
  if (successful.length > 0) {
    const bestInterval = successful[0];
    console.log(`✅ Monthly data IS supported!`);
    console.log(`📋 Recommended interval parameter: "${bestInterval.interval}"`);
    console.log(`📊 Data characteristics:`);
    console.log(`   - ${bestInterval.dataPoints} monthly data points over ~4 years`);
    console.log(`   - Average monthly energy: ${bestInterval.averageEnergy?.toFixed(1)} MWh`);
    console.log(`   - Perfect for generating quick previews and long-term trends`);
    console.log(`   - Should significantly reduce API response time and data transfer`);
    
    // Estimate performance improvement
    const expectedDailyPoints = 365 * 4; // 4 years of daily data
    const monthlyPoints = bestInterval.dataPoints;
    const reduction = ((expectedDailyPoints - monthlyPoints) / expectedDailyPoints * 100).toFixed(1);
    console.log(`   - Data reduction: ~${reduction}% fewer data points vs daily`);
    
  } else {
    console.log(`❌ Monthly data is NOT supported by the OpenElectricity API`);
    console.log(`📋 Only daily intervals ('1d') appear to be available`);
    console.log(`💡 Consider client-side aggregation for monthly previews`);
  }
}

// Run the tests
runTests().catch(console.error);