// Quick script to test unit sorting
require('dotenv').config({ path: '.env.local' });
const { CoalDataService } = require('./dist/lib/coal-data-service');
const { parseDate } = require('@internationalized/date');

async function testSorting() {
  const apiKey = process.env.OPENELECTRICITY_API_KEY;
  if (!apiKey) {
    console.error('OPENELECTRICITY_API_KEY not found');
    return;
  }

  const service = new CoalDataService(apiKey);
  
  console.log('Fetching 1 day of data to check sorting...');
  const result = await service.getCoalStripesDataRange(
    parseDate('2023-07-01'),
    parseDate('2023-07-01')
  );
  
  console.log('\nUnit sorting (first 10 units):');
  console.log('Network | Region | Facility | DUID');
  console.log('---------|---------|-----------|--------');
  
  result.units.slice(0, 10).forEach(unit => {
    const region = unit.region || 'N/A';
    console.log(`${unit.network.padEnd(8)} | ${region.padEnd(7)} | ${unit.facility_name.padEnd(11)} | ${unit.duid}`);
  });
  
  // Show a few from the end too
  console.log('\n...\n');
  console.log('Last 5 units:');
  result.units.slice(-5).forEach(unit => {
    const region = unit.region || 'N/A';
    console.log(`${unit.network.padEnd(8)} | ${region.padEnd(7)} | ${unit.facility_name.padEnd(11)} | ${unit.duid}`);
  });
  
  console.log(`\nTotal units: ${result.units.length}`);
  
  // Check sorting order
  let prevNetwork = '';
  let prevRegion = '';
  let prevFacility = '';
  let sortingIssues = [];
  
  result.units.forEach((unit, i) => {
    const currNetwork = unit.network;
    const currRegion = unit.region || '';
    const currFacility = unit.facility_name;
    
    // Check network order
    if (prevNetwork && currNetwork < prevNetwork) {
      sortingIssues.push(`Network order issue at index ${i}: ${prevNetwork} > ${currNetwork}`);
    }
    
    // Check region order within same network
    if (currNetwork === prevNetwork && prevRegion && currRegion < prevRegion) {
      sortingIssues.push(`Region order issue at index ${i}: ${prevRegion} > ${currRegion}`);
    }
    
    // Check facility order within same network and region
    if (currNetwork === prevNetwork && currRegion === prevRegion && prevFacility && currFacility < prevFacility) {
      sortingIssues.push(`Facility order issue at index ${i}: ${prevFacility} > ${currFacility}`);
    }
    
    prevNetwork = currNetwork;
    prevRegion = currRegion;
    prevFacility = currFacility;
  });
  
  if (sortingIssues.length === 0) {
    console.log('\n✅ Sorting order is correct!');
  } else {
    console.log('\n❌ Sorting issues found:');
    sortingIssues.forEach(issue => console.log(`  - ${issue}`));
  }
}

testSorting().catch(console.error);