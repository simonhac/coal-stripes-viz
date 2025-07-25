import { Tile } from './src/client/tile-system/Tile';
import { TileData } from './src/client/tile-system/types';

// Mock data for testing
function generateMockTileData(facilityName: string, year: number): TileData {
  const daysInYear = year % 4 === 0 ? 366 : 365;
  
  return {
    facilityName,
    year,
    units: [
      {
        duid: 'ER01',
        capacity: 720,
        data: Array(daysInYear).fill(null).map(() => 
          Math.random() < 0.1 ? null : Math.random() * 100
        )
      },
      {
        duid: 'ER02',
        capacity: 720,
        data: Array(daysInYear).fill(null).map(() => 
          Math.random() < 0.1 ? null : Math.random() * 100
        )
      },
      {
        duid: 'ER03',
        capacity: 720,
        data: Array(daysInYear).fill(null).map(() => 
          Math.random() < 0.1 ? null : Math.random() * 100
        )
      },
      {
        duid: 'ER04',
        capacity: 720,
        data: Array(daysInYear).fill(null).map(() => 
          Math.random() < 0.1 ? null : Math.random() * 100
        )
      }
    ],
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`
  };
}

async function testTilePerformance() {
  console.log('Starting tile performance test...\n');
  
  const widths = [800, 1000, 1200, 1600];
  const unitHeights = [30, 30, 40, 30]; // 4 units
  
  for (const width of widths) {
    console.log(`\n=== Testing width: ${width}px ===`);
    
    const times: number[] = [];
    
    // Test 5 tiles at each width
    for (let year = 2020; year <= 2024; year++) {
      const tile = new Tile({ facilityName: 'Eraring', year });
      const data = generateMockTileData('Eraring', year);
      tile.setData(data);
      
      const startTime = performance.now();
      const rendered = tile.render(width, unitHeights);
      const renderTime = performance.now() - startTime;
      
      times.push(renderTime);
      console.log(`  Year ${year}: ${renderTime.toFixed(1)}ms`);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`  Average: ${avgTime.toFixed(1)}ms`);
  }
  
  console.log('\n✅ Performance test complete');
}

// Run if executed directly
if (require.main === module) {
  testTilePerformance().catch(console.error);
}