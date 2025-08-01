'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getTodayAEST } from '@/shared/date-utils';
import { DATE_BOUNDARIES } from '@/shared/config';
import { PerformanceDisplay } from '../components/PerformanceDisplay';
import { OpenElectricityHeader } from '../components/OpenElectricityHeader';
import { RegionSection } from '../components/RegionSection';
import { DateRange } from '../components/DateRange';
import { yearDataVendor, getRegionNames } from '@/client/year-data-vendor';
import { useAnimatedDateRange } from '@/hooks/useAnimatedDateRange';
import { useNavigation } from '@/hooks/useNavigation';
import './opennem.css';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<CalendarDate | null>(null);
  const [facilitiesByRegion, setFacilitiesByRegion] = useState<Map<string, { code: string; name: string }[]>>(new Map());
  const [boundaryFlash, setBoundaryFlash] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get animated date range
  const animatedDateRange = useAnimatedDateRange(endDate, { skipAnimation: isDragging });
  
  // Set up navigation
  const { navigateToMonth, navigateToDate } = useNavigation({
    endDate,
    onDateChange: setEndDate,
    onBoundaryHit: () => {
      setBoundaryFlash(true);
      setTimeout(() => setBoundaryFlash(false), 300);
    },
    isDragging
  });
  
  // Use navigateToMonth directly as it already has the correct signature
  const handleMonthClick = navigateToMonth;
  
  // Handle drag navigation from tiles
  useEffect(() => {
    const handleDateNavigate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { newEndDate, isDragging } = customEvent.detail;
      
      if (newEndDate) {
        // Check boundaries
        const yesterday = getTodayAEST().subtract({ days: 1 });
        const earliestDate = DATE_BOUNDARIES.EARLIEST_END_DATE;
        
        // Clamp the date within boundaries
        let clampedDate = newEndDate;
        if (newEndDate.compare(yesterday) > 0) {
          clampedDate = yesterday;
          // Emit boundary hit event
          const boundaryEvent = new CustomEvent('navigation-boundary-hit');
          window.dispatchEvent(boundaryEvent);
        } else if (newEndDate.compare(earliestDate) < 0) {
          clampedDate = earliestDate;
          // Emit boundary hit event
          const boundaryEvent = new CustomEvent('navigation-boundary-hit');
          window.dispatchEvent(boundaryEvent);
        }
        
        setIsDragging(isDragging);
        if (isDragging) {
          // During drag, update date directly without animation
          setEndDate(clampedDate);
        } else {
          // On drag end or other navigation, use animation
          navigateToDate(clampedDate);
        }
      }
    };
    
    const handleBoundaryHit = () => {
      setBoundaryFlash(true);
      setTimeout(() => setBoundaryFlash(false), 300);
    };
    
    window.addEventListener('date-navigate', handleDateNavigate);
    window.addEventListener('navigation-boundary-hit', handleBoundaryHit);
    
    return () => {
      window.removeEventListener('date-navigate', handleDateNavigate);
      window.removeEventListener('navigation-boundary-hit', handleBoundaryHit);
    };
  }, [navigateToDate, endDate, setEndDate]);
  
  // Target date range (for display in header)
  const targetDateRange = endDate ? {
    start: endDate.subtract({ days: 364 }),
    end: endDate
  } : null;
  


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
        
        // Extract facilities by region from the loaded data
        const regionFacilityMaps = new Map<string, Map<string, string>>();
        
        for (const yearData of yearResults) {
          for (const unit of yearData.data.data) {
            if (unit.region) {
              if (!regionFacilityMaps.has(unit.region)) {
                regionFacilityMaps.set(unit.region, new Map());
              }
              regionFacilityMaps.get(unit.region)!.set(unit.facility_code, unit.facility_name);
            }
          }
        }
        
        // Convert to sorted structure
        const facilitiesMap = new Map<string, { code: string; name: string }[]>();
        
        // Get all region codes and sort alphabetically by long name
        const allRegionCodes = ['NSW1', 'QLD1', 'SA1', 'TAS1', 'VIC1', 'WEM'];
        const sortedRegions = allRegionCodes
          .sort((a, b) => getRegionNames(a).long.localeCompare(getRegionNames(b).long));
        
        // Process each region
        for (const regionCode of sortedRegions) {
          const facilityMap = regionFacilityMaps.get(regionCode);
          if (facilityMap && facilityMap.size > 0) {
            const sortedFacilities = Array.from(facilityMap.entries())
              .map(([code, name]) => ({ code, name }))
              .sort((a, b) => a.name.localeCompare(b.name));
            facilitiesMap.set(regionCode, sortedFacilities);
          }
        }
        
        setFacilitiesByRegion(facilitiesMap);
        
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

  // Ensure the page has focus on mount for keyboard navigation
  useEffect(() => {
    window.focus();
  }, []);

  // Detect mobile screen width
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);


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
          <DateRange dateRange={targetDateRange} />
        </div>

        {/* Main Stripes Visualization */}
        <div 
          ref={containerRef} 
          className={`opennem-stripes-viz ${boundaryFlash ? 'boundary-flash' : ''}`}
        >
          {/* Create a section for each region */}
          {Array.from(facilitiesByRegion.entries()).map(([regionCode, facilities]) => {
            return (
              <RegionSection
                key={regionCode}
                regionCode={regionCode}
                facilities={facilities}
                endDate={endDate!}
                animatedDateRange={animatedDateRange}
                onMonthClick={handleMonthClick}
                isMobile={isMobile}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}