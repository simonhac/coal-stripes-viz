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

async function checkAllUnitsLastDates() {
  console.log('🔍 Checking last data date for each coal unit...\n');
  
  try {
    // Get all facilities
    const allFacilities = await client.getFacilities();
    const coalFacilities = allFacilities.response.data.filter(f => 
      f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
    );
    
    console.log(`Found ${coalFacilities.length} coal facilities\n`);
    
    // Track units by their last data date
    const unitsByLastDate = {};
    const unitDetails = [];
    
    // Test date range from May to July 2025
    const startDate = '2025-05-01';
    const endDate = '2025-07-17';
    
    console.log(`Checking data from ${startDate} to ${endDate}\n`);
    console.log('Facility Code | Network | Last Data Date | Days Ago');
    console.log(''.padEnd(60, '-'));
    
    // Test each facility
    for (const facility of coalFacilities) {
      const networkCode = facility.network_region === 'WEM' ? 'WEM' : 'NEM';
      
      try {
        const energyData = await client.getFacilityData(
          networkCode,
          [facility.code],
          ['energy'],
          {
            interval: '1d',
            dateStart: startDate,
            dateEnd: endDate
          }
        );
        
        // Extract data from the nested structure
        let lastDataDate = null;
        
        if (energyData.response && energyData.response.data) {
          // Handle the nested results structure
          const responseData = energyData.response.data;
          
          if (responseData.length > 0 && responseData[0].results) {
            // Iterate through all units in the facility
            for (const result of responseData[0].results) {
              if (result.data && Array.isArray(result.data)) {
                // Find the last date with data
                for (let i = result.data.length - 1; i >= 0; i--) {
                  const [date, energy] = result.data[i];
                  if (energy !== null && energy !== undefined && energy > 0) {
                    const dateStr = date.split('T')[0];
                    if (!lastDataDate || dateStr > lastDataDate) {
                      lastDataDate = dateStr;
                    }
                    break;
                  }
                }
              }
            }
          }
        }
        
        if (lastDataDate) {
          const daysDiff = Math.floor((new Date('2025-07-18') - new Date(lastDataDate)) / (1000 * 60 * 60 * 24));
          console.log(`${facility.code.padEnd(14)} | ${networkCode.padEnd(7)} | ${lastDataDate} | ${daysDiff}`);
          
          // Track by date
          if (!unitsByLastDate[lastDataDate]) {
            unitsByLastDate[lastDataDate] = [];
          }
          unitsByLastDate[lastDataDate].push({ facility: facility.code, network: networkCode });
          
          unitDetails.push({
            facility: facility.code,
            network: networkCode,
            lastDate: lastDataDate,
            daysAgo: daysDiff
          });
        } else {
          console.log(`${facility.code.padEnd(14)} | ${networkCode.padEnd(7)} | No data found | -`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`${facility.code.padEnd(14)} | ${networkCode.padEnd(7)} | Error: ${error.message}`);
      }
    }
    
    // Summary by date
    console.log('\n📊 SUMMARY - Units grouped by last data date:\n');
    const sortedDates = Object.keys(unitsByLastDate).sort().reverse();
    
    for (const date of sortedDates) {
      const units = unitsByLastDate[date];
      const daysDiff = Math.floor((new Date('2025-07-18') - new Date(date)) / (1000 * 60 * 60 * 24));
      console.log(`${date} (${daysDiff} days ago): ${units.length} units`);
      if (units.length <= 10) {
        for (const unit of units) {
          console.log(`  - ${unit.facility} (${unit.network})`);
        }
      }
    }
    
    // Check if all units stop on the same date
    if (sortedDates.length === 1) {
      console.log(`\n⚠️  ALL units stop on the same date: ${sortedDates[0]}`);
    } else {
      console.log(`\n📈 Data ends on different dates - earliest: ${sortedDates[sortedDates.length - 1]}, latest: ${sortedDates[0]}`);
      
      // Show units with most recent data
      const mostRecentDate = sortedDates[0];
      const mostRecentUnits = unitsByLastDate[mostRecentDate];
      console.log(`\n✅ Units with most recent data (${mostRecentDate}):`);
      for (const unit of mostRecentUnits) {
        console.log(`  - ${unit.facility} (${unit.network})`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllUnitsLastDates();