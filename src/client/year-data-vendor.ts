import { GeneratingUnitCapFacHistoryDTO } from '@/shared/types';
import { LRUCache } from '@/client/lru-cache';
import { CapFacYear, createCapFacYear } from './cap-fac-year';
import { RequestQueue, RequestQueueConfig } from '@/shared/request-queue';
import { NoOpRequestQueueLogger } from '@/shared/request-queue-logger';

/**
 * Vendor for year-based capacity factor data with pre-rendered tiles
 * Always returns a promise - resolved immediately for cached data
 */
export class YearDataVendor {
  private cache: LRUCache<CapFacYear>;
  private requestQueue: RequestQueue<CapFacYear>;

  constructor(maxYears: number = 10, queueConfig?: Partial<RequestQueueConfig>) {
    this.cache = new LRUCache<CapFacYear>(maxYears);
    this.requestQueue = new RequestQueue<CapFacYear>({
      maxConcurrent: 2, // Allow 2 concurrent year fetches
      minInterval: 100, // 100ms between requests
      maxRetries: 3,
      retryDelayBase: 1000,
      retryDelayMax: 30000,
      timeout: 60000, // 60 second timeout for year data
      circuitBreakerThreshold: 5,
      circuitBreakerResetTime: 60000,
      ...queueConfig // Allow overriding for tests
    }, new NoOpRequestQueueLogger());
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

    // Use RequestQueue to handle fetching with retry and rate limiting
    return this.requestQueue.add({
      execute: () => this.fetchYear(year),
      priority: 1, // Normal priority
      method: 'GET',
      url: `/api/capacity-factors?year=${year}`,
      label: year.toString(),
      onProgress: (progress) => {
        console.log(`Year ${year} fetch: ${progress}%`);
      },
      onError: (error) => {
        console.error(`Failed to fetch year ${year}:`, error);
      }
    }, { addToFront: true }); // Client requests go to front of queue
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
    const queueStats = this.requestQueue.getStats();
    const activeItems = this.requestQueue.getActiveItems();
    const queuedItems = this.requestQueue.getQueuedItems();
    
    return {
      ...baseStats,
      pendingCount: queueStats.active,
      queuedCount: queueStats.queued,
      circuitOpen: queueStats.circuitOpen,
      activeLabels: activeItems.map(item => item.label).filter(Boolean),
      queuedLabels: queuedItems.map(item => item.label).filter(Boolean)
    };
  }

  /**
   * Clear all cached data and cancel pending fetches
   */
  clear(): void {
    this.cache.clear();
    this.requestQueue.clear();
  }

  /**
   * Fetch year data from server and create tiles
   */
  private async fetchYear(year: number): Promise<CapFacYear> {
    console.log(`📡 Fetching year ${year} from server...`);
    const fetchStartTime = performance.now();
    
    const response = await fetch(`/api/capacity-factors?year=${year}`);
    
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