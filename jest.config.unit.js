const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Unit Tests',
  testPathIgnorePatterns: [
    '/node_modules/',
    'coal-facilities\\.test\\.ts$',
    'real-api-year\\.integration\\.test\\.ts$',
    'future-dates-null\\.integration\\.test\\.ts$'
  ],
  testTimeout: 30000 // 30 seconds for unit tests
};