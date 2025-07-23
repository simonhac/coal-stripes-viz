import { TimeSeriesCache } from '@/client/time-series-cache';
import { SmartCache } from '@/client/smart-cache';
import { CoalStripesData, CoalUnit } from '@/shared/types';
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
        facility_name: `Facility ${Math.floor(i / 4)}`,
        facility_id: `facility-${Math.floor(i / 4)}`,
        duid: `UNIT${i.toString().padStart(3, '0')}`,
        capacity: 660 + (i % 4) * 60, // 660-840 MW
        fuel_source_descriptor: 'Black Coal',
        commissioned_date: '2000-01-01',
        decommissioned_date: null,
        latest_carbon_intensity: 0.85 + (i % 10) * 0.01,
        history: {
          start: startDate,
          data: unitData
        }
      });
    }
    
    return {
      data: units,
      metadata: {
        start_date: startDate,
        end_date: endDate,
        version: '1.0',
        created_at: new Date().toISOString()
      }
    };
  };

  describe('TimeSeriesCache performance', () => {
    test('TimeSeriesCache performance must stay under 10ms average', async () => {
      console.log('\n🏁 Starting TimeSeriesCache performance test (10ms threshold)...');
      
      const cache = new TimeSeriesCache(10);
      
      // Populate cache with 10 years of data
      console.time('Cache population');
      for (let year = 2016; year <= 2025; year++) {
        const data = createYearData(year);
        cache.addYear(year, data);
        console.log(`💾 Cached ${year} [${year - 2015}/10]`);
      }
      console.timeEnd('Cache population');
      
      const stats = cache.getCacheStats();
      console.log(`📊 Cache stats: ${stats.yearCount} years, ${stats.totalMB.toFixed(2)}MB`);
      
      // Performance test: retrieve years multiple times
      const iterations = 100;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        // Random year retrieval
        const year = 2016 + Math.floor(Math.random() * 10);
        
        const start = performance.now();
        const data = cache.getYear(year);
        const elapsed = performance.now() - start;
        
        times.push(elapsed);
        expect(data).not.toBeNull();
      }
      
      // Calculate statistics
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);
      const min = Math.min(...times);
      
      console.log('\n📈 Performance results:');
      console.log(`  Average: ${avg.toFixed(3)}ms`);
      console.log(`  Min: ${min.toFixed(3)}ms`);
      console.log(`  Max: ${max.toFixed(3)}ms`);
      console.log(`  ${avg < 10 ? '✅' : '❌'} Average under 10ms threshold\n`);
      
      // Assert performance
      expect(avg).toBeLessThan(10);
    });
  });

  describe('SmartCache performance', () => {
    test('SmartCache performance with background operations', async () => {
      // Mock fetch
      global.fetch = jest.fn();
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      
      // Create cache
      const smartCache = new SmartCache(5, true); // Enable preloading
      
      // Setup fetch responses
      for (let year = 2016; year <= 2025; year++) {
        mockFetch.mockImplementationOnce(async () => ({
          ok: true,
          json: async () => createYearData(year)
        } as Response));
      }
      
      console.log('\n🏁 Starting SmartCache performance test...');
      
      // Measure initial fetch performance
      const fetchTimes: number[] = [];
      
      for (let year = 2020; year <= 2023; year++) {
        const start = performance.now();
        await smartCache.getYearData(year);
        const elapsed = performance.now() - start;
        fetchTimes.push(elapsed);
        console.log(`📡 Fetched ${year}: ${elapsed.toFixed(1)}ms`);
      }
      
      // Measure cache hit performance
      const cacheTimes: number[] = [];
      
      for (let i = 0; i < 50; i++) {
        const year = 2020 + Math.floor(Math.random() * 4);
        const start = performance.now();
        const data = await smartCache.getYearData(year);
        const elapsed = performance.now() - start;
        cacheTimes.push(elapsed);
        expect(data).not.toBeNull();
      }
      
      const avgCache = cacheTimes.reduce((a, b) => a + b, 0) / cacheTimes.length;
      console.log(`\n📊 Cache hit performance: ${avgCache.toFixed(3)}ms average`);
      
      // Test preloading performance
      smartCache.preloadAdjacentYears(2022);
      
      // Wait a bit for preloading
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = smartCache.getCacheStats();
      console.log(`📦 Final cache: ${stats.yearCount} years, ${stats.totalMB.toFixed(2)}MB`);
      
      // Cache hits should be very fast
      expect(avgCache).toBeLessThan(1);
      
      smartCache.clear();
    });
  });
});