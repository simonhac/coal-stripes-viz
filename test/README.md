# Coal Stripes API Tests

This directory contains comprehensive tests for the OpenElectricity API integration used in the coal stripes visualisation.

## Test Files

### 🎯 **Main Production Test**
- **`test-production-strategy.js`** - Production-ready batching strategy with retry logic and beautiful logging
  - Tests 20 facilities per batch
  - Includes comprehensive error handling
  - Generates detailed logs in `/output/` directory
  - **Run this to validate the production API strategy**

### 🔬 **API Exploration Tests**
- **`test-api-client.js`** - Basic API client functionality test
- **`test-historical-data.js`** - Tests 365 days of historical data access
- **`test-facility-data.js`** - Tests individual facility data retrieval
- **`test-massive-call.js`** - Tests single massive API call (fails at 32 facilities)
- **`test-api-limits.js`** - Tests API batch size limits (max 30 facilities)

### 📊 **Analysis Scripts**
- **`analyze-api-calls.js`** - Analyzes optimal API call strategies
- **`test-api.js`** - Basic API health check and exploration

## Running Tests

### Prerequisites
```bash
npm install
```

Make sure your API key is set in `.env.local`:
```
OPENELECTRICITY_API_KEY=your_api_key_here
```

### Run Production Test
```bash
node test/test-production-strategy.js
```

This will:
- Test the production-ready batching strategy
- Generate detailed logs in `/output/`
- Validate 365 days of data for all coal units
- Show performance metrics and retry handling

### Run Individual Tests
```bash
# Test basic API functionality
node test/test-api-client.js

# Test historical data access
node test/test-historical-data.js

# Test facility-specific data
node test/test-facility-data.js

# Analyze API call strategies
node test/analyze-api-calls.js
```

## Test Results

The production test generates:
- **JSON log**: `/output/coal-stripes-test-YYYY-MM-DD.json`
- **Summary report**: `/output/coal-stripes-summary-YYYY-MM-DD.md`

## Key Findings

- **Optimal batch size**: 20 facilities per call
- **Total API calls needed**: 3 (1 facilities + 2 batches)
- **Total load time**: ~5 seconds
- **Data coverage**: 44 operating coal units, 365 days each
- **Success rate**: 100% with retry logic

## API Strategy

The production strategy uses:
1. **Conservative batching**: 20 facilities per call (well under 30-facility limit)
2. **Retry logic**: 3 attempts with exponential backoff
3. **Comprehensive logging**: Every step tracked and timed
4. **Error handling**: Graceful failures with detailed error logs

This provides the optimal balance of performance, reliability, and maintainability for the coal stripes visualisation.