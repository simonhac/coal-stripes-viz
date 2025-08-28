/**
 * Tile Monitor - Tracks tile rendering state and mouse position
 */

import { CalendarDate } from '@internationalized/date';

export interface TileState {
  offset: number;
  overstep: number | null;
  dateRange: {
    start: string;
    end: string;
  };
  mousePosition: {
    dayOffset: number | null;
    date: string | null;
    facility: string | null;
    unit: string | null;
    capacityFactor: number | null;
  };
}

class TileMonitor {
  private static instance: TileMonitor;
  private state: TileState = {
    offset: 0,
    overstep: null,
    dateRange: {
      start: '',
      end: ''
    },
    mousePosition: {
      dayOffset: null,
      date: null,
      facility: null,
      unit: null,
      capacityFactor: null
    }
  };
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): TileMonitor {
    if (!TileMonitor.instance) {
      TileMonitor.instance = new TileMonitor();
    }
    return TileMonitor.instance;
  }

  /**
   * Update tile state (called when tile is painted)
   */
  updateTileState(offset: number, overstep: number | null, startDate: CalendarDate, endDate: CalendarDate) {
    this.state.offset = offset;
    this.state.overstep = overstep;
    this.state.dateRange = {
      start: startDate.toString(),
      end: endDate.toString()
    };
    this.notifyListeners();
  }

  /**
   * Update mouse position (called from tooltip)
   */
  updateMousePosition(
    dayOffset: number | null,
    date: string | null,
    facility: string | null,
    unit: string | null,
    capacityFactor: number | null
  ) {
    this.state.mousePosition = {
      dayOffset,
      date,
      facility,
      unit,
      capacityFactor
    };
    this.notifyListeners();
  }

  /**
   * Clear mouse position when tooltip is hidden
   */
  clearMousePosition() {
    this.state.mousePosition = {
      dayOffset: null,
      date: null,
      facility: null,
      unit: null,
      capacityFactor: null
    };
    this.notifyListeners();
  }

  /**
   * Get current state
   */
  getState(): TileState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}

export const tileMonitor = TileMonitor.getInstance();