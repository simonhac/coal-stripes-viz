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
  const animationFrameRef = useRef<number | null>(null);
  const shimmerOffsetRef = useRef<number>(0);
  const lastAnimationTimeRef = useRef<number>(performance.now());

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
    yearDataVendor.requestYear(startYear)
      .then(leftYearData => {
        // Ignore if we've moved to a different year
        if (currentStartYear !== startYear) {
          return;
        }
        
        const leftFacilityTile = leftYearData.facilityTiles.get(facilityCode);
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

    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
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

    const startYear = dateRange.start.year;
    const endYear = dateRange.end.year;
    
    // Calculate dimensions
    const leftStartDay = getDayIndex(dateRange.start);
    const leftEndDay = startYear === endYear 
      ? getDayIndex(dateRange.end) 
      : (leftTile ? leftTile.getDaysCount() - 1 : getDayIndex(new CalendarDate(startYear, 12, 31)));
    const leftWidth = leftEndDay - leftStartDay + 1;
    
    const rightWidth = startYear !== endYear ? getDayIndex(dateRange.end) + 1 : 0;
    
    // Check if we need shimmer animation
    const needsShimmer = leftTileState === 'pendingData' || (startYear !== endYear && rightTileState === 'pendingData');
    
    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      let currentX = 0;
      
      // Draw left tile
      if (leftTileState === 'hasData' && leftTile) {
        const sourceCanvas = leftTile.getCanvas();
        ctx.drawImage(
          sourceCanvas,
          leftStartDay, 0, leftWidth, sourceCanvas.height,
          currentX, 0, leftWidth, sourceCanvas.height
        );
      } else if (leftTileState === 'error') {
        drawErrorState(ctx, currentX, leftWidth, canvas.height);
      }
      
      currentX += leftWidth;
      
      // Draw right tile if we're spanning two years
      if (startYear !== endYear) {
        if (rightTileState === 'hasData' && rightTile) {
          const sourceCanvas = rightTile.getCanvas();
          ctx.drawImage(
            sourceCanvas,
            0, 0, rightWidth, sourceCanvas.height,
            currentX, 0, rightWidth, sourceCanvas.height
          );
        } else if (rightTileState === 'error') {
          drawErrorState(ctx, currentX, rightWidth, canvas.height);
        }
      }
      
      // Draw shimmer overlay if needed
      if (needsShimmer) {
        // Calculate shimmer region
        let shimmerX = 0;
        let shimmerWidth = 0;
        
        if (leftTileState === 'pendingData' && (!startYear || startYear === endYear || rightTileState !== 'pendingData')) {
          // Only left is pending
          shimmerX = 0;
          shimmerWidth = leftWidth;
        } else if (startYear !== endYear && rightTileState === 'pendingData' && leftTileState !== 'pendingData') {
          // Only right is pending
          shimmerX = leftWidth;
          shimmerWidth = rightWidth;
        } else if (leftTileState === 'pendingData' && rightTileState === 'pendingData') {
          // Both are pending - single shimmer across both
          shimmerX = 0;
          shimmerWidth = leftWidth + rightWidth;
        }
        
        if (shimmerWidth > 0) {
          // Update shimmer offset
          const now = performance.now();
          const delta = now - lastAnimationTimeRef.current;
          lastAnimationTimeRef.current = now;
          shimmerOffsetRef.current = (shimmerOffsetRef.current + delta * 0.2) % (shimmerWidth * 2);
          
          // Fill base color
          ctx.fillStyle = '#eeeeee';
          ctx.fillRect(shimmerX, 0, shimmerWidth, canvas.height);
          
          // Draw shimmer effect
          const gradientWidth = shimmerWidth * 0.4;
          const gradientX = shimmerX + shimmerOffsetRef.current - gradientWidth;
          
          const gradient = ctx.createLinearGradient(gradientX, 0, gradientX + gradientWidth, 0);
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
          gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          ctx.save();
          ctx.fillStyle = gradient;
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillRect(shimmerX, 0, shimmerWidth, canvas.height);
          ctx.restore();
          
          // Continue animation
          animationFrameRef.current = requestAnimationFrame(render);
        }
      }
    };
    
    render();
    perfMonitor.end(perfName);
    
    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
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