import { TileKey, TileData, RenderedTile } from './types';
import { TILE_CONFIG } from '@/shared/config';

// Pre-calculate colors for all possible capacity factors
const COLOR_CACHE = new Map<number | null, string>();

function getCoalProportionColor(capacityFactor: number | null): string {
  if (COLOR_CACHE.has(capacityFactor)) {
    return COLOR_CACHE.get(capacityFactor)!;
  }

  let color: string;
  if (capacityFactor === null || capacityFactor === undefined) {
    color = '#e6f3ff';
  } else if (capacityFactor < 25) {
    color = '#ef4444';
  } else {
    const clampedCapacity = Math.min(100, Math.max(25, capacityFactor));
    const greyValue = Math.round(255 * (1 - clampedCapacity / 100));
    color = `rgb(${greyValue}, ${greyValue}, ${greyValue})`;
  }

  COLOR_CACHE.set(capacityFactor, color);
  return color;
}

export class Tile {
  private key: TileKey;
  private data: TileData | null = null;
  private canvas: OffscreenCanvas | HTMLCanvasElement | null = null;

  constructor(key: TileKey) {
    this.key = key;
  }

  setData(data: TileData): void {
    this.data = data;
  }

  render(width: number, unitHeights: number[]): RenderedTile {
    if (!this.data) {
      throw new Error(`Cannot render tile ${this.key.facilityName}-${this.key.year}: no data`);
    }

    const startTime = performance.now();
    console.log(`[TILE] Rendering: ${this.key.facilityName}-${this.key.year} with ${this.data.units.length} units`);

    const height = unitHeights.reduce((sum, h) => sum + h, 0);
    const daysInYear = this.data.units[0].data.length;
    const stripeWidth = width / daysInYear;

    // Create canvas
    if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(width, height);
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    
    // Clear with white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Render each unit
    let yOffset = 0;
    const data = this.data!; // We already checked it's not null above
    data.units.forEach((unit, unitIndex) => {
      const unitHeight = unitHeights[unitIndex];
      
      // Draw stripes for this unit
      for (let dayIndex = 0; dayIndex < unit.data.length; dayIndex++) {
        const capacityFactor = unit.data[dayIndex];
        const color = getCoalProportionColor(capacityFactor);
        
        ctx.fillStyle = color;
        ctx.fillRect(
          Math.floor(dayIndex * stripeWidth),
          yOffset,
          Math.ceil(stripeWidth) + 1, // +1 to prevent gaps
          unitHeight
        );
      }

      // Draw subtle separator line
      if (unitIndex < data.units.length - 1) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, yOffset + unitHeight);
        ctx.lineTo(width, yOffset + unitHeight);
        ctx.stroke();
      }

      yOffset += unitHeight;
    });

    // Draw debug overlay if enabled
    if (TILE_CONFIG.SHOW_DEBUG_OVERLAY) {
      // Draw border
      ctx.strokeStyle = TILE_CONFIG.DEBUG_BORDER_COLOR;
      ctx.lineWidth = TILE_CONFIG.DEBUG_BORDER_WIDTH;
      ctx.strokeRect(
        TILE_CONFIG.DEBUG_BORDER_WIDTH / 2,
        TILE_CONFIG.DEBUG_BORDER_WIDTH / 2,
        width - TILE_CONFIG.DEBUG_BORDER_WIDTH,
        height - TILE_CONFIG.DEBUG_BORDER_WIDTH
      );

      // Draw year text
      ctx.fillStyle = TILE_CONFIG.DEBUG_TEXT_COLOR;
      ctx.font = `bold ${TILE_CONFIG.DEBUG_TEXT_SIZE}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        this.key.year.toString(),
        width / 2,
        height / 2
      );
    }

    const renderTime = performance.now() - startTime;
    console.log(`[TILE] Rendered: ${this.key.facilityName}-${this.key.year} (${renderTime.toFixed(0)}ms)`);

    return {
      key: this.key,
      canvas: this.canvas,
      width,
      height,
      renderedAt: Date.now(),
      renderTime
    };
  }

  getKey(): TileKey {
    return this.key;
  }

  getData(): TileData | null {
    return this.data;
  }
}