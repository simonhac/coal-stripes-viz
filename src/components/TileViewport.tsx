'use client';

import React, { useEffect, useRef } from 'react';
import { TileManager } from '@/client/tile-system/TileManager';
import { TileKey } from '@/client/tile-system/types';
import { parseDate } from '@internationalized/date';
import { getDayIndex, isLeapYear } from '@/shared/date-utils';

interface TileViewportProps {
  facilityName: string;
  tileManager: TileManager; // Receive the tile manager from parent
  dates: string[];
  unitHeights: number[];
  startYear: number;
  endYear: number;
}

export function TileViewport({ facilityName, tileManager, dates, unitHeights, startYear, endYear }: TileViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Main render effect - just composite tiles
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || dates.length === 0) return;
    
    const renderViewport = async () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const rect = containerRef.current!.getBoundingClientRect();
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
      
      // Parse start and end dates
      const viewStartDate = parseDate(dates[0]);
      const viewEndDate = parseDate(dates[dates.length - 1]);
      
      // We need tiles for startYear and endYear (which may be the same)
      const years = startYear === endYear ? [startYear] : [startYear, endYear];
      
      // Calculate total height
      const totalHeight = unitHeights.reduce((sum, h) => sum + h, 0);
      
      // Render each year's contribution
      let currentX = 0;
      const pixelsPerDay = rect.width / 365; // Always 365 days in the viewport
      
      for (const year of years) {
        const tileKey: TileKey = { facilityName, year };
        
        // Get the tile from cache
        const tile = await tileManager.getTile(tileKey);
        if (!tile || !tile.canvas) {
          console.warn(`No tile available for ${facilityName}-${year}`);
          continue;
        }
        
        // Calculate which portion of this year to copy
        const yearStart = parseDate(`${year}-01-01`);
        const yearEnd = parseDate(`${year}-12-31`);
        const daysInYear = isLeapYear(year) ? 366 : 365;
        
        let copyStartDate;
        let copyEndDate;
        
        if (year === startYear && year === endYear) {
          // Same year - copy from viewStartDate to viewEndDate
          copyStartDate = viewStartDate;
          copyEndDate = viewEndDate;
        } else if (year === startYear) {
          // Start year - copy from viewStartDate to Dec 31
          copyStartDate = viewStartDate;
          copyEndDate = yearEnd;
        } else {
          // End year - copy from Jan 1 to viewEndDate
          copyStartDate = yearStart;
          copyEndDate = viewEndDate;
        }
        
        // Calculate source coordinates in the tile
        const sourceDayStart = getDayIndex(copyStartDate);
        const sourceDayEnd = getDayIndex(copyEndDate);
        const sourceDays = sourceDayEnd - sourceDayStart + 1;
        
        const sourceX = (sourceDayStart / daysInYear) * tile.canvas.width;
        const sourceWidth = (sourceDays / daysInYear) * tile.canvas.width;
        
        // Calculate destination width
        const destWidth = sourceDays * pixelsPerDay;
        
        // Draw the tile portion
        try {
          ctx.drawImage(
            tile.canvas as any,
            sourceX, 0, sourceWidth, tile.canvas.height,
            currentX, 0, destWidth, totalHeight
          );
          
          currentX += destWidth;
        } catch (err) {
          console.error(`Failed to draw tile for year ${year}:`, err);
        }
      }
    };
    
    // Run the render
    renderViewport();
  }, [facilityName, tileManager, dates, unitHeights, startYear, endYear]);
  
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