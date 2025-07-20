# OpenElectricity API Future Dates Test Results

**Test Date:** 2025-07-20

## Summary

The OpenElectricity API has interesting behavior when requesting future dates:

1. **API Returns Historical Data**: When requesting data for 2025 (which is the current year), the API returns data up to the current date (July 20, 2025), but not beyond.

2. **No True Future Data**: The API does not provide any data for dates after "today" (the current date).

3. **No Errors for Future Requests**: The API does not throw errors when requesting future date ranges. Instead:
   - For date ranges that include both past and future dates, it returns only the available historical data
   - For date ranges entirely in the future, it returns a 416 "Range Not Satisfiable" error

## Test Results

### Test 1: Full Year 2025 (2025-01-01 to 2025-12-31)
- **Result**: Success (200 OK)
- **Data Returned**: 808 rows
- **Date Range in Response**: 2024-12-31 to 2025-07-20 (today)
- **Note**: API returns data up to today, ignoring the future portion of the request

### Test 2: Near Future (next 30 days from today)
- **Request**: 2025-07-20 to 2025-08-19
- **Result**: Success (200 OK)
- **Data Returned**: 8 rows
- **Actual Data**: Only for 2025-07-19 and 2025-07-20
- **Note**: Returns only today's and yesterday's data, no future data

### Test 3: Mixed Range (30 days ago to 30 days future)
- **Request**: 2025-06-20 to 2025-08-19
- **Result**: Success (200 OK)
- **Data Returned**: 128 rows
- **Future Dates Returned**: 0
- **Note**: Returns only historical data, stops at today

### Test 4: Tomorrow Only
- **Request**: 2025-07-21 to 2025-07-21
- **Result**: Error (416 Range Not Satisfiable)
- **Message**: "No data found for the requested parameters"
- **Note**: Pure future dates result in an error

### Test 5: Different Intervals

#### 5a) 5-minute interval for tomorrow
- **Result**: Error (416 Range Not Satisfiable)
- **Note**: Same behavior regardless of interval type

#### 5b) Monthly interval for 2025
- **Result**: Success (200 OK)
- **Data Returned**: 28 rows (7 complete months × 4 units)
- **Months Covered**: January through June 2025 (complete months only)
- **Note**: Monthly aggregates are available for completed months

## Key Findings

1. **Graceful Handling**: The API gracefully handles future date requests by returning available data up to the current date.

2. **No Predictive Data**: The API does not provide any predictive or forecast data for future dates.

3. **Partial Data for Today**: The current day's data appears to be partial/incomplete, which is why the coal-stripes-viz application filters out today's data.

4. **Date Range Behavior**:
   - Mixed past/future ranges: Returns only the past portion
   - Pure future ranges: Returns 416 error
   - Past ranges extending to future: Truncates at current date

5. **Interval Impact**: The behavior is consistent across different intervals (daily, 5-minute, monthly), though monthly data is only available for complete months.

## Implications for coal-stripes-viz

1. **Current Implementation is Correct**: The existing code that filters out today's data and handles date ranges appropriately is working as expected.

2. **No Special Handling Needed**: The API's graceful handling means no special error handling is needed for future dates in requests.

3. **Cache Strategy**: The year-based caching strategy is appropriate since:
   - Historical data doesn't change
   - Future data isn't available anyway
   - Current year data can be refreshed to get updates up to the current date