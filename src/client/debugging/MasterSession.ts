/**
 * MasterSession binds contemporaneous event sessions together
 */

import { SessionType } from './types';
import { InteractionSession } from './InteractionSession';

export class MasterSession {
  private id: number;
  private startTime: number;
  private boundSessions: Map<string, InteractionSession> = new Map();
  private allSessions: InteractionSession[] = [];  // Keep all sessions for JSON dump
  private sessionTypeCounters: Map<SessionType, number> = new Map();

  constructor(id: number) {
    this.id = id;
    this.startTime = performance.now();
    console.log(`%c🎬 MasterSession #${this.id} started`, 'color: #4CAF50; font-weight: bold');
  }

  getId(): number {
    return this.id;
  }

  getDeltaMs(): number {
    return performance.now() - this.startTime;
  }

  /**
   * Generate the next session info for a given type
   */
  getNextSessionInfo(type: SessionType): { identifier: string; sessionId: string } {
    const currentCount = this.sessionTypeCounters.get(type) || 0;
    const identifier = String.fromCharCode(97 + currentCount); // 'a', 'b', 'c', etc.
    this.sessionTypeCounters.set(type, currentCount + 1);
    const sessionId = `${this.id}${identifier}-${type}`;
    return { identifier, sessionId };
  }

  /**
   * Bind a session to this MasterSession
   */
  bindSession(session: InteractionSession): void {
    const type = session.getType();
    const identifier = session.getSessionIdentifier();
    
    // Store the session with a unique key
    const sessionKey = `${type}_${identifier}`;
    this.boundSessions.set(sessionKey, session);
    this.allSessions.push(session);  // Keep reference for JSON dump
    
    console.log(`%c  → Bound ${type} session ${identifier} to MasterSession #${this.id}`, 'color: #2196F3');
  }


  /**
   * Check if any sessions are still active
   */
  hasActiveSessions(): boolean {
    for (const session of this.allSessions) {
      if (session.isActive()) {
        return true;
      }
    }
    return false;
  }

  /**
   * End the MasterSession lifecycle
   */
  end(): void {
    const duration = Math.round(this.getDeltaMs());
    console.log(`%c🏁 MasterSession #${this.id} ended after ${duration}ms`, 'color: #F44336; font-weight: bold');
    
    // Dump the entire MasterSession as JSON
    const dump = this.toJSON();
    console.log('%c📊 MasterSession #' + this.id + ' Data Dump:', 'color: #9C27B0; font-weight: bold');
    console.log(JSON.stringify(dump, null, 2));
  }
  
  /**
   * Convert MasterSession to JSON-serializable object
   */
  toJSON(): any {
    const endTime = performance.now();
    return {
      masterSessionId: this.id,
      startTime: Math.round(this.startTime),
      endTime: Math.round(endTime),
      duration: Math.round(this.getDeltaMs()),
      totalSessions: this.allSessions.length,
      sessions: this.allSessions.map(s => s.toJSON())
    };
  }
}