'use client';

import React, { useState, useEffect, useRef } from 'react';
import { yearDataVendor } from '@/client/year-data-vendor';
import { PerformanceDisplay } from '@/components/PerformanceDisplay';
import { perfMonitor } from '@/shared/performance-monitor';

const FACILITY_CODE = 'BAYSW';
const FACILITY_NAME = 'Bayswater';
const START_YEAR = 2025;
const YEAR_COUNT = 20;

export default function TilesTestPage() {
  const [tiles, setTiles] = useState<Map<string, HTMLCanvasElement | OffscreenCanvas | null>>(new Map());
  const [tileErrors, setTileErrors] = useState<Map<string, string>>(new Map());
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const years = Array.from({ length: YEAR_COUNT }, (_, i) => START_YEAR - i);

  // Load all tiles on mount
  useEffect(() => {
    loadAllTiles();
    return () => yearDataVendor.clear();
  }, []);

  const loadAllTiles = () => {
    // Clear existing tiles
    setTiles(new Map());
    setTileErrors(new Map());
    
    // Start fetching tiles with 100ms delay between each
    years.forEach((year, index) => {
      setTimeout(() => {
        loadTile(year);
      }, index * 100);
    });
  };

  const loadTile = async (year: number) => {
    const keyStr = `${FACILITY_NAME}-${year}`;
    
    try {
      perfMonitor.start('tiles_fetch_year', { year });
      const capFacYear = await yearDataVendor.requestYear(year);
      perfMonitor.end('tiles_fetch_year', { year, status: 'success' });
      
      if (!capFacYear) {
        throw new Error('No data returned');
      }
      
      const facilityTile = capFacYear.facilityTiles.get(FACILITY_CODE);
      if (!facilityTile) {
        throw new Error('No Bayswater facility found');
      }
      
      perfMonitor.start('tiles_render_single', { year });
      const canvas = facilityTile.render();
      perfMonitor.end('tiles_render_single', { year, status: 'success' });
      
      if (!canvas) {
        throw new Error('Failed to render tile');
      }
      
      // Update state immediately when tile is ready
      setTiles(prev => new Map(prev).set(keyStr, canvas));
      
    } catch (error) {
      perfMonitor.end('tiles_fetch_year', { year, status: 'error' });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTileErrors(prev => new Map(prev).set(keyStr, errorMessage));
    }
  };

  // Render tile to container
  useEffect(() => {
    perfMonitor.start('tiles_dom_update');
    
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
    
    perfMonitor.end('tiles_dom_update');
  }, [tiles]);

  return (
    <div style={{ 
      backgroundColor: '#faf9f6',
      minHeight: '100vh',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <PerformanceDisplay />
      
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
        
        <div style={{ 
          marginBottom: '2rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem' 
        }}>
          <button
            onClick={loadAllTiles}
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
            Reload All Tiles
          </button>
          
          <span style={{ 
            fontSize: '0.875rem', 
            color: '#6b7280' 
          }}>
            {tiles.size} / {years.length} tiles loaded
          </span>
        </div>

        <div>
          {years.map(year => {
            const key = `${FACILITY_NAME}-${year}`;
            const tile = tiles.get(key);
            const error = tileErrors.get(key);
            
            return (
              <div 
                key={year} 
                style={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e5e5e5',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  marginBottom: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                <div style={{ 
                  fontSize: '1rem', 
                  fontWeight: '600', 
                  color: '#353535',
                  width: '50px',
                  flexShrink: 0
                }}>
                  {year}
                </div>
                
                <div 
                  ref={el => {
                    if (el) containerRefs.current.set(key, el);
                  }}
                  style={{ 
                    width: '50%', 
                    height: '80px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0.25rem',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                >
                  {!tile && !error && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9ca3af'
                    }}>
                      Loading...
                    </div>
                  )}
                  {error && (
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
                      <div style={{ 
                        color: '#dc2626', 
                        fontSize: '0.75rem',
                        marginTop: '0.5rem',
                        maxWidth: '100%',
                        wordBreak: 'break-word'
                      }}>
                        {error}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}