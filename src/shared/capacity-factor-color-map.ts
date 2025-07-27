/**
 * Shared module for capacity factor color mapping
 */

// Pre-compute colors for all capacity factors (0-100)
class CapacityFactorColorMap {
  private static instance: CapacityFactorColorMap;
  private hexColors: string[] = new Array(101);
  private intColors: number[] = new Array(101);

  private constructor() {
    // Pre-compute all colors
    for (let i = 0; i <= 100; i++) {
      const color = this.computeColor(i);
      this.hexColors[i] = color.hex;
      this.intColors[i] = color.int;
    }
  }

  static getInstance(): CapacityFactorColorMap {
    if (!CapacityFactorColorMap.instance) {
      CapacityFactorColorMap.instance = new CapacityFactorColorMap();
    }
    return CapacityFactorColorMap.instance;
  }

  private computeColor(capacityFactor: number): { hex: string; int: number } {
    let r: number, g: number, b: number;
    
    if (capacityFactor < 25) {
      // Red for anything under 25%
      r = 239;
      g = 68;
      b = 68;
    } else {
      // Map capacity factor directly to grey scale
      // 25% -> 75% grey (light), 100% -> 0% grey (black)
      const clampedCapacity = Math.min(100, Math.max(25, capacityFactor));
      
      // Invert so that higher capacity = darker (lower grey value)
      const greyValue = Math.round(255 * (1 - clampedCapacity / 100));
      r = g = b = greyValue;
    }
    
    // Convert to hex format
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    
    return {
      hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
      int: (255 << 24) | (b << 16) | (g << 8) | r
    };
  }

  getHexColor(capacityFactor: number | null): string {
    // Light blue for missing data
    if (capacityFactor === null || capacityFactor === undefined) return '#e6f3ff';
    
    // Round and clamp to valid range
    const rounded = Math.round(Math.max(0, Math.min(100, capacityFactor)));
    return this.hexColors[rounded];
  }

  getIntColor(capacityFactor: number | null): number {
    // Light blue for missing data (0xFFFFF3E6 in ABGR format)
    if (capacityFactor === null || capacityFactor === undefined) return 0xFFFFF3E6;
    
    // Round and clamp to valid range
    const rounded = Math.round(Math.max(0, Math.min(100, capacityFactor)));
    return this.intColors[rounded];
  }
}

// Export singleton instance
export const capacityFactorColorMap = CapacityFactorColorMap.getInstance();

// Export convenience functions
export function getProportionColorHex(capacityFactor: number | null): string {
  return capacityFactorColorMap.getHexColor(capacityFactor);
}

export function getProportionColorInt(capacityFactor: number | null): number {
  return capacityFactorColorMap.getIntColor(capacityFactor);
}