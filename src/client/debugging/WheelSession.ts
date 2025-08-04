/**
 * Wheel session for trackpad/mouse wheel scrolling
 */

import { InteractionSession, InteractionEvent } from './InteractionSession';
import { SessionType } from './types';

export class WheelSession extends InteractionSession {
  constructor(seq: number) {
    super(seq);
    this.currentPhase = 'SCROLL';  // Default phase for wheel sessions
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
      this.getSeq(),
      this.getNextEventSeq(),
      this.getElapsedMs(),
      this.getDeltaMs(),
      message
    );
  }
  
  // Parameters version for wheel events
  createWheelEvent(
    phase: string,
    deltaX: number,
    accumulatedX: number
  ): InteractionEvent {
    // Format parameters into a message string
    const message = `deltaX=${deltaX.toFixed(1)}, accumX=${accumulatedX.toFixed(0)}`;
    
    return new InteractionEvent(
      this, 
      phase,
      this.getSeq(),
      this.getNextEventSeq(),
      this.getElapsedMs(),
      this.getDeltaMs(),
      message
    );
  }
}