import { CoalDataService } from '../coal-data-service';
import { parseDate, today } from '@internationalized/date';

describe('Null vs Zero Data Handling', () => {
  let service: CoalDataService;
  
  beforeAll(() => {
    const apiKey = process.env.OPENELECTRICITY_API_KEY;
    if (!apiKey) {
      throw new Error('OPENELECTRICITY_API_KEY environment variable is required');
    }
    service = new CoalDataService(apiKey);
  });

  test('should return null for today (partial data) and all future dates', async () => {
    console.log('\n🔮 Testing partial and future date handling...');
    
    // Get today's date in Australian timezone
    const todayAEST = today('Australia/Brisbane');
    const currentYear = todayAEST.year;
    const todayStr = todayAEST.toString();
    
    console.log(`📅 Today in AEST: ${todayStr}`);
    
    // Fetch data for current year
    const startDate = parseDate(`${currentYear}-01-01`);
    const endDate = parseDate(`${currentYear}-12-31`);
    
    console.log(`📅 Fetching ${currentYear} data...`);
    
    const result = await service.getCoalStripesDataRange(startDate, endDate);
    
    console.log(`✅ Fetched data with ${result.data.length} units`);
    
    // Pick a sample unit to check
    const sampleUnit = result.data[0];
    
    if (!sampleUnit) {
      throw new Error('No units found in result');
    }
    
    console.log(`\n🔍 Checking unit: ${sampleUnit.duid} (${sampleUnit.facility_name})`);
    console.log(`📅 Data range: ${sampleUnit.history.start} to ${sampleUnit.history.last}`);
    
    // Calculate the index for today's data in the array
    const yearStart = parseDate(sampleUnit.history.start);
    const todayIndex = todayAEST.compare(yearStart);
    
    // Check today's value - should be null (partial data)
    if (todayIndex >= 0 && todayIndex < sampleUnit.history.data.length) {
      const todayValue = sampleUnit.history.data[todayIndex];
      console.log(`📅 Today (${todayStr}): ${todayValue} (should be null - partial data)`);
      expect(todayValue).toBeNull();
    } else {
      console.log(`⚠️  Today's date not in result (OK if test runs early in the day)`);
    }
    
    // Check all future dates - should all be null
    let checkedDates = 0;
    let nullCount = 0;
    let nonNullCount = 0;
    let firstNonNull: string | null = null;
    
    console.log(`\n🔍 Checking future dates from tomorrow onwards...`);
    
    // Check remaining days in the year after today
    for (let i = todayIndex + 1; i < sampleUnit.history.data.length; i++) {
      checkedDates++;
      const value = sampleUnit.history.data[i];
      
      if (value === null) {
        nullCount++;
      } else {
        nonNullCount++;
        if (!firstNonNull) {
          const futureDate = yearStart.add({ days: i });
          firstNonNull = `${futureDate.toString()}: ${value}`;
        }
      }
    }
    
    console.log(`📊 Future dates check:`);
    console.log(`   • Checked ${checkedDates} future dates`);
    console.log(`   • ${nullCount} are null (correct)`);
    console.log(`   • ${nonNullCount} have non-null values (incorrect)`);
    
    if (firstNonNull) {
      console.log(`   • First non-null: ${firstNonNull}`);
    }
    
    // All future dates should be null
    expect(nonNullCount).toBe(0);
    
    // Also verify we can distinguish between null and 0
    // Check a date from earlier in the year that should have real data
    const pastDate = parseDate(`${currentYear}-01-15`);
    const pastIndex = pastDate.compare(yearStart);
    
    if (pastDate.compare(todayAEST) < 0 && pastIndex >= 0 && pastIndex < sampleUnit.history.data.length) {
      const pastValue = sampleUnit.history.data[pastIndex];
      console.log(`\n🔍 Historical data check (${pastDate}): ${pastValue}`);
      
      // Historical data should be a number (could be 0 if plant was offline)
      expect(pastValue).not.toBeNull();
      expect(typeof pastValue).toBe('number');
    }
    
    console.log('\n✅ Null handling test complete!');
  }, 30000);
});