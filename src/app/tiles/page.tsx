'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TileManager } from '@/client/tile-system/TileManager';
import { TileKey, RenderedTile } from '@/client/tile-system/types';
import { yearDataVendor } from '@/client/year-data-vendor';
import { CACHE_CONFIG } from '@/shared/config';

export default function TilesTestPage() {
  const [tiles, setTiles] = useState<Map<string, HTMLCanvasElement | OffscreenCanvas | null>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [renderTime, setRenderTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [tileErrors, setTileErrors] = useState<Map<string, string>>(new Map());
  const tileManagerRef = useRef<TileManager | null>(null);
  // Use the singleton yearDataVendor instead of creating a new instance
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Initialize on mount
  useEffect(() => {
    tileManagerRef.current = new TileManager(20); // Cache up to 20 tiles
    // yearDataVendor is already initialized as a singleton
    
    // Initial render
    renderAllTiles();

    return () => {
      tileManagerRef.current = null;
      yearDataVendor.clear();
    };
  }, []);

  const renderAllTiles = async () => {
    const startTime = performance.now();
    const facilityName = 'Bayswater';
    const startYear = 2025;
    const years = Array.from({ length: 10 }, (_, i) => startYear - i);
    
    // Clear existing tiles and errors
    setTiles(new Map());
    setError(null);
    const newLoading = new Set<string>();
    years.forEach(year => {
      newLoading.add(`${facilityName}-${year}`);
    });
    setLoading(newLoading);

    // Fetch data and render tiles
    const newTiles = new Map<string, HTMLCanvasElement | OffscreenCanvas | null>();
    
    for (const year of years) {
      const tileKey: TileKey = { facilityName, year };
      const keyStr = `${facilityName}-${year}`;
      
      try {
        console.log(`Fetching data for ${year}...`);
        
        // Fetch the year data through SmartCache (which handles retries)
        const yearData = await yearDataVendor.requestYear(year);
        
        if (yearData) {
          console.log(`Got data for ${year}, filtering for Bayswater...`);
          
          // Filter for Bayswater units
          const bayswaterUnits = yearData.data.filter(unit => 
            unit.facility_name === 'Bayswater'
          );
          
          console.log(`Found ${bayswaterUnits.length} Bayswater units for ${year}`);
          
          if (bayswaterUnits.length > 0) {
            // Set the data in TileManager
            const bayswaterData = {
              ...yearData,
              data: bayswaterUnits
            };
            
            // Check if component is still mounted
            if (!tileManagerRef.current) {
              console.log(`Component unmounted, skipping tile setup for ${year}`);
              break;
            }
            
            tileManagerRef.current.setYearData(year, bayswaterData);
            
            // Get unit heights (40px per unit)
            const unitHeights = bayswaterUnits.map(() => 40);
            tileManagerRef.current.setUnitHeights(facilityName, unitHeights);
            
            // Set viewport info for tile rendering
            const viewportInfo = {
              startDate: new Date(`${year}-01-01`),
              endDate: new Date(`${year}-12-31`),
              width: 800, // Fixed width for tile rendering
              height: unitHeights.reduce((sum, h) => sum + h, 0),
              pixelsPerDay: 800 / (yearData.data[0].history.data.length || 365)
            };
            tileManagerRef.current.setViewport(viewportInfo);
            
            // Now get the tile - it may not be ready immediately
            console.log(`Getting tile for ${keyStr}...`);
            
            // Try to get the tile, with retries if it's still rendering
            let tile: RenderedTile | null = null;
            let attempts = 0;
            const maxAttempts = 10;
            
            while (attempts < maxAttempts) {
              // Check if component is still mounted
              if (!tileManagerRef.current) {
                console.log(`Component unmounted, stopping tile fetch for ${year}`);
                break;
              }
              
              tile = await tileManagerRef.current.getTile(tileKey);
              
              if (tile && tile.canvas) {
                console.log(`Got tile for ${keyStr} after ${attempts + 1} attempts!`);
                newTiles.set(keyStr, tile.canvas);
                break;
              }
              
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, 500));
              attempts++;
              
              // Log the tile status
              if (tileManagerRef.current) {
                const status = tileManagerRef.current.getStatus(tileKey);
                console.log(`Tile ${keyStr} status:`, status);
              }
            }
            
            if (!tile || !tile.canvas) {
              console.error(`Failed to get tile for ${keyStr} after ${attempts} attempts`);
              
              if (tileManagerRef.current) {
                const finalStatus = tileManagerRef.current.getStatus(tileKey);
                console.error(`Final status:`, finalStatus);
                
                // Check if it's an error state
                if (finalStatus?.state === 'error') {
                  const errorMessage = finalStatus.error?.message || 'Failed to render tile';
                  setTileErrors(prev => new Map([...prev, [keyStr, errorMessage]]));
                }
              }
              
              newTiles.set(keyStr, null);
            }
          } else {
            console.warn(`No Bayswater units found for ${year}`);
            newTiles.set(keyStr, null);
            setTileErrors(prev => new Map([...prev, [keyStr, 'No Bayswater units found']]));
          }
        } else {
          console.error(`No data returned for ${year}`);
          newTiles.set(keyStr, null);
          setTileErrors(prev => new Map([...prev, [keyStr, 'No data available']]));
        }
      } catch (error) {
        console.error(`Failed to load tile for ${keyStr}:`, error);
        newTiles.set(keyStr, null);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setTileErrors(prev => new Map([...prev, [keyStr, errorMessage]]));
      }
      
      // Update state to show this tile
      setTiles(prev => new Map([...prev, [keyStr, newTiles.get(keyStr) || null]]));
      setLoading(prev => {
        const next = new Set(prev);
        next.delete(keyStr);
        return next;
      });
      
      // Add rate limiting delay between fetches (except for the last one)
      if (year !== years[years.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, CACHE_CONFIG.RATE_LIMIT_DELAY));
      }
    }

    const elapsed = performance.now() - startTime;
    setRenderTime(Math.round(elapsed));
  };

  const clearAndRepaint = () => {
    // Clear the tile display but keep cache
    setTiles(new Map());
    setRenderTime(0);
    setError(null);
    setTileErrors(new Map());
    
    // Re-render after a small delay
    setTimeout(() => {
      renderAllTiles();
    }, 100);
  };

  // Render tile to container
  useEffect(() => {
    tiles.forEach((canvas, key) => {
      const container = containerRefs.current.get(key);
      if (container && canvas) {
        // Clear container
        container.innerHTML = '';
        
        // Check if it's an OffscreenCanvas or HTMLCanvasElement
        if (canvas instanceof HTMLCanvasElement) {
          // HTMLCanvasElement - can be cloned
          const clonedCanvas = canvas.cloneNode(true) as HTMLCanvasElement;
          clonedCanvas.style.width = '100%';
          clonedCanvas.style.height = '100%';
          clonedCanvas.style.display = 'block';
          container.appendChild(clonedCanvas);
        } else if (canvas instanceof OffscreenCanvas) {
          // OffscreenCanvas - need to create a new canvas and copy content
          const newCanvas = document.createElement('canvas');
          newCanvas.width = canvas.width;
          newCanvas.height = canvas.height;
          newCanvas.style.width = '100%';
          newCanvas.style.height = '100%';
          newCanvas.style.display = 'block';
          
          const ctx = newCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(canvas as any, 0, 0);
          }
          
          container.appendChild(newCanvas);
        }
      }
    });
  }, [tiles]);

  const years = Array.from({ length: 10 }, (_, i) => 2025 - i);

  return (
    <div style={{ 
      backgroundColor: '#faf9f6',
      minHeight: '100vh',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem' 
      }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: '700', 
          marginBottom: '2rem',
          color: '#353535' 
        }}>
          Tile System Test - Bayswater Facility
        </h1>
        
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
            color: '#991b1b'
          }}>
            {error}
          </div>
        )}
        
        <div style={{ 
          marginBottom: '2rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem' 
        }}>
          <button
            onClick={clearAndRepaint}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#e34a33',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c73820'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e34a33'}
          >
            Clear & Repaint Tiles
          </button>
          
          {renderTime > 0 && (
            <span style={{ 
              fontSize: '0.875rem', 
              color: '#6b7280' 
            }}>
              Rendered in {renderTime}ms
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '2rem' }}>
          <div style={{ flex: 1 }}>
            {years.map(year => {
              const key = `Bayswater-${year}`;
              const isLoading = loading.has(key);
              const tile = tiles.get(key);
              const hasTile = tile !== undefined;
              
              return (
                <div 
                  key={year} 
                  style={{ 
                    backgroundColor: 'white',
                    border: '1px solid #e5e5e5',
                    borderRadius: '0.5rem',
                    padding: '1.5rem',
                    marginBottom: '1rem'
                  }}
                >
                  <h2 style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: '600', 
                    marginBottom: '1rem',
                    color: '#353535' 
                  }}>
                    {year}
                  </h2>
                  
                  <div 
                    ref={el => {
                      if (el) containerRefs.current.set(key, el);
                    }}
                    style={{ 
                      width: '100%', 
                      height: '160px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '0.25rem',
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    {isLoading && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9ca3af'
                      }}>
                        Loading tile...
                      </div>
                    )}
                    {!isLoading && hasTile && !tile && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1rem',
                        textAlign: 'center'
                      }}>
                        <div style={{ color: '#ef4444', fontWeight: '500' }}>
                          Failed to load tile
                        </div>
                        {tileErrors.has(key) && (
                          <div style={{ 
                            color: '#dc2626', 
                            fontSize: '0.75rem',
                            marginTop: '0.5rem',
                            maxWidth: '100%',
                            wordBreak: 'break-word'
                          }}>
                            {tileErrors.get(key)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ width: '300px' }}>
            <div style={{ 
              backgroundColor: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              position: 'sticky',
              top: '2rem'
            }}>
              <h3 style={{ 
                fontSize: '1.125rem',
                fontWeight: '600', 
                marginBottom: '1rem',
                color: '#353535' 
              }}>
                Cache Statistics
              </h3>
              <div style={{ 
                fontSize: '0.875rem', 
                color: '#6b7280',
                lineHeight: '1.75'
              }}>
                <div>Tiles cached: {tileManagerRef.current?.getCacheStats().tiles || 0}</div>
                <div>Tile memory: {(tileManagerRef.current?.getCacheStats().tileMemoryMB || 0).toFixed(2)} MB</div>
                <div>Years cached: {tileManagerRef.current?.getCacheStats().years || 0}</div>
                <div>Year memory: {(tileManagerRef.current?.getCacheStats().yearMemoryMB || 0).toFixed(2)} MB</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}