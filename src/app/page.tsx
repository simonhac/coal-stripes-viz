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
  const [endDate, setEndDate] = useState<CalendarDate | null>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [nswFacilities, setNswFacilities] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    async function initialLoad() {
      try {
        // Calculate end date and determine which years we need
        const today = getTodayAEST();
        const calculatedEndDate = today.subtract({ days: 1 }); // Yesterday
        const startDate = calculatedEndDate.subtract({ days: 364 }); // For determining which years to load
        
        // Determine which years we need
        const startYear = startDate.year;
        const endYear = calculatedEndDate.year;
        const years = startYear === endYear ? [startYear] : [startYear, endYear];
        
        // Load all required years
        const yearPromises = years.map(year => yearDataVendor.requestYear(year));
        const yearResults = await Promise.all(yearPromises);
        
        // Extract NSW facilities from the loaded data
        const nswFacilityCodes = new Set<string>();
        for (const yearData of yearResults) {
          for (const unit of yearData.data.data) {
            if (unit.region === 'NSW1') {
              nswFacilityCodes.add(unit.facility_code);
            }
          }
        }
        
        // Sort facilities alphabetically by code
        const sortedFacilities = Array.from(nswFacilityCodes).sort();
        setNswFacilities(sortedFacilities);
        
        // Only set end date after data is loaded
        setEndDate(calculatedEndDate);
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
    // Ensure the page has focus on mount
    window.focus();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Only handle if we have an end date
      if (!endDate) return;

      const isShift = e.shiftKey;
      const monthsToMove = isShift ? 6 : 1;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        // Left arrow - pan backward in time (older)
        const newEndDate = endDate.subtract({ months: monthsToMove });
        setEndDate(newEndDate);
        
        // Preload the years we'll need
        const startDate = newEndDate.subtract({ days: 364 });
        const years = new Set([startDate.year, newEndDate.year]);
        years.forEach(year => {
          yearDataVendor.requestYear(year).catch(err => {
            console.error(`Failed to preload year ${year}:`, err);
          });
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        // Right arrow - pan forward in time (more recent)
        const newEndDate = endDate.add({ months: monthsToMove });
        
        // Get yesterday as the latest possible date
        const yesterday = getTodayAEST().subtract({ days: 1 });
        
        // Check boundaries - don't go past yesterday
        if (newEndDate.compare(yesterday) > 0) {
          // Don't move if we're already at yesterday
          if (endDate.compare(yesterday) < 0) {
            setEndDate(yesterday);
          }
        } else {
          setEndDate(newEndDate);
          
          // Preload the years we'll need
          const startDate = newEndDate.subtract({ days: 364 });
          const years = new Set([startDate.year, newEndDate.year]);
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
  }, [endDate]);


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
          <DateRange dateRange={endDate ? { start: endDate.subtract({ days: 364 }), end: endDate } : null} />
        </div>

        {/* Main Stripes Visualization */}
        <div 
          ref={containerRef} 
          className="opennem-stripes-viz"
        >
          <div className="opennem-region">
            <div className="opennem-region-header">
              <span>New South Wales</span>
              <CapFacTooltip data={tooltipData} />
            </div>
            <div className="opennem-region-content">
              {/* Display tiles */}
              {(() => {
                if (!endDate || nswFacilities.length === 0) return null;
                
                const dateRange = { start: endDate.subtract({ days: 364 }), end: endDate };
                
                return (
                  <div className="opennem-facility-group">
                    {/* Display all NSW facilities */}
                    {nswFacilities.map(facilityCode => (
                      <CompositeTile
                        key={facilityCode}
                        endDate={endDate}
                        facilityCode={facilityCode}
                        onHover={setTooltipData}
                        onHoverEnd={() => setTooltipData(null)}
                      />
                    ))}
                    
                    <CapFacXAxis 
                      dateRange={dateRange}
                      regionCode="NSW1"
                      onHover={setTooltipData}
                      onHoverEnd={() => setTooltipData(null)}
                    />
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}