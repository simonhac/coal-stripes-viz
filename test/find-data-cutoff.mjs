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

async function findDataCutoff() {
  console.log('🔍 Finding data cutoff date for coal units...\n');
  
  try {
    // Test a single facility with a wide date range
    const testFacility = 'ERARING'; // Large NSW coal plant
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60); // 60 days ago
    
    console.log(`Testing ${testFacility} from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);
    
    const energyData = await client.getFacilityData(
      'NEM',
      [testFacility],
      ['energy'],
      {
        interval: '1d',
        dateStart: startDate.toISOString().split('T')[0],
        dateEnd: endDate.toISOString().split('T')[0]
      }
    );
    
    if (energyData.response.data && energyData.response.data.length > 0) {
      // Sort by date
      const sortedData = energyData.response.data.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      console.log(`Found ${sortedData.length} data points\n`);
      
      // Show last 10 data points
      console.log('Last 10 data points:');
      const last10 = sortedData.slice(-10);
      for (const row of last10) {
        const energy = row.energy !== undefined ? row.energy.toFixed(2) : 'null';
        console.log(`  ${row.date}: ${energy} MWh`);
      }
      
      // Find the last date with actual data
      let lastDataDate = null;
      for (let i = sortedData.length - 1; i >= 0; i--) {
        if (sortedData[i].energy !== undefined && sortedData[i].energy !== null && sortedData[i].energy > 0) {
          lastDataDate = sortedData[i].date;
          break;
        }
      }
      
      console.log(`\n🎯 Last date with non-zero energy data: ${lastDataDate}`);
      
      // Calculate days ago
      if (lastDataDate) {
        const daysDiff = Math.floor((new Date() - new Date(lastDataDate)) / (1000 * 60 * 60 * 24));
        console.log(`   That's ${daysDiff} days ago`);
      }
      
      // Now test all facilities at that date
      console.log('\n📊 Testing all facilities for data availability...\n');
      
      const allFacilities = await client.getFacilities();
      const coalFacilities = allFacilities.response.data.filter(f => 
        f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
      );
      
      // Test date range around June 26
      const testStart = '2025-06-24';
      const testEnd = '2025-06-28';
      
      console.log(`Testing data availability from ${testStart} to ${testEnd}:\n`);
      
      let facilitiesWithData = 0;
      let facilitiesWithoutData = 0;
      
      for (const facility of coalFacilities) {
        const networkCode = facility.network_region === 'WEM' ? 'WEM' : 'NEM';
        process.stdout.write(`  ${facility.code} (${networkCode}): `);
        
        try {
          const data = await client.getFacilityData(
            networkCode,
            [facility.code],
            ['energy'],
            {
              interval: '1d',
              dateStart: testStart,
              dateEnd: testEnd
            }
          );
          
          if (data.response.data && data.response.data.length > 0) {
            const hasData = data.response.data.some(row => 
              row.energy !== undefined && row.energy !== null && row.energy > 0
            );
            if (hasData) {
              console.log('✅ Has data');
              facilitiesWithData++;
            } else {
              console.log('⚠️  No energy data');
              facilitiesWithoutData++;
            }
          } else {
            console.log('❌ No response');
            facilitiesWithoutData++;
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.log(`❌ Error: ${error.message}`);
          facilitiesWithoutData++;
        }
      }
      
      console.log(`\n📈 Summary:`);
      console.log(`   Facilities with data: ${facilitiesWithData}`);
      console.log(`   Facilities without data: ${facilitiesWithoutData}`);
      
    } else {
      console.log('No data returned for test facility');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

findDataCutoff();