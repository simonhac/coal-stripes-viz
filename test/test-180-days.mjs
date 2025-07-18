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

async function test180Days() {
  console.log('🔍 Testing 180 days of data for ERARING (large NSW coal plant)...\n');
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 180); // 180 days ago
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    console.log(`Date range: ${startStr} to ${endStr} (180 days)\n`);
    
    const energyData = await client.getFacilityData(
      'NEM',
      ['ERARING'],
      ['energy'],
      {
        interval: '1d',
        dateStart: startStr,
        dateEnd: endStr
      }
    );
    
    console.log('Raw API response:', JSON.stringify(energyData.response, null, 2).substring(0, 500) + '...');
    
    if (energyData.response.data && energyData.response.data.length > 0) {
      // Sort by date
      const sortedData = energyData.response.data.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      console.log(`✅ Found ${sortedData.length} data points\n`);
      
      // Show first 5 data points
      console.log('First 5 data points:');
      const first5 = sortedData.slice(0, 5);
      for (const row of first5) {
        const energy = row.energy !== undefined ? row.energy.toFixed(2) : 'null';
        console.log(`  ${row.date}: ${energy} MWh`);
      }
      
      console.log('\n...\n');
      
      // Show last 10 data points
      console.log('Last 10 data points:');
      const last10 = sortedData.slice(-10);
      for (const row of last10) {
        const energy = row.energy !== undefined ? row.energy.toFixed(2) : 'null';
        console.log(`  ${row.date}: ${energy} MWh`);
      }
      
      // Find the last date with actual data
      let lastDataDate = null;
      let lastNonZeroDate = null;
      
      for (let i = sortedData.length - 1; i >= 0; i--) {
        if (sortedData[i].energy !== undefined && sortedData[i].energy !== null) {
          if (!lastDataDate) lastDataDate = sortedData[i].date;
          if (sortedData[i].energy > 0) {
            lastNonZeroDate = sortedData[i].date;
            break;
          }
        }
      }
      
      console.log(`\n📊 Data availability:`);
      console.log(`   First date: ${sortedData[0].date}`);
      console.log(`   Last date: ${sortedData[sortedData.length - 1].date}`);
      console.log(`   Last date with any data: ${lastDataDate}`);
      console.log(`   Last date with non-zero energy: ${lastNonZeroDate}`);
      
      // Calculate days ago
      if (lastNonZeroDate) {
        const daysDiff = Math.floor((new Date() - new Date(lastNonZeroDate)) / (1000 * 60 * 60 * 24));
        console.log(`   That's ${daysDiff} days ago (from today: ${endStr})`);
      }
      
      // Analyze data gaps
      console.log('\n📈 Data completeness:');
      let datesWithData = 0;
      let datesWithZero = 0;
      let datesWithNull = 0;
      
      for (const row of sortedData) {
        if (row.energy === undefined || row.energy === null) {
          datesWithNull++;
        } else if (row.energy === 0) {
          datesWithZero++;
        } else {
          datesWithData++;
        }
      }
      
      console.log(`   Dates with energy > 0: ${datesWithData}`);
      console.log(`   Dates with energy = 0: ${datesWithZero}`);
      console.log(`   Dates with null/undefined: ${datesWithNull}`);
      
    } else {
      console.log('❌ No data returned');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

test180Days();