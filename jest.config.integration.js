const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Integration Tests',
  testMatch: [
    '**/coal-facilities.test.ts',
    '**/real-api-year.integration.test.ts',
    '**/future-dates-null.integration.test.ts',
    '**/unit-sorting.integration.test.ts'
  ],
  testTimeout: 15000, // 15 seconds for API calls
  reporters: [
    'default',
    ['<rootDir>/jest-slow-test-reporter.js', { slowThreshold: 2000 }]
  ],
  forceExit: true // Force Jest to exit after tests complete
};