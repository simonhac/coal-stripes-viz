import { OpenElectricityClient } from 'openelectricity';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const client = new OpenElectricityClient({
  apiKey: process.env.OPENELECTRICITY_API_KEY,
  baseUrl: process.env.OPENELECTRICITY_API_URL || 'https://api.openelectricity.org.au'
});

async function checkBayswater() {
  try {
    const response = await fetch('http://localhost:3000/api/coal-stripes?days=365');
    const data = await response.json();
    
    console.log('Bayswater facility data:');
    
    // Find Bayswater units
    const bayswaterUnits = [];
    Object.values(data.regions).forEach(region => {
      region.units.forEach(unit => {
        if (unit.facility_name.toLowerCase().includes('bayswater')) {
          bayswaterUnits.push(unit);
        }
      });
    });
    
    if (bayswaterUnits.length === 0) {
      console.log('No Bayswater units found');
      return;
    }
    
    console.log(`Found ${bayswaterUnits.length} Bayswater units:`);
    bayswaterUnits.forEach(unit => {
      console.log(`  - ${unit.code} (${unit.capacity}MW)`);
    });
    
    // Get date range for Bayswater units
    const firstUnit = bayswaterUnits[0];
    const dates = Object.keys(firstUnit.data).sort();
    
    console.log(`\nDate range for Bayswater:`);
    console.log(`  First date: ${dates[0]}`);
    console.log(`  Last date: ${dates[dates.length - 1]}`);
    console.log(`  Total days: ${dates.length}`);
    
    // Check data availability
    const datesWithData = dates.filter(date => {
      return bayswaterUnits.some(unit => unit.data[date] !== undefined);
    });
    
    console.log(`  Days with data: ${datesWithData.length}`);
    console.log(`  Data coverage: ${(datesWithData.length / dates.length * 100).toFixed(1)}%`);
    
    // Check against the main data.dates array
    console.log(`\nComparing with main data.dates:`);
    console.log(`  Main data first date: ${data.dates[0]}`);
    console.log(`  Main data last date: ${data.dates[data.dates.length - 1]}`);
    console.log(`  Main data total days: ${data.dates.length}`);
    
    console.log(`\nData structure fields:`);
    console.log(`  actualDateStart: ${data.actualDateStart}`);
    console.log(`  actualDateEnd: ${data.actualDateEnd}`);
    console.log(`  lastGoodDay: ${data.lastGoodDay}`);
    
    // Check if 2025-07-16 exists in the main dates array
    const jul16 = '2025-07-16';
    console.log(`\nLooking for ${jul16}:`);
    console.log(`  In main data.dates: ${data.dates.includes(jul16)}`);
    console.log(`  In Bayswater data: ${dates.includes(jul16)}`);
    
    // Show the last few dates from each
    console.log(`\nLast 5 dates in main data.dates:`, data.dates.slice(-5));
    console.log(`Last 5 dates in Bayswater data:`, dates.slice(-5));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkBayswater();