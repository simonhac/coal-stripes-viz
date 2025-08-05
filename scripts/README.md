# Scripts

This directory contains utility scripts for testing and development.

## test-api-caching.js

A manual test script for verifying the capacity-factors API caching behavior.

### Usage

1. Start the development server:
   ```bash
   npm run dev
   ```

2. In another terminal, run the test:
   ```bash
   node scripts/test-api-caching.js
   ```

This script tests:
- Current year caching (1 hour cache)
- Previous year caching (1 week cache) 
- Future year handling (no cache)
- Independent caching for different years
- Response structure validation

The script provides detailed output showing request times and cache verification.