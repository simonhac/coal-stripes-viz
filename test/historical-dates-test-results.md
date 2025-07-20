# OpenElectricity API Historical Date Range Test Results

## Summary of Findings

### 1. **The API DOES accept arbitrary historical date ranges**
- Successfully retrieved data from as far back as 2019
- All tested historical periods (2019, 2020, 2021, 2022) returned data
- Cross-year boundaries work without issues

### 2. **Date Range Limitations**
- **Maximum range for daily intervals: 365 days**
  - The 400-day test failed with error: "Date range too large for 1d interval. Maximum range is 365 days."
  - This is a hard limit enforced by the API
- No apparent limitation on how far back in history you can go (tested back to 2019)

### 3. **Data Availability and Quality**
- Historical data appears to be complete and consistent across all tested periods
- Data is available for coal facilities going back at least to 2019
- Some units show 0 MWh generation on certain days (likely maintenance or offline periods)

### 4. **API Behavior Observations**
- **Date ranges are exclusive of the end date**: The API returns data up to but not including the end date
  - Example: Requesting 2020-07-01 to 2020-07-30 returns data from 2020-06-30 to 2020-07-29
- **Response times are consistent**: All requests completed in 1-2 seconds regardless of date range
- **Data format is consistent** across all time periods

## Test Results Details

| Test Case | Date Range | Expected Days | Actual Days | Status | Notes |
|-----------|------------|---------------|-------------|---------|--------|
| 30 days from July 2020 | 2020-07-01 to 2020-07-30 | 30 | 30 | ✅ Success | Historical data available |
| 90 days from January 2021 | 2021-01-01 to 2021-03-31 | 90 | 90 | ✅ Success | Historical data available |
| 365 days from 2022 | 2022-01-01 to 2022-12-31 | 365 | 365 | ✅ Success | Maximum allowed range |
| Cross-year boundary | 2021-12-15 to 2022-01-15 | 32 | 32 | ✅ Success | Year boundaries handled correctly |
| Recent 30 days | 2025-06-19 to 2025-07-18 | 30 | 30 | ✅ Success | Current data for comparison |
| Very old data (2019) | 2019-01-01 to 2019-01-31 | 31 | 31 | ✅ Success | Data available from 2019 |
| Large range (400 days) | 2021-01-01 to 2022-02-04 | 400 | - | ❌ Failed | Exceeds 365-day limit |

## Implications for the Coal Stripes Visualization

1. **Historical Analysis is Fully Supported**
   - The application can display historical coal generation patterns from any period since at least 2019
   - Users can analyze year-over-year comparisons or specific historical events

2. **Implementation Considerations**
   - For ranges larger than 365 days, multiple API calls would be needed
   - The existing code's date adjustment (+1 day to end date) correctly handles the API's exclusive end date behavior
   - The 365-day limit aligns with the current implementation's maximum request size

3. **Potential Features**
   - Historical date picker allowing users to select any date range (up to 365 days)
   - Year-over-year comparison views
   - Historical trend analysis going back several years

## Code Example for Arbitrary Date Ranges

```typescript
// Example of requesting historical data
const historicalData = await client.getFacilityData('NEM', facilityCodes, ['energy'], {
  interval: '1d',
  dateStart: '2021-07-01',  // Any historical date
  dateEnd: '2022-07-01'     // Up to 365 days later (exclusive)
});
```

The API's support for arbitrary historical dates makes it suitable for comprehensive historical analysis of coal power generation patterns in Australia.