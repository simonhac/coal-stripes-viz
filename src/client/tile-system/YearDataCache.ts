import { GeneratingUnitCapFacHistoryDTO } from '@/shared/types';

interface CacheEntry {
  year: number;
  data: GeneratingUnitCapFacHistoryDTO;
  size: number; // bytes
  lastAccessed: number;
}

export class YearDataCache {
  private cache: Map<number, CacheEntry> = new Map();
  private accessOrder: number[] = [];
  private maxYears: number;
  private totalSize: number = 0;

  constructor(maxYears: number = 10) {
    this.maxYears = maxYears;
  }

  /**
   * Store data for a specific year
   */
  set(year: number, data: GeneratingUnitCapFacHistoryDTO): void {
    // Remove from access order if exists
    const index = this.accessOrder.indexOf(year);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }

    // Estimate size (rough calculation)
    const size = JSON.stringify(data).length;
    
    // Update cache
    const existing = this.cache.get(year);
    if (existing) {
      this.totalSize -= existing.size;
    }
    
    this.cache.set(year, {
      year,
      data,
      size,
      lastAccessed: Date.now()
    });
    
    this.totalSize += size;
    this.accessOrder.push(year);
    
    console.log(`[CACHE] Stored year ${year} (${(size / 1024).toFixed(1)}KB)`);
    
    // Evict if over limit
    while (this.accessOrder.length > this.maxYears) {
      this.evictOldest();
    }
  }

  /**
   * Get data for a specific year
   */
  get(year: number): GeneratingUnitCapFacHistoryDTO | null {
    const entry = this.cache.get(year);
    if (!entry) {
      return null;
    }

    // Update access order
    const index = this.accessOrder.indexOf(year);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(year);
    }
    
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  /**
   * Check if a year is cached
   */
  has(year: number): boolean {
    return this.cache.has(year);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.totalSize = 0;
    console.log('[CACHE] Cleared all year data');
  }

  /**
   * Get cache statistics
   */
  getStats(): { years: number; totalMB: number; yearList: number[] } {
    return {
      years: this.cache.size,
      totalMB: this.totalSize / (1024 * 1024),
      yearList: Array.from(this.cache.keys()).sort()
    };
  }

  private evictOldest(): void {
    if (this.accessOrder.length === 0) return;
    
    const oldestYear = this.accessOrder.shift()!;
    const entry = this.cache.get(oldestYear);
    
    if (entry) {
      this.totalSize -= entry.size;
      this.cache.delete(oldestYear);
      console.log(`[CACHE] Evicted year ${oldestYear}`);
    }
  }
}

// Export singleton instance
export const yearDataCache = new YearDataCache();