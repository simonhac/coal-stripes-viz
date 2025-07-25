import { CalendarDate, parseDate, today } from '@internationalized/date';
import { GeneratingUnitCapFacHistoryDTO } from '@/shared/types';
import { LRUCache } from '@/client/lru-cache';
import { perfMonitor } from '@/shared/performance-monitor';
import { CACHE_CONFIG } from '@/shared/config';
import { getDayIndex } from '@/shared/date-utils';

/**
 * Capacity factor cache that handles server communication and caching logic
 * This is the ONLY interface between React components and data
 */
export class CapFacCache {
  private cache: LRUCache<GeneratingUnitCapFacHistoryDTO>;
  private pendingRequests = new Map<string, Promise<GeneratingUnitCapFacHistoryDTO>>();
  private updateCallbacks = new Set<(year: number) => void>();
  private lastFetchTime = 0;
  private enablePreloading: boolean;
  private preloadPromises = new Set<Promise<any>>();

  constructor(maxYears: number = CACHE_CONFIG.MAX_CHUNKS, enablePreloading: boolean = CACHE_CONFIG.ENABLE_PRELOADING) {
    this.cache = new LRUCache<GeneratingUnitCapFacHistoryDTO>(maxYears);
    this.enablePreloading = enablePreloading;
  }
  
  /**
   * Subscribe to background data updates
   */
  onBackgroundUpdate(callback: (year: number) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }
  
  /**
   * Get data for a specific year
   */
  async getYearData(year: number): Promise<GeneratingUnitCapFacHistoryDTO | null> {
    // Check cache first
    const cached = this.cache.get(year.toString());
    if (cached) {
      return cached;
    }

    // Check if already being fetched
    const requestKey = year.toString();
    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey)!;
    }

    // Fetch from server
    const fetchPromise = this.fetchYearFromServer(year);
    this.pendingRequests.set(requestKey, fetchPromise);
    
    // Clean up on completion
    fetchPromise.finally(() => {
      this.pendingRequests.delete(requestKey);
    }).catch(() => {
      // Silently catch to prevent unhandled rejection if cleared
    });

    return fetchPromise;
  }

  /**
   * Get data for a date range (for compatibility)
   * Note: This now fetches complete years that cover the range
   */
  async getDataForDateRange(
    start: CalendarDate, 
    end: CalendarDate,
    isUIRequest: boolean = true
  ): Promise<GeneratingUnitCapFacHistoryDTO | null> {
    const startTime = performance.now();
    
    perfMonitor.start('capFacCache_getDataForDateRange', {
      start: start.toString(),
      end: end.toString(),
      isUIRequest
    });
    
    // Get required years
    const requiredYears = this.getRequiredYears(start, end);
    if (requiredYears.length === 0) {
      perfMonitor.end('capFacCache_getDataForDateRange', { result: 'no_years_required' });
      return null;
    }

    // Fetch all required years
    const yearPromises = requiredYears.map(year => this.getYearData(year));
    const yearData = await Promise.all(yearPromises);
    
    // Check if we got all data
    if (yearData.some(data => data === null)) {
      perfMonitor.end('capFacCache_getDataForDateRange', { result: 'failed_to_fetch' });
      return null;
    }

    // For now, just return the first year's data
    // The tile system will handle multi-year rendering
    const elapsed = Math.round(performance.now() - startTime);
    console.log(`✅ Fetched data for ${start.toString()} → ${end.toString()} | ${elapsed}ms`);
    
    perfMonitor.end('capFacCache_getDataForDateRange', { result: 'success' });
    return yearData[0];
  }
  
  /**
   * Preload years adjacent to the current view
   */
  preloadAdjacentYears(currentYear: number): void {
    if (!this.enablePreloading) return;

    const yearsToPreload: number[] = [];
    
    // Preload 1 year before and after
    const prevYear = currentYear - 1;
    const nextYear = currentYear + 1;
    const currentYearValue = new Date().getFullYear();
    
    if (prevYear >= 2000 && !this.cache.has(prevYear.toString())) {
      yearsToPreload.push(prevYear);
    }
    
    if (nextYear <= currentYearValue && !this.cache.has(nextYear.toString())) {
      yearsToPreload.push(nextYear);
    }
    
    // Start background preloading
    yearsToPreload.forEach(year => {
      const preloadPromise = this.getYearData(year).catch(err => {
        console.error(`Failed to preload year ${year}:`, err);
      });
      
      // Track the promise
      this.preloadPromises.add(preloadPromise);
      
      // Remove from tracking when complete
      preloadPromise.finally(() => {
        this.preloadPromises.delete(preloadPromise);
      });
    });
    
    if (yearsToPreload.length > 0) {
      console.log(`📦 Preloading years: ${yearsToPreload.join(', ')}`);
    }
  }
  
  /**
   * Fetch year data from server with retry logic
   */
  private async fetchYearFromServer(year: number): Promise<GeneratingUnitCapFacHistoryDTO> {
    console.log(`📡 Fetching year ${year} from server...`);
    
    const maxAttempts = 5;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`/api/capacity-factors?year=${year}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Cache the result
        const sizeBytes = JSON.stringify(data).length;
        this.cache.set(year.toString(), data, sizeBytes, year.toString());
        
        // Notify listeners
        this.notifyBackgroundUpdate(year);
        
        console.log(`✅ Successfully fetched year ${year} on attempt ${attempt}`);
        return data;
        
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ Attempt ${attempt}/${maxAttempts} failed for year ${year}:`, error);
        
        if (attempt < maxAttempts) {
          // Calculate exponential backoff delay (1s, 2s, 4s, 8s)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All attempts failed
    const finalError = new Error(`Failed to fetch year ${year} after ${maxAttempts} attempts: ${lastError?.message}`);
    console.error(`❌ All attempts exhausted for year ${year}:`, finalError);
    throw finalError;
  }
  
  /**
   * Get required years for a date range
   */
  private getRequiredYears(start: CalendarDate, end: CalendarDate): number[] {
    const startYear = start.year;
    const endYear = end.year;
    
    const years: number[] = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }
    
    return years;
  }
  
  /**
   * Notify subscribers of background updates
   */
  private notifyBackgroundUpdate(year: number): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(year);
      } catch (error) {
        console.error('Error in background update callback:', error);
      }
    });
  }
  
  /**
   * Check if a specific year is cached
   */
  hasYear(year: number): boolean {
    return this.cache.has(year.toString());
  }
  
  /**
   * Get capacity factor for a specific unit on a specific date
   * Used by tile system to convert day offsets to percentage values
   */
  async getCapacityFactorForDate(
    duid: string, 
    date: CalendarDate
  ): Promise<number | null> {
    // Get the year data
    const yearData = await this.getYearData(date.year);
    if (!yearData) return null;
    
    // Find the unit
    const unit = yearData.data.find(u => u.duid === duid);
    if (!unit) return null;
    
    // Calculate the day offset within the year
    const dayIndex = getDayIndex(date);
    
    // Return the capacity factor for that day
    if (dayIndex >= 0 && dayIndex < unit.history.data.length) {
      return unit.history.data[dayIndex];
    }
    
    return null;
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stats = this.cache.getStats();
    // Extract years from labels and convert to expected format
    const cachedYears = stats.labels.map(label => parseInt(label)).filter(year => !isNaN(year)).sort();
    
    return {
      yearCount: stats.numItems,
      totalMB: stats.totalKB / 1024,
      cachedYears
    };
  }
  
  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
    // Clear all pending requests to prevent background operations
    this.pendingRequests.clear();
    // Clear preload promises
    this.preloadPromises.clear();
  }
  
  /**
   * Wait for all pending operations to complete
   */
  async waitForPendingOperations(): Promise<void> {
    // Wait for all pending requests
    const pendingOps = [
      ...Array.from(this.pendingRequests.values()),
      ...Array.from(this.preloadPromises)
    ];
    
    if (pendingOps.length > 0) {
      // Wait for all to settle (not throw on errors)
      await Promise.allSettled(pendingOps);
    }
  }

}

// Export singleton instance
export const capFacCache = new CapFacCache(10);