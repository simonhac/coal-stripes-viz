const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Unit Tests',
  testPathIgnorePatterns: [
    '/node_modules/',
    'coal-facilities\\.test\\.ts$',
    'real-api-year\\.integration\\.test\\.ts$',
    'future-dates-null\\.integration\\.test\\.ts$',
    'unit-sorting\\.integration\\.test\\.ts$',
    '\\.performance\\.test\\.ts$'
  ],
  testTimeout: 5000 // 5 seconds for unit tests
};