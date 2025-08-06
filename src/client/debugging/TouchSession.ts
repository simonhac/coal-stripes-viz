/**
 * Touch session for two-finger touch dragging
 */

import { InteractionSession, InteractionEvent } from './InteractionSession';
import { SessionType } from './types';
import { MasterSession } from './MasterSession';

export class TouchSession extends InteractionSession {
  constructor(masterSession: MasterSession, sessionIdentifier: string, masterSessionDeltaMs: number) {
    super(masterSession, sessionIdentifier, masterSessionDeltaMs);
  }

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
      this.getSessionId(),
      this.getNextEventSeq(),
      this.getElapsedMs(),
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
    // Create data object with rounded values
    const data = {
      centerX: Math.round(centerX),
      centerY: Math.round(centerY),
      deltaX: parseFloat(deltaX.toFixed(1)),
      deltaY: parseFloat(deltaY.toFixed(1)),
      touchCount
    };
    
    // Format message from data
    const message = `center=(${data.centerX},${data.centerY}), ` +
                   `Δ=(${data.deltaX},${data.deltaY}), touches=${data.touchCount}`;
    
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
  
  // Velocity tracking event
  createVelocityEvent(
    phase: string,
    pixelVelocity: number,
    dayVelocity: number,
    samples: number,
    timeDelta: number
  ): InteractionEvent {
    // Create data object with rounded values
    const data = {
      pixelVelocity: parseFloat(pixelVelocity.toFixed(1)),
      dayVelocity: parseFloat(dayVelocity.toFixed(1)),
      samples,
      timeDelta: Math.round(timeDelta)
    };
    
    // Format message from data
    const message = `velocity: pixelV=${data.pixelVelocity}px/s, dayV=${data.dayVelocity}d/s, ` +
                   `samples=${data.samples}, Δt=${data.timeDelta}ms`;
    
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