/**
 * MasterSession binds contemporaneous event sessions together
 */

import { SessionType } from './types';
import { InteractionSession } from './InteractionSession';
import { featureFlags } from '@/shared/feature-flags';

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
    
    // Send to dashboard if feature flag is enabled and in browser environment
    if (featureFlags.get('postInteractionEvents') && typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      const dump = this.toJSON();
      fetch('http://localhost:3000/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dump)
      }).then(() => {
        console.log('%c📡 Sent to dashboard', 'color: #4CAF50');
      }).catch(_err => {
        console.log('%c📡 Dashboard not available', 'color: #FF9800');
      });
    }
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