import { GeneratingUnitCapFacHistoryDTO } from '@/shared/types';

export interface CacheEntry {
  year: number;
  data: GeneratingUnitCapFacHistoryDTO;
  lastAccessed: number;
  sizeBytes: number;
}

export interface CacheStats {
  yearCount: number;
  totalMB: number;
  cachedYears: number[];
}

/**
 * Simple year-based cache for coal stripes data
 * Stores complete year data with LRU eviction
 */
export class TimeSeriesCache {
  private cache = new Map<number, CacheEntry>();
  private maxYears: number;
  private totalBytes: number = 0;
  
  constructor(maxYears: number = 5) {
    this.maxYears = maxYears;
  }

  /**
   * Store data for a complete year
   */
  addYear(year: number, data: GeneratingUnitCapFacHistoryDTO): void {
    // Remove existing entry if present
    if (this.cache.has(year)) {
      const existing = this.cache.get(year)!;
      this.totalBytes -= existing.sizeBytes;
      this.cache.delete(year);
    }

    // Calculate size
    const sizeBytes = JSON.stringify(data).length;

    // Add new entry
    const entry: CacheEntry = {
      year,
      data,
      lastAccessed: Date.now(),
      sizeBytes
    };

    this.cache.set(year, entry);
    this.totalBytes += sizeBytes;

    console.log(`💾 Cached year ${year} (${(sizeBytes / 1024 / 1024).toFixed(2)}MB)`);

    // Evict oldest if over limit
    this.evictIfNeeded();
  }

  /**
   * Get data for a specific year
   */
  getYear(year: number): GeneratingUnitCapFacHistoryDTO | null {
    const entry = this.cache.get(year);
    if (!entry) {
      return null;
    }

    // Update access time
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  /**
   * Check if a year is cached
   */
  hasYear(year: number): boolean {
    return this.cache.has(year);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.totalBytes = 0;
    console.log('🗑️ Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const cachedYears = Array.from(this.cache.keys()).sort();
    return {
      yearCount: this.cache.size,
      totalMB: this.totalBytes / (1024 * 1024),
      cachedYears
    };
  }

  /**
   * Evict oldest entries if over limit
   */
  private evictIfNeeded(): void {
    while (this.cache.size > this.maxYears) {
      // Find oldest entry
      let oldestYear: number | null = null;
      let oldestTime = Date.now();

      for (const [year, entry] of this.cache) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestYear = year;
        }
      }

      if (oldestYear !== null) {
        const entry = this.cache.get(oldestYear)!;
        this.totalBytes -= entry.sizeBytes;
        this.cache.delete(oldestYear);
        console.log(`🗑️ Evicted year ${oldestYear} from cache`);
      }
    }
  }
}