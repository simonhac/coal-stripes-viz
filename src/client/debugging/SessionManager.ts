/**
 * Singleton SessionManager to manage active sessions
 */

import { SessionType } from './types';
import { InteractionSession } from './InteractionSession';
import { MoveSession } from './MoveSession';
import { WheelSession } from './WheelSession';
import { TouchSession } from './TouchSession';
import { MasterSession } from './MasterSession';

export class SessionManager {
  private static instance: SessionManager;
  private activeSessions: Map<SessionType, InteractionSession> = new Map();
  private currentMasterSession: MasterSession | null = null;
  private masterSessionId: number = 0;

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
      console.log(`%c↺ Reusing existing ${type} session ${existingSession.getSessionId()}`, 'color: #2196F3');
      return existingSession;
    }

    // Create MasterSession if none exists
    if (!this.currentMasterSession) {
      this.masterSessionId++;
      this.currentMasterSession = new MasterSession(this.masterSessionId);
    }

    // Get session parameters from MasterSession
    const masterDelta = Math.round(this.currentMasterSession.getDeltaMs());
    const { identifier, sessionId } = this.currentMasterSession.getNextSessionInfo(type);
    
    // Create new session with MasterSession info
    let session: InteractionSession;
    switch (type) {
      case SessionType.WHEEL:
        session = new WheelSession(this.currentMasterSession, identifier, masterDelta);
        break;

      case SessionType.MOVE:
        session = new MoveSession(this.currentMasterSession, identifier, masterDelta);
        break;
        
      case SessionType.TOUCH:
        session = new TouchSession(this.currentMasterSession, identifier, masterDelta);
        break;
        
      default:
        throw new Error(`Unknown session type: ${type}`);
    }
    
    // Bind session to MasterSession
    this.currentMasterSession.bindSession(session);
    
    this.activeSessions.set(type, session);
    console.log(`%c✓ Created new ${type} session ${sessionId} at master+${masterDelta}ms`, 'color: #4CAF50');
    
    return session;
  }

  // Called when a session ends itself
  endSession(type: SessionType): void {
    const session = this.activeSessions.get(type);
    if (session) {
      console.log(`%c✗ Ended ${type} session ${session.getSessionId()}`, 'color: #F44336');
      this.activeSessions.delete(type);
      
      // Check if MasterSession should end
      if (this.currentMasterSession) {
        this.currentMasterSession.unbindSession(session);
        
        if (!this.currentMasterSession.hasActiveSessions()) {
          this.currentMasterSession.end();
          this.currentMasterSession = null;
        }
      }
    }
  }
}