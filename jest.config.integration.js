const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Integration Tests',
  testMatch: [
    '**/coal-facilities.test.ts',
    '**/real-api-year.integration.test.ts',
    '**/future-dates-null.integration.test.ts'
  ],
  testTimeout: 30000, // 30 seconds for API calls
  reporters: [
    'default',
    ['<rootDir>/jest-slow-test-reporter.js', { slowThreshold: 2000 }]
  ]
};