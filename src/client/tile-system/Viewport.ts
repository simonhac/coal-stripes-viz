import { ViewportInfo, TileKey } from './types';
import { CalendarDate } from '@internationalized/date';
import { getDaysBetween, isLeapYear } from '@/shared/date-utils';

export interface ViewportConfig {
  containerWidth: number;
  containerHeight: number;
  startDate: CalendarDate;
  endDate: CalendarDate;
  facilityNames: string[];
  facilityHeights: Map<string, number>; // facility -> total height
}

export class Viewport {
  private config: ViewportConfig;
  private currentX: number = 0;
  private currentY: number = 0;
  
  constructor(config: ViewportConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<ViewportConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setPosition(x: number, y: number): void {
    this.currentX = x;
    this.currentY = y;
  }

  pan(deltaX: number, deltaY: number): void {
    this.currentX += deltaX;
    this.currentY += deltaY;
  }

  /**
   * Calculate which tiles are visible in the current viewport
   */
  getVisibleTiles(): TileKey[] {
    const visibleTiles: TileKey[] = [];
    
    // Get the year range from config
    const startYear = this.config.startDate.year;
    const endYear = this.config.endDate.year;
    const facility = this.config.facilityNames[0];
    
    // Return tiles for all years in the range
    for (let year = startYear; year <= endYear; year++) {
      visibleTiles.push({ facilityName: facility, year });
    }
    
    return visibleTiles;
  }

  /**
   * Get tiles that should be preloaded (adjacent to visible)
   */
  getPreloadTiles(): TileKey[] {
    // Don't preload for now - we only have current year data
    return [];
  }

  /**
   * Convert a tile position to pixel coordinates
   */
  getTilePosition(key: TileKey): { x: number; y: number; width: number; height: number } {
    // Calculate x position based on year
    const yearStart = this.config.startDate.set({ year: key.year, month: 1, day: 1 });
    
    // Calculate days between dates efficiently
    const daysSinceStartCount = getDaysBetween(this.config.startDate, yearStart);
    
    const pixelsPerDay = this.getPixelsPerDay();
    const x = daysSinceStartCount * pixelsPerDay - this.currentX;
    
    // Calculate width (days in year * pixels per day)
    const daysInYear = isLeapYear(key.year) ? 366 : 365;
    const width = daysInYear * pixelsPerDay;
    
    // For now, y is 0 and height is from config
    const y = -this.currentY;
    const height = this.config.facilityHeights.get(key.facilityName) || 100;
    
    return { x, y, width, height };
  }

  getPixelsPerDay(): number {
    // Calculate based on viewport width and total days in range
    const totalDays = this.getTotalDays();
    return this.config.containerWidth / totalDays;
  }

  getTotalDays(): number {
    return getDaysBetween(this.config.startDate, this.config.endDate) + 1;
  }


  getViewportInfo(): ViewportInfo {
    const pixelsPerDay = this.getPixelsPerDay();
    const scrollDays = Math.floor(this.currentX / pixelsPerDay);
    
    // Calculate viewport start date by subtracting scroll days
    const startDate = this.config.startDate.subtract({ days: scrollDays });
    
    // Calculate viewport end date based on visible width
    const visibleDays = Math.floor(this.config.containerWidth / pixelsPerDay);
    const endDate = startDate.add({ days: visibleDays });
    
    return {
      startDate: startDate.toDate('Australia/Brisbane'),
      endDate: endDate.toDate('Australia/Brisbane'),
      width: this.config.containerWidth,
      height: this.config.containerHeight,
      pixelsPerDay
    };
  }
}