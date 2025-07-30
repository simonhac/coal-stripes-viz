import { RequestQueueLogger, LogEntry } from '@/shared/request-queue-logger';
import { RequestLogger, getRequestLogger } from './request-logger';

/**
 * Server-side file-based logger that wraps the existing RequestLogger
 */
export class FileRequestQueueLogger implements RequestQueueLogger {
  private fileLogger: RequestLogger;

  constructor() {
    this.fileLogger = getRequestLogger();
  }

  getNextRequestId(): string {
    return this.fileLogger.getNextRequestId();
  }

  log(entry: LogEntry): void {
    // Convert shared LogEntry to server RequestLogger format
    this.fileLogger.log(entry);
  }
}