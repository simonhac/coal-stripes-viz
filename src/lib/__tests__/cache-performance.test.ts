import { TimeSeriesCache } from '../time-series-cache';
import { SmartCache } from '../smart-cache';
import { CoalStripesData, CoalUnit } from '../types';
import { parseDate } from '@internationalized/date';

describe('Cache Performance Tests', () => {
  // Helper to create realistic mock data for a year
  const createYearData = (year: number, numUnits: number = 50): CoalStripesData => {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInYear = isLeapYear ? 366 : 365;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    // Data cutoff: July 20, 2025
    const cutoffDate = parseDate('2025-07-20');
    const yearStart = parseDate(startDate);
    const yearEnd = parseDate(endDate);
    
    // Create units with realistic data
    const units: CoalUnit[] = [];
    
    for (let i = 0; i < numUnits; i++) {
      const unitData: (number | null)[] = new Array(daysInYear);
      
      // Fill with realistic capacity factors
      let currentDate = yearStart;
      for (let day = 0; day < daysInYear; day++) {
        if (currentDate.compare(cutoffDate) > 0) {
          // Future date - no data
          unitData[day] = null;
        } else {
          // Realistic capacity factor with some variation
          // Base capacity factor between 40-80%
          const base = 40 + (i % 4) * 10;
          // Daily variation ±20%
          const variation = Math.sin(day / 30) * 20;
          // Random noise ±5%
          const noise = (Math.random() - 0.5) * 10;
          
          const capacityFactor = Math.max(0, Math.min(100, base + variation + noise));
          
          // Occasionally offline (5% of days)
          if (Math.random() < 0.05) {
            unitData[day] = 0;
          } else {
            unitData[day] = Math.round(capacityFactor * 10) / 10;
          }
        }
        
        currentDate = currentDate.add({ days: 1 });
      }
      
      units.push({
        network: 'NEM',
        region: ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'][i % 5],
        data_type: 'capacity_factor',
        units: 'percentage',
        capacity: 600 + (i * 20),
        duid: `UNIT${String(i + 1).padStart(2, '0')}`,
        facility_code: `FAC${String(Math.floor(i / 4) + 1).padStart(2, '0')}`,
        facility_name: `Test Facility ${Math.floor(i / 4) + 1}`,
        fueltech: i % 3 === 0 ? 'coal_brown' : 'coal_black',
        history: {
          start: startDate,
          last: endDate,
          interval: '1d',
          data: unitData
        }
      });
    }
    
    return {
      type: 'capacity_factors',
      version: '1.0',
      created_at: new Date().toISOString(),
      data: units
    };
  };

  test('TimeSeriesCache performance must stay under 10ms average', () => {
    console.log('\n🏁 Starting TimeSeriesCache performance test (10ms threshold)...\n');
    
    const cache = new TimeSeriesCache(10); // Allow 10 years
    const numUnits = 50; // 50 coal units
    
    // Step 1: Populate cache with 10 years of data (2016-2025)
    console.log('📦 Populating cache with 10 years of data (50 units each)...');
    const populateStart = performance.now();
    
    for (let year = 2016; year <= 2025; year++) {
      const yearData = createYearData(year, numUnits);
      cache.addChunk(year, yearData);
    }
    
    const populateTime = performance.now() - populateStart;
    console.log(`✅ Cache populated in ${populateTime.toFixed(2)}ms`);
    
    const stats = cache.getCacheStats();
    console.log(`📊 Cache stats: ${stats.chunkCount} chunks, ${stats.sizeMB.toFixed(2)}MB`);
    
    // Step 2: Perform 500 random year-long queries
    console.log('\n🔍 Performing 500 random year-long queries...');
    
    const queryTimes: number[] = [];
    const queries: { start: string; end: string; time: number }[] = [];
    
    for (let i = 0; i < 500; i++) {
      // Random start date between 2015-01-01 and 2024-12-31
      const startYear = 2015 + Math.floor(Math.random() * 10);
      const dayOfYear = Math.floor(Math.random() * 365) + 1;
      const startDate = parseDate(`${startYear}-01-01`).add({ days: dayOfYear - 1 });
      
      // End date is exactly one year later
      const endDate = startDate.add({ years: 1 }).subtract({ days: 1 });
      
      // Time the query
      const queryStart = performance.now();
      const result = cache.getDataForDateRange(startDate, endDate);
      const queryTime = performance.now() - queryStart;
      
      queryTimes.push(queryTime);
      queries.push({
        start: startDate.toString(),
        end: endDate.toString(),
        time: queryTime
      });
      
      // Verify result
      if (result) {
        if ('isPartial' in result) {
          // Partial result - some years missing
        } else {
          // Full result
          expect(result.data.length).toBe(numUnits);
        }
      }
    }
    
    // Calculate statistics
    const avgTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
    const minTime = Math.min(...queryTimes);
    const maxTime = Math.max(...queryTimes);
    const medianTime = queryTimes.sort((a, b) => a - b)[Math.floor(queryTimes.length / 2)];
    
    console.log('\n📈 Query Performance Results:');
    console.log(`  Average: ${avgTime.toFixed(2)}ms`);
    console.log(`  Median:  ${medianTime.toFixed(2)}ms`);
    console.log(`  Min:     ${minTime.toFixed(2)}ms`);
    console.log(`  Max:     ${maxTime.toFixed(2)}ms`);
    
    // Show slowest queries
    const slowest = queries.sort((a, b) => b.time - a.time).slice(0, 5);
    console.log('\n🐌 Slowest 5 queries:');
    slowest.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q.start} → ${q.end}: ${q.time.toFixed(2)}ms`);
    });
    
    // Performance assertions - Alert if cache exceeds 10ms average
    expect(avgTime).toBeLessThan(10); // Should average under 10ms
    expect(medianTime).toBeLessThan(10); // Median should be under 10ms
    
    // Log warning if approaching threshold
    if (avgTime > 5) {
      console.warn(`⚠️  Cache performance warning: ${avgTime.toFixed(2)}ms average (threshold: 10ms)`);
    }
  });

  test('SmartCache performance with background operations', () => {
    console.log('\n🏁 Starting SmartCache performance test...\n');
    
    // Mock fetch to return data instantly
    global.fetch = jest.fn().mockImplementation((url) => {
      const yearMatch = (url as string).match(/year=(\d{4})/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        return Promise.resolve({
          ok: true,
          json: async () => createYearData(year, 50)
        });
      }
      return Promise.reject(new Error('Invalid URL'));
    });
    
    const smartCache = new SmartCache(10, false); // Disable preloading for this test
    const queryTimes: number[] = [];
    
    // Perform 20 queries that will trigger fetches and caching
    console.log('🔍 Performing 20 queries with fetch simulation...');
    
    const runQueries = async () => {
      for (let i = 0; i < 20; i++) {
        const startYear = 2018 + Math.floor(Math.random() * 5);
        const startDate = parseDate(`${startYear}-03-15`);
        const endDate = startDate.add({ years: 1 });
        
        const queryStart = performance.now();
        await smartCache.getDataForDateRange(startDate, endDate);
        const queryTime = performance.now() - queryStart;
        
        queryTimes.push(queryTime);
        
        // Small delay between queries
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    };
    
    return runQueries().then(() => {
      const avgTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      console.log(`\n📊 SmartCache average query time: ${avgTime.toFixed(2)}ms`);
      
      // Get cache stats
      const stats = smartCache.getCacheStats();
      console.log(`📈 Final cache stats: ${stats.chunkCount} chunks, ${stats.sizeMB.toFixed(2)}MB`);
    });
  });
});