import { GeneratingUnitCapFacHistoryDTO } from '@/shared/types';
import { LRUCache } from '@/client/lru-cache';
import { CapFacYear, createCapFacYear } from './cap-fac-year';

interface PendingFetch {
  promise: Promise<CapFacYear>;
  abort: AbortController;
}

/**
 * Vendor for year-based capacity factor data with pre-rendered tiles
 * Always returns a promise - resolved immediately for cached data
 */
export class YearDataVendor {
  private cache: LRUCache<CapFacYear>;
  private pendingFetches: Map<number, PendingFetch>;

  constructor(maxYears: number = 10) {
    this.cache = new LRUCache<CapFacYear>(maxYears);
    this.pendingFetches = new Map();
  }

  /**
   * Get data for a year synchronously if it's in the cache
   * @param year The year to get
   * @returns The data if cached, null otherwise
   */
  getYearSync(year: number): CapFacYear | null {
    return this.cache.get(year.toString()) || null;
  }

  /**
   * Request data for a specific year
   * @returns Promise that resolves with the data (immediately if cached)
   */
  async requestYear(year: number): Promise<CapFacYear> {
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
   * Fetch year data from server and create tiles
   */
  private async fetchYear(year: number, signal: AbortSignal): Promise<CapFacYear> {
    console.log(`📡 Fetching year ${year} from server...`);
    const fetchStartTime = performance.now();
    
    try {
      const response = await fetch(`/api/capacity-factors?year=${year}`, { signal });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: GeneratingUnitCapFacHistoryDTO = await response.json();
      
      // Create CapFacYear with pre-rendered tiles
      console.log(`🎨 Creating tiles for year ${year}...`);
      const startTime = performance.now();
      const capFacYear = createCapFacYear(year, data);
      const createTime = performance.now() - startTime;
      console.log(`✅ Created ${capFacYear.facilityTiles.size} facility tiles for ${year} in ${createTime.toFixed(0)}ms`);
      
      // Cache the result with the total size (JSON + canvas memory)
      this.cache.set(year.toString(), capFacYear, capFacYear.totalSizeBytes, year.toString());
      
      const totalTime = (performance.now() - fetchStartTime) / 1000;
      console.log(`✅ Successfully fetched year ${year} (${(capFacYear.totalSizeBytes / 1024 / 1024).toFixed(2)}MB) in ${totalTime.toFixed(1)}s`);
      
      return capFacYear;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Request cancelled for year ${year}`);
      }
      throw error;
    }
  }

  /**
   * Clear all cached data - useful when feature flags change
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const yearDataVendor = new YearDataVendor(10);