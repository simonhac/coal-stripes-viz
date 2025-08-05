const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Integration Tests',
  testMatch: [
    '**/*.integration.test.ts'
  ],
  testTimeout: 15000, // 15 seconds for API calls
  reporters: [
    'default',
    ['<rootDir>/jest-slow-test-reporter.js', { slowThreshold: 2000 }]
  ],
  forceExit: true // Force Jest to exit after tests complete
};