/**
 * Base class for all interaction sessions
 */

import { SessionType } from './types';
import { MasterSession } from './MasterSession';

// Color codes for different log types
export const LogColors = {
  PHASE_START: 'color: #FF9800; font-weight: bold',  // Orange for START
  PHASE_END: 'color: #FF9800; font-weight: bold',    // Orange for END
  FRAME: 'color: #1976D2',
  EVENT: 'color: #7B1FA2',
} as const;

// Base interaction event class
export class InteractionEvent {
  protected session: InteractionSession;
  protected sessionId: string;
  protected phase: string;
  protected eventSeq: number;
  protected elapsedMs: number;  // Time since session start
  protected deltaMs: number;     // Time since last event
  protected message: string;     // Event message
  protected warnings: string[] = [];  // Warnings to display

  constructor(
    session: InteractionSession, 
    phase: string,
    sessionId: string,
    eventSeq: number,
    elapsedMs: number,
    deltaMs: number,
    message: string
  ) {
    if (!session.isActive()) {
      throw new Error(`Cannot create event for inactive session ${sessionId}. Session must be active to log events.`);
    }
    
    // Verify phase matches session's current phase
    if (phase !== session.getCurrentPhase()) {
      throw new Error(
        `Phase mismatch: Event phase '${phase}' does not match session's current phase '${session.getCurrentPhase()}'. ` +
        `Events must be logged in the correct phase.`
      );
    }
    
    this.session = session;
    this.phase = phase;
    this.sessionId = sessionId;
    this.eventSeq = eventSeq;
    this.elapsedMs = elapsedMs;
    this.deltaMs = deltaMs;
    this.message = message;
  }

  // Format the event header
  protected getHeader(): string {
    const prefix = this.session.getPrefix();
    return `%c${prefix} %c${this.phase} ${this.session.getSessionId()}.e${this.eventSeq}@${this.elapsedMs}ms:`;
  }

  // Build the complete log message
  protected buildLogMessage(): string {
    const parts: string[] = [];
    
    // Add delta time
    parts.push(`Δt=${this.deltaMs.toFixed(1)}ms`);
    
    // Add the message
    parts.push(this.message);
    
    return parts.join(', ');
  }

  // Add a warning to this event
  addWarning(warning: string): void {
    this.warnings.push(warning);
  }

  // Log the event
  log(): void {
    if (!this.session.isActive()) {
      throw new Error(`Cannot log to inactive session ${this.sessionId}. Session ended or was terminated.`);
    }
    
    const header = this.getHeader();
    const message = this.buildLogMessage();
    
    // Build the log string with warnings
    let logString = header + ' ' + message;
    const prefixColor = this.session.getPrefixColor();
    const logArgs: any[] = [prefixColor, LogColors.FRAME]; // Style for prefix and main content
    
    // Add warning labels if present
    if (this.warnings.length > 0) {
      this.warnings.forEach(warning => {
        logString += ' %c' + warning;
        logArgs.push('color: #FF0000; font-weight: bold'); // Red style for each warning
      });
    }
    
    console.log(logString, ...logArgs);
  }
}

export abstract class InteractionSession {
  protected startTime: number;
  protected lastFrameTime: number;
  protected active: boolean = true;
  protected sessionTimeoutId: NodeJS.Timeout | null = null;
  protected currentPhase: string = 'INIT';
  protected eventSeq: number = 0;
  protected masterSession: MasterSession;
  protected sessionIdentifier: string;
  protected masterSessionDeltaMs: number;
  protected sessionId: string;

  constructor(masterSession: MasterSession, sessionIdentifier: string, masterSessionDeltaMs: number) {
    this.masterSession = masterSession;
    this.sessionIdentifier = sessionIdentifier;
    this.masterSessionDeltaMs = masterSessionDeltaMs;
    this.sessionId = `${masterSession.getId()}${sessionIdentifier}-${this.getType()}`;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.resetTimeout();
  }

  // Get session ID (e.g., '1a-WHEEL')
  getSessionId(): string {
    return this.sessionId;
  }

  // Get session identifier (e.g., 'a', 'b', 'c')
  getSessionIdentifier(): string {
    return this.sessionIdentifier;
  }

  // Check if session is active
  isActive(): boolean {
    return this.active;
  }

  // Get session type - to be implemented by subclasses
  abstract getType(): SessionType;
  
  // Get session prefix and color - to be implemented by subclasses
  abstract getPrefix(): string;
  abstract getPrefixColor(): string;
  
  // Get current phase
  getCurrentPhase(): string {
    return this.currentPhase;
  }

  protected getElapsedTime(): number {
    return performance.now() - this.startTime;
  }

  protected getFrameDelta(): number {
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    return delta;
  }
  
  // Internal: Get elapsed time in milliseconds (for events)
  protected getElapsedMs(): number {
    return Math.round(this.getElapsedTime());
  }
  
  // Internal: Get delta time in milliseconds (for events)
  protected getDeltaMs(): number {
    return this.getFrameDelta();
  }
  
  // Internal: Get next event sequence number
  protected getNextEventSeq(): number {
    const seq = this.eventSeq;
    this.eventSeq++;
    this.resetTimeout();
    return seq;
  }

  protected resetTimeout(): void {
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
    }
    this.sessionTimeoutId = setTimeout(() => {
      if (this.active) {
        console.log(`%c⏱ Session ${this.sessionId} auto-ending after 1s timeout`, 'color: #FF9800');
        this.end();
      }
    }, 1000);
  }

  // Start a new phase
  startPhase(phase: string, data?: any): void {
    if (!this.active) {
      throw new Error(`Cannot start phase '${phase}' on inactive session ${this.sessionId}. Session has ended.`);
    }
    this.resetTimeout();
    
    this.currentPhase = phase;
    const elapsedMs = Math.round(this.getElapsedTime());
    
    const prefix = this.getPrefix();
    const prefixColor = this.getPrefixColor();
    const dataStr = data ? ` data=${JSON.stringify(data)}` : '';
    console.log(`%c${prefix} %c${phase} ${this.sessionId}@${elapsedMs}ms: %cSTART${dataStr}`, prefixColor, '', LogColors.PHASE_START);
  }

  // End a phase
  endPhase(phase: string, reason: string, data?: any): void {
    if (!this.active) {
      throw new Error(`Cannot end phase '${phase}' on inactive session ${this.sessionId}. Session has ended.`);
    }
    this.resetTimeout();
    
    // Verify we're ending the current phase
    if (phase !== this.currentPhase) {
      console.warn(`Attempting to end phase '${phase}' but current phase is '${this.currentPhase}'`);
      return;
    }
    
    const elapsedMs = Math.round(this.getElapsedTime());
    const prefix = this.getPrefix();
    const prefixColor = this.getPrefixColor();
    const dataStr = data ? ` data=${JSON.stringify(data)}` : '';
    console.log(`%c${prefix} %c${phase} ${this.sessionId}@${elapsedMs}ms: %cEND reason=${reason}${dataStr}`, prefixColor, '', LogColors.PHASE_END);
  }


  // End the session
  end(): void {
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
      this.sessionTimeoutId = null;
    }
    this.active = false;
    // Lazy import to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SessionManager } = require('./SessionManager');
    SessionManager.getInstance().endSession(this.getType());
  }
}
