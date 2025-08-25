#!/usr/bin/env node

/**
 * Fetches energy data from OpenElectricity API
 * Saves both raw and processed versions
 */

const fs = require('fs').promises;
const path = require('path');

const API_URL = 'https://openelectricity.org.au/api/energy?region=_all';
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const RAW_FILE = path.join(OUTPUT_DIR, 'raw.json');
const PROCESSED_FILE = path.join(OUTPUT_DIR, 'processed.json');

async function fetchEnergyData() {
  console.log('📡 Fetching energy data from OpenElectricity API...');
  
  try {
    const response = await fetch(API_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Data fetched successfully');
    
    return data;
  } catch (error) {
    console.error('❌ Error fetching data:', error.message);
    throw error;
  }
}

async function saveRawData(data) {
  console.log('💾 Saving raw data...');
  
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(RAW_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ Raw data saved to ${RAW_FILE}`);
  } catch (error) {
    console.error('❌ Error saving raw data:', error.message);
    throw error;
  }
}

function processData(rawData) {
  console.log('🔧 Processing data...');
  
  const processed = {
    metadata: {
      fetched_at: new Date().toISOString(),
      source: API_URL,
      regions: []
    },
    data: {}
  };
  
  // Process each region's data
  if (rawData.data) {
    for (const [region, regionData] of Object.entries(rawData.data)) {
      processed.metadata.regions.push(region);
      
      // Ensure data arrays contain values, not objects
      if (regionData && typeof regionData === 'object') {
        processed.data[region] = {};
        
        for (const [key, value] of Object.entries(regionData)) {
          if (Array.isArray(value)) {
            // If array contains objects, extract values
            if (value.length > 0 && typeof value[0] === 'object') {
              // Extract numeric values from objects
              processed.data[region][key] = value.map(item => {
                // If item has a 'value' property, use it
                if (item.hasOwnProperty('value')) {
                  return item.value;
                }
                // Otherwise, if it's a single-property object, extract that value
                const keys = Object.keys(item);
                if (keys.length === 1) {
                  return item[keys[0]];
                }
                // For complex objects, return as-is
                return item;
              });
            } else {
              // Already an array of values
              processed.data[region][key] = value;
            }
          } else {
            // Non-array data, keep as-is
            processed.data[region][key] = value;
          }
        }
      }
    }
  }
  
  // Copy over any other top-level metadata from raw data
  if (rawData.metadata) {
    processed.metadata = { ...processed.metadata, ...rawData.metadata };
  }
  
  console.log(`✅ Processed ${processed.metadata.regions.length} regions`);
  
  return processed;
}

async function saveProcessedData(data) {
  console.log('💾 Saving processed data...');
  
  try {
    await fs.writeFile(PROCESSED_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ Processed data saved to ${PROCESSED_FILE}`);
    
    // Print summary
    const stats = await fs.stat(PROCESSED_FILE);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    if (data.metadata && data.metadata.regions) {
      console.log(`📍 Regions: ${data.metadata.regions.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ Error saving processed data:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting OpenElectricity energy data fetch\n');
  
  try {
    // Fetch data from API
    const rawData = await fetchEnergyData();
    
    // Save raw data
    await saveRawData(rawData);
    
    // Process data
    const processedData = processData(rawData);
    
    // Save processed data
    await saveProcessedData(processedData);
    
    console.log('\n✨ Complete! Data fetched and processed successfully.');
  } catch (error) {
    console.error('\n💥 Failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fetchEnergyData, processData };