/**
 * Tests for MasterSession implementation
 */

import { SessionManager } from '../SessionManager';
import { SessionType } from '../types';

describe('MasterSession', () => {
  let manager: SessionManager;

  beforeEach(() => {
    // Get a fresh instance by clearing the singleton
    (SessionManager as any).instance = undefined;
    manager = SessionManager.getInstance();
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Clean up any active sessions
    const activeSessions = (manager as any).activeSessions as Map<SessionType, any>;
    for (const session of activeSessions.values()) {
      if (session.isActive()) {
        session.end();
      }
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Session ID format', () => {
    it('should create session IDs in format "{masterSessionId}{identifier}-{type}"', () => {
      const wheel = manager.createSession(SessionType.WHEEL);
      expect(wheel.getSessionId()).toBe('1a-WHEEL');
      wheel.end();
    });

    it('should increment identifier for multiple sessions of same type', () => {
      // All in same MasterSession
      const wheel1 = manager.createSession(SessionType.WHEEL);
      expect(wheel1.getSessionId()).toBe('1a-WHEEL');
      
      // Keep MasterSession alive by having another session
      const move = manager.createSession(SessionType.MOVE);
      
      wheel1.end();
      const wheel2 = manager.createSession(SessionType.WHEEL);
      expect(wheel2.getSessionId()).toBe('1b-WHEEL');
      
      wheel2.end();
      const wheel3 = manager.createSession(SessionType.WHEEL);
      expect(wheel3.getSessionId()).toBe('1c-WHEEL');
      
      wheel3.end();
      move.end();
    });

    it('should use separate identifier sequences for different session types', () => {
      const wheel = manager.createSession(SessionType.WHEEL);
      expect(wheel.getSessionId()).toBe('1a-WHEEL');

      const move = manager.createSession(SessionType.MOVE);
      expect(move.getSessionId()).toBe('1a-MOVE');

      const touch = manager.createSession(SessionType.TOUCH);
      expect(touch.getSessionId()).toBe('1a-TOUCH');

      // End and create more
      wheel.end();
      const wheel2 = manager.createSession(SessionType.WHEEL);
      expect(wheel2.getSessionId()).toBe('1b-WHEEL');

      move.end();
      const move2 = manager.createSession(SessionType.MOVE);
      expect(move2.getSessionId()).toBe('1b-MOVE');

      // Clean up
      wheel2.end();
      move2.end();
      touch.end();
    });
  });

  describe('MasterSession lifecycle', () => {
    it('should create MasterSession when first session is created', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      const wheel = manager.createSession(SessionType.WHEEL);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🎬 MasterSession #1 started'),
        expect.any(String)
      );
      
      wheel.end();
      consoleSpy.mockRestore();
    });

    it('should end MasterSession when last session ends', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      const wheel = manager.createSession(SessionType.WHEEL);
      const move = manager.createSession(SessionType.MOVE);
      
      wheel.end();
      // MasterSession should still be active
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('🏁 MasterSession #1 ended'),
        expect.any(String)
      );
      
      move.end();
      // MasterSession should end now
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🏁 MasterSession #1 ended'),
        expect.any(String)
      );
      
      consoleSpy.mockRestore();
    });

    it('should increment MasterSession ID for new MasterSessions', () => {
      // First MasterSession
      const wheel1 = manager.createSession(SessionType.WHEEL);
      expect(wheel1.getSessionId()).toBe('1a-WHEEL');
      wheel1.end();

      // Second MasterSession
      const wheel2 = manager.createSession(SessionType.WHEEL);
      expect(wheel2.getSessionId()).toBe('2a-WHEEL');
      wheel2.end();

      // Third MasterSession
      const wheel3 = manager.createSession(SessionType.WHEEL);
      expect(wheel3.getSessionId()).toBe('3a-WHEEL');
      wheel3.end();
    });

    it('should reset session identifiers for each new MasterSession', () => {
      // MasterSession #1
      const wheel1a = manager.createSession(SessionType.WHEEL);
      expect(wheel1a.getSessionId()).toBe('1a-WHEEL');
      
      // Keep MasterSession #1 alive with another session
      const move1a = manager.createSession(SessionType.MOVE);
      
      wheel1a.end();
      const wheel1b = manager.createSession(SessionType.WHEEL);
      expect(wheel1b.getSessionId()).toBe('1b-WHEEL');
      
      // End all sessions to end MasterSession #1
      wheel1b.end();
      move1a.end();

      // MasterSession #2 - identifiers should reset
      const wheel2a = manager.createSession(SessionType.WHEEL);
      expect(wheel2a.getSessionId()).toBe('2a-WHEEL');
      
      const move2a = manager.createSession(SessionType.MOVE);
      expect(move2a.getSessionId()).toBe('2a-MOVE');
      
      wheel2a.end();
      move2a.end();
    });
  });

  describe('Session reuse', () => {
    it('should reuse active session of same type', () => {
      const wheel1 = manager.createSession(SessionType.WHEEL);
      const wheel2 = manager.createSession(SessionType.WHEEL);
      
      expect(wheel1).toBe(wheel2);
      expect(wheel2.getSessionId()).toBe('1a-WHEEL');
      
      wheel1.end();
    });

    it('should create new session after previous one ends', () => {
      // Keep MasterSession alive with another session
      const move = manager.createSession(SessionType.MOVE);
      
      const wheel1 = manager.createSession(SessionType.WHEEL);
      expect(wheel1.getSessionId()).toBe('1a-WHEEL');
      wheel1.end();

      const wheel2 = manager.createSession(SessionType.WHEEL);
      expect(wheel2).not.toBe(wheel1);
      expect(wheel2.getSessionId()).toBe('1b-WHEEL');
      
      wheel2.end();
      move.end();
    });
  });

  describe('MasterSession binding', () => {
    it('should bind sessions to MasterSession with correct identifiers', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      // Keep MasterSession alive with another session
      const move = manager.createSession(SessionType.MOVE);
      
      const wheel = manager.createSession(SessionType.WHEEL);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('→ Bound WHEEL session a to MasterSession #1'),
        expect.any(String)
      );
      
      wheel.end();
      const wheel2 = manager.createSession(SessionType.WHEEL);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('→ Bound WHEEL session b to MasterSession #1'),
        expect.any(String)
      );
      
      wheel2.end();
      move.end();
      consoleSpy.mockRestore();
    });
  });
});