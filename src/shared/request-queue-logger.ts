export type LogEventType = 'QUEUED' | 'STARTED' | 'COMPLETED' | 'FAILED' | 'RETRY' | 'CIRCUIT_OPEN' | 'CIRCUIT_CLOSED';

export interface LogEntry {
  timestamp: Date;
  eventType: LogEventType;
  requestId?: string;
  method?: string;
  path?: string;
  priority?: number;
  attempt?: number;
  maxAttempts?: number;
  status?: number;
  duration?: number;
  size?: string;
  error?: string;
  delay?: number;
  threshold?: number;
  failures?: number;
  resetIn?: number;
}

export interface RequestQueueLogger {
  getNextRequestId(): string;
  log(entry: LogEntry): void;
}

/**
 * Simple console logger for client-side usage
 */
export class ConsoleRequestQueueLogger implements RequestQueueLogger {
  private requestCounter: number = 0;
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  getNextRequestId(): string {
    this.requestCounter++;
    return `ID${this.requestCounter}`;
  }

  log(entry: LogEntry): void {
    if (!this.enabled) return;
    
    const prefix = `[${entry.eventType}]`;
    const timestamp = entry.timestamp.toISOString();
    
    if (entry.requestId) {
      console.log(`${timestamp} ${prefix} ${entry.requestId}`, entry);
    } else {
      console.log(`${timestamp} ${prefix}`, entry);
    }
  }
}

/**
 * No-op logger for when logging is disabled
 */
export class NoOpRequestQueueLogger implements RequestQueueLogger {
  private requestCounter: number = 0;

  getNextRequestId(): string {
    this.requestCounter++;
    return `ID${this.requestCounter}`;
  }

  log(_entry: LogEntry): void {
    // Do nothing
  }
}