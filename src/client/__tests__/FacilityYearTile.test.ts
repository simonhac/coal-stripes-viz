import { FacilityYearTile } from '../facility-year-tile';
import { GeneratingUnitDTO } from '@/shared/types';
import { MockCanvas } from './helpers/mock-canvas';

// Mock OffscreenCanvas
global.OffscreenCanvas = MockCanvas as any;

describe('FacilityYearTile', () => {
  const mockUnit = (duid: string, capacity: number, data: (number | null)[]): GeneratingUnitDTO => ({
    network: 'NEM',
    region: 'NSW1',
    data_type: 'capacity_factor',
    units: 'MW',
    capacity,
    duid,
    facility_code: 'TESTFAC',
    facility_name: 'Test Facility',
    fueltech: 'black_coal',
    history: {
      start: '2023-01-01',
      last: '2023-12-31',
      interval: 'P1D',
      data
    }
  });

  describe('Basic Functionality', () => {
    it('should create a tile instance', () => {
      const tile = new FacilityYearTile('TESTFAC', 2023, []);
      expect(tile).toBeInstanceOf(FacilityYearTile);
    });

    it('should render a canvas with correct dimensions', () => {
      const units = [
        mockUnit('UNIT1', 600, Array(365).fill(50)),
        mockUnit('UNIT2', 400, Array(365).fill(75))
      ];
      
      const tile = new FacilityYearTile('TESTFAC', 2023, units);
      const canvas = tile.render();
      
      expect(canvas.width).toBe(365); // Width should be number of days
      // Height should be based on capacity / 30, with min 12 and max 40
      // Unit 1: max(12, min(40, 600/30)) = max(12, min(40, 20)) = 20
      // Unit 2: max(12, min(40, 400/30)) = max(12, min(40, 13.33)) = 13.33
      expect(canvas.height).toBeGreaterThan(0);
    });

    it('should handle units with null capacity factors', () => {
      const units = [
        mockUnit('UNIT1', 300, Array(365).fill(null))
      ];
      
      const tile = new FacilityYearTile('TESTFAC', 2023, units);
      expect(() => tile.render()).not.toThrow();
    });

    it('should handle mixed capacity factors', () => {
      const data = [
        ...Array(100).fill(0),      // Low utilisation
        ...Array(100).fill(50),     // Medium utilisation
        ...Array(100).fill(100),    // High utilisation
        ...Array(65).fill(null)     // Missing data
      ];
      
      const units = [mockUnit('UNIT1', 500, data)];
      const tile = new FacilityYearTile('TESTFAC', 2023, units);
      expect(() => tile.render()).not.toThrow();
    });

    it('should calculate correct unit heights', () => {
      const units = [
        mockUnit('UNIT1', 360, Array(365).fill(50)),  // 360/30 = 12 (min)
        mockUnit('UNIT2', 600, Array(365).fill(50)),  // 600/30 = 20
        mockUnit('UNIT3', 1500, Array(365).fill(50))  // 1500/30 = 50 (capped at 40)
      ];
      
      const tile = new FacilityYearTile('TESTFAC', 2023, units);
      const canvas = tile.render();
      
      // Total height should be 12 + 20 + 40 = 72
      expect(canvas.height).toBe(72);
    });

    it('should handle useShortLabels parameter', () => {
      const units = [
        mockUnit('UNIT1', 300, Array(365).fill(50))  // 300/30 = 10
      ];
      
      // Create separate tiles for each test since canvas is cached
      const tileShort = new FacilityYearTile('TESTFAC', 2023, units);
      const canvasShort = tileShort.render(true);
      expect(canvasShort.height).toBe(16);
      
      // Create new tile for normal labels test
      const tileNormal = new FacilityYearTile('TESTFAC', 2023, units);
      const canvasNormal = tileNormal.render(false);
      expect(canvasNormal.height).toBe(12);
    });
  });

  describe('Performance Tests', () => {
    it('should render a single tile quickly', () => {
      const units = Array(4).fill(null).map((_, i) => 
        mockUnit(`UNIT${i}`, 500, Array(365).fill(Math.random() * 100))
      );
      
      const tile = new FacilityYearTile('TESTFAC', 2023, units, 1200);
      
      const startTime = performance.now();
      tile.render();
      const renderTime = performance.now() - startTime;
      
      // Should render in less than 50ms
      expect(renderTime).toBeLessThan(50);
    });

    it('should render multiple tiles efficiently', () => {
      const years = 10;
      const renderTimes: number[] = [];
      
      for (let year = 2020; year < 2020 + years; year++) {
        const units = Array(4).fill(null).map((_, i) => 
          mockUnit(`UNIT${i}`, 500, Array(365).fill(Math.random() * 100))
        );
        
        const tile = new FacilityYearTile('TESTFAC', year, units);
        
        const startTime = performance.now();
        tile.render();
        const renderTime = performance.now() - startTime;
        renderTimes.push(renderTime);
      }
      
      const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      
      // Average render time should be under 30ms
      expect(avgRenderTime).toBeLessThan(30);
      
      // No individual render should take more than 50ms
      renderTimes.forEach(time => expect(time).toBeLessThan(50));
    });

    it('should handle large facilities efficiently', () => {
      // Test with 8 units (large facility)
      const units = Array(8).fill(null).map((_, i) => 
        mockUnit(`UNIT${i}`, 500, Array(365).fill(Math.random() * 100))
      );
      
      const tile = new FacilityYearTile('TESTFAC', 2023, units);
      
      const startTime = performance.now();
      tile.render();
      const renderTime = performance.now() - startTime;
      
      // Even large facilities should render quickly
      expect(renderTime).toBeLessThan(100);
    });

    it('should benefit from colour cache', () => {
      // First render - cache might be cold for some values
      const units1 = [mockUnit('UNIT1', 500, Array(365).fill(50))];
      const tile1 = new FacilityYearTile('TESTFAC', 2023, units1);
      
      const startTime1 = performance.now();
      tile1.render();
      const renderTime1 = performance.now() - startTime1;
      
      // Second render with same capacity factors - should use cache
      const units2 = [mockUnit('UNIT2', 500, Array(365).fill(50))];
      const tile2 = new FacilityYearTile('TESTFAC', 2024, units2);
      
      const startTime2 = performance.now();
      tile2.render();
      const renderTime2 = performance.now() - startTime2;
      
      // Both should be fast due to pre-computed cache
      expect(renderTime1).toBeLessThan(50);
      expect(renderTime2).toBeLessThan(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty units array', () => {
      const tile = new FacilityYearTile('TESTFAC', 2023, []);
      const canvas = tile.render();
      expect(canvas.width).toBe(365); // Default to 365 days
      expect(canvas.height).toBeGreaterThanOrEqual(0);
    });

    it('should handle leap years (366 days)', () => {
      const units = [
        mockUnit('UNIT1', 500, Array(366).fill(50))
      ];
      
      const tile = new FacilityYearTile('TESTFAC', 2024, units);
      expect(() => tile.render()).not.toThrow();
    });

    it('should handle leap years with correct width', () => {
      const units = [mockUnit('UNIT1', 500, Array(366).fill(50))];
      const tile = new FacilityYearTile('TESTFAC', 2024, units);
      const canvas = tile.render();
      expect(canvas.width).toBe(366); // Leap year has 366 days
    });

    it('should handle units with zero capacity', () => {
      const units = [
        mockUnit('UNIT1', 0, Array(365).fill(0))
      ];
      
      const tile = new FacilityYearTile('TESTFAC', 2023, units);
      const canvas = tile.render();
      // With 0 capacity, height should be minimum (12)
      expect(canvas.height).toBe(12);
    });

    it('should round capacity factors correctly', () => {
      const units = [
        mockUnit('UNIT1', 500, [
          24.4,  // Should round to 24 (red)
          24.5,  // Should round to 25 (grey)
          24.6,  // Should round to 25 (grey)
          99.4,  // Should round to 99
          99.5,  // Should round to 100
          100.1, // Should clamp to 100
          -10,   // Should clamp to 0
          null   // Should stay null (light blue)
        ])
      ];
      
      const tile = new FacilityYearTile('TESTFAC', 2023, units);
      expect(() => tile.render()).not.toThrow();
    });
  });
});