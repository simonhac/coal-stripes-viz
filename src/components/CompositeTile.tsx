'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CalendarDate } from '@internationalized/date';
import { FacilityYearTile } from '@/client/facility-year-tile';
import { CapFacYear } from '@/client/cap-fac-year';
import { getDayIndex } from '@/shared/date-utils';
import { yearDataVendor } from '@/client/year-data-vendor';
import { perfMonitor } from '@/shared/performance-monitor';

interface CompositeTileProps {
  dateRange: { start: CalendarDate; end: CalendarDate };
  facilityCode: string;
  onHover?: (tooltipData: any) => void;
  onHoverEnd?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

type TileState = 'hasData' | 'pendingData' | 'error' | 'idle';

export function CompositeTile({ 
  dateRange, 
  facilityCode,
  onHover,
  onHoverEnd,
  onFocus,
  onBlur
}: CompositeTileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facilityName, setFacilityName] = useState(facilityCode);
  const [leftTile, setLeftTile] = useState<FacilityYearTile | null>(null);
  const [rightTile, setRightTile] = useState<FacilityYearTile | null>(null);
  const [leftTileState, setLeftTileState] = useState<TileState>('idle');
  const [rightTileState, setRightTileState] = useState<TileState>('idle');
  const lastKnownHeightRef = useRef<number>(12); // Default height

  const drawPendingState = (ctx: CanvasRenderingContext2D, x: number, width: number, height: number) => {
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(x, 0, width, height);
  };

  const drawErrorState = (ctx: CanvasRenderingContext2D, x: number, width: number, height: number) => {
    ctx.fillStyle = '#ff0000';
    for (let i = 0; i < width; i += 4) {
      ctx.fillRect(x + i, 0, 2, height);
    }
  };

  useEffect(() => {
    const startYear = dateRange.start.year;
    const endYear = dateRange.end.year;
    
    // Track current request years to ignore stale responses
    let currentStartYear = startYear;
    let currentEndYear = endYear;
    
    // Reset states when date range changes
    setLeftTile(null);
    setRightTile(null);
    setLeftTileState('pendingData');
    setRightTileState(startYear !== endYear ? 'pendingData' : 'idle');
    
    // Load left tile without waiting
    console.log(`Requesting year ${startYear} for facility ${facilityCode}`);
    yearDataVendor.requestYear(startYear)
      .then(leftYearData => {
        // Ignore if we've moved to a different year
        if (currentStartYear !== startYear) {
          console.log(`Ignoring stale response for year ${startYear}`);
          return;
        }
        
        const leftFacilityTile = leftYearData.facilityTiles.get(facilityCode);
        console.log(`Year ${startYear} loaded, has facility ${facilityCode}: ${!!leftFacilityTile}`);
        if (leftFacilityTile) {
          setLeftTile(leftFacilityTile);
          setLeftTileState('hasData');
          setFacilityName(leftFacilityTile.getFacilityName());
        } else {
          setLeftTileState('error');
        }
      })
      .catch(error => {
        // Ignore if we've moved to a different year
        if (currentStartYear !== startYear) {
          console.log(`Ignoring stale error for year ${startYear}`);
          return;
        }
        
        console.error(`Failed to load year ${startYear}:`, error);
        setLeftTileState('error');
      });

    // Load right tile if spanning two years
    if (startYear !== endYear) {
      yearDataVendor.requestYear(endYear)
        .then(rightYearData => {
          // Ignore if we've moved to different years
          if (currentStartYear !== startYear || currentEndYear !== endYear) {
            console.log(`Ignoring stale response for year ${endYear}`);
            return;
          }
          
          const rightFacilityTile = rightYearData.facilityTiles.get(facilityCode);
          if (rightFacilityTile) {
            setRightTile(rightFacilityTile);
            setRightTileState('hasData');
            if (!leftTile) {
              setFacilityName(rightFacilityTile.getFacilityName());
            }
          } else {
            setRightTileState('error');
          }
        })
        .catch(error => {
          // Ignore if we've moved to different years
          if (currentStartYear !== startYear || currentEndYear !== endYear) {
            console.log(`Ignoring stale error for year ${endYear}`);
            return;
          }
          
          console.error(`Failed to load year ${endYear}:`, error);
          setRightTileState('error');
        });
    }
    
    // Cleanup function to mark requests as stale
    return () => {
      currentStartYear = -1;
      currentEndYear = -1;
    };
  }, [dateRange, facilityCode]);

  useEffect(() => {
    const perfName = 'CompositeTile.render';
    perfMonitor.start(perfName);
    
    const canvas = canvasRef.current;
    if (!canvas) {
      perfMonitor.end(perfName);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      perfMonitor.end(perfName);
      return;
    }

    // Set canvas size to exactly 365 pixels wide
    canvas.width = 365;
    canvas.style.width = '365px';
    
    // Set height from available tiles or use last known height
    let canvasHeight = lastKnownHeightRef.current;
    if (leftTile) {
      canvasHeight = leftTile.getCanvas().height;
      lastKnownHeightRef.current = canvasHeight; // Update last known height
    } else if (rightTile) {
      canvasHeight = rightTile.getCanvas().height;
      lastKnownHeightRef.current = canvasHeight; // Update last known height
    }
    canvas.height = canvasHeight;
    canvas.style.height = `${canvasHeight}px`;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const startYear = dateRange.start.year;
    const endYear = dateRange.end.year;
    
    let currentX = 0;
    
    // Draw left tile
    const leftStartDay = getDayIndex(dateRange.start);
    const leftEndDay = startYear === endYear 
      ? getDayIndex(dateRange.end) 
      : (leftTile ? leftTile.getDaysCount() - 1 : getDayIndex(new CalendarDate(startYear, 12, 31)));
    const leftWidth = leftEndDay - leftStartDay + 1;
    
    // Calculate right tile info for logging
    const rightStartDay = 0;
    const rightEndDay = startYear !== endYear ? getDayIndex(dateRange.end) : -1;
    
    console.log(`CompositeTile: LEFT state: ${leftTileState}, tile: ${!!leftTile}, year: ${startYear}, start-end: ${leftStartDay}-${leftEndDay}. RIGHT state: ${rightTileState}, tile: ${!!rightTile}, year: ${endYear}, start-end: ${rightStartDay}-${rightEndDay}.`);
    
    if (leftTileState === 'hasData' && leftTile) {
      const sourceCanvas = leftTile.getCanvas();
      ctx.drawImage(
        sourceCanvas,
        leftStartDay, 0, leftWidth, sourceCanvas.height,
        currentX, 0, leftWidth, sourceCanvas.height
      );
    } else if (leftTileState === 'pendingData') {
      drawPendingState(ctx, currentX, leftWidth, canvas.height);
    } else if (leftTileState === 'error') {
      drawErrorState(ctx, currentX, leftWidth, canvas.height);
    }
    
    currentX += leftWidth;
    
    // Draw right tile if we're spanning two years
    if (startYear !== endYear) {
      const rightStartDay = 0;
      const rightEndDay = getDayIndex(dateRange.end);
      const rightWidth = rightEndDay - rightStartDay + 1;
      
      if (rightTileState === 'hasData' && rightTile) {
        const sourceCanvas = rightTile.getCanvas();
        ctx.drawImage(
          sourceCanvas,
          rightStartDay, 0, rightWidth, sourceCanvas.height,
          currentX, 0, rightWidth, sourceCanvas.height
        );
      } else if (rightTileState === 'pendingData') {
        drawPendingState(ctx, currentX, rightWidth, canvas.height);
      } else if (rightTileState === 'error') {
        drawErrorState(ctx, currentX, rightWidth, canvas.height);
      }
    }
    
    perfMonitor.end(perfName);
  }, [dateRange, leftTile, rightTile, leftTileState, rightTileState, facilityCode]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onHover) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const startYear = dateRange.start.year;
    const endYear = dateRange.end.year;
    
    // Calculate left tile dimensions
    const leftStartDay = getDayIndex(dateRange.start);
    const leftEndDay = startYear === endYear ? getDayIndex(dateRange.end) : (leftTile?.getDaysCount() || 365) - 1;
    const leftWidth = leftEndDay - leftStartDay + 1;
    
    if (x < leftWidth) {
      // Mouse is in left tile
      if (leftTile) {
        const tileX = x + leftStartDay;
        const tooltipData = leftTile.getTooltipData(tileX, y);
        if (tooltipData) {
          // Convert to new format
          const formattedData: any = {
            date: tooltipData.date,
            label: `${tooltipData.facilityName} ${tooltipData.unitName}`,
            capacityFactor: tooltipData.capacityFactor,
            isRegion: false
          };
          onHover(formattedData);
        }
      }
    } else if (startYear !== endYear) {
      // Mouse is in right tile
      if (rightTile) {
        const tileX = x - leftWidth;
        const tooltipData = rightTile.getTooltipData(tileX, y);
        if (tooltipData) {
          // Convert to new format
          const formattedData: any = {
            date: tooltipData.date,
            label: `${tooltipData.facilityName} ${tooltipData.unitName}`,
            capacityFactor: tooltipData.capacityFactor,
            isRegion: false
          };
          onHover(formattedData);
        }
      }
    }
  };

  return (
    <div className="opennem-stripe-row" style={{ display: 'flex' }}>
      <div className="opennem-facility-label">
        {facilityName}
      </div>
      <div 
        className="opennem-stripe-data"
        tabIndex={0}
        style={{ cursor: 'grab' }}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <canvas
          ref={canvasRef}
          style={{ 
            width: '365px',
            height: '12px',
            imageRendering: 'pixelated',
            display: 'block'
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            if (onHoverEnd) {
              onHoverEnd();
            }
          }}
        />
      </div>
    </div>
  );
}