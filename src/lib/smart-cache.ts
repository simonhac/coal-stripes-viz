import { CalendarDate, parseDate } from '@internationalized/date';
import { CoalStripesData, PartialCoalStripesData } from './types';
import { TimeSeriesCache } from './time-series-cache';

/**
 * Smart cache that handles server communication and caching logic
 * This is the ONLY interface between React components and data
 */
export class SmartCache {
  private cache: TimeSeriesCache;
  private pendingRequests = new Map<string, Promise<CoalStripesData>>();

  constructor(maxChunks: number = 5) {
    this.cache = new TimeSeriesCache(maxChunks);
  }

  /**
   * MAIN METHOD: Get data for date range
   * Handles cache hits, misses, and partial data seamlessly
   */
  async getDataForDateRange(
    start: CalendarDate, 
    end: CalendarDate
  ): Promise<CoalStripesData | PartialCoalStripesData> {
    const startTime = performance.now();
    
    // STEP 1: Check cache first
    const cachedResult = this.cache.getDataForDateRange(start, end);
    if (cachedResult) {
      const elapsed = Math.round(performance.now() - startTime);
      
      if ('isPartial' in cachedResult) {
        console.log(`📦 Partial cache hit: ${start.toString()} → ${end.toString()} | ${elapsed}ms | Missing: ${cachedResult.missingYears.join(', ')}`);
        
        // Launch background fetch for missing years (don't await)
        this.backgroundFetchMissingYears(cachedResult.missingYears);
        
        return cachedResult;
      } else {
        console.log(`✅ Complete cache hit: ${start.toString()} → ${end.toString()} | ${elapsed}ms`);
        return cachedResult;
      }
    }

    // STEP 2: Cache miss - fetch required years
    const requiredYears = this.getRequiredYears(start, end);
    const fetchPromises: Promise<CoalStripesData>[] = [];
    
    for (const year of requiredYears) {
      const yearStart = parseDate(`${year}-01-01`);
      
      // Skip if already cached
      if (this.cache.hasDataForDate(yearStart)) {
        continue;
      }
      
      // Skip if already being fetched
      const requestKey = year.toString();
      if (this.pendingRequests.has(requestKey)) {
        fetchPromises.push(this.pendingRequests.get(requestKey)!);
        continue;
      }
      
      // Start fetch for this year
      const fetchPromise = this.fetchYearFromServer(year);
      this.pendingRequests.set(requestKey, fetchPromise);
      fetchPromises.push(fetchPromise);
      
      // Clean up on completion
      fetchPromise.finally(() => {
        this.pendingRequests.delete(requestKey);
      });
    }
    
    // STEP 3: Wait for required data
    if (fetchPromises.length > 0) {
      console.log(`⏳ Fetching ${fetchPromises.length} year(s) of data from server...`);
      await Promise.all(fetchPromises);
    }
    
    // STEP 4: Try cache again after fetch
    const result = this.cache.getDataForDateRange(start, end);
    const elapsed = Math.round(performance.now() - startTime);
    
    if (result) {
      if ('isPartial' in result) {
        console.log(`📦 Partial result after fetch: ${start.toString()} → ${end.toString()} | ${elapsed}ms | Still missing: ${result.missingYears.join(', ')}`);
      } else {
        console.log(`✅ Complete result after fetch: ${start.toString()} → ${end.toString()} | ${elapsed}ms`);
      }
      return result;
    } else {
      throw new Error(`Failed to retrieve data for range ${start.toString()} → ${end.toString()}`);
    }
  }

  /**
   * Launch background fetch for missing years (non-blocking)
   */
  private backgroundFetchMissingYears(missingYears: number[]): void {
    console.log(`🔄 Background fetching missing years: ${missingYears.join(', ')}`);
    
    for (const year of missingYears) {
      const requestKey = year.toString();
      
      // Skip if already being fetched
      if (this.pendingRequests.has(requestKey)) {
        continue;
      }
      
      // Start background fetch
      const fetchPromise = this.fetchYearFromServer(year);
      this.pendingRequests.set(requestKey, fetchPromise);
      
      // Clean up on completion (don't await)
      fetchPromise.finally(() => {
        this.pendingRequests.delete(requestKey);
      });
    }
  }

  /**
   * Fetch a year of data from the server and cache it
   * Handles leap years by splitting into multiple requests if needed
   */
  private async fetchYearFromServer(year: number): Promise<CoalStripesData> {
    const yearStart = parseDate(`${year}-01-01`);
    const yearEnd = parseDate(`${year}-12-31`);
    const daysInYear = yearEnd.compare(yearStart) + 1;
    
    const startTime = Date.now();
    console.log(`🔄 Fetching year ${year} from server... (${daysInYear} days${daysInYear === 366 ? ' - LEAP YEAR' : ''})`);
    
    // Simple API call - the server handles leap year splitting internally
    const response = await fetch(`/api/coal-stripes?year=${year}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    const fetchTime = Date.now() - startTime;
    
    // Log completion with time
    console.log(`✅ Fetched year ${year} from server (${fetchTime}ms)`);
    
    // Cache the result
    this.cache.addChunk(year, result);
    
    return result;
  }

  /**
   * Merge two CoalStripesData objects (for leap year handling)
   * Note: This method is no longer needed with the new unit-based structure
   * The backend handles merging internally now
   */
  private mergeCoalStripesData(data1: CoalStripesData, data2: CoalStripesData): CoalStripesData {
    // Simply return the first dataset as merging is handled server-side
    return data1;
  }

  /**
   * Get all years needed to cover a date range
   */
  private getRequiredYears(start: CalendarDate, end: CalendarDate): number[] {
    const years: number[] = [];
    let currentYear = start.year;
    
    while (currentYear <= end.year) {
      years.push(currentYear);
      currentYear++;
    }
    
    return years;
  }

  /**
   * Check if we have data for a specific date
   */
  hasDataForDate(date: CalendarDate): boolean {
    return this.cache.hasDataForDate(date);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getCacheStats();
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }
}