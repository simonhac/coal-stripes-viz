'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CalendarDate } from '@internationalized/date';
import { FacilityYearTile } from '@/client/facility-year-tile';
import { CapFacYear } from '@/client/cap-fac-year';
import { getDayIndex, getDaysBetween } from '@/shared/date-utils';
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
  
  // Simple global mouse position tracking (moved to top)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  
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
  }, [dateRange, facilityCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Use current position for loading tiles
    const startYear = currentPosition.start.year;
    const endYear = currentPosition.end.year;
    
    // Track current request years to ignore stale responses
    let currentStartYear = startYear;
    let currentEndYear = endYear;
    
    // Only reset tiles if we're loading a different year
    const needsNewLeftTile = !leftTile || leftTile.getYear() !== startYear;
    const needsNewRightTile = startYear !== endYear && (!rightTile || rightTile.getYear() !== endYear);
    
    if (needsNewLeftTile) {
      setLeftTile(null);
      setLeftTileState('pendingData');
    }
    
    if (needsNewRightTile) {
      setRightTile(null);
      setRightTileState('pendingData');
    } else if (startYear === endYear) {
      setRightTileState('idle');
    }
    
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
    if (leftTile) {
      canvasHeight = leftTile.getCanvas().height;
      lastKnownHeightRef.current = canvasHeight; // Update last known height
    } else if (rightTile) {
      canvasHeight = rightTile.getCanvas().height;
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
      : (leftTile ? leftTile.getDaysCount() - 1 : getDayIndex(new CalendarDate(startYear, 12, 31)));
    const leftWidth = leftEndDay - leftStartDay + 1;
    
    const rightWidth = startYear !== endYear ? getDayIndex(currentPosition.end) + 1 : 0;
    
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
  }, [dateRange, currentPosition, leftTile, rightTile, leftTileState, rightTileState, facilityCode]);
  
  // Update tooltip based on current mouse position
  const updateTooltip = (x: number, y: number) => {
    if (!onHover) return;
    
    if (facilityCode === 'BAYSW') {
      console.log('[BAYSW updateTooltip] Called with x:', x, 'y:', y);
    }
    
    const startYear = currentPosition.start.year;
    const endYear = currentPosition.end.year;
    
    // Calculate left tile dimensions
    const leftStartDay = getDayIndex(currentPosition.start);
    const leftEndDay = startYear === endYear ? getDayIndex(currentPosition.end) : (leftTile?.getDaysCount() || 365) - 1;
    const leftWidth = leftEndDay - leftStartDay + 1;
    
    if (x < leftWidth) {
      // Mouse is in left tile
      if (leftTile) {
        const tileX = x + leftStartDay;
        const tooltipData = leftTile.getTooltipData(tileX, y);
        if (facilityCode === 'BAYSW') {
          console.log('[BAYSW updateTooltip] Got tooltip data:', tooltipData);
        }
        if (tooltipData) {
          // Convert to new format
          const formattedData: any = {
            date: tooltipData.date,
            label: `${tooltipData.facilityName} ${tooltipData.unitName}`,
            capacityFactor: tooltipData.capacityFactor,
            isRegion: false
          };
          if (facilityCode === 'BAYSW') {
            console.log('[BAYSW updateTooltip] Calling onHover with:', formattedData);
          }
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
        const rangeWidth = getDaysBetween(dateRange.start, dateRange.end);
        const newEnd = newStart.add({ days: rangeWidth });
        
        // Update current position
        setCurrentPosition({ start: newStart, end: newEnd });
        
        // Update tooltip if mouse is over the canvas
        if (mousePos && canvasRef.current) {
          const elementAtMouse = document.elementFromPoint(mousePos.x, mousePos.y);
          if (elementAtMouse === canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            updateTooltip(mousePos.x - rect.left, mousePos.y - rect.top);
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
  }, [animationRef.current.isAnimating, dateRange, facilityCode, updateTooltip, mousePos]);
  
  // Mouse position tracking effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  // Handle window scroll to update tooltip
  useEffect(() => {
    if (!mousePos) return;
    
    const handleScroll = () => {
      if (!canvasRef.current) return;
      
      // Get element at current mouse position
      const elementAtMouse = document.elementFromPoint(mousePos.x, mousePos.y);
      
      if (facilityCode === 'BAYSW') {
        console.log('[BAYSW Scroll] Mouse at:', mousePos, 'Element:', elementAtMouse);
      }
      
      // Check if it's our canvas
      if (elementAtMouse === canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = mousePos.x - rect.left;
        const y = mousePos.y - rect.top;
        
        if (facilityCode === 'BAYSW') {
          console.log('[BAYSW Scroll] Mouse over our canvas at:', { x, y });
        }
        
        updateTooltip(x, y);
      } else {
        // Mouse not over our canvas - check if we need to call onHoverEnd
        // We can check if the tooltip is currently showing for this tile
        if (facilityCode === 'BAYSW') {
          console.log('[BAYSW Scroll] Mouse not over our canvas');
        }
        // Note: We don't have a way to know if tooltip was showing for this specific tile
        // The parent component manages tooltip state across all tiles
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mousePos, updateTooltip, onHoverEnd, facilityCode]);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (facilityCode === 'BAYSW') {
      console.log('[BAYSW Mouse] Move at:', { x, y });
    }
    
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