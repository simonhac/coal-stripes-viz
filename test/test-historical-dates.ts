import { OpenElectricityClient } from 'openelectricity';
import { CalendarDate, parseDate } from '@internationalized/date';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const API_KEY = process.env.OPENELECTRICITY_API_KEY;

if (!API_KEY) {
  console.error('❌ Missing OPENELECTRICITY_API_KEY environment variable');
  process.exit(1);
}

interface TestCase {
  name: string;
  startDate: string;
  endDate: string;
  expectedDays: number;
}

async function testDateRange(client: OpenElectricityClient, testCase: TestCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`📅 Date range: ${testCase.startDate} to ${testCase.endDate} (${testCase.expectedDays} days)`);
  
  try {
    // Get facilities first
    const facilities = await client.getFacilities();
    const coalFacilities = facilities.response.data.filter(f => 
      f.units.some(u => u.fueltech_id === 'coal_black' || u.fueltech_id === 'coal_brown')
    );
    
    // Get a few sample facilities for testing (to avoid hitting rate limits)
    const sampleFacilities = coalFacilities.slice(0, 3);
    const facilityCodes = sampleFacilities.map(f => f.code);
    
    console.log(`🏭 Testing with ${facilityCodes.length} facilities: ${facilityCodes.join(', ')}`);
    
    // Adjust end date by +1 day as per the API's exclusive end date behavior
    const adjustedEndDate = parseDate(testCase.endDate).add({ days: 1 }).toString();
    
    // Try to fetch data
    const startTime = Date.now();
    const response = await client.getFacilityData('NEM', facilityCodes, ['energy'], {
      interval: '1d',
      dateStart: testCase.startDate,
      dateEnd: adjustedEndDate
    });
    const endTime = Date.now();
    
    const data = (response.datatable as any)?.rows || [];
    console.log(`✅ API request successful (${endTime - startTime}ms)`);
    console.log(`📊 Data points returned: ${data.length}`);
    
    // Analyze the data
    if (data.length > 0) {
      // Get unique dates
      const uniqueDates = new Set<string>();
      data.forEach((row: any) => {
        const date = new Date(row.interval);
        uniqueDates.add(date.toISOString().split('T')[0]);
      });
      
      const sortedDates = Array.from(uniqueDates).sort();
      console.log(`📅 Actual date range in data: ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`);
      console.log(`📊 Unique days with data: ${uniqueDates.size}`);
      
      // Sample some data points
      console.log(`🔍 Sample data points:`);
      data.slice(0, 3).forEach((row: any) => {
        console.log(`   - ${row.unit_code}: ${new Date(row.interval).toISOString().split('T')[0]} = ${row.energy} MWh`);
      });
    }
    
  } catch (error) {
    console.log(`❌ API request failed: ${error instanceof Error ? error.message : String(error)}`);
    
    // Check if it's a specific error about date ranges
    if (error instanceof Error) {
      if (error.message.includes('date range')) {
        console.log(`⚠️  Date range limitation detected`);
      } else if (error.message.includes('No data found')) {
        console.log(`⚠️  No data available for this date range`);
      }
    }
  }
}

async function runTests() {
  console.log('🚀 OpenElectricity API Historical Date Range Test');
  console.log('================================================');
  
  const client = new OpenElectricityClient({ apiKey: API_KEY });
  
  const testCases: TestCase[] = [
    {
      name: '30 days from July 2020',
      startDate: '2020-07-01',
      endDate: '2020-07-30',
      expectedDays: 30
    },
    {
      name: '90 days from January 2021',
      startDate: '2021-01-01',
      endDate: '2021-03-31',
      expectedDays: 90
    },
    {
      name: '365 days from 2022',
      startDate: '2022-01-01',
      endDate: '2022-12-31',
      expectedDays: 365
    },
    {
      name: 'Cross-year boundary (Dec 2021 - Jan 2022)',
      startDate: '2021-12-15',
      endDate: '2022-01-15',
      expectedDays: 32
    },
    {
      name: 'Recent 30 days (for comparison)',
      startDate: '2025-06-19',
      endDate: '2025-07-18',
      expectedDays: 30
    },
    {
      name: 'Very old data (2019)',
      startDate: '2019-01-01',
      endDate: '2019-01-31',
      expectedDays: 31
    },
    {
      name: 'Large range test (400 days)',
      startDate: '2021-01-01',
      endDate: '2022-02-04',
      expectedDays: 400
    }
  ];
  
  for (const testCase of testCases) {
    await testDateRange(client, testCase);
    // Add a small delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n\n📋 Summary');
  console.log('==========');
  console.log('The test results above show:');
  console.log('1. Whether the API accepts arbitrary historical date ranges');
  console.log('2. Any limitations on date range size or historical depth');
  console.log('3. The actual data availability for different time periods');
}

// Run the tests
runTests().catch(console.error);