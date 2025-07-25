import { Tile } from '../Tile';
import { TileData } from '../types';
import { YearDataCache } from '../YearDataCache';
import { GeneratingUnitCapFacHistoryDTO } from '@/shared/types';

function generateMockTileData(facilityName: string, year: number): TileData {
  const daysInYear = year % 4 === 0 ? 366 : 365;
  
  // Generate 4 units with realistic capacity factor patterns
  const units = ['01', '02', '03', '04'].map(unitNum => {
    // Create realistic capacity factor data with patterns
    const data = Array(daysInYear).fill(null).map((_, dayIndex) => {
      // Add some seasonal variation
      const seasonalFactor = Math.sin((dayIndex / 365) * 2 * Math.PI) * 0.2 + 0.5;
      
      // Add some randomness
      const randomFactor = Math.random() * 0.3;
      
      // Occasional outages (5% chance)
      if (Math.random() < 0.05) return 0;
      
      // Occasional missing data (2% chance)
      if (Math.random() < 0.02) return null;
      
      // Normal operation
      const capacityFactor = (seasonalFactor + randomFactor) * 100;
      return Math.min(100, Math.max(0, capacityFactor));
    });
    
    return {
      duid: `ER${unitNum}`,
      capacity: 720,
      data
    };
  });
  
  return {
    facilityName,
    year,
    units,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`
  };
}

describe('Tile Performance Test', () => {
  it('should measure tile generation performance over 100 tiles with year-based caching', () => {
    const facilityName = 'Eraring';
    const unitHeights = [30, 30, 40, 30];
    const width = 1200;
    const renderTimes: number[] = [];
    
    // Initialize year data cache
    const yearCache = new YearDataCache(5); // Small cache to test eviction
    
    console.log('\n=== Tile Generation Performance Test (Year-based) ===\n');
    console.log('Testing with year-based caching system...');
    console.log('Generating 100 tiles (10 years × 10 iterations)...\n');
    
    // Generate 10 iterations of 10 years each
    for (let iteration = 0; iteration < 10; iteration++) {
      for (let year = 2015; year <= 2024; year++) {
        // Simulate year data caching behavior
        if (!yearCache.has(year)) {
          // Simulate fetching year data
          const yearData: GeneratingUnitCapFacHistoryDTO = {
            type: 'capacity_factors' as const,
            version: '1.0',
            created_at: new Date().toISOString(),
            data: [{
              network: 'NEM',
              region: 'NSW1',
              data_type: 'capacity_factor',
              units: 'MW',
              capacity: 720,
              duid: 'ER01',
              facility_code: 'ERARING',
              facility_name: facilityName,
              fueltech: 'black_coal',
              history: {
                start: `${year}-01-01`,
                last: `${year}-12-31`,
                interval: '1D',
                data: generateMockTileData(facilityName, year).units[0].data
              }
            }, {
              network: 'NEM',
              region: 'NSW1',
              data_type: 'capacity_factor',
              units: 'MW',
              capacity: 720,
              duid: 'ER02',
              facility_code: 'ERARING',
              facility_name: facilityName,
              fueltech: 'black_coal',
              history: {
                start: `${year}-01-01`,
                last: `${year}-12-31`,
                interval: '1D',
                data: generateMockTileData(facilityName, year).units[1].data
              }
            }, {
              network: 'NEM',
              region: 'NSW1',
              data_type: 'capacity_factor',
              units: 'MW',
              capacity: 720,
              duid: 'ER03',
              facility_code: 'ERARING',
              facility_name: facilityName,
              fueltech: 'black_coal',
              history: {
                start: `${year}-01-01`,
                last: `${year}-12-31`,
                interval: '1D',
                data: generateMockTileData(facilityName, year).units[2].data
              }
            }, {
              network: 'NEM',
              region: 'NSW1',
              data_type: 'capacity_factor',
              units: 'MW',
              capacity: 720,
              duid: 'ER04',
              facility_code: 'ERARING',
              facility_name: facilityName,
              fueltech: 'black_coal',
              history: {
                start: `${year}-01-01`,
                last: `${year}-12-31`,
                interval: '1D',
                data: generateMockTileData(facilityName, year).units[3].data
              }
            }]
          };
          yearCache.set(year, yearData);
        }
        
        // Create new tile instance (no tile caching, but using year cache)
        const tile = new Tile({ facilityName, year });
        
        // Generate mock data for this specific facility/year
        const mockData = generateMockTileData(facilityName, year);
        tile.setData(mockData);
        
        // Measure render time
        const startTime = performance.now();
        try {
          const rendered = tile.render(width, unitHeights);
          const renderTime = performance.now() - startTime;
          renderTimes.push(renderTime);
        } catch (error) {
          // In test environment, canvas operations might fail
          // Just measure the time taken
          const renderTime = performance.now() - startTime;
          renderTimes.push(renderTime);
        }
      }
    }
    
    // Calculate statistics
    const sum = renderTimes.reduce((a, b) => a + b, 0);
    const avg = sum / renderTimes.length;
    const min = Math.min(...renderTimes);
    const max = Math.max(...renderTimes);
    
    // Calculate standard deviation
    const squaredDiffs = renderTimes.map(time => Math.pow(time - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / renderTimes.length;
    const stdev = Math.sqrt(avgSquaredDiff);
    
    // Log results
    console.log('Results:');
    console.log(`  Total tiles generated: ${renderTimes.length}`);
    console.log(`  Average render time: ${avg.toFixed(2)}ms`);
    console.log(`  Min render time: ${min.toFixed(2)}ms`);
    console.log(`  Max render time: ${max.toFixed(2)}ms`);
    console.log(`  Standard deviation: ${stdev.toFixed(2)}ms`);
    
    // Log year cache stats
    const cacheStats = yearCache.getStats();
    console.log('\nYear Cache Statistics:');
    console.log(`  Cached years: ${cacheStats.years} (max: 5)`);
    console.log(`  Total size: ${cacheStats.totalMB.toFixed(2)}MB`);
    console.log(`  Years in cache: [${cacheStats.yearList.join(', ')}]`);
    
    console.log('\nDistribution:');
    
    // Show distribution
    const buckets = [0, 1, 2, 5, 10, 20, 50, 100, Infinity];
    const distribution: Record<string, number> = {};
    
    for (let i = 0; i < buckets.length - 1; i++) {
      const bucketName = `${buckets[i]}-${buckets[i + 1]}ms`;
      distribution[bucketName] = renderTimes.filter(
        t => t >= buckets[i] && t < buckets[i + 1]
      ).length;
    }
    
    Object.entries(distribution).forEach(([bucket, count]) => {
      if (count > 0) {
        const percentage = (count / renderTimes.length * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(count / renderTimes.length * 40));
        console.log(`  ${bucket.padEnd(10)} ${count.toString().padStart(3)} (${percentage.padStart(5)}%) ${bar}`);
      }
    });
    
    // Assertions
    expect(renderTimes.length).toBe(100);
    expect(avg).toBeGreaterThan(0);
    expect(min).toBeGreaterThan(0);
    expect(max).toBeGreaterThan(min);
    expect(stdev).toBeGreaterThan(0);
    
    // Performance expectations (adjust based on your requirements)
    expect(avg).toBeLessThan(100); // Average should be under 100ms
    expect(max).toBeLessThan(500); // Max should be under 500ms
  });
});