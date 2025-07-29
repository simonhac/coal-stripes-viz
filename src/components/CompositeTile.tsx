'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CalendarDate } from '@internationalized/date';
import { FacilityYearTile } from '@/client/facility-year-tile';
import { CapFacYear } from '@/client/cap-fac-year';
import { getDayIndex, getDaysBetween, isLeapYear } from '@/shared/date-utils';
import { yearDataVendor } from '@/client/year-data-vendor';
import { perfMonitor } from '@/shared/performance-monitor';

interface CompositeTileProps {
  endDate: CalendarDate;
  facilityCode: string;
  onHover?: (tooltipData: any) => void;
  onHoverEnd?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

type TileState = 'hasData' | 'pendingData' | 'error' | 'idle';

// Helper function to get days in a year
function getDaysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

function CompositeTileComponent({ 
  endDate, 
  facilityCode,
  onHover,
  onHoverEnd,
  onFocus,
  onBlur
}: CompositeTileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facilityName, setFacilityName] = useState(facilityCode);
  
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
  
  // Simple global mouse position tracking (using ref to avoid re-renders)
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  
  // Calculate date range - always exactly 365 days
  const dateRange = {
    start: endDate.subtract({ days: 364 }), // 364 days before end = 365 days total (inclusive)
    end: endDate
  };
  
  // Current animated position (internal state)
  const [currentPosition, setCurrentPosition] = useState<{
    start: CalendarDate;
    end: CalendarDate;
  }>(dateRange);
  
  // Animation state
  const animationRef = useRef<{
    animationDuration: number; // animation duration in ms
    animationStartTime: number; // when animation started
    isAnimating: boolean;
    fromStart: CalendarDate; // where we started animating from
  }>({
    animationDuration: 150, // 200ms
    animationStartTime: 0,
    isAnimating: false,
    fromStart: dateRange.start
  });

  const drawErrorState = (ctx: CanvasRenderingContext2D, x: number, width: number, height: number) => {
    ctx.fillStyle = '#ff0000';
    for (let i = 0; i < width; i += 4) {
      ctx.fillRect(x + i, 0, 2, height);
    }
  };
  
  // Track last processed goal to avoid loops
  const lastGoalRef = useRef(dateRange.start.toString());
  
  // Handle date range changes - set up animation if appropriate
  useEffect(() => {
    const anim = animationRef.current;
    const newGoal = dateRange.start.toString();
    
    // Check if goal has actually changed
    if (lastGoalRef.current === newGoal) {
      return;
    }
    
    lastGoalRef.current = newGoal;
    
    // Check if we should animate
    const daysDiff = getDaysBetween(currentPosition.start, dateRange.start);
    
    // Only animate if change is not "too much"
    if (Math.abs(daysDiff) > 0 && Math.abs(daysDiff) <= 2000) {
      anim.fromStart = currentPosition.start;
      anim.animationStartTime = performance.now();
      anim.isAnimating = true;
    } else if (Math.abs(daysDiff) > 0) {
      // Jump directly for large changes
      setCurrentPosition(dateRange);
      anim.isAnimating = false;
    }
    // Don't depend on currentPosition to avoid loops
  }, [endDate, facilityCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Use current position for loading tiles
    const startYear = currentPosition.start.year;
    const endYear = currentPosition.end.year;
    
    
    // Track current request years to ignore stale responses
    let currentStartYear = startYear;
    let currentEndYear = endYear;
    
    // Only reset tiles if we're loading a different year
    let needsNewLeftTile = !tiles.left || tiles.left.getYear() !== startYear;
    let needsNewRightTile = startYear !== endYear && (!tiles.right || tiles.right.getYear() !== endYear);
    
    // Prepare new tiles state - start with current state
    let newTiles = { ...tiles };
    let updateNeeded = false;
    
    // Try to get tiles synchronously from cache first
    if (needsNewLeftTile) {
      const cachedLeftYear = yearDataVendor.getYearSync(startYear);
      if (cachedLeftYear) {
        const cachedLeftTile = cachedLeftYear.facilityTiles.get(facilityCode);
        if (cachedLeftTile) {
          newTiles.left = cachedLeftTile;
          newTiles.leftState = 'hasData';
          setFacilityName(cachedLeftTile.getFacilityName());
          needsNewLeftTile = false;
          updateNeeded = true;
        }
      }
      
      if (needsNewLeftTile) {
        newTiles.left = null;
        newTiles.leftState = 'pendingData';
        updateNeeded = true;
      }
    }
    
    if (needsNewRightTile) {
      const cachedRightYear = yearDataVendor.getYearSync(endYear);
      if (cachedRightYear) {
        const cachedRightTile = cachedRightYear.facilityTiles.get(facilityCode);
        if (cachedRightTile) {
          newTiles.right = cachedRightTile;
          newTiles.rightState = 'hasData';
          if (!newTiles.left) {
            setFacilityName(cachedRightTile.getFacilityName());
          }
          needsNewRightTile = false;
          updateNeeded = true;
        }
      }
      
      if (needsNewRightTile) {
        newTiles.right = null;
        newTiles.rightState = 'pendingData';
        updateNeeded = true;
      }
    } else if (startYear === endYear) {
      newTiles.rightState = 'idle';
      updateNeeded = true;
    }
    
    // Apply all tile updates atomically
    if (updateNeeded) {
      setTiles(newTiles);
    }
    
    // Load left tile only if not found in cache
    if (needsNewLeftTile) {
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
            setFacilityName(leftFacilityTile.getFacilityName());
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
    }

    // Load right tile only if not found in cache and we're spanning two years
    if (startYear !== endYear && needsNewRightTile) {
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
              setFacilityName(rightFacilityTile.getFacilityName());
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
    }
    
    // Cleanup function to mark requests as stale
    return () => {
      currentStartYear = -1;
      currentEndYear = -1;
    };
    // Only reload tiles when year changes or we don't have the tiles we need
  }, [facilityCode, currentPosition.start.year, currentPosition.end.year]);

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
    if (tiles.left) {
      canvasHeight = tiles.left.getCanvas().height;
      lastKnownHeightRef.current = canvasHeight; // Update last known height
    } else if (tiles.right) {
      canvasHeight = tiles.right.getCanvas().height;
      lastKnownHeightRef.current = canvasHeight; // Update last known height
    }
    canvas.height = canvasHeight;
    canvas.style.height = `${canvasHeight}px`;

    // Use current position
    const startYear = currentPosition.start.year;
    const endYear = currentPosition.end.year;
    
    
    // Calculate dimensions
    const leftStartDay = getDayIndex(currentPosition.start);
    const leftEndDay = startYear === endYear 
      ? getDayIndex(currentPosition.end) 
      : getDaysInYear(startYear) - 1; // 0-based index for last day of year
    const leftWidth = leftEndDay - leftStartDay + 1;
    
    const rightWidth = startYear !== endYear ? getDayIndex(currentPosition.end) + 1 : 0;
    
    // Ensure total width is exactly 365 pixels (canvas width)
    const totalWidth = leftWidth + rightWidth;
    if (totalWidth !== 365) {
      console.warn(`[${facilityCode}] Width mismatch! leftWidth: ${leftWidth}, rightWidth: ${rightWidth}, total: ${totalWidth}, currentPosition: ${currentPosition.start} to ${currentPosition.end}`);
    }
    
    // Check if we need shimmer animation
    const needsShimmer = tiles.leftState === 'pendingData' || (startYear !== endYear && tiles.rightState === 'pendingData');
    
    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      let currentX = 0;
      
      // Draw left tile
      if (tiles.leftState === 'hasData' && tiles.left) {
        const sourceCanvas = tiles.left.getCanvas();
        ctx.drawImage(
          sourceCanvas,
          leftStartDay, 0, leftWidth, sourceCanvas.height,
          currentX, 0, leftWidth, sourceCanvas.height
        );
      } else if (tiles.leftState === 'error') {
        drawErrorState(ctx, currentX, leftWidth, canvas.height);
      }
      
      currentX += leftWidth;
      
      // Draw right tile if we're spanning two years
      if (startYear !== endYear) {
        if (tiles.rightState === 'hasData' && tiles.right) {
          const sourceCanvas = tiles.right.getCanvas();
          ctx.drawImage(
            sourceCanvas,
            0, 0, rightWidth, sourceCanvas.height,
            currentX, 0, rightWidth, sourceCanvas.height
          );
        } else if (tiles.rightState === 'error') {
          drawErrorState(ctx, currentX, rightWidth, canvas.height);
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
  }, [dateRange, currentPosition, tiles, facilityCode]);
  
  // Update tooltip based on current mouse position
  const updateTooltip = (x: number, y: number) => {
    if (!onHover) return;
    
    
    const startYear = currentPosition.start.year;
    const endYear = currentPosition.end.year;
    
    // Calculate left tile dimensions
    const leftStartDay = getDayIndex(currentPosition.start);
    const leftEndDay = startYear === endYear 
      ? getDayIndex(currentPosition.end) 
      : getDaysInYear(startYear) - 1; // 0-based index for last day of year
    const leftWidth = leftEndDay - leftStartDay + 1;
    
    if (x < leftWidth) {
      // Mouse is in left tile
      if (tiles.left) {
        const tileX = x + leftStartDay;
        const tooltipData = tiles.left.getTooltipData(tileX, y);
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
      if (tiles.right) {
        const tileX = x - leftWidth;
        const tooltipData = tiles.right.getTooltipData(tileX, y);
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
  
  // Animation loop effect - runs independently of render
  useEffect(() => {
    if (!animationRef.current.isAnimating) {
      return;
    }
    
    let frameId: number;
    
    const animate = () => {
      const anim = animationRef.current;
      
      if (!anim.isAnimating) {
        return;
      }
      
      // Calculate progress based on elapsed time
      const elapsed = performance.now() - anim.animationStartTime;
      const progress = Math.min(elapsed / anim.animationDuration, 1);
      
      if (progress >= 1) {
        // Animation complete - snap to goal
        setCurrentPosition(dateRange);
        anim.isAnimating = false;
      } else {
        // Calculate interpolated position
        const totalDays = getDaysBetween(anim.fromStart, dateRange.start);
        const daysToMove = Math.round(totalDays * progress);
        const newStart = anim.fromStart.add({ days: daysToMove });
        const newEnd = newStart.add({ days: 364 }); // Always exactly 365 days
        
        // Update current position
        setCurrentPosition({ start: newStart, end: newEnd });
        
        // Update tooltip if mouse is over the canvas
        if (mousePosRef.current && canvasRef.current) {
          const elementAtMouse = document.elementFromPoint(mousePosRef.current.x, mousePosRef.current.y);
          if (elementAtMouse === canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            updateTooltip(mousePosRef.current.x - rect.left, mousePosRef.current.y - rect.top);
          }
        }
        
        // Continue animation
        frameId = requestAnimationFrame(animate);
      }
    };
    
    frameId = requestAnimationFrame(animate);
    
    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [animationRef.current.isAnimating, endDate, facilityCode, updateTooltip]);
  
  // Mouse position tracking effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  // Handle window scroll to update tooltip
  useEffect(() => {
    const handleScroll = () => {
      if (!canvasRef.current || !mousePosRef.current) return;
      
      // Get element at current mouse position
      const elementAtMouse = document.elementFromPoint(mousePosRef.current.x, mousePosRef.current.y);
      
      // Check if it's our canvas
      if (elementAtMouse === canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = mousePosRef.current.x - rect.left;
        const y = mousePosRef.current.y - rect.top;
        
        updateTooltip(x, y);
      } else {
        // Mouse not over our canvas - check if we need to call onHoverEnd
        // We can check if the tooltip is currently showing for this tile
        // Note: We don't have a way to know if tooltip was showing for this specific tile
        // The parent component manages tooltip state across all tiles
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [updateTooltip, onHoverEnd, facilityCode]);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    
    updateTooltip(x, y);
  };

  return (
    <div className="opennem-stripe-row" style={{ display: 'flex' }}>
      <div className="opennem-facility-label">
        {facilityName}
      </div>
      <div 
        className="opennem-stripe-data"
        style={{ cursor: 'grab' }}
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

export const CompositeTile = React.memo(CompositeTileComponent);