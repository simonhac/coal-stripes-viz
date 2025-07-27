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
import './opennem.css';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: CalendarDate; end: CalendarDate } | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    async function initialLoad() {
      try {
        // Calculate date range for last 12 months
        const today = getTodayAEST();
        const endDate = today.subtract({ days: 1 }); // Yesterday
        const startDate = endDate.subtract({ months: 12 }).add({ days: 1 }); // 12 months ago
        
        // Determine which years we need
        const startYear = startDate.year;
        const endYear = endDate.year;
        const years = startYear === endYear ? [startYear] : [startYear, endYear];
        
        // Load all required years
        const yearPromises = years.map(year => yearDataVendor.requestYear(year));
        await Promise.all(yearPromises);
        
        // Only set date range after data is loaded
        setDateRange({ start: startDate, end: endDate });
        setLoading(false);
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load initial data');
        setLoading(false);
      }
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
        
        setDateRange({ start: newStart, end: newEnd });
        
        // Preload the new year if needed
        const years = new Set([newStart.year, newEnd.year]);
        years.forEach(year => {
          yearDataVendor.requestYear(year).catch(err => {
            console.error(`Failed to preload year ${year}:`, err);
          });
        });
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
          
          setDateRange({ start: constrainedStart, end: constrainedEnd });
        } else {
          setDateRange({ start: newStart, end: newEnd });
          
          // Preload the new year if needed
          const years = new Set([newStart.year, newEnd.year]);
          years.forEach(year => {
            yearDataVendor.requestYear(year).catch(err => {
              console.error(`Failed to preload year ${year}:`, err);
            });
          });
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
        >
          <div className="opennem-region">
            <div className="opennem-region-header">
              New South Wales
            </div>
            <div className="opennem-region-content">
              {/* Display tiles */}
              {(() => {
                if (!dateRange) return null;
                
                // For now, hardcode the first facility code
                // In a real app, this would come from a facility selector
                const firstFacilityCode = 'ERARING';
                
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