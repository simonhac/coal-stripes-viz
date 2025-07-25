import { TileKey, RenderedTile } from './types';
import { LRUCache, CacheStats } from '@/client/lru-cache';

export class TileCache {
  private cache: LRUCache<RenderedTile>;

  constructor(maxSize: number = 50) {
    this.cache = new LRUCache<RenderedTile>(maxSize);
  }

  private getKey(tile: TileKey): string {
    return `${tile.facilityName}-${tile.year}`;
  }

  set(tile: RenderedTile): void {
    const key = this.getKey(tile.key);
    
    // Estimate memory usage (rough: 4 bytes per pixel)
    const tileMemory = tile.width * tile.height * 4;
    const label = `${tile.key.year}-${tile.width}`;
    
    this.cache.set(key, tile, tileMemory, label);

    console.log(`[TILE] Cached: ${key} (${(tileMemory / 1024 / 1024).toFixed(1)}MB)`);
  }

  get(key: TileKey): RenderedTile | undefined {
    const keyStr = this.getKey(key);
    return this.cache.get(keyStr);
  }

  has(key: TileKey): boolean {
    return this.cache.has(this.getKey(key));
  }

  clear(): void {
    console.log('[TILE] Cache cleared');
    this.cache.clear();
  }

  getMemoryUsage(): { count: number; totalMB: number } {
    const stats = this.cache.getStats();
    return {
      count: stats.numItems,
      totalMB: stats.totalKB / 1024
    };
  }

  getStats(): { tiles: number; totalMB: number; yearList: number[] } {
    const stats = this.cache.getStats();
    const years = new Set<number>();
    
    // Extract years from labels (format: "year-width")
    for (const label of stats.labels) {
      const parts = label.split('-');
      const year = parseInt(parts[0]);
      if (!isNaN(year)) {
        years.add(year);
      }
    }
    
    return {
      tiles: stats.numItems,
      totalMB: stats.totalKB / 1024,
      yearList: Array.from(years)
    };
  }
  
  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

}

// Export singleton instance
export const tileCache = new TileCache();