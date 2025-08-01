import { initializeRequestLogger, cleanupRequestLogger } from './request-logger';

// Initialize the request logger for tests
export function setupTestLogger(): void {
  // Use a test port number
  initializeRequestLogger(9999);
}

// Cleanup the request logger after tests
export function cleanupTestLogger(): void {
  cleanupRequestLogger();
}

// Helper to mock the request logger for tests that don't need real logging
export function mockRequestLogger(): void {
  jest.mock('../request-logger', () => ({
    initializeRequestLogger: jest.fn(),
    getRequestLogger: jest.fn(() => ({
      getNextRequestId: jest.fn(() => 'ID1'),
      log: jest.fn(),
      cleanOldLogs: jest.fn()
    }))
  }));
}