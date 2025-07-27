'use client';

import { useState, useEffect, useRef } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getTodayAEST, getDayIndex, getDaysBetween } from '@/shared/date-utils';
import { PerformanceDisplay } from '../components/PerformanceDisplay';
import { OpenElectricityHeader } from '../components/OpenElectricityHeader';
import { yearDataVendor } from '@/client/year-data-vendor';
import { FacilityYearTile } from '@/client/facility-year-tile';
import './opennem.css';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tiles, setTiles] = useState<Map<string, FacilityYearTile>>(new Map());
  const [dateRange, setDateRange] = useState<{ start: CalendarDate; end: CalendarDate } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stripeDataRef = useRef<HTMLDivElement>(null);

  // Function to load tiles for a given date range
  const loadTilesForDateRange = async (start: CalendarDate, end: CalendarDate) => {
    try {
      setIsNavigating(true);
      
      // Determine which years we need
      const startYear = start.year;
      const endYear = end.year;
      const years = startYear === endYear ? [startYear] : [startYear, endYear];
      
      // Fetch year data
      const yearDataPromises = years.map(year => yearDataVendor.requestYear(year));
      const yearDataResults = await Promise.all(yearDataPromises);
      
      // Create tiles for display
      const newTiles = new Map<string, FacilityYearTile>();
      
      // For now, just get the first facility from NSW
      for (const yearData of yearDataResults) {
        // Get all facility tiles
        const facilities = Array.from(yearData.facilityTiles.entries());
        
        if (facilities.length > 0) {
          // Get the first facility tile for testing
          const [facilityCode, tile] = facilities[0];
          
          console.log(`Loaded tile for ${facilityCode} year ${yearData.year}`);
          
          newTiles.set(`${facilityCode}-${yearData.year}`, tile);
        }
      }
      
      setTiles(newTiles);
      setDateRange({ start, end });
      setIsNavigating(false);
    } catch (err) {
      console.error('Error loading tiles:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setIsNavigating(false);
    }
  };

  // Initial load
  useEffect(() => {
    async function initialLoad() {
      setLoading(true);
      
      // Calculate date range for last 12 months
      const today = getTodayAEST();
      const endDate = today.subtract({ days: 1 }); // Yesterday
      const startDate = endDate.subtract({ months: 12 }).add({ days: 1 }); // 12 months ago
      
      await loadTilesForDateRange(startDate, endDate);
      setLoading(false);
    }
    
    initialLoad();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Only handle arrow keys if stripe data is focused
      if (!isFocused || !dateRange) return;

      const isShift = e.shiftKey;
      const monthsToMove = isShift ? 6 : 1;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        // Left arrow - pan backward in time (older)
        const newStart = dateRange.start.subtract({ months: monthsToMove });
        const newEnd = dateRange.end.subtract({ months: monthsToMove });
        
        loadTilesForDateRange(newStart, newEnd);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        // Right arrow - pan forward in time (more recent)
        const newStart = dateRange.start.add({ months: monthsToMove });
        const newEnd = dateRange.end.add({ months: monthsToMove });
        
        // Get yesterday as the latest possible date
        const yesterday = getTodayAEST().subtract({ days: 1 });
        
        // Check boundaries - don't go past yesterday
        if (newEnd.compare(yesterday) > 0) {
          // Adjust to end at yesterday
          const daysOver = getDaysBetween(yesterday, newEnd);
          const constrainedEnd = yesterday;
          const constrainedStart = newStart.subtract({ days: Math.abs(daysOver) });
          
          loadTilesForDateRange(constrainedStart, constrainedEnd);
        } else {
          loadTilesForDateRange(newStart, newEnd);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dateRange, isFocused]);

  // Format date range for display
  const formatDateRange = () => {
    if (!dateRange) return 'Loading...';
    
    const format = (date: CalendarDate) => 
      date.toDate('Australia/Brisbane').toLocaleDateString('en-AU', { 
        day: 'numeric',
        month: 'long', 
        year: 'numeric',
        timeZone: 'Australia/Brisbane'
      });
    
    return `${format(dateRange.start)} – ${format(dateRange.end)}`;
  };

  // Tooltip functions
  const updateTooltip = (tooltipData: any) => {
    let tooltip = document.getElementById('unified-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'unified-tooltip';
      tooltip.className = 'opennem-tooltip';
      document.body.appendChild(tooltip);
    }

    const date = tooltipData.date;
    const formattedDate = date.toDate('Australia/Brisbane').toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Australia/Brisbane'
    });

    const getCapacityText = (capacityFactor: number | null) => {
      if (capacityFactor === null) return 'No data';
      if (capacityFactor < 1) return 'Offline';
      if (capacityFactor < 25) return `${capacityFactor.toFixed(1)}% (Low)`;
      return `${capacityFactor.toFixed(1)}%`;
    };

    tooltip.innerHTML = `
      <div class="opennem-tooltip-date">${formattedDate}</div>
      <div class="opennem-tooltip-facility">${tooltipData.facilityName}: ${tooltipData.unitName}</div>
      <div class="opennem-tooltip-value">
        ${getCapacityText(tooltipData.capacityFactor)}
      </div>
    `;

    const viewportWidth = window.innerWidth;
    const margin = 5;
    const tooltipWidth = 150;

    let left = tooltipData.x;
    let transform = 'translate(-50%, -100%)';

    if (tooltipData.x + (tooltipWidth / 2) > viewportWidth - margin) {
      left = viewportWidth - tooltipWidth - margin;
      transform = 'translateY(-100%)';
    }

    if (tooltipData.x - (tooltipWidth / 2) < margin) {
      left = margin;
      transform = 'translateY(-100%)';
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = (tooltipData.y - 10) + 'px';
    tooltip.style.transform = transform;
    tooltip.style.display = 'block';
    tooltip.style.opacity = '1';
  };

  const hideTooltip = () => {
    const tooltip = document.getElementById('unified-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  };

  if (loading) {
    return (
      <div className="opennem-loading">
        <div className="opennem-loading-spinner"></div>
        Loading stripes data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="opennem-error">
        <div>
          <h2>Unable to load data</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Performance Monitor */}
      <PerformanceDisplay />
      
      {/* Header */}
      <OpenElectricityHeader />

      {/* Date Range Header */}
      <div className="opennem-stripes-container">
        <div className="opennem-stripes-header">
          <div className="opennem-date-range">
            {formatDateRange()}
          </div>
        </div>

        {/* Main Stripes Visualization */}
        <div 
          ref={containerRef} 
          className="opennem-stripes-viz"
          style={{ 
            opacity: isNavigating ? 0.6 : 1,
            transition: 'opacity 100ms ease-out'
          }}
        >
          <div className="opennem-region">
            <div className="opennem-region-header">
              New South Wales
            </div>
            <div className="opennem-region-content">
              {/* Display tiles */}
              {tiles.size > 0 && (
                <div className="opennem-facility-group">
                  <div className="opennem-stripe-row" style={{ display: 'flex' }}>
                    <div className="opennem-facility-label">
                      {/* Get facility name from first tile */}
                      {Array.from(tiles.values())[0].getFacilityName()}
                    </div>
                    <div 
                      ref={stripeDataRef}
                      className="opennem-stripe-data"
                      tabIndex={0}
                      style={{ cursor: 'grab' }}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                    >
                      <div className="opennem-stripe-data-inner" style={{ display: 'flex', height: '100%' }}>
                        {Array.from(tiles.entries()).map(([key, tile]) => {
                          const year = tile.getYear();
                          const canvas = tile.getCanvas();
                          
                          // Calculate day range for this year
                          let startDay = 0;
                          let endDay = tile.getDaysCount() - 1; // 0-indexed
                          
                          if (dateRange) {
                            if (year === dateRange.start.year) {
                              startDay = getDayIndex(dateRange.start);
                            }
                            if (year === dateRange.end.year) {
                              endDay = getDayIndex(dateRange.end);
                            }
                          }
                          
                          const width = endDay - startDay + 1;
                          console.log(`Rendering tile ${key}: canvas dimensions ${canvas.width}x${canvas.height}, showing days ${startDay}-${endDay}`);
                          
                          // For display, we need to convert the canvas to an img element
                          return (
                            <div key={key} style={{ height: '100%', display: 'flex' }}>
                              <canvas
                                ref={(el) => {
                                  if (el) {
                                    const ctx = el.getContext('2d');
                                    if (ctx) {
                                      el.width = width;
                                      el.height = canvas.height;
                                      
                                      // Handle both HTMLCanvasElement and OffscreenCanvas
                                      if (canvas instanceof HTMLCanvasElement || canvas instanceof OffscreenCanvas) {
                                        ctx.drawImage(
                                          canvas,
                                          startDay, 0, width, canvas.height,
                                          0, 0, width, canvas.height
                                        );
                                        console.log(`Drew ${width} days from canvas to display`);
                                      }
                                    }
                                  }
                                }}
                                style={{ height: '100%', imageRendering: 'pixelated' }}
                                onMouseMove={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const x = e.clientX - rect.left;
                                  const y = e.clientY - rect.top;
                                  
                                  // Adjust x coordinate based on the start day
                                  const tileX = x + startDay;
                                  
                                  const tooltipData = tile.getTooltipData(tileX, y);
                                  if (tooltipData) {
                                    updateTooltip({
                                      ...tooltipData,
                                      x: e.clientX,
                                      y: e.clientY
                                    });
                                  }
                                }}
                                onMouseLeave={() => {
                                  hideTooltip();
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}