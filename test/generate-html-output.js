// Generate HTML version of coal stripes for better viewing
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const { OpenElectricityClient } = require('openelectricity');
const fs = require('fs');

const apiKey = process.env.OPENELECTRICITY_API_KEY;

// ASCII characters for different shades (darkest to lightest)
const SHADES = {
  offline: 'X',
  shades: ['█', '▉', '▊', '▋', '▌', '▍', '▎', '▏', '░', '·']
};

function getShadeCharacter(capacityFactor) {
  if (capacityFactor <= 0) return SHADES.offline;
  const shadeIndex = Math.min(9, Math.floor((100 - capacityFactor) / 10));
  return SHADES.shades[shadeIndex];
}

function calculateCapacityFactor(dailyEnergyMWh, capacityMW) {
  if (!capacityMW || capacityMW <= 0) return 0;
  const maxPossibleMWh = capacityMW * 24;
  const capacityFactor = (dailyEnergyMWh / maxPossibleMWh) * 100;
  return Math.min(100, capacityFactor);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}/${month}`;
}

async function generateHtmlOutput() {
  console.log('🎨 Generating HTML coal stripes visualisation...\n');
  
  try {
    const client = new OpenElectricityClient({ apiKey });
    
    // Get date range - request extra days to account for data availability delays
    const requestEndDate = new Date();
    const requestStartDate = new Date(requestEndDate);
    requestStartDate.setDate(requestStartDate.getDate() - 70); // Request 70 days to ensure we have 60 good days
    
    const dateStart = requestStartDate.toISOString().split('T')[0];
    const dateEnd = requestEndDate.toISOString().split('T')[0];
    
    console.log(`📅 Requesting data from ${dateStart} to ${dateEnd} (${Math.ceil((requestEndDate - requestStartDate) / (1000 * 60 * 60 * 24))} days)`);
    
    // Get facilities from both NEM and WEM networks
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
    
    console.log(`🔍 Found ${nemCoalFacilities.length} NEM coal facilities and ${wemCoalFacilities.length} WEM coal facilities (${allCoalFacilities.length} total)`);
    
    // Fetch data in batches for both networks
    const BATCH_SIZE = 20;
    const allData = [];
    
    // Process NEM facilities
    const nemFacilityCodes = nemCoalFacilities.map(f => f.code);
    for (let i = 0; i < nemFacilityCodes.length; i += BATCH_SIZE) {
      const batch = nemFacilityCodes.slice(i, i + BATCH_SIZE);
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
      const batchData = await client.getFacilityData('WEM', batch, ['energy'], {
        interval: '1d',
        dateStart,
        dateEnd
      });
      allData.push(...(batchData.datatable?.rows || []));
    }
    
    console.log(`✅ Retrieved ${allData.length} data rows`);
    
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
    
    console.log(`📅 Using date range: ${actualDateStart} to ${actualDateEnd} (60 days)`);
    
    // Process data for both networks
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
    
    // Generate HTML
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coal Stripes Visualization</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            background-color: #1a1a1a;
            color: #e0e0e0;
            padding: 20px;
            line-height: 1.2;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            margin-bottom: 20px;
        }
        .legend {
            margin-bottom: 20px;
            font-size: 14px;
        }
        .data-table {
            white-space: pre;
            font-size: 12px;
            overflow-x: auto;
        }
        .region-header {
            font-weight: bold;
            margin-top: 20px;
            color: #4a9eff;
        }
        .stripe-line {
            margin: 2px 0;
        }
        .summary {
            margin-top: 20px;
            padding: 15px;
            background-color: #2a2a2a;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 Coal Stripes Visualization (Last 60 Days)</h1>
        </div>
        
        <div class="legend">
            <p><strong>Legend:</strong></p>
            <p>X Offline (0%) &nbsp;&nbsp; ${SHADES.shades[0]} High (90-100%) &nbsp;&nbsp; ${SHADES.shades[5]} Medium (40-50%) &nbsp;&nbsp; ${SHADES.shades[9]} Low (0-10%)</p>
            <p>${SHADES.shades[2]} High (70-80%) &nbsp;&nbsp; ${SHADES.shades[7]} Low (20-30%) &nbsp;&nbsp; · Very Low (&lt;10%)</p>
        </div>
        
        <div class="data-table">`;
    
    // Add headers with weekly alignment
    html += `Unit              Facility          Cap   \n`;
    
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
    html += `${headerString}\n`;
    html += `${'─'.repeat(headerString.length)}\n`;
    
    // Add stripes for each region
    Object.entries(regions).forEach(([regionCode, region]) => {
      if (region.units.length === 0) return;
      
      html += `\n<span class="region-header">▼ ${region.name.toUpperCase()}</span>\n`;
      
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
        
        html += `<div class="stripe-line">${unitLabel} ${facilityLabel} ${capacityLabel} ${stripe}</div>\n`;
      });
    });
    
    html += `\n${'─'.repeat(100)}\n`;
    html += `        </div>
        
        <div class="summary">
            <h3>📊 Summary</h3>
            <p>Total operating units: ${Object.values(regions).reduce((sum, r) => sum + r.units.length, 0)}</p>
            <p>Date range: ${dates.length} days</p>
            <p>Regions: ${Object.values(regions).filter(r => r.units.length > 0).length}</p>
        </div>
    </div>
</body>
</html>`;
    
    // Save HTML file
    const htmlPath = path.join(__dirname, '../output/coal-stripes-visualisation.html');
    fs.writeFileSync(htmlPath, html);
    
    console.log(`✅ HTML file generated: ${htmlPath}`);
    console.log(`📝 Open this file in your browser to view the properly formatted output!`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

generateHtmlOutput();