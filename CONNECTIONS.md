# Connection Management Documentation

## Current State Analysis

### API Request Patterns

Our application makes requests to the OpenElectricity API through the following layers:

1. **API Routes** (`/api/capacity-factors`)
   - Single endpoint for fetching capacity factor data
   - Creates singleton `CoalDataService` instance
   - No rate limiting or retry logic at this layer

2. **CoalDataService** (`src/server/coal-data-service.ts`)
   - Makes parallel requests to OpenElectricity API
   - Groups facilities by network (NEM, WEM)
   - Uses `Promise.all()` for parallel execution
   - No rate limiting between requests
   - No retry logic for failed requests
   - Special handling for leap years (splits into two 6-month requests)

3. **OpenElectricityClient** (npm package)
   - No built-in rate limiting
   - No retry mechanism
   - Throws errors immediately on failure
   - Special handling for 416 (no data) and 403 (permission denied)

### Existing Rate Limiting Infrastructure

#### Client-Side Rate Limiting
- **SmartCache** (`src/client/smart-cache.ts`)
  - Implements retry logic with exponential backoff for failed requests
  - Retry delays: 1s, 2s, 4s, 8s (max 4 attempts)
  - No rate limiting between successful requests

- **Tile Test Page** (`src/app/tiles/page.tsx`)
  - Uses `CACHE_CONFIG.RATE_LIMIT_DELAY` (250ms) between sequential year fetches
  - Simple sequential processing with delays

#### Configuration
- `CACHE_CONFIG.RATE_LIMIT_DELAY`: 250ms (defined in `src/shared/config.ts`)
- No server-side rate limiting configuration

### Current Issues

1. **No Server-Side Rate Limiting**
   - `Promise.all()` fires all network requests simultaneously
   - Could trigger API rate limits with multiple facilities
   - No queuing mechanism for API requests

2. **No Retry Logic in Server**
   - Failed requests immediately fail the entire operation
   - No exponential backoff for server-side requests
   - Client retries don't help with server-side failures

3. **Inefficient Request Patterns**
   - Parallel requests per network could overwhelm API
   - No request prioritization
   - No request deduplication

## Proposed Solution: Request Queue System

### Design Principles

1. **Reusable**: Can be used in both server and client tiers
2. **Configurable**: Rate limits, retry policies, and timeouts in config
3. **Observable**: Progress tracking and error reporting
4. **Resilient**: Exponential backoff, circuit breaker pattern
5. **Efficient**: Request deduplication and prioritization

### Architecture

```typescript
// Core interfaces
interface QueuedRequest<T> {
  id: string;
  execute: () => Promise<T>;
  priority: number;
  retryCount: number;
  createdAt: number;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

interface RequestQueueConfig {
  maxConcurrent: number;
  minInterval: number;
  maxRetries: number;
  retryDelayBase: number;
  retryDelayMax: number;
  timeout: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetTime: number;
}

class RequestQueue<T> {
  private queue: QueuedRequest<T>[] = [];
  private active: Map<string, Promise<T>> = new Map();
  private lastRequestTime: number = 0;
  private failureCount: number = 0;
  private circuitOpen: boolean = false;
  
  constructor(private config: RequestQueueConfig) {}
  
  async add(request: Omit<QueuedRequest<T>, 'id' | 'createdAt' | 'retryCount'>): Promise<T> {
    // Implementation details below
  }
  
  private async processQueue(): Promise<void> {
    // Implementation details below
  }
}
```

### Implementation Plan

#### Phase 1: Core Queue Implementation
1. Create `src/shared/request-queue.ts` with base RequestQueue class
2. Implement queue management with priority sorting
3. Add rate limiting with configurable minimum interval
4. Implement exponential backoff retry logic

#### Phase 2: Circuit Breaker & Monitoring
1. Add circuit breaker pattern to prevent cascading failures
2. Implement request deduplication
3. Add progress tracking and observability
4. Create request metrics and logging

#### Phase 3: Integration
1. Create `OpenElectricityQueue` wrapper for API-specific logic
2. Update `CoalDataService` to use request queue
3. Add queue configuration to `src/shared/config.ts`
4. Create tests for queue behavior

#### Phase 4: Client-Side Adoption
1. Update `SmartCache` to use request queue
2. Implement client-side queue with browser considerations
3. Add request prioritization based on viewport visibility

### Configuration

Add to `src/shared/config.ts`:

```typescript
export const REQUEST_QUEUE_CONFIG = {
  // Rate limiting
  DEFAULT_MIN_INTERVAL: 200,        // Minimum 200ms between requests
  MAX_CONCURRENT_REQUESTS: 2,       // Max parallel requests
  
  // Retry policy
  MAX_RETRIES: 3,                   // Maximum retry attempts
  RETRY_DELAY_BASE: 1000,           // Base retry delay (1s)
  RETRY_DELAY_MAX: 30000,           // Maximum retry delay (30s)
  
  // Timeouts
  REQUEST_TIMEOUT: 30000,           // 30 second timeout per request
  
  // Circuit breaker
  CIRCUIT_BREAKER_THRESHOLD: 5,     // Open circuit after 5 consecutive failures
  CIRCUIT_BREAKER_RESET_TIME: 60000 // Reset circuit after 1 minute
};
```

### Usage Example

```typescript
// Server-side usage in CoalDataService
class CoalDataService {
  private requestQueue: RequestQueue<any>;
  
  constructor(apiKey: string) {
    this.client = new OpenElectricityClient({ apiKey });
    this.requestQueue = new RequestQueue({
      maxConcurrent: REQUEST_QUEUE_CONFIG.MAX_CONCURRENT_REQUESTS,
      minInterval: REQUEST_QUEUE_CONFIG.DEFAULT_MIN_INTERVAL,
      maxRetries: REQUEST_QUEUE_CONFIG.MAX_RETRIES,
      // ... other config
    });
  }
  
  private async fetchEnergyData(
    facilities: Facility[], 
    startDate: string, 
    endDate: string
  ): Promise<any[]> {
    // Group by network as before
    const facilitiesByNetwork = this.groupFacilitiesByNetwork(facilities);
    
    // Queue requests instead of Promise.all
    const promises = [];
    for (const [network, facilityCodes] of facilitiesByNetwork) {
      const promise = this.requestQueue.add({
        execute: () => this.client.getFacilityData(
          network as any,
          facilityCodes,
          ['energy'],
          { interval: '1d', dateStart: startDate, dateEnd: endDatePlusOne }
        ),
        priority: 0, // High priority for user-requested data
        onProgress: (progress) => console.log(`${network}: ${progress}%`),
        onError: (error) => console.error(`${network} failed:`, error)
      });
      promises.push(promise);
    }
    
    // Await all queued requests
    const responses = await Promise.all(promises);
    return this.combineResponses(responses);
  }
}
```

### Benefits

1. **Rate Limit Compliance**: Ensures we don't exceed API limits
2. **Improved Reliability**: Automatic retries with exponential backoff
3. **Better Performance**: Request deduplication and prioritization
4. **Observability**: Progress tracking and error reporting
5. **Resilience**: Circuit breaker prevents cascading failures
6. **Reusability**: Same queue can be used client and server side

### Migration Strategy

1. **Phase 1**: Implement queue without changing existing behavior
2. **Phase 2**: Add queue to new endpoints first
3. **Phase 3**: Gradually migrate existing code to use queue
4. **Phase 4**: Remove old retry/rate limit logic

### Monitoring

The queue will emit events for:
- Request queued
- Request started
- Request completed
- Request failed
- Request retried
- Circuit breaker opened/closed

These can be integrated with application monitoring tools.

### Request Logging

All API requests will be logged to a dedicated log file for audit and debugging purposes.

#### Log File Format
- **Filename**: `YYYYMMDD HH:MM:SS capfac-${portnum}.log`
- **Location**: `./logs/` directory
- **Example**: `20240124 14:30:45 capfac-3000.log`

#### Log Entry Format
Plain text format with structured information (no payload data):
```
2024-01-24 14:30:45.123 [QUEUED] ID1 GET /data/facilities/NEM priority=0
2024-01-24 14:30:45.234 [STARTED] ID1 GET /data/facilities/NEM attempt=1/3
2024-01-24 14:30:46.567 [COMPLETED] ID1 GET /data/facilities/NEM status=200 duration=1333ms size=45KB
2024-01-24 14:30:47.890 [FAILED] ID2 GET /data/facilities/WEM status=429 duration=234ms error="Rate limit exceeded"
2024-01-24 14:30:48.901 [RETRY] ID2 GET /data/facilities/WEM attempt=2/3 delay=1000ms
2024-01-24 14:30:50.123 [CIRCUIT_OPEN] threshold=5 failures=5 reset_in=60000ms
```

#### Log Information Includes
- Timestamp (server's local timezone)
- Event type (QUEUED, STARTED, COMPLETED, FAILED, RETRY, CIRCUIT_OPEN, CIRCUIT_CLOSED)
- Request ID (sequential: ID1, ID2, ID3, etc.)
- HTTP method and path
- Priority level
- Attempt number and max retries
- Response status code
- Request duration
- Response size (headers only, no payload)
- Error messages
- Circuit breaker state changes

#### What's NOT Logged
- Request payload/body
- Response data
- API keys or credentials
- Sensitive headers

#### Log Rotation
- New log file created daily at midnight
- Old logs retained for 30 days
- Logs older than 30 days automatically deleted

## Next Steps

1. Review and approve this design
2. Implement core RequestQueue class
3. Create unit tests for queue behavior
4. Integrate with CoalDataService
5. Monitor and tune rate limiting parameters