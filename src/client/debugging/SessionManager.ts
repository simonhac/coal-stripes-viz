/**
 * Singleton SessionManager to manage active sessions
 */

import { SessionType } from './types';
import { InteractionSession } from './InteractionSession';
import { MoveSession } from './MoveSession';
import { WheelSession } from './WheelSession';

export class SessionManager {
  private static instance: SessionManager;
  private sessionSequence: number = -1;
  private activeSessions: Map<SessionType, InteractionSession> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // Create or get existing session for a type
  createSession(type: SessionType): InteractionSession {
    // Check if there's already an active session of this type
    const existingSession = this.activeSessions.get(type);
    if (existingSession && existingSession.isActive()) {
      console.log(`%c↺ Reusing existing ${type} session ${existingSession.getSeq()}`, 'color: #2196F3');
      return existingSession;
    }

    // Create new session
    this.sessionSequence++;
    
    let session: InteractionSession;
    switch (type) {
      case SessionType.WHEEL:
        session = new WheelSession(this.sessionSequence);
        break;

      case SessionType.MOVE:
        session = new MoveSession(this.sessionSequence);
        break;
        
      default:
        throw new Error(`Unknown session type: ${type}`);
    }
    
    this.activeSessions.set(type, session);
    console.log(`%c✓ Created new ${type} session ${this.sessionSequence}`, 'color: #4CAF50');
    
    return session;
  }

  // Called when a session ends itself
  endSession(type: SessionType): void {
    const session = this.activeSessions.get(type);
    if (session) {
      console.log(`%c✗ Ended ${type} session ${session.getSeq()}`, 'color: #F44336');
      this.activeSessions.delete(type);
    }
  }
}