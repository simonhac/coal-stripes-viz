'use client';

import { useState, useEffect, useRef } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getTodayAEST, getDaysBetween } from '@/shared/date-utils';
import { PerformanceDisplay } from '../components/PerformanceDisplay';
import { OpenElectricityHeader } from '../components/OpenElectricityHeader';
import { CompositeTile } from '../components/CompositeTile';
import { CapFacTooltip, TooltipData } from '../components/CapFacTooltip';
import { CapFacXAxis } from '../components/CapFacXAxis';
import { DateRange } from '../components/DateRange';
import { yearDataVendor } from '@/client/year-data-vendor';
import { CapFacYear } from '@/client/cap-fac-year';
import './opennem.css';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearDataMap, setYearDataMap] = useState<Map<number, CapFacYear>>(new Map());
  const [dateRange, setDateRange] = useState<{ start: CalendarDate; end: CalendarDate } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      
      // Update year data map
      const newYearDataMap = new Map(yearDataMap);
      for (const yearData of yearDataResults) {
        newYearDataMap.set(yearData.year, yearData);
      }
      
      setYearDataMap(newYearDataMap);
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
          <DateRange dateRange={dateRange} />
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
              {(() => {
                if (!dateRange) return null;
                
                // Get first facility code from any available year data
                let firstFacilityCode: string | null = null;
                for (const [year, yearData] of yearDataMap) {
                  const facilities = Array.from(yearData.facilityTiles.keys());
                  if (facilities.length > 0) {
                    firstFacilityCode = facilities[0];
                    break;
                  }
                }
                
                if (!firstFacilityCode) return null;
                
                return (
                  <div className="opennem-facility-group">
                    <CompositeTile
                      dateRange={dateRange}
                      facilityCode={firstFacilityCode}
                      onHover={setTooltipData}
                      onHoverEnd={() => setTooltipData(null)}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                    />
                    
                    <CapFacXAxis 
                      dateRange={dateRange}
                      yearDataMap={yearDataMap}
                      regionCode="NSW1"
                    />
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
      
      {/* Tooltip */}
      <CapFacTooltip data={tooltipData} />
    </>
  );
}