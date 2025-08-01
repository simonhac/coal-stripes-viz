'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getDateBoundaries } from '@/shared/date-boundaries';
import { getDaysBetween } from '@/shared/date-utils';
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
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Get animated date range
  const animatedDateRange = useAnimatedDateRange(endDate, { skipAnimation: isDragging });
  
  // Set up navigation
  const { navigateToMonth, navigateToDate } = useNavigation({
    endDate,
    onDateChange: setEndDate,
    isDragging
  });
  
  // Use navigateToMonth directly as it already has the correct signature
  const handleMonthClick = navigateToMonth;
  
  // Handle drag navigation from tiles
  useEffect(() => {
    const handleDateNavigate = (e: Event) => {
      try {
        const customEvent = e as CustomEvent;
        const { newEndDate, deltaDays, startEndDate, isDragging } = customEvent.detail;
      
      
      // Handle new format with deltaDays (desktop drag)
      if (deltaDays !== undefined && startEndDate) {
        // Calculate the raw position from start
        const rawEndDate = startEndDate.add({ days: deltaDays });
        
        if (isDragging) {
          // Update dragging state only if needed
          setIsDragging(prev => prev !== true ? true : prev);
          // During drag, apply rubber band effect if beyond display boundaries
          const boundaries = getDateBoundaries();
          
          let adjustedDate = rawEndDate;
          
          // Apply rubber band effect if beyond display boundaries (for end dates)
          if (!boundaries.isEndDateWithinDisplayBounds(rawEndDate)) {
            // Calculate how far beyond the boundary we are
            const clampedDate = boundaries.clampEndDateToDisplayBounds(rawEndDate);
            const overshoot = rawEndDate.compare(clampedDate) > 0 
              ? getDaysBetween(clampedDate, rawEndDate)
              : getDaysBetween(rawEndDate, clampedDate);
            
            // Apply rubber band resistance (logarithmic scaling)
            const resistance = 0.12; // Lower value = more resistance, slightly stiffer
            const rubberBandDays = Math.sign(overshoot) * Math.log(1 + Math.abs(overshoot)) * resistance;
            
            // Apply the rubber band effect
            if (rawEndDate.compare(clampedDate) > 0) {
              adjustedDate = clampedDate.add({ days: Math.ceil(rubberBandDays) });
            } else {
              adjustedDate = clampedDate.add({ days: Math.floor(rubberBandDays) });
            }
          }
          
          setEndDate(adjustedDate);
        }
      } else if (isDragging === false && !newEndDate) {
        // Mouse up without position - check if we need to spring back
        setIsDragging(false);
        
        if (endDate) {
          const boundaries = getDateBoundaries();
          
          if (endDate.compare(boundaries.latestDataDay) > 0 || endDate.compare(boundaries.earliestDataEndDay) < 0) {
            // Beyond data boundaries - animate spring back to data boundary
            const targetDate = endDate.compare(boundaries.latestDataDay) > 0 
              ? boundaries.latestDataDay 
              : boundaries.earliestDataEndDay;
            const totalDays = getDaysBetween(endDate, targetDate);
            const startTime = Date.now();
            const duration = 250; // Faster animation
            const startDate = endDate;
            
            // Cancel any existing animation
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            
            // Start immediately without delay
            const animate = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              
              // Use ease-out cubic for smooth deceleration
              const easeOut = 1 - Math.pow(1 - progress, 3);
              
              if (progress < 1) {
                // Interpolate between current position and target
                const daysToMove = Math.round(totalDays * easeOut);
                const interpolatedDate = startDate.add({ days: daysToMove });
                
                setEndDate(interpolatedDate);
                animationFrameRef.current = requestAnimationFrame(animate);
              } else {
                // Animation complete
                animationFrameRef.current = null;
                setEndDate(targetDate);
              }
            };
            
            animationFrameRef.current = requestAnimationFrame(animate);
          }
        }
      } else if (newEndDate) {
        // Handle old format (touch drag already has rubber band applied)
        if (isDragging) {
          // Update dragging state only if needed
          setIsDragging(prev => prev !== true ? true : prev);
          // During drag, apply rubber band effect if beyond display boundaries
          const boundaries = getDateBoundaries();
          
          let adjustedDate = newEndDate;
          
          // Apply rubber band effect if beyond display boundaries (for end dates)
          if (!boundaries.isEndDateWithinDisplayBounds(newEndDate)) {
            // Calculate how far beyond the boundary we are
            const clampedDate = boundaries.clampEndDateToDisplayBounds(newEndDate);
            const overshoot = newEndDate.compare(clampedDate) > 0 
              ? getDaysBetween(clampedDate, newEndDate)
              : getDaysBetween(newEndDate, clampedDate);
            
            // Apply rubber band resistance (logarithmic scaling)
            const resistance = 0.12; // Lower value = more resistance, slightly stiffer
            const rubberBandDays = Math.sign(overshoot) * Math.log(1 + Math.abs(overshoot)) * resistance;
            
            // Apply the rubber band effect
            if (newEndDate.compare(clampedDate) > 0) {
              adjustedDate = clampedDate.add({ days: Math.ceil(rubberBandDays) });
            } else {
              adjustedDate = clampedDate.add({ days: Math.floor(rubberBandDays) });
            }
          }
          
          setEndDate(adjustedDate);
        } else {
          // On drag end, check display boundaries and spring back if needed
          const boundaries = getDateBoundaries();
          
          if (!boundaries.isWithinDisplayBounds(newEndDate)) {
            // Beyond display boundaries - animate spring back
            const targetDate = boundaries.clampToDisplayBounds(newEndDate);
            const totalDays = getDaysBetween(newEndDate, targetDate);
            const startTime = Date.now();
            const duration = 300; // 300ms animation
            const startDate = newEndDate;
            
            // Cancel any existing animation
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            
            const animate = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              
              // Use ease-out cubic for smooth deceleration
              const easeOut = 1 - Math.pow(1 - progress, 3);
              
              if (progress < 1) {
                // Interpolate between current position and target
                const daysToMove = Math.round(totalDays * easeOut);
                const interpolatedDate = startDate.add({ days: daysToMove });
                
                setEndDate(interpolatedDate);
                animationFrameRef.current = requestAnimationFrame(animate);
              } else {
                // Animation complete
                animationFrameRef.current = null;
                setEndDate(targetDate);
              }
            };
            
            animationFrameRef.current = requestAnimationFrame(animate);
          } else {
            // Within boundaries - just set the position
            setEndDate(newEndDate);
          }
        }
      }
      } catch (error) {
        console.error('Error in handleDateNavigate:', error);
      }
    };
    
    window.addEventListener('date-navigate', handleDateNavigate);
    
    return () => {
      window.removeEventListener('date-navigate', handleDateNavigate);
    };
  }, [navigateToDate]);
  
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
        const boundaries = getDateBoundaries();
        const calculatedEndDate = boundaries.latestDataDay;
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

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Ensure the page has focus on mount for keyboard navigation
  useEffect(() => {
    window.focus();
  }, []);

  // Clear pinned tooltips when touching outside interactive elements
  useEffect(() => {
    const handleGlobalTouch = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if the touch is on an interactive element
      const isInteractiveElement = 
        target.closest('.opennem-facility-label') ||
        target.closest('.opennem-region-label') ||
        target.closest('.opennem-facility-canvas') ||
        target.closest('.opennem-month-label') ||
        target.closest('.tooltip-container');
      
      // If touching outside interactive elements, clear any pinned tooltips
      if (!isInteractiveElement) {
        const event = new CustomEvent('tooltip-data-hover-end');
        window.dispatchEvent(event);
      }
    };

    document.addEventListener('touchstart', handleGlobalTouch);
    
    return () => {
      document.removeEventListener('touchstart', handleGlobalTouch);
    };
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
          className="opennem-stripes-viz"
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
          
          {/* Bottom spacer */}
          <div style={{ height: '50px', clear: 'both' }} />
        </div>
      </div>
    </>
  );
}