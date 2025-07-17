// Test production-ready batching strategy with retry logic and beautiful logging
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const { OpenElectricityClient } = require('openelectricity');
const fs = require('fs');

const apiKey = process.env.OPENELECTRICITY_API_KEY;
const BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '../output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Utility functions for logging
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatNumber(num) {
  return num.toLocaleString();
}

function formatTimestamp() {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

function logSection(title, width = 80) {
  const padding = Math.max(0, width - title.length - 4);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return `${'='.repeat(leftPad)} ${title} ${'='.repeat(rightPad)}`;
}

// Sleep utility for retries
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper function
async function withRetry(operation, operationName, maxRetries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      console.log(`❌ ${operationName} failed on attempt ${attempt}: ${error.message}`);
      
      if (attempt < maxRetries) {
        const delay = RETRY_DELAY * attempt; // Exponential backoff
        console.log(`⏳ Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  throw new Error(`${operationName} failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
}

async function testProductionStrategy() {
  console.log(logSection('COAL STRIPES DATA FETCHING TEST', 80));
  console.log(`Started at: ${formatTimestamp()}`);
  console.log(`Batch size: ${BATCH_SIZE} facilities`);
  console.log(`Max retries: ${MAX_RETRIES}`);
  console.log();
  
  const testStart = Date.now();
  const logEntries = [];
  
  function addLogEntry(entry) {
    logEntries.push({ ...entry, timestamp: formatTimestamp() });
    console.log(`${entry.emoji} ${entry.message}`);
  }
  
  try {
    const client = new OpenElectricityClient({ apiKey });
    
    // Step 1: Get facilities list
    console.log(logSection('STEP 1: FACILITIES LIST'));
    addLogEntry({ emoji: '📋', message: 'Fetching facilities list...' });
    
    const facilitiesStart = Date.now();
    const facilities = await withRetry(
      () => client.getFacilities({ network: 'NEM' }),
      'Get facilities list'
    );
    const facilitiesDuration = Date.now() - facilitiesStart;
    
    const coalFacilities = facilities.response.data.filter(f => 
      f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
    );
    
    addLogEntry({ 
      emoji: '✅', 
      message: `Found ${coalFacilities.length} coal facilities in ${formatDuration(facilitiesDuration)}`,
      duration: facilitiesDuration,
      type: 'facilities'
    });
    
    // Analyze facilities
    const totalUnits = coalFacilities.reduce((sum, f) => 
      sum + f.units.filter(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown').length, 0
    );
    
    const operatingUnits = coalFacilities.reduce((sum, f) => 
      sum + f.units.filter(u => (u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown') && u.status_id === 'operating').length, 0
    );
    
    addLogEntry({ 
      emoji: '📊', 
      message: `Total units: ${totalUnits} (${operatingUnits} operating, ${totalUnits - operatingUnits} retired)` 
    });
    
    // Create batches
    const coalFacilityCodes = coalFacilities.map(f => f.code);
    const batches = [];
    for (let i = 0; i < coalFacilityCodes.length; i += BATCH_SIZE) {
      batches.push(coalFacilityCodes.slice(i, i + BATCH_SIZE));
    }
    
    addLogEntry({ 
      emoji: '📦', 
      message: `Created ${batches.length} batches of ${BATCH_SIZE} facilities each` 
    });
    
    console.log();
    console.log(logSection('STEP 2: DATA FETCHING'));
    
    // Step 2: Fetch data for each batch
    let allData = [];
    let totalDataRows = 0;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNum = i + 1;
      
      addLogEntry({ 
        emoji: '🔄', 
        message: `Batch ${batchNum}/${batches.length}: Fetching ${batch.length} facilities...` 
      });
      
      const batchStart = Date.now();
      
      try {
        const batchData = await withRetry(
          () => client.getFacilityData('NEM', batch, ['energy'], {
            interval: '1d',
            dateStart: '2024-01-01',
            dateEnd: '2024-12-31'
          }),
          `Batch ${batchNum} data fetch`
        );
        
        const batchDuration = Date.now() - batchStart;
        const batchRows = batchData.datatable?.rows?.length || 0;
        const batchUnits = [...new Set(batchData.datatable?.rows?.map(r => r.unit_code) || [])];
        const batchFacilities = [...new Set(batchData.datatable?.rows?.map(r => r.facility_code).filter(Boolean) || [])];
        
        totalDataRows += batchRows;
        allData.push(...(batchData.datatable?.rows || []));
        
        addLogEntry({ 
          emoji: '✅', 
          message: `Batch ${batchNum}: ${formatNumber(batchRows)} rows, ${batchUnits.length} units, ${batchFacilities.length} facilities in ${formatDuration(batchDuration)}`,
          duration: batchDuration,
          type: 'batch',
          batchNum,
          rows: batchRows,
          units: batchUnits.length,
          facilities: batchFacilities.length
        });
        
        // Log facility details for this batch
        console.log(`    Facilities: ${batch.join(', ')}`);
        console.log(`    Units found: ${batchUnits.join(', ')}`);
        console.log();
        
      } catch (error) {
        addLogEntry({ 
          emoji: '❌', 
          message: `Batch ${batchNum} FAILED: ${error.message}`,
          error: error.message,
          type: 'batch_error',
          batchNum
        });
        throw error;
      }
    }
    
    console.log(logSection('STEP 3: DATA ANALYSIS'));
    
    // Analyze combined data
    const totalTestDuration = Date.now() - testStart;
    const uniqueUnits = [...new Set(allData.map(r => r.unit_code))];
    const uniqueFacilities = [...new Set(allData.map(r => r.facility_code).filter(Boolean))];
    const dateRange = allData.length > 0 ? {
      min: new Date(Math.min(...allData.map(r => r.interval))).toISOString().split('T')[0],
      max: new Date(Math.max(...allData.map(r => r.interval))).toISOString().split('T')[0]
    } : null;
    
    addLogEntry({ 
      emoji: '🎉', 
      message: `SUCCESS! Retrieved ${formatNumber(totalDataRows)} rows in ${formatDuration(totalTestDuration)}` 
    });
    
    addLogEntry({ 
      emoji: '📈', 
      message: `Data coverage: ${uniqueUnits.length} units, ${uniqueFacilities.length} facilities` 
    });
    
    if (dateRange) {
      addLogEntry({ 
        emoji: '📅', 
        message: `Date range: ${dateRange.min} to ${dateRange.max}` 
      });
    }
    
    // Performance metrics
    const avgBatchTime = logEntries
      .filter(e => e.type === 'batch')
      .reduce((sum, e) => sum + e.duration, 0) / batches.length;
    
    addLogEntry({ 
      emoji: '⚡', 
      message: `Average batch time: ${formatDuration(avgBatchTime)}` 
    });
    
    // Sample data
    console.log();
    console.log(logSection('SAMPLE DATA'));
    if (allData.length > 0) {
      console.log('Sample records:');
      allData.slice(0, 5).forEach(row => {
        console.log(`  ${row.interval?.toISOString()?.split('T')[0]} | ${row.unit_code} | ${row.energy?.toFixed(1)} MWh`);
      });
    }
    
    // Summary statistics
    console.log();
    console.log(logSection('SUMMARY'));
    console.log(`✅ Total API calls: ${batches.length + 1}`);
    console.log(`✅ Total duration: ${formatDuration(totalTestDuration)}`);
    console.log(`✅ Success rate: 100%`);
    console.log(`✅ Data rows: ${formatNumber(totalDataRows)}`);
    console.log(`✅ Units: ${uniqueUnits.length}`);
    console.log(`✅ Facilities: ${uniqueFacilities.length}`);
    
    // Generate detailed log file
    const logData = {
      test_info: {
        timestamp: formatTimestamp(),
        batch_size: BATCH_SIZE,
        max_retries: MAX_RETRIES,
        total_duration: totalTestDuration,
        total_api_calls: batches.length + 1
      },
      results: {
        total_rows: totalDataRows,
        unique_units: uniqueUnits.length,
        unique_facilities: uniqueFacilities.length,
        date_range: dateRange,
        success_rate: '100%'
      },
      performance: {
        average_batch_time: avgBatchTime,
        total_facilities: coalFacilities.length,
        total_units: totalUnits,
        operating_units: operatingUnits
      },
      batches: logEntries.filter(e => e.type === 'batch'),
      facilities: coalFacilities.map(f => ({
        code: f.code,
        name: f.name,
        region: f.network_region,
        units: f.units.filter(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown').map(u => ({
          code: u.code,
          fueltech: u.fueltech_id,
          capacity: u.capacity_registered,
          status: u.status_id
        }))
      })),
      log_entries: logEntries
    };
    
    const logFilePath = path.join(outputDir, `coal-stripes-test-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));
    
    console.log();
    console.log(`📝 Detailed log saved to: ${logFilePath}`);
    
    // Generate human-readable summary
    const summaryPath = path.join(outputDir, `coal-stripes-summary-${new Date().toISOString().split('T')[0]}.md`);
    const summaryContent = `# Coal Stripes Data Fetching Test Results

## Test Configuration
- **Date**: ${formatTimestamp()}
- **Batch Size**: ${BATCH_SIZE} facilities per call
- **Max Retries**: ${MAX_RETRIES}
- **Total Duration**: ${formatDuration(totalTestDuration)}

## Results
- **Total API Calls**: ${batches.length + 1}
- **Total Data Rows**: ${formatNumber(totalDataRows)}
- **Unique Units**: ${uniqueUnits.length}
- **Unique Facilities**: ${uniqueFacilities.length}
- **Date Range**: ${dateRange?.min || 'N/A'} to ${dateRange?.max || 'N/A'}
- **Success Rate**: 100%

## Performance Metrics
- **Average Batch Time**: ${formatDuration(avgBatchTime)}
- **Total Facilities**: ${coalFacilities.length}
- **Total Units**: ${totalUnits} (${operatingUnits} operating, ${totalUnits - operatingUnits} retired)

## Batch Performance
${logEntries.filter(e => e.type === 'batch').map(e => 
  `- **Batch ${e.batchNum}**: ${formatNumber(e.rows)} rows, ${e.units} units, ${e.facilities} facilities in ${formatDuration(e.duration)}`
).join('\n')}

## Facilities by Region
${Object.entries(coalFacilities.reduce((acc, f) => {
  acc[f.network_region] = acc[f.network_region] || [];
  acc[f.network_region].push(f);
  return acc;
}, {})).map(([region, facilities]) => {
  const totalUnits = facilities.reduce((sum, f) => 
    sum + f.units.filter(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown').length, 0
  );
  return `- **${region}**: ${facilities.length} facilities, ${totalUnits} units`;
}).join('\n')}

## Sample Data
${allData.slice(0, 5).map(row => 
  `- ${row.interval?.toISOString()?.split('T')[0]} | ${row.unit_code} | ${row.energy?.toFixed(1)} MWh`
).join('\n')}

---
*Generated by coal-stripes-viz test suite*
`;
    
    fs.writeFileSync(summaryPath, summaryContent);
    console.log(`📋 Summary report saved to: ${summaryPath}`);
    
    console.log();
    console.log(logSection('TEST COMPLETE', 80));
    
  } catch (error) {
    console.error();
    console.error(logSection('TEST FAILED', 80));
    console.error(`❌ Error: ${error.message}`);
    
    // Save error log
    const errorLogPath = path.join(outputDir, `coal-stripes-error-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(errorLogPath, JSON.stringify({
      error: error.message,
      timestamp: formatTimestamp(),
      log_entries: logEntries
    }, null, 2));
    
    console.error(`📝 Error log saved to: ${errorLogPath}`);
  }
}

testProductionStrategy();