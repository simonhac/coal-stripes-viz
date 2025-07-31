import { GeneratingUnitCapFacHistoryDTO } from '@/shared/types';
import { LRUCache, CacheStats } from '@/shared/lru-cache';
import { CapFacYear, createCapFacYear } from './cap-fac-year';
import { RequestQueue, RequestQueueConfig, QueueStats } from '@/shared/request-queue';
import { NoOpRequestQueueLogger } from '@/shared/request-queue-logger';
import { CalendarDate } from '@internationalized/date';
import { getDayIndex } from '@/shared/date-utils';

export interface GenerationStats {
  totalWeightedCapacityFactor: number;
  totalCapacityDays: number;
}

/**
 * Calculate average capacity factor from generation statistics
 * Returns null if stats are null or totalCapacityDays is 0
 */
export function calculateAverageCapacityFactor(stats: GenerationStats | null): number | null {
  if (stats === null || stats.totalCapacityDays === 0) {
    return null;
  }
  return stats.totalWeightedCapacityFactor / stats.totalCapacityDays;
}

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
    const result = this.cache.get(year.toString());
    if (!result) {
      console.log(`getYearSync(${year}) returned null, cache size: ${this.cache.size()}`);
    }
    return result || null;
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
  getCacheStats(): CacheStats & QueueStats {
    const cacheStats = this.cache.getStats();
    const queueStats = this.requestQueue.getStats();
    
    return {
      ...cacheStats,
      ...queueStats
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
    // const startTime = performance.now();
    const capFacYear = createCapFacYear(year, data);
    
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

  /**
   * Get facility codes for a specific region from cached data
   * Returns null if year data is not cached
   */
  getFacilityCodesInRegion(regionCode: string, year: number): string[] | null {
    const yearData = this.getYearSync(year);
    if (!yearData) {
      return null;
    }
    
    const facilityCodesInRegion: string[] = [];
    
    // Check each unit in the raw data to find facilities in this region
    for (const unit of yearData.data.data) {
      const unitRegion = unit.network === 'WEM' ? 'WEM' : (unit.region || 'UNKNOWN');
      if (unitRegion === regionCode && !facilityCodesInRegion.includes(unit.facility_code)) {
        facilityCodesInRegion.push(unit.facility_code);
      }
    }
    
    return facilityCodesInRegion;
  }

  /**
   * Calculate generation statistics for a facility across a date range
   * Returns null if data is not available in cache
   */
  calculateFacilityStats(regionCode: string, facilityCode: string, dateRange: { start: CalendarDate; end: CalendarDate }): GenerationStats | null {
    const startYear = dateRange.start.year;
    const endYear = dateRange.end.year;
    
    let totalWeightedCapacityFactor = 0;
    let totalCapacityDays = 0;
    
    // Calculate for start year
    const leftYearData = this.getYearSync(startYear);
    if (!leftYearData) return null;
    
    const leftTile = leftYearData.facilityTiles.get(facilityCode);
    if (!leftTile) return null;
    
    const leftStartDay = getDayIndex(dateRange.start);
    const leftEndDay = startYear === endYear 
      ? getDayIndex(dateRange.end) 
      : leftYearData.daysInYear - 1;
    
    for (const unit of leftTile.getUnits()) {
      for (let day = leftStartDay; day <= leftEndDay; day++) {
        const cf = unit.history.data[day];
        if (cf !== null) {
          totalWeightedCapacityFactor += cf * unit.capacity;
          totalCapacityDays += unit.capacity;
        }
      }
    }
    
    // Calculate for end year if different
    if (startYear !== endYear) {
      const rightYearData = this.getYearSync(endYear);
      if (!rightYearData) return null;
      
      const rightTile = rightYearData.facilityTiles.get(facilityCode);
      if (!rightTile) return null;
      
      const rightEndDay = getDayIndex(dateRange.end);
      
      for (const unit of rightTile.getUnits()) {
        for (let day = 0; day <= rightEndDay; day++) {
          const cf = unit.history.data[day];
          if (cf !== null) {
            totalWeightedCapacityFactor += cf * unit.capacity;
            totalCapacityDays += unit.capacity;
          }
        }
      }
    }
    
    return { totalWeightedCapacityFactor, totalCapacityDays };
  }

  /**
   * Calculate generation statistics for a region across a date range
   * Returns null if data is not available in cache
   */
  calculateRegionStats(regionCode: string, dateRange: { start: CalendarDate; end: CalendarDate }): GenerationStats | null {
    let totalWeightedCapacityFactor = 0;
    let totalCapacityDays = 0;
    
    const startYear = dateRange.start.year;
    const endYear = dateRange.end.year;
    // console.log(`calculateRegionStats for ${regionCode}, date range: ${dateRange.start.toString()} to ${dateRange.end.toString()}, years: ${startYear}-${endYear}`);
    
    // Get facilities for this region
    const facilitiesInRegion = this.getFacilityCodesInRegion(regionCode, startYear);
    
    // If year data not cached, return null
    if (!facilitiesInRegion) {
      return null;
    }
    
    // Accumulate stats across all facilities in the region
    for (const facilityCode of facilitiesInRegion) {
      const facilityStats = this.calculateFacilityStats(regionCode, facilityCode, dateRange);
      if (facilityStats === null) {
        console.warn(`Unable to get stats for facility ${facilityCode} in region ${regionCode} - cannot calculate region average`);
        return null;
      }
      
      totalWeightedCapacityFactor += facilityStats.totalWeightedCapacityFactor;
      totalCapacityDays += facilityStats.totalCapacityDays;
    }
    
    return { totalWeightedCapacityFactor, totalCapacityDays };
  }
}

// Export singleton instance
export const yearDataVendor = new YearDataVendor(10);