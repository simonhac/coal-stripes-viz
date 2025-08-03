import { CalendarDate } from '@internationalized/date';
import { getDateBoundaries } from '@/shared/date-boundaries';
import { getDaysBetween } from '@/shared/date-utils';

// Global flag to enable/disable drag logging
const DRAG_LOGGING_ENABLED = true;

// Flag to enable/disable wheel event logging (very verbose)
const LOG_WHEEL_EVENTS = true;

// Color codes for different log types
const LogColors = {
  PHASE_START: 'color: #00C853; font-weight: bold',
  PHASE_END: 'color: #D32F2F; font-weight: bold',
  FRAME: 'color: #1976D2',
  EVENT: 'color: #7B1FA2',
  STATE: 'color: #F57C00',
  WARNING: 'color: #FF6F00; font-weight: bold',
  ERROR: 'color: #B71C1C; font-weight: bold',
} as const;

// Log levels
export enum LogLevel {
  PHASE = 'PHASE',
  FRAME = 'FRAME',
  EVENT = 'EVENT',
  STATE = 'STATE',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

// Phase names
export enum DragPhase {
  IDLE = 'IDLE',
  DRAG_START = 'DRAG_START',
  DRAGGING = 'DRAGGING',
  DRAG_END = 'DRAG_END',
  SPRING = 'SPRING',
  RUBBER_BAND = 'RUBBER_BAND',
}

// Animation frame data
interface FrameData {
  phase: DragPhase;
  position?: CalendarDate;
  velocity?: number;
  acceleration?: number;
  displacement?: number;
  targetDate?: CalendarDate;
  [key: string]: any;
}

class DragLogger {
  private frameCounters: Map<DragPhase, number> = new Map();
  private phaseStartTimes: Map<DragPhase, number> = new Map();
  private globalStartTime: number = 0;
  private enabled: boolean = DRAG_LOGGING_ENABLED;
  private lastFrameTime: number = 0;
  private dragSessionSeq: number = -1;

  constructor() {
    // Initialize without incrementing session
    this.globalStartTime = performance.now();
    this.lastFrameTime = this.globalStartTime;
    this.frameCounters.clear();
    this.phaseStartTimes.clear();
  }

  reset() {
    this.globalStartTime = performance.now();
    this.lastFrameTime = this.globalStartTime;
    this.frameCounters.clear();
    this.phaseStartTimes.clear();
    this.dragSessionSeq++;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      this.reset();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private getElapsedTime(): number {
    return (performance.now() - this.globalStartTime) / 1000;
  }

  private getFrameDelta(): number {
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    return delta;
  }

  // Get current session sequence
  getSessionSeq(): number {
    return this.dragSessionSeq;
  }

  // Phase logging
  logPhaseStart(phase: DragPhase, data?: any) {
    if (!this.enabled) return;
    
    const elapsed = this.getElapsedTime();
    this.phaseStartTimes.set(phase, performance.now());
    this.frameCounters.set(phase, 0);
    
    console.group(`%c▶ ${phase} START @ ${elapsed.toFixed(1)}s [session ${this.dragSessionSeq}]`, LogColors.PHASE_START);
    if (data) {
      console.log('Data:', data);
    }
    console.groupEnd();
  }

  logPhaseEnd(phase: DragPhase, data?: any) {
    if (!this.enabled) return;
    
    const elapsed = this.getElapsedTime();
    const startTime = this.phaseStartTimes.get(phase);
    const duration = startTime ? performance.now() - startTime : 0;
    const frameCount = this.frameCounters.get(phase) || 0;
    
    console.group(`%c■ ${phase} END @ ${elapsed.toFixed(1)}s [session ${this.dragSessionSeq}]`, LogColors.PHASE_END);
    console.log('Duration:', (duration / 1000).toFixed(3), 's');
    console.log('Frames:', frameCount);
    if (frameCount > 0 && duration > 0) {
      console.log('Avg FPS:', (frameCount / (duration / 1000)).toFixed(1));
    }
    if (data) {
      console.log('Data:', data);
    }
    console.groupEnd();
    
    this.phaseStartTimes.delete(phase);
    this.frameCounters.delete(phase);
  }

  // Frame logging
  logFrame(data: FrameData) {
    if (!this.enabled) return;
    
    const frameCount = this.frameCounters.get(data.phase) || 0;
    this.frameCounters.set(data.phase, frameCount + 1);
    
    const elapsed = this.getElapsedTime();
    const frameDelta = this.getFrameDelta();
    
    // Special formatting for RUBBER_BAND phase
    const elapsedMs = Math.round(elapsed * 1000);
    const phaseLabel = data.phase === DragPhase.RUBBER_BAND ? 'RUBBER' : data.phase;
    const header = `%c${phaseLabel} s${this.dragSessionSeq}.f${frameCount}@${elapsedMs}ms:`;
    
    const parts: string[] = [];
    
    parts.push(`Δt=${frameDelta.toFixed(1)}ms`);
    
    if (data.position) {
      const boundaries = getDateBoundaries();
      const startDate = data.position.subtract({ days: 364 });
      
      // Check if outside data window or display window
      const outsideDataWindow = data.position.compare(boundaries.latestDataDay) > 0 || 
                               startDate.compare(boundaries.earliestDataDay) < 0;
      const outsideDisplayWindow = data.position.compare(boundaries.latestDisplayDay) > 0 || 
                                  startDate.compare(boundaries.earliestDisplayDay) < 0;
      
      if (outsideDisplayWindow) {
        parts.push(`%cdisplayEnd=${data.position.toString()}%c`);
      } else if (outsideDataWindow) {
        parts.push(`%cdisplayEnd=${data.position.toString()}%c`);
      } else {
        parts.push(`displayEnd=${data.position.toString()}`);
      }
    }
    
    if (data.targetDate) {
      parts.push(`t=${data.targetDate.toString()}`);
    }
    
    if (data.velocity !== undefined) {
      parts.push(`v=${data.velocity.toFixed(1)}`);
    }
    
    if (data.acceleration !== undefined) {
      parts.push(`a=${data.acceleration.toFixed(1)}`);
    }
    
    if (data.displacement !== undefined) {
      if (data.isStuck) {
        parts.push(`%cd=${data.displacement.toFixed(0)} STUCK%c`);
      } else {
        parts.push(`d=${data.displacement.toFixed(0)}`);
      }
    }
    
    // Log any additional data
    const { phase, position, velocity, acceleration, displacement, targetDate, isStuck, ...rest } = data;
    
    // Check if we need color styling for displayEnd or STUCK
    const logString = header + ' ' + parts.join(', ');
    
    // Build styles array based on conditions
    const styles: string[] = [LogColors.FRAME];
    
    // Check for STUCK styling
    if (data.isStuck) {
      // Add red color for STUCK text
      styles.push('color: #FF0000; font-weight: bold');
      styles.push(''); // Reset style after STUCK
    }
    
    // Check for position-based styling
    if (data.position) {
      const boundaries = getDateBoundaries();
      const startDate = data.position.subtract({ days: 364 });
      
      const outsideDataWindow = data.position.compare(boundaries.latestDataDay) > 0 || 
                               startDate.compare(boundaries.earliestDataDay) < 0;
      const outsideDisplayWindow = data.position.compare(boundaries.latestDisplayDay) > 0 || 
                                  startDate.compare(boundaries.earliestDisplayDay) < 0;
      
      if (outsideDisplayWindow) {
        // Apply purple color for outside display window
        if (!data.isStuck) {
          styles[1] = 'color: #9C27B0; font-weight: bold';
          styles[2] = '';
        }
      } else if (outsideDataWindow) {
        // Apply red color for outside data window
        if (!data.isStuck) {
          styles[1] = 'color: #FF0000; font-weight: bold';
          styles[2] = '';
        }
      }
    }
    
    // Only log rest if it has properties
    if (Object.keys(rest).length > 0) {
      console.log(logString, ...styles, rest);
    } else {
      console.log(logString, ...styles);
    }
  }

  // Event logging
  logEvent(event: string, data?: any) {
    if (!this.enabled) return;
    
    // Special handling for wheel events
    if (event === 'Wheel event' && !LOG_WHEEL_EVENTS) {
      return;
    }
    
    const elapsed = this.getElapsedTime();
    
    // For WHEEL events, format time as milliseconds with special format
    if (event.startsWith('WHEEL ')) {
      const elapsedMs = Math.round(elapsed * 1000);
      // Extract session.event from "WHEEL X.Y" format and reformat as "WHEEL sX.eY@Zms"
      const wheelMatch = event.match(/^WHEEL (\d+)\.(\d+)$/);
      if (wheelMatch) {
        const session = wheelMatch[1];
        const eventNum = wheelMatch[2];
        console.log(`%c⚡ WHEEL s${session}.e${eventNum}@${elapsedMs}ms ${data || ''}`, LogColors.EVENT);
      } else {
        console.log(`%c⚡ ${event}@${elapsedMs}ms ${data || ''}`, LogColors.EVENT);
      }
    } else {
      // Add session info to drag events
      const eventWithSession = event.includes('[session') ? event : `${event} [session ${this.dragSessionSeq}]`;
      console.log(`%c⚡ ${eventWithSession} @ ${elapsed.toFixed(1)}s`, LogColors.EVENT, data || '');
    }
  }

  // State logging
  logState(label: string, state: any) {
    if (!this.enabled) return;
    
    const elapsed = this.getElapsedTime();
    console.log(`%c📊 ${label} @ ${elapsed.toFixed(1)}s:`, LogColors.STATE, state);
  }

  // Warning logging
  logWarning(message: string, data?: any) {
    if (!this.enabled) return;
    
    const elapsed = this.getElapsedTime();
    console.warn(`%c⚠️  ${message} @ ${elapsed.toFixed(1)}s`, LogColors.WARNING, data || '');
  }

  // Error logging
  logError(message: string, error?: any) {
    if (!this.enabled) return;
    
    const elapsed = this.getElapsedTime();
    console.error(`%c❌ ${message} @ ${elapsed.toFixed(1)}s`, LogColors.ERROR, error || '');
  }

  // Utility methods
  formatDate(date: CalendarDate): string {
    return date.toString();
  }

  formatDelta(delta: number): string {
    return delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
  }

  // Group logging
  startGroup(label: string) {
    if (!this.enabled) return;
    const elapsed = this.getElapsedTime();
    console.group(`${label} @ ${elapsed.toFixed(1)}s`);
  }

  endGroup() {
    if (!this.enabled) return;
    console.groupEnd();
  }
}

// Export singleton instance
export const dragLogger = new DragLogger();

// Convenience functions
export function logDragPhaseStart(phase: DragPhase, data?: any) {
  dragLogger.logPhaseStart(phase, data);
}

export function logDragPhaseEnd(phase: DragPhase, data?: any) {
  dragLogger.logPhaseEnd(phase, data);
}

export function logDragFrame(data: FrameData) {
  dragLogger.logFrame(data);
}

export function logDragEvent(event: string, data?: any) {
  dragLogger.logEvent(event, data);
}

export function logDragState(label: string, state: any) {
  dragLogger.logState(label, state);
}

export function logDragWarning(message: string, data?: any) {
  dragLogger.logWarning(message, data);
}

export function logDragError(message: string, error?: any) {
  dragLogger.logError(message, error);
}

export function getDragSessionSeq(): number {
  return dragLogger.getSessionSeq();
}