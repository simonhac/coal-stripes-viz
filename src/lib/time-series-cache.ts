import { CalendarDate, parseDate } from '@internationalized/date';
import { CoalStripesData, PartialCoalStripesData, CoalUnit } from './types';
import { perfMonitor } from './performance-monitor';
import { getCurrentTimeInAEST } from './date-utils';

export interface CacheEntry {
  year: number;
  data: CoalStripesData;
  // Pre-computed for fast access
  unitArrays: Map<string, (number | null)[]>; // duid -> array
  unitMetadata: Map<string, Omit<CoalUnit, 'history'>>; // duid -> unit info
  lastAccessed: number;
}

export interface CacheStats {
  chunkCount: number;
  sizeMB: number;
}

/**
 * Optimized time-series cache that stores year data efficiently
 * Key optimization: Keep original arrays, calculate indices on demand
 */
export class TimeSeriesCache {
  private cache = new Map<number, CacheEntry>(); // year -> entry
  private maxChunks: number;
  
  constructor(maxChunks: number = 5) {
    this.maxChunks = maxChunks;
  }

  /**
   * Get data for a specific date range - OPTIMIZED VERSION
   */
  getDataForDateRange(start: CalendarDate, end: CalendarDate): CoalStripesData | PartialCoalStripesData | null {
    perfMonitor.start('timeSeriesCache_getDataForDateRange', {
      start: start.toString(),
      end: end.toString()
    });
    
    // Get required years
    const requiredYears = this.getRequiredYears(start, end);
    
    // Quick check: do we have all the data?
    const missingYears: number[] = [];
    const availableEntries: CacheEntry[] = [];
    
    for (const year of requiredYears) {
      const entry = this.cache.get(year);
      if (entry) {
        availableEntries.push(entry);
        entry.lastAccessed = Date.now();
      } else {
        missingYears.push(year);
      }
    }
    
    if (availableEntries.length === 0) {
      perfMonitor.end('timeSeriesCache_getDataForDateRange', { result: 'miss' });
      return null;
    }
    
    // Single year case - just slice the arrays
    if (requiredYears.length === 1 && availableEntries.length === 1) {
      const result = perfMonitor.measure('timeSeriesCache_sliceSingleYear',
        () => this.sliceSingleYearData(availableEntries[0], start, end)
      );
      perfMonitor.end('timeSeriesCache_getDataForDateRange', { result: 'single_year_hit' });
      return result;
    }
    
    // Multi-year case
    if (missingYears.length === 0) {
      // All years available - create view without copying
      const result = perfMonitor.measure('timeSeriesCache_createMultiYearView',
        () => this.createMultiYearView(availableEntries, start, end)
      );
      perfMonitor.end('timeSeriesCache_getDataForDateRange', { result: 'multi_year_hit' });
      return result;
    } else {
      // Partial data
      const result = perfMonitor.measure('timeSeriesCache_createPartial',
        () => this.createPartialData(availableEntries, start, end, missingYears)
      );
      perfMonitor.end('timeSeriesCache_getDataForDateRange', { result: 'partial_hit' });
      return result;
    }
  }

  /**
   * Add a year chunk to cache with pre-computed lookups
   */
  addChunk(year: number, data: CoalStripesData): void {
    // Pre-compute lookups for fast access
    const unitArrays = new Map<string, (number | null)[]>();
    const unitMetadata = new Map<string, Omit<CoalUnit, 'history'>>();
    
    for (const unit of data.data) {
      unitArrays.set(unit.duid, unit.history.data);
      
      // Store metadata separately
      const { history, ...metadata } = unit;
      unitMetadata.set(unit.duid, metadata);
    }
    
    const entry: CacheEntry = {
      year,
      data,
      unitArrays,
      unitMetadata,
      lastAccessed: Date.now()
    };
    
    this.cache.set(year, entry);
    this.evictIfOverLimit();
    
    console.log(`💾 Cached ${year} [${this.cache.size}/${this.maxChunks}]`);
  }

  /**
   * Slice data from a single year - FAST VERSION
   */
  private sliceSingleYearData(entry: CacheEntry, start: CalendarDate, end: CalendarDate): CoalStripesData {
    const yearStart = parseDate(`${entry.year}-01-01`);
    
    // Calculate array indices
    const startIndex = this.getDayIndex(start, yearStart);
    const endIndex = this.getDayIndex(end, yearStart);
    const length = endIndex - startIndex + 1;
    
    // Build result by slicing arrays
    const units: CoalUnit[] = [];
    
    for (const [duid, metadata] of entry.unitMetadata) {
      const sourceArray = entry.unitArrays.get(duid)!;
      
      // Just slice the array - no copying!
      const slicedData = sourceArray.slice(startIndex, endIndex + 1);
      
      units.push({
        ...metadata,
        history: {
          start: start.toString(),
          last: end.toString(),
          interval: '1d',
          data: slicedData
        }
      });
    }
    
    return {
      type: 'capacity_factors',
      version: '1.0',
      created_at: getCurrentTimeInAEST(),
      data: units
    };
  }

  /**
   * Create multi-year view WITHOUT copying arrays - OPTIMIZED
   */
  private createMultiYearView(entries: CacheEntry[], start: CalendarDate, end: CalendarDate): CoalStripesData {
    // Sort by year
    entries.sort((a, b) => a.year - b.year);
    
    // Get all unique units
    const allDuids = new Set<string>();
    for (const entry of entries) {
      for (const duid of entry.unitMetadata.keys()) {
        allDuids.add(duid);
      }
    }
    
    // Build result
    const units: CoalUnit[] = [];
    const totalDays = end.compare(start) + 1;
    
    for (const duid of allDuids) {
      // Get metadata from first entry that has this unit
      let metadata: Omit<CoalUnit, 'history'> | undefined;
      for (const entry of entries) {
        metadata = entry.unitMetadata.get(duid);
        if (metadata) break;
      }
      
      if (!metadata) continue;
      
      // Pre-allocate array
      const combinedData: (number | null)[] = new Array(totalDays);
      
      // Process each year's data in chunks
      let outputIndex = 0;
      let currentDate = start;
      
      while (currentDate.compare(end) <= 0) {
        const year = currentDate.year;
        const entry = entries.find(e => e.year === year);
        
        if (entry && entry.unitArrays.has(duid)) {
          const sourceArray = entry.unitArrays.get(duid)!;
          const yearStart = parseDate(`${year}-01-01`);
          const yearEnd = parseDate(`${year}-12-31`);
          
          // Calculate how many days to copy from this year
          const copyStart = currentDate.compare(yearStart) > 0 ? currentDate : yearStart;
          const copyEnd = end.compare(yearEnd) < 0 ? end : yearEnd;
          
          const startIndex = this.getDayIndex(copyStart, yearStart);
          const endIndex = this.getDayIndex(copyEnd, yearStart);
          const copyLength = endIndex - startIndex + 1;
          
          // Copy the chunk efficiently using splice with spread
          const slice = sourceArray.slice(startIndex, endIndex + 1);
          combinedData.splice(outputIndex, slice.length, ...slice);
          
          // Move to next year
          outputIndex += copyLength;
          currentDate = copyEnd.add({ days: 1 });
        } else {
          // No data for this year - fill with nulls efficiently
          const yearEnd = parseDate(`${year}-12-31`);
          const fillEnd = end.compare(yearEnd) < 0 ? end : yearEnd;
          const fillDays = fillEnd.compare(currentDate) + 1;
          
          // Use splice with spread for efficient null filling
          const nulls = new Array(fillDays).fill(null);
          combinedData.splice(outputIndex, fillDays, ...nulls);
          
          outputIndex += fillDays;
          currentDate = fillEnd.add({ days: 1 });
        }
      }
      
      units.push({
        ...metadata,
        history: {
          start: start.toString(),
          last: end.toString(),
          interval: '1d',
          data: combinedData
        }
      });
    }
    
    return {
      type: 'capacity_factors',
      version: '1.0',
      created_at: getCurrentTimeInAEST(),
      data: units
    };
  }

  /**
   * Get day index within a year (0-based)
   */
  private getDayIndex(date: CalendarDate, yearStart: CalendarDate): number {
    // Simple calculation - days since year start
    return date.compare(yearStart);
  }

  /**
   * Get all years needed for a date range
   */
  private getRequiredYears(start: CalendarDate, end: CalendarDate): number[] {
    const years: number[] = [];
    for (let year = start.year; year <= end.year; year++) {
      years.push(year);
    }
    return years;
  }

  /**
   * Check if we have data for a specific date
   */
  hasDataForDate(date: CalendarDate): boolean {
    return this.cache.has(date.year);
  }

  /**
   * Check if we have data for a specific year
   */
  hasYear(year: number): boolean {
    return this.cache.has(year);
  }

  /**
   * Create partial data response
   */
  private createPartialData(
    availableEntries: CacheEntry[], 
    start: CalendarDate, 
    end: CalendarDate, 
    missingYears: number[]
  ): PartialCoalStripesData {
    // Use the optimized multi-year view for available data
    const baseData = this.createMultiYearView(availableEntries, start, end);
    
    const availableYears = availableEntries.map(e => e.year);
    
    const missingRanges = missingYears.map(year => ({
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      reason: 'Year not in cache'
    }));
    
    return {
      ...baseData,
      isPartial: true,
      missingYears,
      availableYears,
      missingDateRanges: missingRanges
    };
  }

  /**
   * Evict oldest entries if over limit
   */
  private evictIfOverLimit(): void {
    while (this.cache.size > this.maxChunks) {
      // Find least recently accessed
      let oldestTime = Date.now();
      let oldestYear = -1;
      
      for (const [year, entry] of this.cache) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestYear = year;
        }
      }
      
      if (oldestYear !== -1) {
        const entry = this.cache.get(oldestYear);
        if (entry) {
          const days = entry.data.data[0]?.history.data.length || 0;
          console.log(`♻️  Evicted year ${oldestYear}: ${days} days (LRU)`);
          this.cache.delete(oldestYear);
        }
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    let totalDataPoints = 0;
    
    for (const entry of this.cache.values()) {
      const unitsCount = entry.data.data.length;
      const daysCount = entry.data.data[0]?.history.data.length || 0;
      totalDataPoints += unitsCount * daysCount;
    }
    
    // Rough estimate: 4 bytes per number + overhead
    const sizeMB = (totalDataPoints * 8) / (1024 * 1024);
    
    return {
      chunkCount: this.cache.size,
      sizeMB: Math.round(sizeMB * 100) / 100
    };
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    const stats = this.getCacheStats();
    this.cache.clear();
    
    if (stats.chunkCount > 0) {
      console.log(`🗑️  Cache cleared: Released ${stats.sizeMB}MB (${stats.chunkCount} chunks)`);
    } else {
      console.log(`🗑️  Cache cleared: Released 0MB (0 chunks)`);
    }
  }
}