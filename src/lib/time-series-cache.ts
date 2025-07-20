import { CalendarDate, parseDate } from '@internationalized/date';
import { CoalStripesData, PartialCoalStripesData, CoalUnit } from './types';
import { getCurrentTimeInAEST } from './date-utils';

export interface CacheEntry {
  year: number; // e.g., 2024
  data: CoalStripesData;
  lastAccessed: number;
}

export interface CacheStats {
  sizeMB: number;
  chunkCount: number;
}

export class TimeSeriesCache {
  private cache = new Map<string, CacheEntry>();
  private maxChunks: number;

  constructor(maxChunks: number = 5) {
    this.maxChunks = maxChunks;
  }

  /**
   * Get data for a specific date range, combining from multiple cached chunks if needed
   * V1: Combine cached years OR return partial data with missing info
   */
  getDataForDateRange(start: CalendarDate, end: CalendarDate): CoalStripesData | PartialCoalStripesData | null {
    
    // Get all required years for this range
    const requiredYears = this.getRequiredYears(start, end);
    
    // Check what years we have vs what we need
    const missingYears: number[] = [];
    const availableEntries: CacheEntry[] = [];
    
    for (const year of requiredYears) {
      const yearStart = parseDate(`${year}-01-01`);
      if (this.hasDataForDate(yearStart)) {
        const entry = this.cache.get(year.toString())!;
        availableEntries.push(entry);
        // Update access time
        entry.lastAccessed = Date.now();
      } else {
        missingYears.push(year);
      }
    }
    
    // If no data at all, return null
    if (availableEntries.length === 0) {
      // Don't log here - SmartCache will handle logging
      return null;
    }
    
    // If single year, filter to requested range
    if (requiredYears.length === 1) {
      const entry = availableEntries[0];
      const filteredData = this.filterDataToRange(entry.data, start, end);
      const days = end.compare(start) + 1;
      return filteredData;
    }
    
    // Multi-year case
    if (missingYears.length === 0) {
      // All years available - combine them!
      return this.combineYearData(availableEntries, start, end);
    } else {
      // Partial data available - return what we have with metadata
      // Don't log missing years here - it's handled by SmartCache
      return this.createPartialData(availableEntries, start, end, missingYears);
    }
  }

  /**
   * Add a year-long chunk to the cache
   */
  addChunk(year: number, data: CoalStripesData): void {
    const entry: CacheEntry = {
      year,
      data,
      lastAccessed: Date.now()
    };
    
    // Add to cache
    this.cache.set(year.toString(), entry);
    
    // Evict oldest if over limit
    this.evictIfOverLimit();
    
    console.log(`💾 Cached ${year} [${this.cache.size}/${this.maxChunks}]`);
  }

  /**
   * Check if we have data for a specific date
   */
  hasDataForDate(date: CalendarDate): boolean {
    const year = date.year.toString();
    const entry = this.cache.get(year);
    
    if (!entry) return false;
    
    // Check if date falls within the cached year
    return date.year === entry.year;
  }

  /**
   * Check if we have data for a specific year
   */
  hasYear(year: number): boolean {
    return this.cache.has(year.toString());
  }

  /**
   * Get cache statistics for logging
   */
  getCacheStats(): CacheStats {
    let totalDataPoints = 0;
    
    for (const entry of this.cache.values()) {
      // Count data points across all units
      const daysInYear = entry.year % 4 === 0 && (entry.year % 100 !== 0 || entry.year % 400 === 0) ? 366 : 365;
      totalDataPoints += daysInYear * (entry.data.data?.length || 0);
    }
    
    // More realistic estimate:
    // - Each data point: ~100 bytes (date string, number, object overhead)
    // - Additional overhead for structure
    const estimatedBytes = totalDataPoints * 100;
    const estimatedSizeMB = totalDataPoints > 0 
      ? Math.max(0.1, estimatedBytes / (1024 * 1024)) 
      : 0; // Return 0 for empty cache
    
    return {
      sizeMB: Math.round(estimatedSizeMB * 10) / 10, // Round to 1 decimal
      chunkCount: this.cache.size
    };
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    const stats = this.getCacheStats();
    this.cache.clear();
    console.log(`🗑️  Cache cleared: Released ${stats.sizeMB}MB (${stats.chunkCount} chunks)`);
  }

  /**
   * Get all years required to cover a date range
   */
  getRequiredYears(start: CalendarDate, end: CalendarDate): number[] {
    const years: number[] = [];
    let currentYear = start.year;
    
    while (currentYear <= end.year) {
      years.push(currentYear);
      currentYear++;
    }
    
    return years;
  }

  // V1 SIMPLIFICATION: Complex data combining moved to V2

  /**
   * Combine multiple year datasets into a single cross-year dataset
   */
  private combineYearData(entries: CacheEntry[], start: CalendarDate, end: CalendarDate): CoalStripesData {
    // Sort entries by year
    entries.sort((a, b) => a.year - b.year);
    
    // Build map of all units by duid
    const unitMap = new Map<string, CoalUnit>();
    
    // First pass: collect all unique units
    for (const entry of entries) {
      for (const unit of entry.data.data) {
        if (!unitMap.has(unit.duid)) {
          // Clone unit structure but with empty data array
          unitMap.set(unit.duid, {
            ...unit,
            history: {
              ...unit.history,
              data: []
            }
          });
        }
      }
    }
    
    // Calculate the date range and number of days
    const totalDays = end.compare(start) + 1;
    const dateArray: CalendarDate[] = [];
    let currentDate = start;
    while (currentDate.compare(end) <= 0) {
      dateArray.push(currentDate);
      currentDate = currentDate.add({ days: 1 });
    }
    
    // Second pass: combine data for each unit
    for (const [duid, combinedUnit] of unitMap) {
      // Initialize data array with nulls
      combinedUnit.history.data = new Array(totalDays).fill(null);
      
      // Fill in data from each year
      for (const entry of entries) {
        const sourceUnit = entry.data.data.find(u => u.duid === duid);
        if (!sourceUnit) continue;
        
        // Calculate offset for this year's data
        const yearStart = parseDate(sourceUnit.history.start);
        const startOffset = Math.max(0, yearStart.compare(start));
        
        // Copy data points that fall within our requested range
        for (let i = 0; i < sourceUnit.history.data.length; i++) {
          const dataDate = yearStart.add({ days: i });
          if (dataDate.compare(start) >= 0 && dataDate.compare(end) <= 0) {
            const targetIndex = dataDate.compare(start);
            combinedUnit.history.data[targetIndex] = sourceUnit.history.data[i];
          }
        }
      }
      
      // Update history metadata
      combinedUnit.history.start = start.toString();
      combinedUnit.history.last = end.toString();
    }
    
    // Convert map back to array and sort
    const units = Array.from(unitMap.values());
    units.sort((a, b) => {
      if (a.facility_name !== b.facility_name) {
        return a.facility_name.localeCompare(b.facility_name);
      }
      return a.duid.localeCompare(b.duid);
    });
    
    // Get current time in AEST timezone format
    const aestTime = getCurrentTimeInAEST();
    
    return {
      type: "capacity_factors" as const,
      version: "unknown",
      created_at: aestTime,
      data: units
    };
  }
  
  /**
   * Create partial data response with available years and missing info
   */
  private createPartialData(entries: CacheEntry[], start: CalendarDate, end: CalendarDate, missingYears: number[]): PartialCoalStripesData {
    // Get combined data for available years
    const baseData = this.combineYearData(entries, start, end);
    
    // Calculate missing date ranges
    const missingDateRanges = missingYears.map(year => {
      const yearStart = parseDate(`${year}-01-01`);
      const yearEnd = parseDate(`${year}-12-31`);
      
      // Calculate intersection with requested range
      const rangeStart = start.compare(yearStart) >= 0 ? start : yearStart;
      const rangeEnd = end.compare(yearEnd) <= 0 ? end : yearEnd;
      
      return {
        start: rangeStart.toString(),
        end: rangeEnd.toString(),
        reason: `Year ${year} data not cached`
      };
    });
    
    return {
      ...baseData,
      isPartial: true,
      missingYears,
      availableYears: entries.map(e => e.year).sort(),
      missingDateRanges
    };
  }

  /**
   * Evict oldest chunks if over the limit
   */
  private evictIfOverLimit(): void {
    while (this.cache.size > this.maxChunks) {
      // Find oldest entry
      let oldestKey = '';
      let oldestTime = Date.now();
      
      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        const evicted = this.cache.get(oldestKey)!;
        this.cache.delete(oldestKey);
        const days = evicted.year % 4 === 0 && (evicted.year % 100 !== 0 || evicted.year % 400 === 0) ? 366 : 365;
        console.log(`♻️  Evicted year ${oldestKey}: ${days} days (LRU)`);
      }
    }
  }

  /**
   * Filter cached data to a specific date range
   */
  private filterDataToRange(data: CoalStripesData, start: CalendarDate, end: CalendarDate): CoalStripesData {
    // Handle missing or empty data array
    if (!data.data || data.data.length === 0) {
      return {
        type: "capacity_factors" as const,
        version: data.version || '1.0',
        created_at: data.created_at || new Date().toISOString(),
        data: []
      };
    }
    
    // Calculate how many days to skip at start and end
    const firstUnit = data.data[0];
    if (!firstUnit) {
      return {
        type: "capacity_factors" as const,
        version: data.version,
        created_at: data.created_at,
        data: []
      };
    }
    
    const dataStart = parseDate(firstUnit.history.start);
    const dataEnd = parseDate(firstUnit.history.last);
    
    // Calculate indices for the requested range
    const skipStart = Math.max(0, start.compare(dataStart));
    const skipEnd = Math.max(0, dataEnd.compare(end));
    const totalDays = end.compare(start) + 1;
    
    // Filter units and their data
    const filteredUnits = data.data.map(unit => ({
      ...unit,
      history: {
        start: start.toString(),
        last: end.toString(),
        interval: unit.history.interval,
        data: unit.history.data.slice(skipStart, unit.history.data.length - skipEnd)
      }
    }));
    
    return {
      type: "capacity_factors" as const,
      version: data.version,
      created_at: data.created_at,
      data: filteredUnits
    };
  }
}