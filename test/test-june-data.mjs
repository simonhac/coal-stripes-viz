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

async function testJuneData() {
  console.log('🔍 Testing different date ranges to find where data exists...\n');
  
  try {
    // Test different date ranges
    const testRanges = [
      { start: '2025-06-20', end: '2025-06-30', desc: 'Late June 2025' },
      { start: '2025-06-01', end: '2025-06-30', desc: 'Full June 2025' },
      { start: '2025-05-01', end: '2025-06-30', desc: 'May-June 2025' },
      { start: '2024-06-01', end: '2025-06-30', desc: 'Past year through June 2025' },
      { start: '2024-12-01', end: '2024-12-31', desc: 'December 2024' }
    ];
    
    for (const range of testRanges) {
      console.log(`\n📅 Testing ${range.desc}: ${range.start} to ${range.end}`);
      
      try {
        const energyData = await client.getFacilityData(
          'NEM',
          ['ERARING'],
          ['energy'],
          {
            interval: '1d',
            dateStart: range.start,
            dateEnd: range.end
          }
        );
        
        if (energyData.response.data && energyData.response.data.length > 0) {
          console.log(`   ✅ Found ${energyData.response.data.length} data points`);
          
          // Show the actual data
          console.log(`   Raw data: ${JSON.stringify(energyData.response.data, null, 2)}`);
          
          // Check how many have actual energy data
          const withEnergy = energyData.response.data.filter(d => d.energy > 0).length;
          const withZero = energyData.response.data.filter(d => d.energy === 0).length;
          const withNull = energyData.response.data.filter(d => d.energy === null || d.energy === undefined).length;
          
          console.log(`      - With energy > 0: ${withEnergy}`);
          console.log(`      - With energy = 0: ${withZero}`);
          console.log(`      - With null/undefined: ${withNull}`);
          
          // Show sample data
          if (withEnergy > 0) {
            const firstWithEnergy = energyData.response.data.find(d => d.energy > 0);
            const lastWithEnergy = [...energyData.response.data].reverse().find(d => d.energy > 0);
            console.log(`      - First data: ${firstWithEnergy.date} = ${firstWithEnergy.energy.toFixed(2)} MWh`);
            console.log(`      - Last data: ${lastWithEnergy.date} = ${lastWithEnergy.energy.toFixed(2)} MWh`);
          }
        } else {
          console.log(`   ❌ No data returned`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testJuneData();