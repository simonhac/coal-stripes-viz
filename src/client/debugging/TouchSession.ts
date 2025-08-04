/**
 * Touch session for two-finger touch dragging
 */

import { InteractionSession, InteractionEvent } from './InteractionSession';
import { SessionType } from './types';

export class TouchSession extends InteractionSession {
  getType(): SessionType {
    return SessionType.TOUCH;
  }
  
  getPrefix(): string {
    return 'TOUCH';
  }
  
  getPrefixColor(): string {
    return 'color: #9C27B0; font-weight: bold';  // Purple for TOUCH
  }
  
  // String message version
  createTouchMessage(phase: string, message: string): InteractionEvent {
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
  
  // Touch-specific event with center position and movement
  createTouchEvent(
    phase: string,
    centerX: number,
    centerY: number,
    deltaX: number,
    deltaY: number,
    touchCount: number
  ): InteractionEvent {
    const message = `center=(${centerX.toFixed(0)},${centerY.toFixed(0)}), ` +
                   `Δ=(${deltaX.toFixed(1)},${deltaY.toFixed(1)}), touches=${touchCount}`;
    
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
  
  // Velocity tracking event
  createVelocityEvent(
    phase: string,
    pixelVelocity: number,
    dayVelocity: number,
    samples: number,
    timeDelta: number
  ): InteractionEvent {
    const message = `velocity: pixelV=${pixelVelocity.toFixed(1)}px/s, dayV=${dayVelocity.toFixed(1)}d/s, ` +
                   `samples=${samples}, Δt=${timeDelta.toFixed(0)}ms`;
    
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