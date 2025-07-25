import { TileKey, TileData, TileStatus, ViewportInfo, RenderedTile } from './types';
import { TileCache, tileCache } from './TileCache';
import { YearDataCache, yearDataCache } from './YearDataCache';
import { Tile } from './Tile';
import { GeneratingUnitCapFacHistoryDTO } from '@/shared/types';

interface RenderQueueItem {
  key: TileKey;
  priority: number; // 0 = highest (visible), 1 = adjacent, 2+ = distant
}

export class TileManager {
  private tileCache: TileCache;
  private yearDataCache: YearDataCache;
  private tileStatus: Map<string, TileStatus> = new Map();
  private renderQueue: RenderQueueItem[] = [];
  private isRendering = false;
  private viewport: ViewportInfo | null = null;
  private unitHeights: Map<string, number[]> = new Map(); // facility -> unit heights

  constructor(maxTileCache: number = 50, maxYearCache: number = 10) {
    // Use singleton instances instead of creating new ones
    this.tileCache = tileCache;
    this.yearDataCache = yearDataCache;
  }

  private getKey(tile: TileKey): string {
    return `${tile.facilityName}-${tile.year}`;
  }

  setViewport(viewport: ViewportInfo): void {
    const oldWidth = this.viewport?.width;
    this.viewport = viewport;

    // Clear cache if width changed
    if (oldWidth && oldWidth !== viewport.width) {
      console.log('[TILE] Cache cleared: viewport resize');
      this.tileCache.clear();
      this.queueVisibleTiles();
    }
  }

  setUnitHeights(facilityName: string, heights: number[]): void {
    this.unitHeights.set(facilityName, heights);
  }

  // Set data directly instead of fetching from API
  setYearData(year: number, data: GeneratingUnitCapFacHistoryDTO): void {
    this.yearDataCache.set(year, data);
  }

  async fetchTileData(key: TileKey): Promise<TileData> {
    console.log(`[TILE] Processing: ${key.facilityName}-${key.year}`);
    this.updateStatus(key, { state: 'loading' });

    try {
      // Check if we have the year data cached
      const yearData = this.yearDataCache.get(key.year);
      
      if (!yearData) {
        throw new Error(`Year ${key.year} data not available in cache`);
      }

      // Extract facility data from year data
      const facilityUnits = yearData.data.filter(unit => 
        unit.facility_name === key.facilityName
      );

      if (facilityUnits.length === 0) {
        throw new Error(`Facility ${key.facilityName} not found in year ${key.year}`);
      }

      // Convert to TileData format
      const tileData: TileData = {
        facilityName: key.facilityName,
        year: key.year,
        units: facilityUnits.map(unit => ({
          duid: unit.duid,
          capacity: unit.capacity,
          data: unit.history.data
        })),
        startDate: `${key.year}-01-01`,
        endDate: `${key.year}-12-31`
      };
      
      this.updateStatus(key, { state: 'loaded', data: tileData });
      return tileData;
    } catch (error) {
      this.updateStatus(key, { state: 'error', error: error as Error });
      throw error;
    }
  }

  async getTile(key: TileKey): Promise<RenderedTile | null> {
    // Check render cache
    const cached = this.tileCache.get(key);
    if (cached) {
      return cached;
    }

    // Check current status
    const status = this.tileStatus.get(this.getKey(key));
    
    // If there was an error, don't retry automatically
    if (status?.state === 'error') {
      return null;
    }
    
    // If already rendering, wait
    if (status?.state === 'rendering') {
      return null; // Will be ready soon
    }

    // Add to render queue
    this.queueTileRender(key, 0); // Priority 0 for immediate need
    
    // Start processing if not already
    if (!this.isRendering) {
      this.processRenderQueue();
    }

    return null;
  }

  private queueTileRender(key: TileKey, priority: number): void {
    const keyStr = this.getKey(key);
    
    // Check if already queued
    const existing = this.renderQueue.findIndex(item => 
      this.getKey(item.key) === keyStr
    );

    if (existing >= 0) {
      // Update priority if higher
      if (priority < this.renderQueue[existing].priority) {
        this.renderQueue[existing].priority = priority;
      }
    } else {
      this.renderQueue.push({ key, priority });
    }

    // Sort by priority
    this.renderQueue.sort((a, b) => a.priority - b.priority);
  }

  private async processRenderQueue(): Promise<void> {
    if (this.isRendering || this.renderQueue.length === 0) {
      return;
    }

    this.isRendering = true;
    console.log(`[TILE] Queue: ${this.renderQueue.length} tiles pending`);

    while (this.renderQueue.length > 0) {
      const item = this.renderQueue.shift()!;
      await this.renderTile(item.key);
    }

    this.isRendering = false;
  }

  private async renderTile(key: TileKey): Promise<void> {
    try {
      // Fetch tile data (which will use year cache)
      const data = await this.fetchTileData(key);

      // Get unit heights
      const heights = this.unitHeights.get(key.facilityName);
      if (!heights || !this.viewport) {
        console.warn(`[TILE] Cannot render ${this.getKey(key)}: missing heights or viewport`);
        return;
      }

      // Update status
      this.updateStatus(key, { state: 'rendering', data });

      // Create and render tile
      const tile = new Tile(key);
      tile.setData(data);
      const rendered = tile.render(this.viewport.width, heights);

      // Cache the result
      this.tileCache.set(rendered);
      this.updateStatus(key, { state: 'ready', data, rendered });

    } catch (error) {
      console.error(`[TILE] Render failed: ${this.getKey(key)}`, error);
      this.updateStatus(key, { state: 'error', error: error as Error });
    }
  }

  private updateStatus(key: TileKey, updates: Partial<TileStatus>): void {
    const keyStr = this.getKey(key);
    const current = this.tileStatus.get(keyStr) || { key, state: 'empty' };
    this.tileStatus.set(keyStr, { ...current, ...updates });
  }

  private queueVisibleTiles(): void {
    if (!this.viewport) return;

    // Calculate which tiles are visible
    const startYear = this.viewport.startDate.getFullYear();
    const endYear = this.viewport.endDate.getFullYear();

    // For now, just queue the first facility in NSW
    const facilities = ['Eraring']; // Will expand later

    for (const facility of facilities) {
      for (let year = startYear; year <= endYear; year++) {
        const key = { facilityName: facility, year };
        
        // Priority 0 for visible tiles
        this.queueTileRender(key, 0);
        
        // Priority 1 for adjacent years
        if (year > 2015) {
          this.queueTileRender({ facilityName: facility, year: year - 1 }, 1);
        }
        if (year < 2024) {
          this.queueTileRender({ facilityName: facility, year: year + 1 }, 1);
        }
      }
    }

    this.processRenderQueue();
  }

  getStatus(key: TileKey): TileStatus | undefined {
    return this.tileStatus.get(this.getKey(key));
  }

  getCacheStats() {
    const tileStats = this.tileCache.getMemoryUsage();
    const yearStats = this.yearDataCache.getStats();
    return {
      tiles: tileStats.count,
      tileMemoryMB: tileStats.totalMB,
      years: yearStats.years,
      yearMemoryMB: yearStats.totalMB,
      cachedYears: yearStats.yearList
    };
  }
  
  getTileStatus(key: TileKey): TileStatus | undefined {
    return this.tileStatus.get(this.getKey(key));
  }
}