'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TileManager } from '@/client/tile-system/TileManager';
import { Viewport } from '@/client/tile-system/Viewport';
import { TileKey, RenderedTile } from '@/client/tile-system/types';
import { CoalUnit, CoalStripesData } from '@/shared/types';
import { parseDate } from '@internationalized/date';
import { getDaysBetween, isLeapYear } from '@/shared/date-utils';

interface TileViewportProps {
  facilityName: string;
  units: CoalUnit[];
  dates: string[];
  unitHeights: number[];
  startYear: number;
  endYear: number;
}

export function TileViewport({ facilityName, units, dates, unitHeights, startYear, endYear }: TileViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tileManagerRef = useRef<TileManager | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [stats, setStats] = useState({ 
    tiles: 0, 
    tileMemoryMB: 0,
    years: 0,
    yearMemoryMB: 0,
    cachedYears: [] as number[]
  });
  const [loading, setLoading] = useState(true);
  
  // Initialize managers
  useEffect(() => {
    if (!containerRef.current || !units || units.length === 0) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const totalHeight = unitHeights.reduce((sum, h) => sum + h, 0);
    
    // Create tile manager
    tileManagerRef.current = new TileManager(20);
    tileManagerRef.current.setUnitHeights(facilityName, unitHeights);
    
    // Set the data directly in the tile manager - NO API CALLS
    // We need to split the data by year for proper tile rendering
    const startDate = parseDate(dates[0]);
    const endDate = parseDate(dates[dates.length - 1]);
    
    // For each year in the range, create year data
    for (let year = startYear; year <= endYear; year++) {
      // For now, use the same units data for each year
      // In a real implementation, we'd filter the data by year
      const yearData: CoalStripesData = {
        type: 'capacity_factors',
        version: '1.0',
        created_at: new Date().toISOString(),
        data: units
      };
      
      tileManagerRef.current.setYearData(year, yearData);
    }
    
    // Create viewport
    const facilityHeights = new Map([[facilityName, totalHeight]]);
    viewportRef.current = new Viewport({
      containerWidth: rect.width,
      containerHeight: rect.height,
      startDate: parseDate(`${startYear}-01-01`),
      endDate: parseDate(`${endYear}-12-31`),
      facilityNames: [facilityName],
      facilityHeights
    });
    
    // Set viewport info in tile manager
    const viewportInfo = viewportRef.current.getViewportInfo();
    tileManagerRef.current.setViewport(viewportInfo);
    
    // Initial render
    setTimeout(() => {
      renderViewport();
    }, 100);
  }, [facilityName, units, dates, unitHeights, startYear, endYear]);
  
  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !viewportRef.current || !tileManagerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      viewportRef.current.updateConfig({
        containerWidth: rect.width,
        containerHeight: rect.height
      });
      
      // Update tile manager viewport
      const viewportInfo = viewportRef.current.getViewportInfo();
      tileManagerRef.current.setViewport(viewportInfo);
      
      renderViewport();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const renderViewport = useCallback(async () => {
    if (!canvasRef.current || !viewportRef.current || !tileManagerRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    // Get visible tiles
    const visibleTiles = viewportRef.current.getVisibleTiles();
    console.log('[VIEWPORT] Visible tiles:', visibleTiles);
    const renderedTiles: RenderedTile[] = [];
    
    // Render each visible tile
    let needsRerender = false;
    for (const tileKey of visibleTiles) {
      const tile = await tileManagerRef.current.getTile(tileKey);
      console.log(`[VIEWPORT] Tile ${tileKey.facilityName}-${tileKey.year}:`, tile ? 'ready' : 'loading');
      
      if (tile) {
        renderedTiles.push(tile);
        
        // Get tile position
        const pos = viewportRef.current.getTilePosition(tileKey);
        console.log(`[VIEWPORT] Drawing at:`, pos);
        
        // Draw tile if visible
        if (pos.x + pos.width > 0 && pos.x < rect.width) {
          try {
            // Calculate which portion of the tile to draw
            const tileYear = tileKey.year;
            const yearStart = parseDate(`${tileYear}-01-01`);
            const yearEnd = parseDate(`${tileYear}-12-31`);
            
            // Calculate the visible portion of this tile
            const viewStart = parseDate(dates[0]);
            const viewEnd = parseDate(dates[dates.length - 1]);
            
            // Determine the overlap between tile year and view range
            const overlapStart = viewStart.compare(yearStart) > 0 ? viewStart : yearStart;
            const overlapEnd = viewEnd.compare(yearEnd) < 0 ? viewEnd : yearEnd;
            
            // Calculate source coordinates within the tile
            const daysInYear = isLeapYear(tileKey.year) ? 366 : 365;
            
            // Calculate days more efficiently
            const daysSinceYearStartCount = getDaysBetween(yearStart, overlapStart);
            const overlapDays = getDaysBetween(overlapStart, overlapEnd) + 1;
            
            const sourceX = (daysSinceYearStartCount / daysInYear) * tile.canvas.width;
            const sourceWidth = (overlapDays / daysInYear) * tile.canvas.width;
            
            // Calculate destination coordinates
            const destX = pos.x + (daysSinceYearStartCount / daysInYear) * pos.width;
            const destWidth = (overlapDays / daysInYear) * pos.width;
            
            // Try to draw the tile
            ctx.save();
            ctx.drawImage(
              tile.canvas as any,
              sourceX, 0, sourceWidth, tile.canvas.height,
              destX, pos.y, destWidth, pos.height
            );
            ctx.restore();
            console.log(`[VIEWPORT] Drew tile ${tileKey.year}: source(${sourceX.toFixed(0)}, ${sourceWidth.toFixed(0)}) -> dest(${destX.toFixed(0)}, ${destWidth.toFixed(0)})`);
          } catch (err) {
            console.error(`[VIEWPORT] Failed to draw tile:`, err);
            // Draw a placeholder
            ctx.fillStyle = 'blue';
            ctx.fillRect(pos.x, pos.y, pos.width, pos.height);
          }
        }
      } else {
        needsRerender = true;
      }
    }
    
    // If some tiles weren't ready, re-render after a delay
    if (needsRerender) {
      setTimeout(() => renderViewport(), 500);
    } else {
      setLoading(false);
    }
    
    // Draw year labels
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    for (const tileKey of visibleTiles) {
      const pos = viewportRef.current.getTilePosition(tileKey);
      if (pos.x + pos.width > 0 && pos.x < rect.width) {
        ctx.fillText(tileKey.year.toString(), pos.x + 5, pos.y + 15);
      }
    }
    
    // Update stats
    const cacheStats = tileManagerRef.current.getCacheStats();
    setStats({ 
      tiles: cacheStats.tiles, 
      tileMemoryMB: cacheStats.tileMemoryMB,
      years: cacheStats.years,
      yearMemoryMB: cacheStats.yearMemoryMB,
      cachedYears: cacheStats.cachedYears
    });
    
    // Preload adjacent tiles
    const preloadTiles = viewportRef.current.getPreloadTiles();
    for (const tileKey of preloadTiles) {
      tileManagerRef.current.fetchTileData(tileKey).catch(console.error);
    }
  }, []);
  
  // Mouse/touch handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - scrollPosition.x, y: e.clientY - scrollPosition.y });
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !viewportRef.current) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    setScrollPosition({ x: newX, y: newY });
    viewportRef.current.setPosition(-newX, -newY);
    
    // Throttle rendering
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      renderViewport();
    });
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove as any);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove as any);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);
  
  return (
    <div 
      ref={containerRef}
      style={{ 
        position: 'relative',
        width: '100%',
        height: unitHeights.reduce((sum, h) => sum + h, 0),
        overflow: 'hidden'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
}