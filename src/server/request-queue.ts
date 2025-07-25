import { REQUEST_QUEUE_CONFIG } from '@/shared/config';
import { getRequestLogger, RequestLogger } from './request-logger';

export interface QueuedRequest<T> {
  id: string;
  execute: () => Promise<T>;
  priority: number;
  retryCount: number;
  createdAt: number;
  url?: string;
  method?: string;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export interface RequestQueueConfig {
  maxConcurrent: number;
  minInterval: number;
  maxRetries: number;
  retryDelayBase: number;
  retryDelayMax: number;
  timeout: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetTime: number;
}

export class RequestQueue<T = any> {
  private queue: QueuedRequest<T>[] = [];
  private active: Map<string, Promise<T>> = new Map();
  private lastRequestTime: number = 0;
  private failureCount: number = 0;
  private circuitOpen: boolean = false;
  private circuitOpenTime: number = 0;
  private logger: RequestLogger;
  private processing: boolean = false;

  constructor(
    private config: RequestQueueConfig = {
      maxConcurrent: REQUEST_QUEUE_CONFIG.MAX_CONCURRENT_REQUESTS,
      minInterval: REQUEST_QUEUE_CONFIG.DEFAULT_MIN_INTERVAL,
      maxRetries: REQUEST_QUEUE_CONFIG.MAX_RETRIES,
      retryDelayBase: REQUEST_QUEUE_CONFIG.RETRY_DELAY_BASE,
      retryDelayMax: REQUEST_QUEUE_CONFIG.RETRY_DELAY_MAX,
      timeout: REQUEST_QUEUE_CONFIG.REQUEST_TIMEOUT,
      circuitBreakerThreshold: REQUEST_QUEUE_CONFIG.CIRCUIT_BREAKER_THRESHOLD,
      circuitBreakerResetTime: REQUEST_QUEUE_CONFIG.CIRCUIT_BREAKER_RESET_TIME
    }
  ) {
    this.logger = getRequestLogger();
  }

  public async add(
    request: Omit<QueuedRequest<T>, 'id' | 'createdAt' | 'retryCount' | 'resolve' | 'reject'>
  ): Promise<T> {
    // Check circuit breaker
    if (this.circuitOpen) {
      const timeSinceOpen = Date.now() - this.circuitOpenTime;
      if (timeSinceOpen < this.config.circuitBreakerResetTime) {
        const error = new Error('Circuit breaker is open');
        if (request.onError) {
          request.onError(error);
        }
        throw error;
      } else {
        // Reset circuit breaker
        this.circuitOpen = false;
        this.failureCount = 0;
        this.logger.log({
          timestamp: new Date(),
          eventType: 'CIRCUIT_CLOSED'
        });
      }
    }

    return new Promise<T>((resolve, reject) => {
      const id = this.logger.getNextRequestId();
      const queuedRequest: QueuedRequest<T> = {
        ...request,
        id,
        retryCount: 0,
        createdAt: Date.now(),
        resolve,
        reject
      };

      // Log queued event
      this.logger.log({
        timestamp: new Date(),
        eventType: 'QUEUED',
        requestId: id,
        method: request.method || 'GET',
        path: request.url || 'unknown',
        priority: request.priority
      });

      // Add to queue
      this.queue.push(queuedRequest);
      this.queue.sort((a, b) => a.priority - b.priority);

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.active.size < this.config.maxConcurrent) {
      // Check if we need to wait for rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.config.minInterval) {
        const waitTime = this.config.minInterval - timeSinceLastRequest;
        await this.sleep(waitTime);
      }

      const request = this.queue.shift()!;
      this.processRequest(request);
      this.lastRequestTime = Date.now();
    }

    this.processing = false;

    // Continue processing if there are more requests
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), this.config.minInterval);
    }
  }

  private async processRequest(request: QueuedRequest<T>): Promise<void> {
    const startTime = Date.now();

    try {
      // Log start event
      this.logger.log({
        timestamp: new Date(),
        eventType: 'STARTED',
        requestId: request.id,
        method: request.method || 'GET',
        path: request.url || 'unknown',
        attempt: request.retryCount + 1,
        maxAttempts: this.config.maxRetries + 1
      });

      // Create promise with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), this.config.timeout);
      });

      const executePromise = request.execute();
      this.active.set(request.id, executePromise);

      // Race between execution and timeout
      const result = await Promise.race([executePromise, timeoutPromise]);

      // Success - reset failure count
      this.failureCount = 0;
      this.active.delete(request.id);

      const duration = Date.now() - startTime;

      // Log completion
      this.logger.log({
        timestamp: new Date(),
        eventType: 'COMPLETED',
        requestId: request.id,
        method: request.method || 'GET',
        path: request.url || 'unknown',
        status: 200, // We don't have actual status without response object
        duration
      });

      request.resolve(result);

      // Notify progress
      if (request.onProgress) {
        request.onProgress(100);
      }

    } catch (error) {
      this.active.delete(request.id);
      const duration = Date.now() - startTime;

      // Log failure
      this.logger.log({
        timestamp: new Date(),
        eventType: 'FAILED',
        requestId: request.id,
        method: request.method || 'GET',
        path: request.url || 'unknown',
        duration,
        error: error instanceof Error ? error.message : String(error)
      });

      // Check if we should retry
      if (request.retryCount < this.config.maxRetries) {
        request.retryCount++;
        
        // Calculate exponential backoff delay
        const delay = Math.min(
          this.config.retryDelayBase * Math.pow(2, request.retryCount - 1),
          this.config.retryDelayMax
        );

        // Log retry
        this.logger.log({
          timestamp: new Date(),
          eventType: 'RETRY',
          requestId: request.id,
          method: request.method || 'GET',
          path: request.url || 'unknown',
          attempt: request.retryCount + 1,
          maxAttempts: this.config.maxRetries + 1,
          delay
        });

        // Re-queue with delay
        setTimeout(() => {
          this.queue.unshift(request); // Add to front to maintain order
          if (!this.processing) {
            this.processQueue();
          }
        }, delay);

      } else {
        // Max retries exceeded
        this.failureCount++;

        // Check circuit breaker
        if (this.failureCount >= this.config.circuitBreakerThreshold) {
          this.circuitOpen = true;
          this.circuitOpenTime = Date.now();

          this.logger.log({
            timestamp: new Date(),
            eventType: 'CIRCUIT_OPEN',
            threshold: this.config.circuitBreakerThreshold,
            failures: this.failureCount,
            resetIn: this.config.circuitBreakerResetTime
          });
        }

        // Notify error
        if (request.onError) {
          request.onError(error as Error);
        }

        request.reject(error as Error);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get queue statistics
  public getStats() {
    return {
      queued: this.queue.length,
      active: this.active.size,
      circuitOpen: this.circuitOpen,
      failureCount: this.failureCount
    };
  }

  // Clear the queue
  public clear(): void {
    this.queue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}