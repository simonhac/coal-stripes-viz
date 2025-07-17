// Test script for the CoalDataService
import { CoalDataService, CoalDataUtils } from './coal-data-service';

// Load environment variables
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

async function testCoalDataService() {
  const apiKey = process.env.OPENELECTRICITY_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENELECTRICITY_API_KEY not found in environment variables');
    return;
  }
  
  console.log('🧪 Testing CoalDataService...\n');
  
  try {
    const service = new CoalDataService(apiKey);
    const data = await service.getCoalStripesData(70);
    
    console.log('\n📊 Service Test Results:');
    console.log(`   Total units: ${data.totalUnits}`);
    console.log(`   Date range: ${data.actualDateStart} to ${data.actualDateEnd}`);
    console.log(`   Days: ${data.actualDays}`);
    console.log(`   Last good day: ${data.lastGoodDay}`);
    console.log(`   Regions with data: ${Object.values(data.regions).filter(r => r.units.length > 0).length}`);
    
    // Test utility functions
    console.log('\n🔧 Testing utility functions:');
    console.log(`   Capacity factor (12000 MWh, 660 MW): ${CoalDataUtils.calculateCapacityFactor(12000, 660).toFixed(1)}%`);
    console.log(`   Shade character for 75%: ${CoalDataUtils.getShadeCharacter(75)}`);
    console.log(`   Date format: ${CoalDataUtils.formatDateAU('2025-07-15')}`);
    
    // Show sample data for first unit
    const firstRegion = Object.values(data.regions).find(r => r.units.length > 0);
    if (firstRegion && firstRegion.units.length > 0) {
      const sampleUnit = firstRegion.units[0];
      console.log(`\n🔍 Sample unit: ${sampleUnit.code} (${sampleUnit.facility_name})`);
      console.log(`   Capacity: ${sampleUnit.capacity} MW`);
      console.log(`   Fuel type: ${sampleUnit.fueltech}`);
      
      // Show last 5 days of data
      const lastDays = data.dates.slice(-5);
      console.log('   Last 5 days:');
      lastDays.forEach(date => {
        const energy = sampleUnit.data[date] || 0;
        const cf = CoalDataUtils.calculateCapacityFactor(energy, sampleUnit.capacity);
        const char = CoalDataUtils.getShadeCharacter(cf);
        console.log(`     ${date}: ${energy.toFixed(0).padStart(5)} MWh → ${cf.toFixed(1).padStart(5)}% ${char}`);
      });
    }
    
    console.log('\n✅ Service test completed successfully!');
    
  } catch (error) {
    console.error('❌ Service test failed:', error);
  }
}

// Run the test
testCoalDataService();