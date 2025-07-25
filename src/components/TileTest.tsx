'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TileManager } from '@/client/tile-system/TileManager';
import { ViewportInfo } from '@/client/tile-system/types';

export function TileTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tileManagerRef = useRef<TileManager | null>(null);
  const [renderStats, setRenderStats] = useState<Array<{
    tile: string;
    time: number;
  }>>([]);
  const [cacheStats, setCacheStats] = useState({ 
    tiles: 0, 
    tileMemoryMB: 0, 
    years: 0, 
    yearMemoryMB: 0, 
    cachedYears: [] as number[] 
  });

  useEffect(() => {
    if (!tileManagerRef.current) {
      tileManagerRef.current = new TileManager(20);
    }

    const manager = tileManagerRef.current;
    
    // Set up viewport
    const viewport: ViewportInfo = {
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-12-31'),
      width: 1000,
      height: 100,
      pixelsPerDay: 1000 / 365
    };
    
    manager.setViewport(viewport);
    
    // Set unit heights for Eraring (example: 3 units)
    manager.setUnitHeights('Eraring', [30, 30, 40]);

    // Test rendering
    const testRender = async () => {
      const startTime = performance.now();
      const stats: typeof renderStats = [];

      // Test fetching and rendering 3 years
      for (let year = 2022; year <= 2024; year++) {
        const tileStart = performance.now();
        const key = { facilityName: 'Eraring', year };
        
        try {
          // Fetch data
          await manager.fetchTileData(key);
          
          // Get tile (triggers render)
          let tile = await manager.getTile(key);
          
          // Wait for render if not ready
          let attempts = 0;
          while (!tile && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            tile = await manager.getTile(key);
            attempts++;
          }
          
          const tileTime = performance.now() - tileStart;
          stats.push({ tile: `Eraring-${year}`, time: tileTime });
          
          // Draw on test canvas
          if (tile && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx && tile.canvas instanceof HTMLCanvasElement) {
              ctx.drawImage(tile.canvas, 0, (year - 2022) * 110, 1000, 100);
            }
          }
        } catch (error) {
          console.error(`Failed to render tile for year ${year}:`, error);
        }
      }

      const totalTime = performance.now() - startTime;
      console.log(`[TEST] Total render time: ${totalTime.toFixed(0)}ms`);
      
      setRenderStats(stats);
      setCacheStats(manager.getCacheStats());
    };

    testRender();

    // Test viewport resize
    const testResize = () => {
      setTimeout(() => {
        console.log('[TEST] Simulating viewport resize...');
        manager.setViewport({
          ...viewport,
          width: 1200 // Change width
        });
        setCacheStats(manager.getCacheStats());
      }, 5000);
    };

    testResize();

  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Tile Rendering Test</h2>
      
      <div style={{ marginBottom: 20 }}>
        <h3>Render Statistics:</h3>
        <ul>
          {renderStats.map((stat, i) => (
            <li key={i}>
              {stat.tile}: {stat.time.toFixed(0)}ms
            </li>
          ))}
        </ul>
        <p>
          Cache: {cacheStats.tiles} tiles ({cacheStats.tileMemoryMB.toFixed(1)}MB), {cacheStats.years} years ({cacheStats.yearMemoryMB.toFixed(1)}MB)
        </p>
      </div>

      <div style={{ border: '1px solid #ccc', overflow: 'auto' }}>
        <canvas 
          ref={canvasRef}
          width={1000}
          height={330}
          style={{ display: 'block' }}
        />
      </div>
    </div>
  );
}