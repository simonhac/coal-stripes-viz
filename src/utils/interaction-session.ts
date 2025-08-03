/**
 * InteractionSession manages session tracking for user interactions like dragging and wheeling
 */

export enum SessionType {
  DRAG = 'DRAG',
  WHEEL = 'WHEEL',
}

export interface SessionInfo {
  type: SessionType;
  seq: number;
  startTime: number;
  eventCount: number;
}

class SessionManager {
  private sessionSequences: Map<SessionType, number> = new Map();
  private currentSession: SessionInfo | null = null;

  constructor() {
    // Initialize session sequences
    this.sessionSequences.set(SessionType.DRAG, -1);
    this.sessionSequences.set(SessionType.WHEEL, -1);
  }

  // Start a new session
  startSession(type: SessionType): SessionInfo {
    const currentSeq = this.sessionSequences.get(type) || -1;
    const newSeq = currentSeq + 1;
    this.sessionSequences.set(type, newSeq);
    
    this.currentSession = {
      type,
      seq: newSeq,
      startTime: performance.now(),
      eventCount: 0
    };
    
    return this.currentSession;
  }

  // Get current session
  getCurrentSession(): SessionInfo | null {
    return this.currentSession;
  }

  // End current session
  endSession(): void {
    this.currentSession = null;
  }

  // Increment event count
  incrementEventCount(): number {
    if (this.currentSession) {
      return ++this.currentSession.eventCount;
    }
    return 0;
  }

  // Get elapsed time since session start
  getElapsedTime(): number {
    if (this.currentSession) {
      return performance.now() - this.currentSession.startTime;
    }
    return 0;
  }
}

// Singleton instance
const sessionManager = new SessionManager();

// Export convenience functions
export function startDragSession(): SessionInfo {
  return sessionManager.startSession(SessionType.DRAG);
}

export function startWheelSession(): SessionInfo {
  return sessionManager.startSession(SessionType.WHEEL);
}

export function getCurrentSession(): SessionInfo | null {
  return sessionManager.getCurrentSession();
}

export function endSession(): void {
  sessionManager.endSession();
}

export function incrementEventCount(): number {
  return sessionManager.incrementEventCount();
}

export function getSessionElapsedTime(): number {
  return sessionManager.getElapsedTime();
}