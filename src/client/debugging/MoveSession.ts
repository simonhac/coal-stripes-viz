/**
 * Move session for mouse/touch dragging with phases
 */

import { CalendarDate } from '@internationalized/date';
import { InteractionSession, InteractionEvent } from './InteractionSession';
import { SessionType } from './types';
import { MasterSession } from './MasterSession';

export class MoveSession extends InteractionSession {
  constructor(masterSession: MasterSession, sessionIdentifier: string, masterSessionDeltaMs: number) {
    super(masterSession, sessionIdentifier, masterSessionDeltaMs);
  }

  getType(): SessionType {
    return SessionType.MOVE;
  }
  
  getPrefix(): string {
    return 'MOVE';
  }
  
  getPrefixColor(): string {
    return 'color: #4CAF50; font-weight: bold';  // Green for MOVE
  }
  
  // String message version
  createMoveMessage(phase: string, message: string): InteractionEvent {
    return new InteractionEvent(
      this, 
      phase,
      this.getSessionId(),
      this.getNextEventSeq(),
      this.getElapsedMs(),
      message
    );
  }
  
  // Parameters version - all required
  createMoveEvent(
    phase: string,
    position: CalendarDate,
    targetDate: CalendarDate,
    velocity: number,
    acceleration: number,
    displacement: number
  ): InteractionEvent {
    // Create data object with rounded values
    const data = {
      position: position.toString(),
      targetDate: targetDate.toString(),
      velocity: parseFloat(velocity.toFixed(1)),
      acceleration: parseFloat(acceleration.toFixed(1)),
      displacement: Math.round(displacement)
    };
    
    // Format message from data
    const message = `pos=${data.position}, target=${data.targetDate}, ` +
                   `v=${data.velocity}, a=${data.acceleration}, d=${data.displacement}`;
    
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