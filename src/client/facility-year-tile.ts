import { GeneratingUnitDTO } from '@/shared/types';
import { TILE_CONFIG } from '@/shared/config';

// Singleton colour cache - pre-computed as 32-bit RGBA integers
const COLOR_CACHE = new Map<number | null, number>();

// Pre-compute all colours at startup as 32-bit integers (RGBA)
function initializeColorCache(): void {
  // Add null value - light blue (#e6f3ff)
  COLOR_CACHE.set(null, 0xffe6f3ff); // ABGR format for little-endian
  
  // Pre-compute all integer capacity factors from 0 to 100
  for (let i = 0; i <= 100; i++) {
    let r: number, g: number, b: number;
    if (i < 25) {
      // Red (#ef4444)
      r = 0xef;
      g = 0x44;
      b = 0x44;
    } else {
      // Grayscale based on capacity
      const greyValue = Math.round(255 * (1 - i / 100));
      r = greyValue;
      g = greyValue;
      b = greyValue;
    }
    // Store as ABGR (little-endian) with full alpha
    const color = (0xff << 24) | (b << 16) | (g << 8) | r;
    COLOR_CACHE.set(i, color);
  }
}

// Initialize the cache immediately
initializeColorCache();

function getCoalProportionColorInt(capacityFactor: number | null): number {
  if (capacityFactor === null || capacityFactor === undefined) {
    return COLOR_CACHE.get(null)!;
  }
  
  // Round to nearest integer and clamp to 0-100
  const rounded = Math.round(Math.min(100, Math.max(0, capacityFactor)));
  return COLOR_CACHE.get(rounded)!;
}

export class FacilityYearTile {
  private facilityCode: string;
  private year: number;
  private units: GeneratingUnitDTO[];
  private canvas: OffscreenCanvas | HTMLCanvasElement | null = null;

  constructor(facilityCode: string, year: number, units: GeneratingUnitDTO[]) {
    this.facilityCode = facilityCode;
    this.year = year;
    this.units = units;
  }

  private calculateUnitHeights(useShortLabels: boolean = false): number[] {
    return this.units.map(unit => {
      const minHeight = useShortLabels ? 16 : 12;
      return Math.max(minHeight, Math.min(40, unit.capacity / 30));
    });
  }

  render(useShortLabels: boolean = false): OffscreenCanvas | HTMLCanvasElement {
    const startTime = performance.now();
    
    // Width is exactly the number of days
    const daysInYear = this.units[0]?.history.data.length || 365;
    const width = daysInYear;
    
    const unitHeights = this.calculateUnitHeights(useShortLabels);
    const height = unitHeights.reduce((sum, h) => sum + h, 0);

    if (!this.canvas) {
      if (typeof OffscreenCanvas !== 'undefined') {
        this.canvas = new OffscreenCanvas(width, height);
      } else {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
      }
    }

    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    
    // Create ImageData for direct pixel manipulation
    const imageData = ctx.createImageData(width, height);
    
    // Check if we're in a test environment with mock canvas
    let pixels: Uint32Array;
    let useDirectBuffer = true;
    try {
      pixels = new Uint32Array(imageData.data.buffer);
    } catch (e) {
      // Fallback for test environment - use imageData directly
      useDirectBuffer = false;
      // Work directly with the Uint8ClampedArray
      pixels = new Uint32Array(0); // Dummy, won't be used
    }
    
    if (useDirectBuffer) {
      // Fill with white background (0xffffffff in ABGR)
      pixels.fill(0xffffffff);
      
      // Render units using direct pixel manipulation
      let yOffset = 0;
      this.units.forEach((unit, unitIndex) => {
        const unitHeight = unitHeights[unitIndex];
        
        for (let dayIndex = 0; dayIndex < unit.history.data.length; dayIndex++) {
          const capacityFactor = unit.history.data[dayIndex];
          const color = getCoalProportionColorInt(capacityFactor);
          
          // Fill the column for this day
          for (let y = 0; y < unitHeight; y++) {
            const pixelIndex = (yOffset + y) * width + dayIndex;
            pixels[pixelIndex] = color;
          }
        }

        yOffset += unitHeight;
      });
    } else {
      // Fallback: work with Uint8ClampedArray directly
      const data = imageData.data;
      
      // Fill with white background
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;     // R
        data[i + 1] = 255; // G
        data[i + 2] = 255; // B
        data[i + 3] = 255; // A
      }
      
      // Render units
      let yOffset = 0;
      this.units.forEach((unit, unitIndex) => {
        const unitHeight = unitHeights[unitIndex];
        
        for (let dayIndex = 0; dayIndex < unit.history.data.length; dayIndex++) {
          const capacityFactor = unit.history.data[dayIndex];
          const color = getCoalProportionColorInt(capacityFactor);
          
          // Extract RGBA components from the 32-bit color
          const r = color & 0xFF;
          const g = (color >> 8) & 0xFF;
          const b = (color >> 16) & 0xFF;
          const a = (color >> 24) & 0xFF;
          
          // Fill the column for this day
          for (let y = 0; y < unitHeight; y++) {
            const pixelIndex = ((yOffset + y) * width + dayIndex) * 4;
            data[pixelIndex] = r;
            data[pixelIndex + 1] = g;
            data[pixelIndex + 2] = b;
            data[pixelIndex + 3] = a;
          }
        }
        
        yOffset += unitHeight;
      });
    }
    
    // Put the image data back to canvas
    try {
      ctx.putImageData(imageData, 0, 0);
    } catch (e) {
      // Test environment fallback
      console.warn('Skipping putImageData in test environment');
    }
    
    // Draw debug overlay if needed (this still needs string colors)
    if (TILE_CONFIG.SHOW_DEBUG_OVERLAY) {
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
        this.year.toString(),
        width / 2,
        height / 2
      );
    }

    const renderTime = performance.now() - startTime;
    console.log(`[FacilityYearTile] Rendered: ${this.facilityCode}-${this.year} (${renderTime.toFixed(0)}ms)`);

    return this.canvas;
  }
}
