'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getTodayAEST } from '@/shared/date-utils';
import { PerformanceDisplay } from '../components/PerformanceDisplay';
import { OpenElectricityHeader } from '../components/OpenElectricityHeader';
import { RegionSection } from '../components/RegionSection';
import { DateRange } from '../components/DateRange';
import { yearDataVendor } from '@/client/year-data-vendor';
import { useAnimatedDateRange } from '@/hooks/useAnimatedDateRange';
import { useNavigation } from '@/hooks/useNavigation';
import './opennem.css';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<CalendarDate | null>(null);
  const [facilitiesByRegion, setFacilitiesByRegion] = useState<Map<string, { code: string; name: string }[]>>(new Map());
  const [boundaryFlash, setBoundaryFlash] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<CalendarDate | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get animated date range
  const animatedDateRange = useAnimatedDateRange(endDate);
  
  // // Debug: Listen for hover events
  // useEffect(() => {
  //   const handleHover = (e: Event) => {
  //     const customEvent = e as CustomEvent;
  //     console.log('Tooltip data hover event:', customEvent.detail);
  //   };
    
  //   const handleHoverEnd = () => {
  //     console.log('Tooltip data hover end');
  //   };
    
  //   window.addEventListener('tooltip-data-hover', handleHover);
  //   window.addEventListener('tooltip-data-hover-end', handleHoverEnd);
    
  //   return () => {
  //     window.removeEventListener('tooltip-data-hover', handleHover);
  //     window.removeEventListener('tooltip-data-hover-end', handleHoverEnd);
  //   };
  // }, []);
  
  // Set up navigation
  const { navigateToMonth } = useNavigation({
    endDate,
    onDateChange: setEndDate,
    onBoundaryHit: () => {
      setBoundaryFlash(true);
      setTimeout(() => setBoundaryFlash(false), 300);
    }
  });
  
  // Use navigateToMonth directly as it already has the correct signature
  const handleMonthClick = navigateToMonth;
  
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
        
        // Define region display names
        const regionNames = new Map([
          ['NSW1', 'New South Wales'],
          ['QLD1', 'Queensland'],
          ['SA1', 'South Australia'],
          ['TAS1', 'Tasmania'],
          ['VIC1', 'Victoria'],
          ['WEM', 'Western Australia']
        ]);
        
        // Sort regions alphabetically by display name
        const sortedRegions = Array.from(regionNames.entries())
          .sort((a, b) => a[1].localeCompare(b[1]))
          .map(([code]) => code);
        
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
            // Get region display name
            const regionName = {
              'NSW1': 'New South Wales',
              'QLD1': 'Queensland',
              'SA1': 'South Australia',
              'TAS1': 'Tasmania',
              'VIC1': 'Victoria',
              'WEM': 'Western Australia'
            }[regionCode] || regionCode;
            
            return (
              <RegionSection
                key={regionCode}
                regionCode={regionCode}
                regionName={regionName}
                facilities={facilities}
                endDate={endDate!}
                animatedDateRange={animatedDateRange}
                onMonthClick={handleMonthClick}
                hoveredDate={hoveredDate}
                onHoveredDateChange={setHoveredDate}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}