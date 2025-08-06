/**
 * Shared event emitter for coordinating between POST endpoint and SSE stream
 */

import { EventEmitter } from 'events';

// Global event emitter for session updates
class SessionEventEmitter extends EventEmitter {
  private static instance: SessionEventEmitter;

  private constructor() {
    super();
    // Increase max listeners to handle multiple dashboard connections
    this.setMaxListeners(100);
  }

  static getInstance(): SessionEventEmitter {
    if (!SessionEventEmitter.instance) {
      SessionEventEmitter.instance = new SessionEventEmitter();
    }
    return SessionEventEmitter.instance;
  }

  emitSession(data: any): void {
    this.emit('session', data);
  }

  onSession(callback: (data: any) => void): void {
    this.on('session', callback);
  }

  offSession(callback: (data: any) => void): void {
    this.off('session', callback);
  }
}

export const sessionEvents = SessionEventEmitter.getInstance();