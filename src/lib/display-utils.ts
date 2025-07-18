import { CalendarDate } from '@internationalized/date';

/**
 * Utility functions for displaying and visualizing coal data
 */
export class CoalDisplayUtils {
  /**
   * Calculate capacity factor as percentage
   */
  static calculateCapacityFactor(dailyEnergyMWh: number, capacityMW: number): number {
    if (!capacityMW || capacityMW <= 0) return 0;
    
    const maxPossibleMWh = capacityMW * 24;
    const capacityFactor = (dailyEnergyMWh / maxPossibleMWh) * 100;
    
    return Math.min(100, capacityFactor);
  }

  /**
   * Get shade character for capacity factor (for ASCII visualization)
   */
  static getShadeCharacter(capacityFactor: number): string {
    const SHADES = {
      offline: 'X',
      shades: ['█', '▉', '▊', '▋', '▌', '▍', '▎', '▏', '░', '·']
    };
    
    if (capacityFactor <= 0) return SHADES.offline;
    
    const shadeIndex = Math.min(9, Math.floor((100 - capacityFactor) / 10));
    return SHADES.shades[shadeIndex];
  }

  /**
   * Format date in Australian format (DD/MM)
   */
  static formatDateAU(date: CalendarDate): string {
    return `${date.day.toString().padStart(2, '0')}/${date.month.toString().padStart(2, '0')}`;
  }

  /**
   * Create date headers for weekly alignment
   */
  static createWeeklyHeaders(dates: CalendarDate[]): string {
    const headerChars = new Array(dates.length).fill(' ');
    
    // Place dates at weekly intervals (every 7 days)
    for (let i = 0; i < dates.length; i += 7) {
      const dateStr = this.formatDateAU(dates[i]);
      // Place the date starting at position i
      for (let j = 0; j < dateStr.length && i + j < dates.length; j++) {
        headerChars[i + j] = dateStr[j];
      }
    }
    
    return headerChars.join('');
  }
}