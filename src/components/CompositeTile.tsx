'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { CalendarDate } from '@internationalized/date';
import { FacilityYearTile } from '@/client/facility-year-tile';
import { getDayIndex, isLeapYear } from '@/shared/date-utils';
import { yearDataVendor } from '@/client/year-data-vendor';
import { perfMonitor } from '@/shared/performance-monitor';
import { useTouchAsHover } from '@/hooks/useTouchAsHover';

interface CompositeTileProps {
  endDate: CalendarDate;
  facilityCode: string;
  facilityName: string;
  regionCode: string;
  animatedDateRange?: { start: CalendarDate; end: CalendarDate };
  minCanvasHeight?: number;
}

type TileState = 'hasData' | 'pendingData' | 'error' | 'idle';

// Helper function to get days in a year
function getDaysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

const CompositeTileComponent = ({ 
  endDate, 
  facilityCode,
  facilityName,
  regionCode: _regionCode,
  animatedDateRange,
  minCanvasHeight = 20
}: CompositeTileProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Store both tiles in a single state to ensure atomic updates
  const [tiles, setTiles] = useState<{
    left: FacilityYearTile | null;
    right: FacilityYearTile | null;
    leftState: TileState;
    rightState: TileState;
  }>({
    left: null,
    right: null,
    leftState: 'idle',
    rightState: 'idle'
  });
  const lastKnownHeightRef = useRef<number>(12); // Default height
  const animationFrameRef = useRef<number | null>(null);
  const shimmerOffsetRef = useRef<number>(0);
  const lastAnimationTimeRef = useRef<number>(performance.now());
  
  // Drag state (using state for isDragging to trigger re-renders for cursor)
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    startX: number;
    startEndDate: CalendarDate | null;
  }>({
    startX: 0,
    startEndDate: null
  });
  
  // Simple global mouse position tracking (using ref to avoid re-renders)
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  
  // Use provided animated date range, or calculate from endDate
  const dateRange = useMemo(() => {
    return animatedDateRange || {
      start: endDate.subtract({ days: 364 }), // 364 days before end = 365 days total (inclusive)
      end: endDate
    };
  }, [animatedDateRange, endDate]);
  
  // Calculate which tiles we need synchronously
  const startYear = dateRange.start.year;
  const endYear = dateRange.end.year;
  
  // Determine what tiles we need based on current date range
  const neededTiles = {
    leftYear: startYear,
    rightYear: startYear !== endYear ? endYear : null
  };
  
  // Get tiles from cache synchronously
  const getTilesForDateRange = () => {
    const newTiles = { ...tiles };
    let needsUpdate = false;
    
    // Check left tile
    if (!tiles.left || tiles.left.getYear() !== neededTiles.leftYear) {
      try {
        const cachedLeftYear = yearDataVendor.getYearSync(neededTiles.leftYear);
        if (cachedLeftYear) {
          // If year is cached, tile MUST exist - use non-null assertion
          const cachedLeftTile = cachedLeftYear.facilityTiles.get(facilityCode)!;
          newTiles.left = cachedLeftTile;
          newTiles.leftState = 'hasData';
          needsUpdate = true;
        } else {
          // Year not in cache yet
          newTiles.left = null;
          newTiles.leftState = 'pendingData';
          needsUpdate = true;
        }
      } catch {
        // Year is out of bounds - no data available
        newTiles.left = null;
        newTiles.leftState = 'error';
        needsUpdate = true;
      }
    }
    
    // Check right tile
    if (neededTiles.rightYear) {
      if (!tiles.right || tiles.right.getYear() !== neededTiles.rightYear) {
        try {
          const cachedRightYear = yearDataVendor.getYearSync(neededTiles.rightYear);
          if (cachedRightYear) {
            // If year is cached, tile MUST exist - use non-null assertion
            const cachedRightTile = cachedRightYear.facilityTiles.get(facilityCode)!;
            newTiles.right = cachedRightTile;
            newTiles.rightState = 'hasData';
            needsUpdate = true;
          } else {
            // Year not in cache yet
            newTiles.right = null;
            newTiles.rightState = 'pendingData';
            needsUpdate = true;
          }
        } catch {
          // Year is out of bounds - no data available
          newTiles.right = null;
          newTiles.rightState = 'error';
          needsUpdate = true;
        }
      } else if (tiles.right && tiles.rightState !== 'hasData') {
        // We already have the correct right tile but state is wrong
        newTiles.rightState = 'hasData';
        needsUpdate = true;
      }
    } else {
      // Single year - no right tile needed
      if (tiles.rightState !== 'idle') {
        newTiles.rightState = 'idle';
        needsUpdate = true;
      }
    }
    
    return { newTiles, needsUpdate };
  };
  
  // Update tiles if needed
  const { newTiles, needsUpdate } = getTilesForDateRange();
  if (needsUpdate && JSON.stringify(newTiles) !== JSON.stringify(tiles)) {
    setTiles(newTiles);
  }

  const drawErrorState = (ctx: CanvasRenderingContext2D, left: number, width: number, height: number) => {
    ctx.fillStyle = '#ff0000';
    for (let i = 0; i < width; i += 4) {
      ctx.fillRect(left + i, 0, 2, height);
    }
  };

  // Helper to convert client coordinates to canvas coordinates
  const clientToCanvasCoordinates = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { canvasX: 0, canvasY: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // Since CSS is stretching the canvas, convert screen coordinates back to canvas coordinates
    const canvasX = (x / rect.width) * canvas.width;
    const canvasY = (y / rect.height) * canvas.height;
    
    return { canvasX, canvasY };
  }, []);
  
  const updateTooltip = useCallback((x: number, y: number) => {
    
    const startYear = dateRange.start.year;
    const endYear = dateRange.end.year;
    
    // Calculate left tile dimensions
    const leftStartDay = getDayIndex(dateRange.start);
    const leftEndDay = startYear === endYear 
      ? getDayIndex(dateRange.end) 
      : getDaysInYear(startYear) - 1; // 0-based index for last day of year
    const leftWidth = leftEndDay - leftStartDay + 1;
    
    // Calculate total width of the composite tile
    const totalWidth = startYear === endYear ? leftWidth : leftWidth + getDayIndex(dateRange.end) + 1;
    
    // Clamp x coordinate to valid range
    const clampedX = Math.max(0, Math.min(x, totalWidth - 1));
    
    let tooltipData = null;
    
    if (clampedX < leftWidth) {
      // Mouse is in left tile
      if (tiles.left) {
        const tileX = clampedX + leftStartDay;
        tooltipData = tiles.left.getTooltipData(tileX, y);
      }
    } else if (startYear !== endYear) {
      // Mouse is in right tile
      if (tiles.right) {
        const tileX = clampedX - leftWidth;
        tooltipData = tiles.right.getTooltipData(tileX, y);
      }
    }
    
    if (tooltipData) {
      // Format unit name - for WA units, show only the part after underscore
      let unitName = tooltipData.unitName;
      if (tooltipData.network && tooltipData.network.toUpperCase() === 'WEM' && unitName && unitName.includes('_')) {
        unitName = unitName.split('_').pop() || unitName;
        // Update the label to use formatted unit name
        tooltipData.label = `${facilityName} ${unitName}`;
      }
      
      // Broadcast the tooltip data via custom event
      const event = new CustomEvent('tooltip-data-hover', { 
        detail: tooltipData
      });
      window.dispatchEvent(event);
    }
  }, [dateRange, tiles, facilityName]);

  // Handle async loading of tiles that aren't in cache
  useEffect(() => {
    const startYear = dateRange.start.year;
    const endYear = dateRange.end.year;
    
    // Track current request years to ignore stale responses
    let currentStartYear = startYear;
    let currentEndYear = endYear;
    
    // Check if we need to load any data asynchronously
    const needsAsyncLeftLoad = tiles.leftState === 'pendingData' && startYear === neededTiles.leftYear;
    const needsAsyncRightLoad = tiles.rightState === 'pendingData' && neededTiles.rightYear && endYear === neededTiles.rightYear;
    
    // Load left tile only if not found in cache
    if (needsAsyncLeftLoad) {
      try {
        yearDataVendor.requestYear(startYear)
          .then(leftYearData => {
          // Ignore if we've moved to a different year
          if (currentStartYear !== startYear) {
            return;
          }
          
          const leftFacilityTile = leftYearData.facilityTiles.get(facilityCode);
          if (leftFacilityTile) {
            setTiles(prev => ({
              ...prev,
              left: leftFacilityTile,
              leftState: 'hasData'
            }));
          } else {
            setTiles(prev => ({ ...prev, leftState: 'error' }));
          }
        })
        .catch(error => {
          // Ignore if we've moved to a different year
          if (currentStartYear !== startYear) {
            return;
          }
          
          console.error(`Failed to load year ${startYear}:`, error);
          setTiles(prev => ({ ...prev, leftState: 'error' }));
        });
      } catch (error) {
        // Handle synchronous validation errors
        console.error(`Invalid year ${startYear}:`, error);
        setTiles(prev => ({ ...prev, leftState: 'error' }));
      }
    }

    // Load right tile only if not found in cache and we're spanning two years
    if (needsAsyncRightLoad) {
      try {
        yearDataVendor.requestYear(endYear)
          .then(rightYearData => {
          // Ignore if we've moved to different years
          if (currentStartYear !== startYear || currentEndYear !== endYear) {
            return;
          }
          
          const rightFacilityTile = rightYearData.facilityTiles.get(facilityCode);
          if (rightFacilityTile) {
            setTiles(prev => ({
              ...prev,
              right: rightFacilityTile,
              rightState: 'hasData'
            }));
            if (!tiles.left) {
            }
          } else {
            setTiles(prev => ({ ...prev, rightState: 'error' }));
          }
        })
        .catch(error => {
          // Ignore if we've moved to different years
          if (currentStartYear !== startYear || currentEndYear !== endYear) {
            return;
          }
          
          console.error(`Failed to load year ${endYear}:`, error);
          setTiles(prev => ({ ...prev, rightState: 'error' }));
        });
      } catch (error) {
        // Handle synchronous validation errors
        console.error(`Invalid year ${endYear}:`, error);
        setTiles(prev => ({ ...prev, rightState: 'error' }));
      }
    }
    
    // Cleanup function to mark requests as stale
    return () => {
      currentStartYear = -1;
      currentEndYear = -1;
    };
    // Only reload tiles when pending states change
  }, [facilityCode, dateRange.start.year, dateRange.end.year, tiles.leftState, tiles.rightState, tiles.left, neededTiles.leftYear, neededTiles.rightYear]);

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

    // Disable image smoothing for crisp pixel rendering
    ctx.imageSmoothingEnabled = false;
    // @ts-ignore - vendor prefixes for older browsers
    ctx.mozImageSmoothingEnabled = false;
    // @ts-ignore - vendor prefixes for older browsers
    ctx.webkitImageSmoothingEnabled = false;
    // @ts-ignore - vendor prefixes for older browsers
    ctx.msImageSmoothingEnabled = false;
    
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Get the actual width from the parent container
    // const containerElement = canvas.parentElement;
    
    // Set height from available tiles or use last known height
    let canvasHeight = lastKnownHeightRef.current;
    if (tiles.left) {
      canvasHeight = tiles.left.getCanvas().height;
      lastKnownHeightRef.current = canvasHeight; // Update last known height
    } else if (tiles.right) {
      canvasHeight = tiles.right.getCanvas().height;
      lastKnownHeightRef.current = canvasHeight; // Update last known height
    }
    
    // Apply minimum height if specified
    const displayHeight = Math.max(canvasHeight, minCanvasHeight);
    
    // Set canvas size - keep internal resolution at 365 pixels wide
    // and let CSS stretch it
    canvas.width = 365;
    canvas.height = canvasHeight;
    canvas.style.width = '100%';
    canvas.style.height = `${displayHeight}px`;

    // Use date range
    const startYear = dateRange.start.year;
    const endYear = dateRange.end.year;
    
    // Update tooltip if mouse is hovering during date range changes
    if (mousePosRef.current && canvasRef.current) {
      const elementAtMouse = document.elementFromPoint(mousePosRef.current.x, mousePosRef.current.y);
      if (elementAtMouse === canvasRef.current) {
        const { canvasX, canvasY } = clientToCanvasCoordinates(mousePosRef.current.x, mousePosRef.current.y);
        updateTooltip(canvasX, canvasY);
      }
    }
    
    
    // Calculate dimensions (in source pixels - always 365 total)
    const leftStartDay = getDayIndex(dateRange.start);
    const leftEndDay = startYear === endYear 
      ? getDayIndex(dateRange.end) 
      : getDaysInYear(startYear) - 1; // 0-based index for last day of year
    const leftWidth = leftEndDay - leftStartDay + 1;
    
    const rightWidth = startYear !== endYear ? getDayIndex(dateRange.end) + 1 : 0;
    
    // Ensure total width is exactly 365 days
    const totalDays = leftWidth + rightWidth;
    if (totalDays !== 365) {
      console.warn(`[${facilityCode}] Width mismatch! leftWidth: ${leftWidth}, rightWidth: ${rightWidth}, total: ${totalDays}, dateRange: ${dateRange.start} to ${dateRange.end}`);
    }
    
    
    // Check if we need shimmer animation
    const needsShimmer = tiles.leftState === 'pendingData' || (startYear !== endYear && tiles.rightState === 'pendingData');
    
    const render = () => {

      // draw left tile
      if (tiles.leftState === 'hasData' && tiles.left) {
        const sourceCanvas = tiles.left.getCanvas();
        ctx.drawImage(
          sourceCanvas,
          leftStartDay, 0, leftWidth, sourceCanvas.height,
          0, 0, leftWidth, sourceCanvas.height
        );
      } else if (tiles.leftState === 'error') {
        drawErrorState(ctx, 0, leftWidth, canvas.height);
      }
            
      // draw right tile if we're spanning two years
      if (startYear !== endYear) {
        if (tiles.rightState === 'hasData' && tiles.right) {
          const sourceCanvas = tiles.right.getCanvas();
          ctx.drawImage(
            sourceCanvas,
            0, 0, rightWidth, sourceCanvas.height,
            leftWidth, 0, rightWidth, sourceCanvas.height
          );
        } else if (tiles.rightState === 'error') {
          drawErrorState(ctx, leftWidth, rightWidth, canvas.height);
        }
      }
      
      
      // Draw shimmer overlay if needed
      if (needsShimmer) {
        // Calculate shimmer region
        let shimmerX = 0;
        let shimmerWidth = 0;
        
        if (tiles.leftState === 'pendingData' && (!startYear || startYear === endYear || tiles.rightState !== 'pendingData')) {
          // Only left is pending
          shimmerX = 0;
          shimmerWidth = leftWidth;
        } else if (startYear !== endYear && tiles.rightState === 'pendingData' && tiles.leftState !== 'pendingData') {
          // Only right is pending
          shimmerX = leftWidth;
          shimmerWidth = rightWidth;
        } else if (tiles.leftState === 'pendingData' && tiles.rightState === 'pendingData') {
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
          
        }
      }
      
      // Continue shimmer animation if needed
      if (needsShimmer) {
        animationFrameRef.current = requestAnimationFrame(render);
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
  }, [dateRange, tiles, facilityCode, updateTooltip, minCanvasHeight, clientToCanvasCoordinates]);
  
  // Define handleMouseUp before the useEffect that uses it
  const handleMouseUp = useCallback(() => {
    // If we were dragging, emit a final event with isDragging: false
    // This allows the animation to smooth out to the final position
    if (isDragging && endDate) {
      const event = new CustomEvent('date-navigate', { 
        detail: { newEndDate: endDate, isDragging: false } 
      });
      window.dispatchEvent(event);
    }
    
    setIsDragging(false);
    dragStateRef.current.startX = 0;
    dragStateRef.current.startEndDate = null;
    document.body.style.cursor = '';
  }, [isDragging, endDate]);
  
  // Mouse position tracking effect and global mouse handlers for drag
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      
      // Update hover indicator if mouse is over any canvas (even during drag)
      const elementAtMouse = document.elementFromPoint(e.clientX, e.clientY);
      if (elementAtMouse && elementAtMouse.classList.contains('opennem-facility-canvas')) {
        const rect = elementAtMouse.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const canvasX = (x / rect.width) * 365; // Assuming all canvases are 365px wide internally
        const dayColumn = Math.floor(canvasX);
        if (dayColumn >= 0 && dayColumn < 365) {
          const percentage = (dayColumn / 365) * 100;
          document.documentElement.style.setProperty('--hover-x', `${percentage}%`);
        }
      }
      
      // Handle dragging globally (not just on canvas)
      if (isDragging && dragStateRef.current.startEndDate && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const deltaX = e.clientX - dragStateRef.current.startX;
        // Convert screen pixels to days (negative because dragging right should move back in time)
        const daysDelta = -Math.round((deltaX / rect.width) * 365);
        
        if (daysDelta !== 0) {
          const newEndDate = dragStateRef.current.startEndDate.add({ days: daysDelta });
          
          // Emit custom event with new date and dragging flag
          // Boundary checking is now handled centrally in page.tsx
          const event = new CustomEvent('date-navigate', { 
            detail: { newEndDate, isDragging: true } 
          });
          window.dispatchEvent(event);
        }
      }
    };
    
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };
    
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [endDate, isDragging, handleMouseUp]);
  
  // Handle window scroll to update tooltip
  useEffect(() => {
    const handleScroll = () => {
      if (!canvasRef.current || !mousePosRef.current) return;
      
      // Get element at current mouse position
      const elementAtMouse = document.elementFromPoint(mousePosRef.current.x, mousePosRef.current.y);
      
      // Check if it's our canvas
      if (elementAtMouse === canvasRef.current) {
        const { canvasX, canvasY } = clientToCanvasCoordinates(mousePosRef.current.x, mousePosRef.current.y);
        updateTooltip(canvasX, canvasY);
      } else {
        // Mouse not over our canvas - check if we need to call onHoverEnd
        // We can check if the tooltip is currently showing for this tile
        // Note: We don't have a way to know if tooltip was showing for this specific tile
        // The parent component manages tooltip state across all tiles
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [updateTooltip, facilityCode, clientToCanvasCoordinates]);
  
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only handle left click
    
    e.preventDefault();
    setIsDragging(true);
    dragStateRef.current = {
      startX: e.clientX,
      startEndDate: endDate
    };
    
    // Update cursor
    document.body.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Skip if dragging (tooltip is handled in global mouse move)
    if (isDragging) {
      return;
    }
    
    const { canvasX, canvasY } = clientToCanvasCoordinates(e.clientX, e.clientY);
    
    // Normal hover behavior - tooltip
    updateTooltip(canvasX, canvasY);
  };

  // Touch handlers for hover functionality
  const touchHandlers = useTouchAsHover({
    onHoverStart: (clientX, clientY) => {
      const { canvasX, canvasY } = clientToCanvasCoordinates(clientX, clientY);
      updateTooltip(canvasX, canvasY);
    },
    onHoverMove: (clientX, clientY) => {
      if (isDragging) return;
      
      const { canvasX, canvasY } = clientToCanvasCoordinates(clientX, clientY);
      updateTooltip(canvasX, canvasY);
    },
    onHoverEnd: () => {
      if (!isDragging) {
        document.documentElement.style.removeProperty('--hover-x');
        const event = new CustomEvent('tooltip-data-hover-end');
        window.dispatchEvent(event);
      }
    }
  });

  return (
    <div 
      className="opennem-stripe-data"
      style={{ cursor: isDragging ? 'grabbing' : undefined }}
    >
      <canvas
        ref={canvasRef}
        className={`opennem-facility-canvas ${isDragging ? 'is-dragging' : ''}`}
        style={{ 
          width: '100%',
          imageRendering: 'pixelated'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          // Only handle hover cleanup when not dragging
          if (!isDragging) {
            // Clear hover position on document root
            document.documentElement.style.removeProperty('--hover-x');
            
            // Broadcast hover end event
            const event = new CustomEvent('tooltip-data-hover-end');
            window.dispatchEvent(event);
          }
        }}
        {...touchHandlers}
      />
    </div>
  );
};

CompositeTileComponent.displayName = 'CompositeTile';

export const CompositeTile = React.memo(CompositeTileComponent);