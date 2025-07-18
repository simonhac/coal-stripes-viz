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

async function investigateDataGaps() {
  console.log('🔍 Investigating data gaps for coal units...\n');
  
  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  // Get date 30 days ago for testing
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
  
  console.log(`📅 Testing data availability from ${thirtyDaysAgoStr} to ${yesterdayStr}\n`);
  
  try {
    // Get all facilities
    const allFacilities = await client.getFacilities();
    const coalFacilities = allFacilities.response.data.filter(f => 
      f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
    );
    
    console.log(`Found ${coalFacilities.length} coal facilities\n`);
    
    // Track units by their last data date
    const unitsByLastDataDate = {};
    const problemUnits = [];
    
    // Test each facility individually
    for (const facility of coalFacilities) {
      const networkCode = facility.network_region === 'WEM' ? 'WEM' : 'NEM';
      process.stdout.write(`Testing ${facility.code} (${networkCode})...`);
      
      try {
        const energyData = await client.getFacilityData(
          networkCode,
          [facility.code],
          ['energy'],
          {
            interval: '1d',
            dateStart: thirtyDaysAgoStr,
            dateEnd: yesterdayStr
          }
        );
        
        if (energyData.response.data && energyData.response.data.length > 0) {
          // Find the last date with non-zero data
          let lastDataDate = null;
          let lastNonZeroDate = null;
          
          for (const row of energyData.response.data) {
            if (row.energy !== undefined && row.energy !== null) {
              lastDataDate = row.date;
              if (row.energy > 0) {
                lastNonZeroDate = row.date;
              }
            }
          }
          
          const lastDate = lastNonZeroDate || lastDataDate;
          if (lastDate) {
            if (!unitsByLastDataDate[lastDate]) {
              unitsByLastDataDate[lastDate] = [];
            }
            unitsByLastDataDate[lastDate].push({
              facility: facility.code,
              network: networkCode,
              lastDataDate: lastDataDate,
              lastNonZeroDate: lastNonZeroDate
            });
            
            // Check if this unit's data ends before yesterday
            const daysDiff = Math.floor((yesterday - new Date(lastDate)) / (1000 * 60 * 60 * 24));
            if (daysDiff > 1) {
              problemUnits.push({
                facility: facility.code,
                network: networkCode,
                lastDate: lastDate,
                daysAgo: daysDiff
              });
              console.log(` ⚠️  Last data: ${lastDate} (${daysDiff} days ago)`);
            } else {
              console.log(' ✅');
            }
          } else {
            console.log(' ❌ No data');
          }
        } else {
          console.log(' ❌ No data returned');
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(` ❌ Error: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n📊 SUMMARY:\n');
    
    // Sort dates and show units grouped by last data date
    const sortedDates = Object.keys(unitsByLastDataDate).sort();
    console.log('Units grouped by last data date:');
    for (const date of sortedDates) {
      const units = unitsByLastDataDate[date];
      const daysDiff = Math.floor((yesterday - new Date(date)) / (1000 * 60 * 60 * 24));
      console.log(`\n${date} (${daysDiff} days ago): ${units.length} units`);
      for (const unit of units) {
        console.log(`  - ${unit.facility} (${unit.network})`);
      }
    }
    
    // Show problem units
    if (problemUnits.length > 0) {
      console.log('\n⚠️  PROBLEM UNITS (data older than yesterday):');
      problemUnits.sort((a, b) => b.daysAgo - a.daysAgo);
      for (const unit of problemUnits) {
        console.log(`  - ${unit.facility} (${unit.network}): ${unit.lastDate} (${unit.daysAgo} days ago)`);
      }
      
      // Find the most recent date that ALL units have data
      console.log(`\n🎯 The most recent date with data from ALL units appears to be: ${sortedDates[0]}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

investigateDataGaps();