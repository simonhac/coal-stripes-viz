/**
 * Wheel session for trackpad/mouse wheel scrolling
 */

import { InteractionSession, InteractionEvent } from './InteractionSession';
import { SessionType } from './types';
import { MasterSession } from './MasterSession';

export class WheelSession extends InteractionSession {
  constructor(masterSession: MasterSession, sessionIdentifier: string, masterSessionDeltaMs: number) {
    super(masterSession, sessionIdentifier, masterSessionDeltaMs);
  }

  getType(): SessionType {
    return SessionType.WHEEL;
  }
  
  getPrefix(): string {
    return 'WHEEL';
  }
  
  getPrefixColor(): string {
    return 'color: #2196F3; font-weight: bold';  // Blue for WHEEL
  }
  
  // String message version
  createWheelMessage(phase: string, message: string): InteractionEvent {
    return new InteractionEvent(
      this, 
      phase,
      this.getSessionId(),
      this.getNextEventSeq(),
      this.getElapsedMs(),
      message
    );
  }
  
  // Parameters version for wheel events
  createWheelEvent(
    phase: string,
    deltaX: number,
    accumulatedX: number
  ): InteractionEvent {
    // Create data object with rounded values
    const data = {
      deltaX: parseFloat(deltaX.toFixed(1)),
      accumulatedX: Math.round(accumulatedX)
    };
    
    // Format message from data
    const message = `deltaX=${data.deltaX}, accumX=${data.accumulatedX}`;
    
    return new InteractionEvent(
      this, 
      phase,
      this.getSessionId(),
      this.getNextEventSeq(),
      this.getElapsedMs(),
      message,
      data
    );
  }
}