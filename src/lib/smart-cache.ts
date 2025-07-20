import { CalendarDate, parseDate, today } from '@internationalized/date';
import { CoalStripesData, PartialCoalStripesData } from './types';
import { TimeSeriesCache } from './time-series-cache';

/**
 * Smart cache that handles server communication and caching logic
 * This is the ONLY interface between React components and data
 */
export class SmartCache {
  private cache: TimeSeriesCache;
  private pendingRequests = new Map<string, Promise<CoalStripesData>>();
  private updateCallbacks = new Set<(year: number) => void>();
  private lastFetchTime = 0;
  private readonly RATE_LIMIT_DELAY = 1500; // 1.5 seconds between API calls
  private lastRequestRange: { start: CalendarDate; end: CalendarDate } | null = null;

  constructor(maxChunks: number = 5) {
    this.cache = new TimeSeriesCache(maxChunks);
  }
  
  /**
   * Subscribe to background data updates
   */
  onBackgroundUpdate(callback: (year: number) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }
  
  /**
   * Preload data based on current view and pan direction
   * @param currentStart Current view start date
   * @param currentEnd Current view end date
   * @param direction 'forward' (toward future) or 'backward' (toward past)
   */
  preloadAdjacentData(
    currentStart: CalendarDate,
    currentEnd: CalendarDate,
    direction: 'forward' | 'backward' | 'both' = 'both'
  ): void {
    const viewDuration = currentEnd.toDate('UTC').getTime() - currentStart.toDate('UTC').getTime();
    const viewDays = Math.round(viewDuration / (1000 * 60 * 60 * 24));
    
    // Preload 3 pages in the primary direction, 1 in the opposite
    const forwardPages = direction === 'backward' ? 1 : 3;
    const backwardPages = direction === 'forward' ? 1 : 3;
    
    // Collect all years that need preloading
    const allYearsToPreload = new Set<number>();
    
    // Check forward pages
    if (direction !== 'backward') {
      for (let page = 1; page <= forwardPages; page++) {
        const preloadStart = currentEnd.add({ days: (page - 1) * viewDays + 1 });
        const preloadEnd = currentEnd.add({ days: page * viewDays });
        
        // Don't preload beyond yesterday
        const yesterday = today('Australia/Brisbane').subtract({ days: 1 });
        if (preloadStart.compare(yesterday) <= 0) {
          const constrainedEnd = preloadEnd.compare(yesterday) > 0 ? yesterday : preloadEnd;
          const years = this.getRequiredYears(preloadStart, constrainedEnd);
          years.forEach(year => {
            if (!this.cache.hasYear(year)) {
              allYearsToPreload.add(year);
            }
          });
        }
      }
    }
    
    // Check backward pages  
    if (direction !== 'forward') {
      for (let page = 1; page <= backwardPages; page++) {
        const preloadEnd = currentStart.subtract({ days: (page - 1) * viewDays + 1 });
        const preloadStart = currentStart.subtract({ days: page * viewDays });
        const years = this.getRequiredYears(preloadStart, preloadEnd);
        years.forEach(year => {
          if (!this.cache.hasYear(year)) {
            allYearsToPreload.add(year);
          }
        });
      }
    }
    
    // Log and start preloading
    if (allYearsToPreload.size > 0) {
      const yearsList = Array.from(allYearsToPreload).sort((a, b) => 
        direction === 'backward' ? b - a : a - b
      );
      console.log(`📦 Preloading ${yearsList.length} years: ${yearsList.join(' → ')}`);
      
      // Start the actual preloading
      this.startBackgroundPreloading(currentStart, currentEnd, direction, forwardPages, backwardPages, viewDays);
    }
  }
  
  /**
   * Start background preloading (actual work)
   */
  private startBackgroundPreloading(
    currentStart: CalendarDate,
    currentEnd: CalendarDate,
    direction: 'forward' | 'backward' | 'both',
    forwardPages: number,
    backwardPages: number,
    viewDays: number
  ): void {
    // Preload forward (toward more recent dates)
    if (direction !== 'backward') {
      for (let page = 1; page <= forwardPages; page++) {
        const preloadStart = currentEnd.add({ days: (page - 1) * viewDays + 1 });
        const preloadEnd = currentEnd.add({ days: page * viewDays });
        
        // Don't preload beyond yesterday
        const yesterday = today('Australia/Brisbane').subtract({ days: 1 });
        if (preloadStart.compare(yesterday) <= 0) {
          const constrainedEnd = preloadEnd.compare(yesterday) > 0 ? yesterday : preloadEnd;
          this.backgroundPreload(preloadStart, constrainedEnd, false);
        }
      }
    }
    
    // Preload backward (toward older dates)
    if (direction !== 'forward') {
      // Collect all ranges first
      const backwardRanges: Array<{start: CalendarDate, end: CalendarDate}> = [];
      for (let page = 1; page <= backwardPages; page++) {
        const preloadEnd = currentStart.subtract({ days: (page - 1) * viewDays + 1 });
        const preloadStart = currentStart.subtract({ days: page * viewDays });
        backwardRanges.push({ start: preloadStart, end: preloadEnd });
      }
      
      // Process in reverse order (most recent first)
      for (const range of backwardRanges.reverse()) {
        this.backgroundPreload(range.start, range.end, direction === 'backward');
      }
    }
  }
  
  /**
   * Background preload without blocking
   */
  private backgroundPreload(start: CalendarDate, end: CalendarDate, isBackwardPreload: boolean = false): void {
    // Check if we already have all the data
    const cachedResult = this.cache.getDataForDateRange(start, end);
    if (cachedResult && !('isPartial' in cachedResult)) {
      return; // Already fully cached
    }
    
    // Get required years
    const requiredYears = this.getRequiredYears(start, end);
    const missingYears = requiredYears.filter(year => {
      return !this.cache.hasYear(year);
    });
    
    if (missingYears.length > 0) {
      // For backward preloading, reverse the order
      const yearsToFetch = isBackwardPreload ? [...missingYears].reverse() : missingYears;
      this.backgroundFetchMissingYears(yearsToFetch);
    }
  }

  /**
   * MAIN METHOD: Get data for date range
   * Handles cache hits, misses, and partial data seamlessly
   */
  async getDataForDateRange(
    start: CalendarDate, 
    end: CalendarDate,
    isUIRequest: boolean = true
  ): Promise<CoalStripesData | PartialCoalStripesData> {
    const startTime = performance.now();
    
    // STEP 1: Check cache first
    const cachedResult = this.cache.getDataForDateRange(start, end);
    if (cachedResult) {
      const elapsed = Math.round(performance.now() - startTime);
      
      if ('isPartial' in cachedResult) {
        if (isUIRequest) {
          console.log(`🔍 Cache lookup: ${start.toString()} → ${end.toString()} ❌ partial miss (${elapsed}ms)`);
        }
        
        // Launch background fetch for missing years (don't await)
        this.backgroundFetchMissingYears(cachedResult.missingYears);
        
        return cachedResult;
      } else {
        if (isUIRequest) {
          console.log(`🔍 Cache lookup: ${start.toString()} → ${end.toString()} ✅ hit (${elapsed}ms)`);
          
          // Auto-detect direction and preload
          this.autoPreload(start, end);
        }
        return cachedResult;
      }
    }

    // STEP 2: Cache miss - fetch required years
    const requiredYears = this.getRequiredYears(start, end);
    const fetchPromises: Promise<CoalStripesData>[] = [];
    
    for (const year of requiredYears) {
      // Skip if already cached
      if (this.cache.hasYear(year)) {
        continue;
      }
      
      // Skip if already being fetched
      const requestKey = year.toString();
      if (this.pendingRequests.has(requestKey)) {
        fetchPromises.push(this.pendingRequests.get(requestKey)!);
        continue;
      }
      
      // Start fetch for this year (no rate limit for initial load)
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
      const elapsed = Math.round(performance.now() - startTime);
      if (isUIRequest) {
        console.log(`🔍 Cache lookup: ${start.toString()} → ${end.toString()} ❌❌ complete miss (${elapsed}ms)`);
      }
      await Promise.all(fetchPromises);
    }
    
    // STEP 4: Try cache again after fetch
    const result = this.cache.getDataForDateRange(start, end);
    const elapsed = Math.round(performance.now() - startTime);
    
    if (result) {
      if ('isPartial' in result) {
        if (isUIRequest) {
          console.log(`📦 Partial result after fetch: ${start.toString()} → ${end.toString()} | ${elapsed}ms | Still missing: ${result.missingYears.join(', ')}`);
        }
      } else {
        if (isUIRequest) {
          console.log(`✅ Complete result after fetch: ${start.toString()} → ${end.toString()} | ${elapsed}ms`);
        }
      }
      
      // Store this request for direction detection and preload
      if (isUIRequest) {
        this.autoPreload(start, end);
      }
      
      return result;
    } else {
      throw new Error(`Failed to retrieve data for range ${start.toString()} → ${end.toString()}`);
    }
  }

  /**
   * Auto-detect pan direction and trigger preloading
   */
  private autoPreload(start: CalendarDate, end: CalendarDate): void {
    if (!this.lastRequestRange) {
      // First request - preload both directions
      this.preloadAdjacentData(start, end, 'both');
    } else {
      // Compare with last request to detect direction
      const lastStart = this.lastRequestRange.start;
      const lastEnd = this.lastRequestRange.end;
      
      if (start.compare(lastStart) > 0) {
        // Moving forward in time (toward more recent dates)
        this.preloadAdjacentData(start, end, 'forward');
      } else if (start.compare(lastStart) < 0) {
        // Moving backward in time (toward older dates)
        this.preloadAdjacentData(start, end, 'backward');
      }
      // If equal, no direction change - no additional preloading needed
    }
    
    // Store current request for next comparison
    this.lastRequestRange = { start, end };
  }

  /**
   * Launch background fetch for missing years (non-blocking)
   */
  private async backgroundFetchMissingYears(missingYears: number[]): Promise<void> {
    // Process years sequentially with delay to avoid rate limiting
    for (let i = 0; i < missingYears.length; i++) {
      const year = missingYears[i];
      const requestKey = year.toString();
      
      // Skip if already being fetched
      if (this.pendingRequests.has(requestKey)) {
        // Wait for the existing request to complete before continuing
        await this.pendingRequests.get(requestKey);
        continue;
      }
      
      // Add delay between fetches (except for the first one)
      if (i > 0) {
        const timeSinceLastFetch = Date.now() - this.lastFetchTime;
        const remainingDelay = this.RATE_LIMIT_DELAY - timeSinceLastFetch;
        if (remainingDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingDelay));
        }
      }
      
      // Start fetch and wait for it to complete before starting the next one
      const fetchPromise = this.fetchYearFromServerWithRateLimit(year);
      this.pendingRequests.set(requestKey, fetchPromise);
      
      try {
        // Wait for this fetch to complete before starting the next
        await fetchPromise;
        
        // Notify all callbacks
        this.updateCallbacks.forEach(callback => callback(year));
      } finally {
        this.pendingRequests.delete(requestKey);
      }
    }
  }

  /**
   * Fetch with rate limiting for background/preload requests
   */
  private async fetchYearFromServerWithRateLimit(year: number): Promise<CoalStripesData> {
    // Enforce rate limit
    const timeSinceLastFetch = Date.now() - this.lastFetchTime;
    const remainingDelay = this.RATE_LIMIT_DELAY - timeSinceLastFetch;
    if (remainingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
    }
    
    return this.fetchYearFromServer(year);
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
    const url = `/api/coal-stripes?year=${year}`;
    console.log(`🌐 API fetching ${year}`);
    
    try {
      // Simple API call - the server handles leap year splitting internally
      const response = await fetch(url);
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use status text
          errorMessage = `${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      // Cache the result
      this.cache.addChunk(year, result);
      
      // Update last fetch time
      this.lastFetchTime = Date.now();
      
      return result;
    } catch (error) {
      const fetchTime = Date.now() - startTime;
      console.error(`❌ API fetch ${year} failed after ${fetchTime}ms:`, error);
      throw error;
    }
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
   * Check if we have data for a specific year
   */
  hasYear(year: number): boolean {
    return this.cache.hasYear(year);
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