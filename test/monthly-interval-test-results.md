# OpenElectricity API Monthly Interval Test Results

**Date:** July 19, 2025  
**Test Subject:** Monthly data interval support in OpenElectricity API  
**Test Facility:** ERARING (NSW coal facility with 4 units)

## Summary

✅ **Monthly intervals ARE supported** by the OpenElectricity API using the `"1M"` parameter.

## Key Findings

### 1. Working Monthly Interval
- **Parameter:** `interval: "1M"`
- **Status:** ✅ Fully functional
- **Data Structure:** Returns monthly aggregated energy data per unit

### 2. Date Range Limitations
- **Maximum range:** 730 days (~2 years)
- **Optimal range:** 365-729 days for best performance
- **Error for larger ranges:** "Date range too large for 1M interval. Maximum range is 730 days."

### 3. Performance Improvements
- **API Response Time:** 55.1% faster than daily data (823ms vs 1834ms)
- **Data Volume:** 96.7% reduction in data points (48 vs 1456 for 1 year)
- **Energy Accuracy:** 99.78% accuracy compared to daily totals (0.22% difference)

### 4. Data Format
- Returns one data point per unit per month
- Example: ERARING has 4 units (ER01-ER04), so 12 months = 48 data points
- Each data point contains monthly aggregated energy (MWh)
- Maintains unit-level granularity while aggregating time

### 5. Failed Intervals
All other tested monthly variants failed:
- `"monthly"`, `"1m"`, `"M"`, `"m"`, `"1mo"`, `"month"`, `"30d"`, `"1month"`
- Error: "API request failed: Unprocessable Entity"

## Data Quality Analysis

### Energy Comparison (2023 test period)
- **Monthly total:** 14,849.7 GWh
- **Daily total:** 14,816.7 GWh  
- **Difference:** 33.0 GWh (0.22%)
- **Assessment:** ✅ Excellent accuracy for trend analysis

### Sample Monthly Data (January 2023)
```
Unit ER01: 223.5 GWh
Unit ER02: 344.0 GWh  
Unit ER03: 246.6 GWh
Unit ER04: 192.2 GWh
Total: 1,006.3 GWh
```

## Recommendations for Implementation

### 1. Use Cases for Monthly Data (`"1M"`)
✅ **Ideal for:**
- Initial page loads (quick preview)
- Long-term trend visualization (>6 months)
- Multi-year analysis (up to 2 years)
- Overview dashboards
- Mobile/low-bandwidth scenarios

❌ **Not suitable for:**
- Detailed day-by-day analysis
- Short-term patterns (<3 months)
- Real-time monitoring
- Date ranges >730 days

### 2. Implementation Strategy

#### Option A: Smart Interval Selection
```typescript
function getOptimalInterval(requestDays: number): string {
  if (requestDays > 365) {
    // Long-term analysis - use monthly for overview
    return '1M';
  } else if (requestDays > 90) {
    // Medium-term - could use either based on user preference
    return '1d'; // or allow user to choose
  } else {
    // Short-term - always use daily
    return '1d';
  }
}
```

#### Option B: Two-Tier Approach
1. **Preview Mode:** Load monthly data first for instant preview
2. **Detail Mode:** Load daily data on demand for detailed analysis

#### Option C: Progressive Enhancement
1. Show monthly data immediately (fast loading)
2. Offer "Load Daily Detail" button for specific time periods
3. Cache both monthly and daily data separately

### 3. Technical Implementation

#### Update coal-data-service.ts
```typescript
// Add interval parameter to fetchBatchedData method
async fetchBatchedData(
  network: 'NEM' | 'WEM',
  facilityCodes: string[],
  dateStart: string,
  dateEnd: string,
  batchSize: number,
  allData: OpenElectricityDataRow[],
  interval: string = '1d' // Add interval parameter
) {
  // ... existing code ...
  
  const batchData = await this.client.getFacilityData(network, batch, ['energy'], {
    interval: interval, // Use provided interval
    dateStart,
    dateEnd: adjustedDateEnd
  });
  
  // ... rest of method
}

// Add method for monthly data
async getCoalStripesMonthlyData(requestDays: number = 365): Promise<CoalStripesData> {
  // Similar to getCoalStripesData but with interval: '1M'
  // Handle the 730-day limit
  const maxDays = Math.min(requestDays, 730);
  
  // ... implementation using '1M' interval
}
```

### 4. User Experience Enhancements

#### Fast Loading Strategy
1. Load monthly preview (< 1 second)
2. Show "Loading daily details..." progress
3. Replace with daily data when available

#### Responsive Design
- Mobile: Default to monthly for performance
- Desktop: Offer interval selection toggle
- Auto-select based on screen size and connection

## Limitations and Considerations

### 1. API Limitations
- 730-day maximum range for monthly data
- Only `"1M"` parameter works (no alternatives)
- Monthly data still returns per-unit granularity

### 2. Data Processing
- Monthly data structure is similar to daily (same fields)
- Need to handle different data point counts in visualization
- Date parsing remains the same (ISO date strings)

### 3. Edge Cases
- Some units may have 0 MWh for certain months (maintenance)
- Partial months at range boundaries
- Time zone considerations (already handled in current code)

## Conclusion

The OpenElectricity API's monthly interval support provides an excellent opportunity to:

1. **Dramatically improve initial load times** (55% faster)
2. **Reduce bandwidth usage** (97% less data)
3. **Maintain high accuracy** (99.8% energy total accuracy)
4. **Enable better mobile experience**
5. **Support multi-year trend analysis**

**Recommendation:** Implement a dual-mode approach where monthly data provides instant previews and daily data offers detailed analysis on demand. This would significantly improve user experience while maintaining analytical capabilities.

## Test Files
- `/test/monthly-interval-test.js` - Initial comprehensive testing
- `/test/monthly-interval-followup.js` - Detailed analysis with performance comparison
- `/test/monthly-interval-test-results.md` - This summary report