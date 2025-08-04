/**
 * Move session for mouse/touch dragging with phases
 */

import { CalendarDate } from '@internationalized/date';
import { InteractionSession, InteractionEvent } from './InteractionSession';
import { SessionType } from './types';

export class MoveSession extends InteractionSession {
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
      this.getSeq(),
      this.getNextEventSeq(),
      this.getElapsedMs(),
      this.getDeltaMs(),
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
    const message = `pos=${position.toString()}, target=${targetDate.toString()}, ` +
                   `v=${velocity.toFixed(1)}, a=${acceleration.toFixed(1)}, d=${displacement.toFixed(0)}`;
    
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