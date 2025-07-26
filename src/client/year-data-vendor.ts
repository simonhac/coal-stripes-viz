import { GeneratingUnitCapFacHistoryDTO } from '@/shared/types';
import { LRUCache } from '@/client/lru-cache';

interface PendingFetch {
  promise: Promise<GeneratingUnitCapFacHistoryDTO>;
  abort: AbortController;
}

/**
 * Vendor for year-based capacity factor data
 * Always returns a promise - resolved immediately for cached data
 */
export class YearDataVendor {
  private cache: LRUCache<GeneratingUnitCapFacHistoryDTO>;
  private pendingFetches: Map<number, PendingFetch>;

  constructor(maxYears: number = 10) {
    this.cache = new LRUCache<GeneratingUnitCapFacHistoryDTO>(maxYears);
    this.pendingFetches = new Map();
  }

  /**
   * Request data for a specific year
   * @returns Promise that resolves with the data (immediately if cached)
   */
  async requestYear(year: number): Promise<GeneratingUnitCapFacHistoryDTO> {
    // Check cache first
    const cached = this.cache.get(year.toString());
    if (cached) {
      return Promise.resolve(cached);
    }

    // Check if already fetching
    const pendingFetch = this.pendingFetches.get(year);
    if (pendingFetch) {
      return pendingFetch.promise;
    }

    // Start new fetch
    const abort = new AbortController();
    const fetchPromise = this.fetchYear(year, abort.signal);
    
    this.pendingFetches.set(year, { promise: fetchPromise, abort });
    
    // Clean up on completion
    fetchPromise.finally(() => {
      this.pendingFetches.delete(year);
    }).catch(() => {
      // Prevent unhandled rejection if no one is listening
    });

    return fetchPromise;
  }

  /**
   * Check if a year is currently cached
   */
  hasYear(year: number): boolean {
    return this.cache.has(year.toString());
  }

  /**
   * Get cache statistics including pending fetches
   */
  getCacheStats() {
    const baseStats = this.cache.getStats();
    
    // Add pending labels
    const pendingLabels: string[] = [];
    for (const year of this.pendingFetches.keys()) {
      pendingLabels.push(year.toString());
    }
    
    return {
      ...baseStats,
      pendingLabels
    };
  }

  /**
   * Clear all cached data and cancel pending fetches
   */
  clear(): void {
    this.cache.clear();
    
    // Abort all pending fetches
    for (const [year, { abort }] of this.pendingFetches) {
      console.log(`🚫 Cancelling fetch for year ${year}`);
      abort.abort();
    }
    this.pendingFetches.clear();
  }

  /**
   * Fetch year data from server
   */
  private async fetchYear(year: number, signal: AbortSignal): Promise<GeneratingUnitCapFacHistoryDTO> {
    console.log(`📡 Fetching year ${year} from server...`);
    
    try {
      const response = await fetch(`/api/capacity-factors?year=${year}`, { signal });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: GeneratingUnitCapFacHistoryDTO = await response.json();
      
      // Cache the result
      const sizeBytes = JSON.stringify(data).length;
      this.cache.set(year.toString(), data, sizeBytes, year.toString());
      
      console.log(`✅ Successfully fetched year ${year} (${(sizeBytes / 1024 / 1024).toFixed(2)}MB)`);
      
      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Request cancelled for year ${year}`);
      }
      throw error;
    }
  }
}

// Export singleton instance
export const yearDataVendor = new YearDataVendor(10);