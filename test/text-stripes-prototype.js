// Text-based coal stripes prototype - ASCII visualization for last 60 days
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const { OpenElectricityClient } = require('openelectricity');

const apiKey = process.env.OPENELECTRICITY_API_KEY;

// ASCII characters for different shades (darkest to lightest)
const SHADES = {
  // Red for offline (0%) - using single character to maintain monospace alignment
  offline: 'X',
  // Grayscale from dark (high capacity) to light (low capacity)
  shades: ['█', '▉', '▊', '▋', '▌', '▍', '▎', '▏', '░', '·']
  //       100%  90%  80%  70%  60%  50%  40%  30%  20%  10%
};

function getShadeCharacter(capacityFactor) {
  if (capacityFactor <= 0) return SHADES.offline;
  
  // Map 0-100% to shade index (0-9)
  const shadeIndex = Math.min(9, Math.floor((100 - capacityFactor) / 10));
  return SHADES.shades[shadeIndex];
}

function calculateCapacityFactor(dailyEnergyMWh, capacityMW) {
  if (!capacityMW || capacityMW <= 0) return 0;
  
  // Maximum possible energy in 24 hours
  const maxPossibleMWh = capacityMW * 24;
  
  // Capacity factor as percentage
  const capacityFactor = (dailyEnergyMWh / maxPossibleMWh) * 100;
  
  // Cap at 100% (sometimes generation can exceed registered capacity)
  return Math.min(100, capacityFactor);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}/${month}`;
}

function groupByRegion(facilities) {
  const regions = {
    'NSW1': { name: 'New South Wales', units: [] },
    'QLD1': { name: 'Queensland', units: [] },
    'VIC1': { name: 'Victoria', units: [] },
    'SA1': { name: 'South Australia', units: [] },
    'WEM': { name: 'Western Australia', units: [] }
  };
  
  facilities.forEach(facility => {
    facility.units.forEach(unit => {
      if (unit.fueltech === 'coal_black' || unit.fueltech === 'coal_brown') {
        regions[facility.region]?.units.push({
          ...unit,
          facility_name: facility.name,
          facility_code: facility.code
        });
      }
    });
  });
  
  return regions;
}

async function createTextStripes() {
  console.log('🎨 Creating text-based coal stripes visualization...\n');
  
  try {
    const client = new OpenElectricityClient({ apiKey });
    
    // Get date range - request extra days to account for data availability delays
    const requestEndDate = new Date();
    const requestStartDate = new Date(requestEndDate);
    requestStartDate.setDate(requestStartDate.getDate() - 70); // Request 70 days to ensure we have 60 good days
    
    const dateStart = requestStartDate.toISOString().split('T')[0];
    const dateEnd = requestEndDate.toISOString().split('T')[0];
    
    console.log(`📅 Requesting data from ${dateStart} to ${dateEnd} (${Math.ceil((requestEndDate - requestStartDate) / (1000 * 60 * 60 * 24))} days)\n`);
    
    // Get facilities from both NEM and WEM networks
    console.log('📋 Fetching facilities...');
    const nemFacilities = await client.getFacilities({ network: 'NEM' });
    const wemFacilities = await client.getFacilities({ network: 'WEM' });
    
    // Filter for coal facilities from both networks
    const nemCoalFacilities = nemFacilities.response.data.filter(f => 
      f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
    );
    const wemCoalFacilities = wemFacilities.response.data.filter(f => 
      f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
    );
    
    // Combine all coal facilities
    const allCoalFacilities = [...nemCoalFacilities, ...wemCoalFacilities];
    
    console.log(`🔍 Found ${nemCoalFacilities.length} NEM coal facilities and ${wemCoalFacilities.length} WEM coal facilities (${allCoalFacilities.length} total)\n`);
    
    // Fetch data in batches (20 facilities per call) for both networks
    console.log('⚡ Fetching energy data...');
    const BATCH_SIZE = 20;
    const allData = [];
    
    // Process NEM facilities
    const nemFacilityCodes = nemCoalFacilities.map(f => f.code);
    for (let i = 0; i < nemFacilityCodes.length; i += BATCH_SIZE) {
      const batch = nemFacilityCodes.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(nemFacilityCodes.length / BATCH_SIZE);
      
      console.log(`  NEM Batch ${batchNum}/${totalBatches}: ${batch.length} facilities`);
      
      const batchData = await client.getFacilityData('NEM', batch, ['energy'], {
        interval: '1d',
        dateStart,
        dateEnd
      });
      
      allData.push(...(batchData.datatable?.rows || []));
    }
    
    // Process WEM facilities
    const wemFacilityCodes = wemCoalFacilities.map(f => f.code);
    for (let i = 0; i < wemFacilityCodes.length; i += BATCH_SIZE) {
      const batch = wemFacilityCodes.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(wemFacilityCodes.length / BATCH_SIZE);
      
      console.log(`  WEM Batch ${batchNum}/${totalBatches}: ${batch.length} facilities`);
      
      const batchData = await client.getFacilityData('WEM', batch, ['energy'], {
        interval: '1d',
        dateStart,
        dateEnd
      });
      
      allData.push(...(batchData.datatable?.rows || []));
    }
    
    console.log(`✅ Retrieved ${allData.length} data rows\n`);
    
    // Find the last day with good data by checking data availability
    console.log('🔍 Analyzing data availability...');
    
    // Create all possible dates in the requested range
    const allDates = [];
    for (let d = new Date(requestStartDate); d <= requestEndDate; d.setDate(d.getDate() + 1)) {
      allDates.push(d.toISOString().split('T')[0]);
    }
    
    // Count data points per day to find last good day
    const dailyDataCount = {};
    allData.forEach(row => {
      const date = row.interval.toISOString().split('T')[0];
      dailyDataCount[date] = (dailyDataCount[date] || 0) + 1;
    });
    
    // Find the last day with substantial data (> 50% of expected data points)
    const expectedDataPoints = allCoalFacilities.reduce((sum, f) => sum + f.units.filter(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown').length, 0);
    const minDataThreshold = Math.floor(expectedDataPoints * 0.5);
    
    let lastGoodDay = null;
    for (let i = allDates.length - 1; i >= 0; i--) {
      const date = allDates[i];
      const dataCount = dailyDataCount[date] || 0;
      if (dataCount >= minDataThreshold) {
        lastGoodDay = date;
        break;
      }
    }
    
    if (!lastGoodDay) {
      lastGoodDay = allDates[allDates.length - 3]; // Fallback to 3 days ago
    }
    
    console.log(`📊 Last day with good data: ${lastGoodDay} (${dailyDataCount[lastGoodDay] || 0} data points)`);
    
    // Create final date range - exactly 60 days ending with last good day
    const finalEndDate = new Date(lastGoodDay);
    const finalStartDate = new Date(finalEndDate);
    finalStartDate.setDate(finalStartDate.getDate() - 59); // 59 days back + end day = 60 days total
    
    const actualDateStart = finalStartDate.toISOString().split('T')[0];
    const actualDateEnd = finalEndDate.toISOString().split('T')[0];
    
    console.log(`📅 Using date range: ${actualDateStart} to ${actualDateEnd} (60 days)\n`);
    
    // Create facility lookup with capacities for both networks
    const facilityLookup = {};
    allCoalFacilities.forEach(f => {
      facilityLookup[f.code] = {
        name: f.name,
        region: f.network_region,
        units: {}
      };
      
      f.units.forEach(u => {
        if (u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown') {
          facilityLookup[f.code].units[u.code] = {
            capacity: u.capacity_registered,
            fueltech: u.fueltech_id,
            status: u.status_id
          };
        }
      });
    });
    
    // Process data into unit/date matrix (only for the final date range)
    const unitData = {};
    allData.forEach(row => {
      const unitCode = row.unit_code;
      const date = row.interval.toISOString().split('T')[0];
      const energy = row.energy || 0;
      
      // Only include data within our final date range
      if (date >= actualDateStart && date <= actualDateEnd) {
        if (!unitData[unitCode]) unitData[unitCode] = {};
        unitData[unitCode][date] = energy;
      }
    });
    
    // Create date array for headers (final 60 days only)
    const dates = [];
    for (let d = new Date(finalStartDate); d <= finalEndDate; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    
    // Group units by region
    const regions = {
      'NSW1': { name: 'New South Wales', units: [] },
      'QLD1': { name: 'Queensland', units: [] },
      'VIC1': { name: 'Victoria', units: [] },
      'SA1': { name: 'South Australia', units: [] },
      'WEM': { name: 'Western Australia', units: [] }
    };
    
    // Organize units by region
    Object.keys(unitData).forEach(unitCode => {
      // Find which facility this unit belongs to
      let facilityCode = null;
      let unitInfo = null;
      
      for (const [fCode, fData] of Object.entries(facilityLookup)) {
        if (fData.units[unitCode]) {
          facilityCode = fCode;
          unitInfo = fData.units[unitCode];
          break;
        }
      }
      
      if (facilityCode && unitInfo && unitInfo.status === 'operating') {
        const facility = facilityLookup[facilityCode];
        const region = facility.region;
        
        if (regions[region]) {
          regions[region].units.push({
            code: unitCode,
            facility_name: facility.name,
            facility_code: facilityCode,
            capacity: unitInfo.capacity,
            fueltech: unitInfo.fueltech,
            data: unitData[unitCode]
          });
        }
      }
    });
    
    // Sort units by facility first, then by capacity within each facility
    Object.values(regions).forEach(region => {
      region.units.sort((a, b) => {
        // First sort by facility name
        if (a.facility_name !== b.facility_name) {
          return a.facility_name.localeCompare(b.facility_name);
        }
        // Then sort by capacity (largest first) within the same facility
        return (b.capacity || 0) - (a.capacity || 0);
      });
    });
    
    // Print header
    console.log('🎨 COAL STRIPES VISUALIZATION (Last 60 Days)\n');
    console.log('Legend:');
    console.log(`  X Offline (0%)    ${SHADES.shades[0]} High (90-100%)  ${SHADES.shades[5]} Medium (40-50%)  ${SHADES.shades[9]} Low (0-10%)`);
    console.log(`  ${SHADES.shades[2]} High (70-80%)   ${SHADES.shades[7]} Low (20-30%)    · Very Low (<10%)`);
    console.log();
    console.log('📝 NOTE: View this output in a monospace font (Terminal, VS Code, etc.) for proper alignment');
    console.log();
    
    // Print date headers with weekly alignment
    console.log('Unit              Facility          Cap   ');
    
    // Create header array, one character per day
    const headerChars = new Array(dates.length).fill(' ');
    
    // Place dates at weekly intervals (every 7 days)
    for (let i = 0; i < dates.length; i += 7) {
      const dateStr = formatDate(dates[i]);
      // Place the date starting at position i
      for (let j = 0; j < dateStr.length && i + j < dates.length; j++) {
        headerChars[i + j] = dateStr[j];
      }
    }
    
    const headerString = '                                    MW    ' + headerChars.join('');
    console.log(headerString);
    console.log('─'.repeat(headerString.length));
    
    // Print stripes for each region
    Object.entries(regions).forEach(([regionCode, region]) => {
      if (region.units.length === 0) return;
      
      console.log(`\n▼ ${region.name.toUpperCase()}`);
      
      region.units.forEach(unit => {
        const unitLabel = unit.code.padEnd(17);
        const facilityLabel = unit.facility_name.substring(0, 17).padEnd(17);
        const capacityLabel = (unit.capacity || 0).toString().padStart(5);
        
        // Generate stripe
        const stripe = dates.map(date => {
          const energy = unit.data[date] || 0;
          const capacityFactor = calculateCapacityFactor(energy, unit.capacity);
          return getShadeCharacter(capacityFactor);
        }).join('');
        
        console.log(`${unitLabel} ${facilityLabel} ${capacityLabel} ${stripe}`);
      });
    });
    
    console.log('\n' + '─'.repeat(120));
    console.log(`\n📊 Summary:`);
    console.log(`   Total operating units: ${Object.values(regions).reduce((sum, r) => sum + r.units.length, 0)}`);
    console.log(`   Date range: ${actualDateStart} to ${actualDateEnd} (${dates.length} days)`);
    console.log(`   Last day with good data: ${lastGoodDay}`);
    console.log(`   Regions: ${Object.values(regions).filter(r => r.units.length > 0).length}`);
    
    // Show sample capacity factors
    const sampleUnit = Object.values(regions).find(r => r.units.length > 0)?.units[0];
    if (sampleUnit) {
      console.log(`\n🔍 Sample (${sampleUnit.code}):`);
      const recentDates = dates.slice(-7);
      recentDates.forEach(date => {
        const energy = sampleUnit.data[date] || 0;
        const cf = calculateCapacityFactor(energy, sampleUnit.capacity);
        const char = getShadeCharacter(cf);
        console.log(`   ${date}: ${energy.toFixed(0).padStart(6)} MWh → ${cf.toFixed(1).padStart(5)}% ${char}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTextStripes();