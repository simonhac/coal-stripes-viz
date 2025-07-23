import { TileKey, RenderedTile } from './types';

export class TileCache {
  private cache: Map<string, RenderedTile> = new Map();
  private accessOrder: string[] = [];
  private maxSize: number;
  private totalMemory: number = 0;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  private getKey(tile: TileKey): string {
    return `${tile.facilityName}-${tile.year}`;
  }

  set(tile: RenderedTile): void {
    const key = this.getKey(tile.key);
    
    // If tile exists, remove from access order
    if (this.cache.has(key)) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }

    // Add to end (most recently used)
    this.accessOrder.push(key);
    this.cache.set(key, tile);

    // Estimate memory usage (rough: 4 bytes per pixel)
    const tileMemory = tile.width * tile.height * 4;
    this.totalMemory += tileMemory;

    // Evict if over limit
    while (this.accessOrder.length > this.maxSize) {
      this.evictOldest();
    }

    console.log(`[TILE] Cached: ${key} (${(tileMemory / 1024 / 1024).toFixed(1)}MB)`);
  }

  get(key: TileKey): RenderedTile | undefined {
    const keyStr = this.getKey(key);
    const tile = this.cache.get(keyStr);
    
    if (tile) {
      // Move to end (most recently used)
      const index = this.accessOrder.indexOf(keyStr);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
        this.accessOrder.push(keyStr);
      }
    }
    
    return tile;
  }

  has(key: TileKey): boolean {
    return this.cache.has(this.getKey(key));
  }

  clear(): void {
    console.log('[TILE] Cache cleared');
    this.cache.clear();
    this.accessOrder = [];
    this.totalMemory = 0;
  }

  private evictOldest(): void {
    if (this.accessOrder.length === 0) return;
    
    const oldestKey = this.accessOrder.shift()!;
    const tile = this.cache.get(oldestKey);
    
    if (tile) {
      const tileMemory = tile.width * tile.height * 4;
      this.totalMemory -= tileMemory;
      this.cache.delete(oldestKey);
      console.log(`[TILE] Evicted: ${oldestKey}`);
    }
  }

  getMemoryUsage(): { count: number; totalMB: number } {
    return {
      count: this.cache.size,
      totalMB: this.totalMemory / 1024 / 1024
    };
  }
}