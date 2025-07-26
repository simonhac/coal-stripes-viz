import { GeneratingUnitDTO } from '@/shared/types';
import { TILE_CONFIG } from '@/shared/config';

// Singleton colour cache - pre-computed for all integer values 0-100
const COLOR_CACHE = new Map<number | null, string>();

// Pre-compute all colours at startup
function initializeColorCache(): void {
  // Add null value
  COLOR_CACHE.set(null, '#e6f3ff');
  
  // Pre-compute all integer capacity factors from 0 to 100
  for (let i = 0; i <= 100; i++) {
    let color: string;
    if (i < 25) {
      color = '#ef4444';
    } else {
      const greyValue = Math.round(255 * (1 - i / 100));
      color = `rgb(${greyValue}, ${greyValue}, ${greyValue})`;
    }
    COLOR_CACHE.set(i, color);
  }
}

// Initialize the cache immediately
initializeColorCache();

function getCoalProportionColor(capacityFactor: number | null): string {
  if (capacityFactor === null || capacityFactor === undefined) {
    return COLOR_CACHE.get(null)!;
  }
  
  // Round to nearest integer and clamp to 0-100
  const rounded = Math.round(Math.min(100, Math.max(0, capacityFactor)));
  return COLOR_CACHE.get(rounded)!;
}

function drawDebugOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  year: number
): void {
  ctx.strokeStyle = TILE_CONFIG.DEBUG_BORDER_COLOR;
  ctx.lineWidth = TILE_CONFIG.DEBUG_BORDER_WIDTH;
  ctx.strokeRect(
    TILE_CONFIG.DEBUG_BORDER_WIDTH / 2,
    TILE_CONFIG.DEBUG_BORDER_WIDTH / 2,
    width - TILE_CONFIG.DEBUG_BORDER_WIDTH,
    height - TILE_CONFIG.DEBUG_BORDER_WIDTH
  );

  ctx.fillStyle = TILE_CONFIG.DEBUG_TEXT_COLOR;
  ctx.font = `bold ${TILE_CONFIG.DEBUG_TEXT_SIZE}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    year.toString(),
    width / 2,
    height / 2
  );
}

export class FacilityYearTile {
  private facilityCode: string;
  private year: number;
  private units: GeneratingUnitDTO[];
  private width: number;
  private canvas: OffscreenCanvas | HTMLCanvasElement | null = null;

  constructor(facilityCode: string, year: number, units: GeneratingUnitDTO[], width: number) {
    this.facilityCode = facilityCode;
    this.year = year;
    this.units = units;
    this.width = width;
  }

  private calculateUnitHeights(useShortLabels: boolean = false): number[] {
    return this.units.map(unit => {
      const minHeight = useShortLabels ? 16 : 12;
      return Math.max(minHeight, Math.min(40, unit.capacity / 30));
    });
  }

  render(useShortLabels: boolean = false): OffscreenCanvas | HTMLCanvasElement {
    const startTime = performance.now();
    console.log(`[FacilityYearTile] Rendering: ${this.facilityCode}-${this.year} with ${this.units.length} units`);

    const unitHeights = this.calculateUnitHeights(useShortLabels);
    const height = unitHeights.reduce((sum, h) => sum + h, 0);
    
    const daysInYear = this.units[0]?.history.data.length || 365;
    const stripeWidth = this.width / daysInYear;

    if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(this.width, height);
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width;
      this.canvas.height = height;
    }

    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.width, height);

    let yOffset = 0;
    this.units.forEach((unit, unitIndex) => {
      const unitHeight = unitHeights[unitIndex];
      
      for (let dayIndex = 0; dayIndex < unit.history.data.length; dayIndex++) {
        const capacityFactor = unit.history.data[dayIndex];
        const color = getCoalProportionColor(capacityFactor);
        
        ctx.fillStyle = color;
        ctx.fillRect(
          Math.floor(dayIndex * stripeWidth),
          yOffset,
          Math.ceil(stripeWidth) + 1,
          unitHeight
        );
      }

      yOffset += unitHeight;
    });

    if (TILE_CONFIG.SHOW_DEBUG_OVERLAY) {
      drawDebugOverlay(ctx, this.width, height, this.year);
    }

    const renderTime = performance.now() - startTime;
    console.log(`[FacilityYearTile] Rendered: ${this.facilityCode}-${this.year} (${renderTime.toFixed(0)}ms)`);

    return this.canvas;
  }
}