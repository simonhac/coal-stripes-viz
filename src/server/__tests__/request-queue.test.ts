import { RequestQueue } from '../request-queue';
import { initializeRequestLogger } from '../request-logger';
import * as fs from 'fs';
import * as path from 'path';

// Mock the logger for tests
jest.mock('../request-logger', () => ({
  initializeRequestLogger: jest.fn(),
  getRequestLogger: jest.fn(() => ({
    getNextRequestId: jest.fn(() => 'ID1'),
    log: jest.fn(),
    cleanOldLogs: jest.fn()
  }))
}));

describe('RequestQueue', () => {
  let queue: RequestQueue<string>;

  beforeEach(() => {
    queue = new RequestQueue();
  });

  afterEach(() => {
    queue.clear();
  });

  describe('Basic functionality', () => {
    it('should execute requests in priority order when queued', async () => {
      // Create a queue with single concurrent execution
      const orderQueue = new RequestQueue({
        maxConcurrent: 1,
        minInterval: 10,
        maxRetries: 0,
        retryDelayBase: 1000,
        retryDelayMax: 30000,
        timeout: 5000,
        circuitBreakerThreshold: 5,
        circuitBreakerResetTime: 60000
      });
      
      const results: string[] = [];
      
      // First, add a blocking request that will occupy the queue
      const blocker = orderQueue.add({
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          results.push('blocker');
          return 'blocker';
        },
        priority: 10
      });
      
      // Now add requests with different priorities while the blocker is running
      // These will be queued and should execute in priority order
      const promises = [];
      
      promises.push(orderQueue.add({
        execute: async () => {
          results.push('low-priority');
          return 'low';
        },
        priority: 2
      }));
      
      promises.push(orderQueue.add({
        execute: async () => {
          results.push('high-priority');
          return 'high';
        },
        priority: 0
      }));
      
      promises.push(orderQueue.add({
        execute: async () => {
          results.push('medium-priority');
          return 'medium';
        },
        priority: 1
      }));

      await Promise.all([blocker, ...promises]);

      // The blocker executes first, then the rest in priority order
      expect(results).toEqual(['blocker', 'high-priority', 'medium-priority', 'low-priority']);
    });

    it('should respect rate limiting', async () => {
      const executionTimes: number[] = [];
      
      // Create a queue with shorter intervals for faster testing
      const testQueue = new RequestQueue({
        maxConcurrent: 1, // Process one at a time to make timing predictable
        minInterval: 100, // 100ms between requests
        maxRetries: 0,
        retryDelayBase: 1000,
        retryDelayMax: 30000,
        timeout: 5000,
        circuitBreakerThreshold: 5,
        circuitBreakerResetTime: 60000
      });
      
      // Make 3 requests
      const requests = Array.from({ length: 3 }, (_, i) => 
        testQueue.add({
          execute: async () => {
            executionTimes.push(Date.now());
            return `result${i}`;
          },
          priority: 0
        })
      );

      await Promise.all(requests);
      
      // Check gaps between executions
      const gaps: number[] = [];
      for (let i = 1; i < executionTimes.length; i++) {
        gaps.push(executionTimes[i] - executionTimes[i - 1]);
      }
      
      // Each gap should be at least 100ms (minus some tolerance for timing)
      gaps.forEach(gap => {
        expect(gap).toBeGreaterThanOrEqual(95); // Allow 5ms tolerance
      });
    });
  });

  describe('Retry logic', () => {
    it('should retry failed requests', async () => {
      let attempts = 0;
      
      const result = await queue.add({
        execute: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        },
        priority: 0
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
      let attempts = 0;
      
      // Create a queue with shorter retry delays for faster testing
      const testQueue = new RequestQueue({
        maxConcurrent: 2,
        minInterval: 10,
        maxRetries: 3,
        retryDelayBase: 50, // 50ms base delay
        retryDelayMax: 200, // 200ms max delay
        timeout: 1000,
        circuitBreakerThreshold: 5,
        circuitBreakerResetTime: 1000
      });
      
      await expect(
        testQueue.add({
          execute: async () => {
            attempts++;
            throw new Error('Permanent failure');
          },
          priority: 0
        })
      ).rejects.toThrow('Permanent failure');

      expect(attempts).toBe(4); // 1 initial + 3 retries
    }, 10000); // Increase test timeout to 10 seconds
  });

  describe('Circuit breaker', () => {
    it('should open circuit after threshold failures', async () => {
      // Create queue with low threshold for testing
      const testQueue = new RequestQueue({
        maxConcurrent: 2,
        minInterval: 10,
        maxRetries: 0,
        retryDelayBase: 10,
        retryDelayMax: 100,
        timeout: 1000,
        circuitBreakerThreshold: 2,
        circuitBreakerResetTime: 100
      });

      // Cause 2 failures to open circuit
      for (let i = 0; i < 2; i++) {
        await expect(
          testQueue.add({
            execute: async () => {
              throw new Error('Failure');
            },
            priority: 0
          })
        ).rejects.toThrow();
      }

      // Circuit should be open now
      await expect(
        testQueue.add({
          execute: async () => 'success',
          priority: 0
        })
      ).rejects.toThrow('Circuit breaker is open');

      // Wait for circuit to reset
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should work now
      const result = await testQueue.add({
        execute: async () => 'success after reset',
        priority: 0
      });

      expect(result).toBe('success after reset');
    });
  });
});