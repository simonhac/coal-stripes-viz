'use client';

import { useState, useEffect, useRef } from 'react';
import { useCoalStripesRange } from '../hooks/useCoalStripes';
import { GeneratingUnitDTO } from '@/shared/types';
import { parseDate } from '@internationalized/date';
import { getTodayAEST } from '@/shared/date-utils';
import { OptimizedStripeCanvas } from '../components/OptimizedStripeCanvas';
import { TileViewport } from '../components/TileViewport';
import { TileManager } from '../client/tile-system/TileManager';
import { PerformanceDisplay } from '../components/PerformanceDisplay';
import { UI_CONFIG } from '@/shared/config';
import './opennem.css';

// Get color based on capacity factor
function getCoalProportionColor(capacityFactor: number | null): string {
  // Light blue for missing data
  if (capacityFactor === null || capacityFactor === undefined) return '#e6f3ff';
  
  // Red for anything under 25%
  if (capacityFactor < 25) return '#ef4444';
  
  // Map capacity factor directly to grey scale
  // 25% -> 75% grey (light), 100% -> 0% grey (black)
  // Grey value = 255 * (1 - capacityFactor/100)
  const clampedCapacity = Math.min(100, Math.max(25, capacityFactor));
  
  // Invert so that higher capacity = darker (lower grey value)
  const greyValue = Math.round(255 * (1 - clampedCapacity / 100));
  
  return `rgb(${greyValue}, ${greyValue}, ${greyValue})`;
}

// Group units by region
interface RegionGroup {
  name: string;
  units: GeneratingUnitDTO[];
}

function groupUnitsByRegion(units: GeneratingUnitDTO[]): RegionGroup[] {
  const regions: Record<string, RegionGroup> = {
    NSW1: { name: 'New South Wales', units: [] },
    QLD1: { name: 'Queensland', units: [] },
    VIC1: { name: 'Victoria', units: [] },
    SA1: { name: 'South Australia', units: [] },
    WEM: { name: 'Western Australia', units: [] }
  };
  
  units.forEach(unit => {
    const regionKey = unit.network === 'wem' ? 'WEM' : (unit.region || 'NSW1');
    if (regions[regionKey]) {
      regions[regionKey].units.push(unit);
    }
  });
  
  return Object.values(regions).filter(r => r.units.length > 0);
}

function getMonthLabels(dates: string[], units: GeneratingUnitDTO[], data: any, useShortLabels: boolean = false) {
  const monthGroups: Record<string, { 
    dates: string[]; 
    monthYear: string; 
    shortMonthYear: string;
    startIndex: number; 
    endIndex: number; 
  }> = {};
  
  // Group dates by month and track their positions
  dates.forEach((date, index) => {
    const calendarDate = parseDate(date);
    const monthYear = calendarDate.toDate('Australia/Brisbane').toLocaleDateString('en-AU', { 
      month: 'long', 
      year: 'numeric',
      timeZone: 'Australia/Brisbane'
    });
    const shortMonthYear = calendarDate.toDate('Australia/Brisbane').toLocaleDateString('en-AU', { 
      month: 'short', 
      year: 'numeric',
      timeZone: 'Australia/Brisbane'
    });
    const monthKey = date.substring(0, 7); // YYYY-MM format from date string
    
    if (!monthGroups[monthKey]) {
      monthGroups[monthKey] = { 
        dates: [], 
        monthYear, 
        shortMonthYear,
        startIndex: index, 
        endIndex: index 
      };
    }
    monthGroups[monthKey].dates.push(date);
    monthGroups[monthKey].endIndex = index;
  });
  
  const totalDates = dates.length;
  
  return Object.entries(monthGroups).map(([monthKey, group]) => {
    const monthLabel = group.shortMonthYear.split(' ')[0]; // Just the month part (Jan, Feb, etc)
    
    // Use pre-calculated monthly averages if available
    let avgCapacityFactor = null;
    
    if (data.monthlyAverages && data.monthlyAverages[monthKey]) {
      let totalCapacityFactor = 0;
      let unitCount = 0;
      
      units.forEach(unit => {
        const monthAvg = data.monthlyAverages[monthKey][unit.duid];
        if (monthAvg !== undefined && monthAvg !== null) {
          totalCapacityFactor += monthAvg;
          unitCount++;
        }
      });
      
      if (unitCount > 0) {
        avgCapacityFactor = totalCapacityFactor / unitCount;
      }
    } else {
      // Fallback to calculating on the fly if no pre-calculated data
      let totalCapacityFactor = 0;
      let dataPoints = 0;
      
      units.forEach(unit => {
        group.dates.forEach((date) => {
          // Calculate the data index for this date
          const dataStartDate = unit.history.start;
          const [year, month, day] = date.split('-').map(Number);
          const [startYear, startMonth, startDay] = dataStartDate.split('-').map(Number);
          
          // Simple day difference calculation
          const currentTime = new Date(year, month - 1, day).getTime();
          const startTime = new Date(startYear, startMonth - 1, startDay).getTime();
          const daysDiff = Math.floor((currentTime - startTime) / (1000 * 60 * 60 * 24));
          
          // Get the capacity factor if within data range
          if (daysDiff >= 0 && daysDiff < unit.history.data.length) {
            const capacityFactor = unit.history.data[daysDiff];
            if (capacityFactor !== null && capacityFactor !== undefined) {
              totalCapacityFactor += capacityFactor;
              dataPoints++;
            }
          }
        });
      });
      
      avgCapacityFactor = dataPoints > 0 ? totalCapacityFactor / dataPoints : null;
    }
    
    // Calculate position and width based on actual date positions
    const startPosition = (group.startIndex / totalDates) * 100;
    const width = ((group.endIndex - group.startIndex + 1) / totalDates) * 100;
    
    // Use single letter for narrow displays
    const displayLabel = useShortLabels ? monthLabel.charAt(0) : monthLabel;
    
    return {
      label: displayLabel,
      fullLabel: monthLabel,
      avgCapacityFactor,
      width,
      startPosition,
      monthYear: group.monthYear
    };
  });
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  const startFormatted = start.toDate('Australia/Brisbane').toLocaleDateString('en-AU', { 
    day: 'numeric',
    month: 'long', 
    year: 'numeric',
    timeZone: 'Australia/Brisbane'
  });
  
  const endFormatted = end.toDate('Australia/Brisbane').toLocaleDateString('en-AU', { 
    day: 'numeric',
    month: 'long', 
    year: 'numeric',
    timeZone: 'Australia/Brisbane'
  });
  
  return `${startFormatted} – ${endFormatted}`;
}

export default function Home() {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const stripesContainerRef = useRef<HTMLDivElement>(null);
  const firstFacilityRef = useRef<HTMLDivElement>(null);
  const [isFirstFacilityFocused, setIsFirstFacilityFocused] = useState(false);
  const tileManagerRef = useRef<TileManager | null>(null);
  
  // Calculate container width for accurate drag sensitivity
  const [containerWidth, setContainerWidth] = useState(1200);
  const [stripeDataWidth, setStripeDataWidth] = useState(1060);
  
  const { 
    data, 
    loading, 
    error, 
    currentDateRange,
    isDragging,
    onDragStart,
    onDragMove,
    onDragEnd,
    setDateRange
  } = useCoalStripesRange({ containerWidth: stripeDataWidth });
  const isMouseOverStripes = useRef(false);
  const isMouseOverMonth = useRef(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [paintCount, setPaintCount] = useState(0);
  
  // Initialize TileManager
  useEffect(() => {
    if (!tileManagerRef.current) {
      tileManagerRef.current = new TileManager(50); // Cache up to 50 tiles
    }
  }, []);
  
  // Set up year data in TileManager when data changes
  useEffect(() => {
    if (!tileManagerRef.current || !data || !currentDateRange) return;
    
    // Set year data for the years we need
    const years = new Set([currentDateRange.start.year, currentDateRange.end.year]);
    
    for (const year of years) {
      // The data from useCoalStripesRange already contains the units for the date range
      tileManagerRef.current.setYearData(year, data);
    }
    
    // Set viewport info
    if (stripesContainerRef.current) {
      const rect = stripesContainerRef.current.getBoundingClientRect();
      tileManagerRef.current.setViewport({
        startDate: currentDateRange.start.toDate('Australia/Brisbane'),
        endDate: currentDateRange.end.toDate('Australia/Brisbane'),
        width: rect.width,
        height: rect.height,
        pixelsPerDay: rect.width / 365
      });
    }
  }, [data, currentDateRange]);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      
      // Update container width for accurate drag calculations
      if (stripesContainerRef.current) {
        const rect = stripesContainerRef.current.getBoundingClientRect();
        setContainerWidth(rect.width);
        
        // Also measure the actual stripe data width
        const stripeData = stripesContainerRef.current.querySelector('.opennem-stripe-data');
        if (stripeData) {
          const stripeDataRect = stripeData.getBoundingClientRect();
          setStripeDataWidth(stripeDataRect.width);
        }
      }
    };
    
    // Initial measurement
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mobile breakpoint
  const isMobile = windowWidth < 768;
  const useShortLabels = windowWidth < 600;

  // Handle mouse position updates efficiently
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Handle dragging globally
      if (isDragging) {
        e.preventDefault();
        onDragMove(e.clientX);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        onDragEnd();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length > 0) {
        e.preventDefault();
        const touch = e.touches[0];
        onDragMove(touch.clientX);
      }
    };

    const handleTouchEnd = () => {
      if (isDragging) {
        onDragEnd();
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, onDragMove, onDragEnd]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Only handle arrow keys if first facility is focused
      if (!isFirstFacilityFocused) return;

      if (!currentDateRange) return;

      const isShift = e.shiftKey;
      const monthsToMove = isShift ? 6 : 1;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        // Left arrow - pan backward in time (older)
        const newStart = currentDateRange.start.subtract({ months: monthsToMove });
        const newEnd = currentDateRange.end.subtract({ months: monthsToMove });
        
        // Show loading state immediately
        setIsNavigating(true);
        setDateRange(newStart, newEnd, 'backward');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        // Right arrow - pan forward in time (more recent)
        const newStart = currentDateRange.start.add({ months: monthsToMove });
        const newEnd = currentDateRange.end.add({ months: monthsToMove });
        
        // Get yesterday as the latest possible date
        const yesterday = getTodayAEST().subtract({ days: 1 });
        
        // Check boundaries - don't go past yesterday
        if (newEnd.compare(yesterday) > 0) {
          // Adjust to end at yesterday
          const daysOverYesterday = newEnd.toDate('Australia/Brisbane').getTime() - yesterday.toDate('Australia/Brisbane').getTime();
          const daysOver = Math.ceil(daysOverYesterday / (1000 * 60 * 60 * 24));
          const constrainedEnd = yesterday;
          const constrainedStart = newStart.subtract({ days: daysOver });
          
          // Show loading state immediately
          setIsNavigating(true);
          setDateRange(constrainedStart, constrainedEnd, 'forward');
        } else {
          // Show loading state immediately
          setIsNavigating(true);
          setDateRange(newStart, newEnd, 'forward');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDateRange, setDateRange, isFirstFacilityFocused]);

  // Clear navigating state when loading completes
  useEffect(() => {
    if (!loading && isNavigating) {
      setIsNavigating(false);
    }
  }, [loading, isNavigating]);
  

  const updateUnifiedTooltip = (tooltipData: any) => {
    let tooltip = document.getElementById('unified-tooltip');
    if (!tooltip) {
      // Create tooltip element if it doesn't exist
      tooltip = document.createElement('div');
      tooltip.id = 'unified-tooltip';
      tooltip.className = 'opennem-tooltip';
      document.body.appendChild(tooltip);
    }

    // Format date
    const date = parseDate(tooltipData.date);
    const formattedDate = date.toDate('Australia/Brisbane').toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Australia/Brisbane'
    });

    // Format capacity factor
    const getCapacityText = (capacityFactor: number | null) => {
      if (capacityFactor === null) return 'No data';
      if (capacityFactor < 1) return 'Offline';
      if (capacityFactor < 25) return `${capacityFactor.toFixed(1)}% (Low)`;
      return `${capacityFactor.toFixed(1)}%`;
    };

    tooltip.innerHTML = `
      <div class="opennem-tooltip-date">${formattedDate}</div>
      <div class="opennem-tooltip-facility">${tooltipData.facility}: ${tooltipData.unit}</div>
      <div class="opennem-tooltip-value">
        ${getCapacityText(tooltipData.capacityFactor)}
      </div>
    `;

    // Position tooltip
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

  const updateMonthTooltip = (tooltipData: any) => {
    let tooltip = document.getElementById('unified-tooltip');
    if (!tooltip) {
      // Create tooltip element if it doesn't exist
      tooltip = document.createElement('div');
      tooltip.id = 'unified-tooltip';
      tooltip.className = 'opennem-tooltip';
      document.body.appendChild(tooltip);
    }

    // Update content for month tooltip
    const getCapacityText = (capacityFactor: number | null) => {
      if (capacityFactor === null) return 'No data';
      if (capacityFactor < 1) return 'Offline';
      if (capacityFactor < 25) return `${capacityFactor.toFixed(1)}% (Low)`;
      return `${capacityFactor.toFixed(1)}%`;
    };

    tooltip.innerHTML = `
      <div class="opennem-tooltip-date">${tooltipData.monthYear}</div>
      <div class="opennem-tooltip-facility">${tooltipData.region}</div>
      <div class="opennem-tooltip-value">
        ${getCapacityText(tooltipData.avgCapacityFactor)}
      </div>
    `;

    // Position tooltip
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

  const hideUnifiedTooltip = () => {
    const tooltip = document.getElementById('unified-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  };

  // Show loading state but don't block if we have existing data
  if (loading && !data) {
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

  if (!data || !data.data || data.data.length === 0) {
    return (
      <div className="opennem-error">
        <p>No data available</p>
      </div>
    );
  }

  // Calculate dates based on currentDateRange for real-time drag feedback
  const dates: string[] = [];
  if (currentDateRange) {
    let currentDate = currentDateRange.start;
    while (currentDate.compare(currentDateRange.end) <= 0) {
      dates.push(currentDate.toString());
      currentDate = currentDate.add({ days: 1 });
    }
  } else if (data.data.length > 0) {
    // Fallback to data dates if no currentDateRange
    const firstUnit = data.data[0];
    const startDate = parseDate(firstUnit.history.start);
    const endDate = parseDate(firstUnit.history.last);
    
    let currentDate = startDate;
    while (currentDate.compare(endDate) <= 0) {
      dates.push(currentDate.toString());
      currentDate = currentDate.add({ days: 1 });
    }
  }

  // Group units by region
  const regionsWithData = groupUnitsByRegion(data.data);
  const totalUnits = data.data.length;

  return (
    <>
      {/* Performance Monitor */}
      <PerformanceDisplay />
      
      {/* Header - Exact OpenElectricity structure */}
      <header className="bg-white border-b" style={{ borderBottom: '1px dotted #cdcdcd' }}>
        <div className="mx-auto px-4 py-6" style={{ maxWidth: '1200px' }}>
          <div className="flex items-center justify-between">
            <a href="/" className="text-black no-underline">
              <svg width="200" height="24" viewBox="0 0 236 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M55.5015 21.4094V7.10859H59.0767V8.98269H59.5957C59.8263 8.48293 60.2588 8.012 60.8931 7.5699C61.5274 7.10859 62.4885 6.87793 63.7763 6.87793C64.8912 6.87793 65.8619 7.13742 66.6884 7.6564C67.5341 8.15616 68.1877 8.85775 68.649 9.76116C69.1103 10.6454 69.341 11.6833 69.341 12.8751V21.4094H65.7081V13.1634C65.7081 12.087 65.439 11.2797 64.9008 10.7415C64.3818 10.2033 63.6322 9.93415 62.6519 9.93415C61.537 9.93415 60.6721 10.309 60.057 11.0586C59.4419 11.789 59.1343 12.8174 59.1343 14.1437V21.4094H55.5015Z" fill="#353535"></path>
                <path d="M45.3795 21.8142C43.9571 21.8142 42.6981 21.5163 41.6024 20.9204C40.526 20.3053 39.6803 19.4499 39.0652 18.3543C38.4693 17.2395 38.1714 15.9324 38.1714 14.4331V14.0871C38.1714 12.5878 38.4693 11.2904 39.0652 10.1948C39.6611 9.07992 40.4972 8.22456 41.5736 7.62869C42.65 7.0136 43.8994 6.70605 45.3218 6.70605C46.725 6.70605 47.9455 7.02321 48.9835 7.65752C50.0215 8.27261 50.8288 9.13758 51.4054 10.2524C51.9821 11.3481 52.2704 12.6263 52.2704 14.0871V15.3269H41.8619C41.9004 16.3072 42.2656 17.1049 42.9575 17.72C43.6495 18.3351 44.4953 18.6426 45.4948 18.6426C46.5135 18.6426 47.2632 18.4216 47.7437 17.9795C48.2242 17.5374 48.5895 17.0472 48.8393 16.509L51.8091 18.066C51.54 18.5657 51.1459 19.1136 50.6269 19.7094C50.1272 20.2861 49.4544 20.7858 48.6087 21.2087C47.7629 21.6124 46.6865 21.8142 45.3795 21.8142ZM41.8908 12.6167H48.5798C48.503 11.7902 48.1666 11.127 47.5707 10.6272C46.9941 10.1275 46.2348 9.87761 45.293 9.87761C44.3127 9.87761 43.5342 10.1275 42.9575 10.6272C42.3809 11.127 42.0253 11.7902 41.8908 12.6167Z" fill="#353535"></path>
                <path d="M20.4761 27.177V7.10971H24.0513V8.83965H24.5703C24.897 8.28222 25.4064 7.79207 26.0984 7.3692C26.7903 6.9271 27.7803 6.70605 29.0681 6.70605C30.2214 6.70605 31.2882 6.99438 32.2685 7.57102C33.2488 8.12845 34.0369 8.95498 34.6327 10.0506C35.2286 11.1462 35.5265 12.4725 35.5265 14.0295V14.4908C35.5265 16.0477 35.2286 17.374 34.6327 18.4696C34.0369 19.5653 33.2488 20.4014 32.2685 20.978C31.2882 21.5355 30.2214 21.8142 29.0681 21.8142C28.2031 21.8142 27.4727 21.7085 26.8768 21.497C26.3002 21.3048 25.8293 21.0549 25.4641 20.7474C25.1181 20.4206 24.8394 20.0939 24.6279 19.7671H24.1089V27.177H20.4761ZM27.9725 18.6426C29.1065 18.6426 30.0388 18.287 30.7692 17.5758C31.5188 16.8454 31.8937 15.7882 31.8937 14.4043V14.116C31.8937 12.732 31.5188 11.6844 30.7692 10.9732C30.0196 10.2428 29.0873 9.87761 27.9725 9.87761C26.8576 9.87761 25.9254 10.2428 25.1757 10.9732C24.4261 11.6844 24.0513 12.732 24.0513 14.116V14.4043C24.0513 15.7882 24.4261 16.8454 25.1757 17.5758C25.9254 18.287 26.8576 18.6426 27.9725 18.6426Z" fill="#353535"></path>
                <path d="M8.71875 21.8132C6.1815 21.8132 4.16324 21.1212 2.66396 19.7372C1.16468 18.3341 0.415039 16.335 0.415039 13.7401V8.89629C0.415039 6.30138 1.16468 4.31195 2.66396 2.928C4.16324 1.52483 6.1815 0.823242 8.71875 0.823242C11.256 0.823242 13.2743 1.52483 14.7735 2.928C16.2728 4.31195 17.0225 6.30138 17.0225 8.89629V13.7401C17.0225 16.335 16.2728 18.3341 14.7735 19.7372C13.2743 21.1212 11.256 21.8132 8.71875 21.8132ZM8.71875 18.411C10.1411 18.411 11.2464 17.9977 12.0345 17.1712C12.8225 16.3446 13.2166 15.2394 13.2166 13.8554V8.78096C13.2166 7.39701 12.8225 6.29177 12.0345 5.46524C11.2464 4.63872 10.1411 4.22546 8.71875 4.22546C7.31557 4.22546 6.21033 4.63872 5.40303 5.46524C4.61495 6.29177 4.2209 7.39701 4.2209 8.78096V13.8554C4.2209 15.2394 4.61495 16.3446 5.40303 17.1712C6.21033 17.9977 7.31557 18.411 8.71875 18.411Z" fill="#353535"></path>
                <path fillRule="evenodd" clipRule="evenodd" d="M79.6652 8.96582L84.7408 14.0414L88.5681 10.2142L91.0647 12.7108L84.7408 19.0348L79.6652 13.9592L75.838 17.7864L73.3413 15.2897L79.6652 8.96582Z" fill="#A29D66" stroke="black" strokeWidth="0.2"></path>
                <path d="M223.357 27.1767V24.0051H231.142C231.68 24.0051 231.949 23.7168 231.949 23.1401V19.5361H231.43C231.277 19.8629 231.036 20.1896 230.71 20.5164C230.383 20.8432 229.941 21.1123 229.383 21.3237C228.826 21.5351 228.115 21.6409 227.25 21.6409C226.135 21.6409 225.155 21.391 224.309 20.8912C223.482 20.3722 222.838 19.661 222.377 18.7576C221.916 17.8542 221.685 16.8163 221.685 15.6437V7.10938H225.318V15.3554C225.318 16.4318 225.577 17.2391 226.096 17.7773C226.635 18.3155 227.394 18.5846 228.374 18.5846C229.489 18.5846 230.354 18.2194 230.969 17.489C231.584 16.7394 231.892 15.7014 231.892 14.3751V7.10938H235.525V23.9474C235.525 24.9277 235.236 25.7062 234.66 26.2829C234.083 26.8787 233.314 27.1767 232.353 27.1767H223.357Z" fill="#353535"></path>
                <path d="M214.129 21.409C213.187 21.409 212.418 21.1206 211.823 20.544C211.246 19.9481 210.958 19.16 210.958 18.1798V10.1067H207.382V7.10814H210.958V2.66797H214.59V7.10814H218.512V10.1067H214.59V17.5454C214.59 18.1221 214.86 18.4104 215.398 18.4104H218.166V21.409H214.129Z" fill="#353535"></path>
                <path d="M200.992 21.4095V7.10869H204.625V21.4095H200.992ZM202.808 5.43641C202.155 5.43641 201.597 5.22497 201.136 4.8021C200.694 4.37923 200.473 3.8218 200.473 3.12983C200.473 2.43785 200.694 1.88043 201.136 1.45755C201.597 1.03468 202.155 0.823242 202.808 0.823242C203.481 0.823242 204.038 1.03468 204.48 1.45755C204.922 1.88043 205.143 2.43785 205.143 3.12983C205.143 3.8218 204.922 4.37923 204.48 4.8021C204.038 5.22497 203.481 5.43641 202.808 5.43641Z" fill="#353535"></path>
                <path d="M190.818 21.8142C189.434 21.8142 188.175 21.5259 187.041 20.9492C185.926 20.3726 185.042 19.5364 184.388 18.4408C183.734 17.3452 183.408 16.0189 183.408 14.4619V14.0583C183.408 12.5013 183.734 11.1751 184.388 10.0794C185.042 8.98381 185.926 8.14767 187.041 7.57102C188.175 6.99438 189.434 6.70605 190.818 6.70605C192.182 6.70605 193.355 6.94632 194.335 7.42686C195.315 7.9074 196.104 8.57054 196.699 9.41629C197.314 10.2428 197.718 11.1847 197.91 12.2419L194.393 12.9915C194.316 12.4149 194.143 11.8959 193.874 11.4346C193.605 10.9732 193.22 10.608 192.721 10.3389C192.24 10.0698 191.635 9.93527 190.904 9.93527C190.174 9.93527 189.511 10.0987 188.915 10.4254C188.338 10.733 187.877 11.2039 187.531 11.8382C187.204 12.4533 187.041 13.2125 187.041 14.116V14.4043C187.041 15.3077 187.204 16.0766 187.531 16.7109C187.877 17.326 188.338 17.7969 188.915 18.1236C189.511 18.4312 190.174 18.585 190.904 18.585C192 18.585 192.826 18.3063 193.384 17.7488C193.96 17.1722 194.326 16.4225 194.479 15.4999L197.997 16.336C197.747 17.3548 197.314 18.287 196.699 19.1328C196.104 19.9593 195.315 20.6128 194.335 21.0934C193.355 21.5739 192.182 21.8142 190.818 21.8142Z" fill="#353535"></path>
                <path d="M176.441 21.4095V7.10869H180.074V21.4095H176.441ZM178.257 5.43641C177.604 5.43641 177.046 5.22497 176.585 4.8021C176.143 4.37923 175.922 3.8218 175.922 3.12983C175.922 2.43785 176.143 1.88043 176.585 1.45755C177.046 1.03468 177.604 0.823242 178.257 0.823242C178.93 0.823242 179.487 1.03468 179.93 1.45755C180.372 1.88043 180.593 2.43785 180.593 3.12983C180.593 3.8218 180.372 4.37923 179.93 4.8021C179.487 5.22497 178.93 5.43641 178.257 5.43641Z" fill="#353535"></path>
                <path d="M165.009 21.4093V7.10845H168.584V8.72306H169.103C169.314 8.14641 169.66 7.72354 170.141 7.45443C170.641 7.18533 171.217 7.05078 171.871 7.05078H173.601V10.28H171.813C170.891 10.28 170.131 10.5299 169.535 11.0296C168.94 11.5102 168.642 12.2598 168.642 13.2786V21.4093H165.009Z" fill="#353535"></path>
                <path d="M157.336 21.409C156.394 21.409 155.625 21.1206 155.029 20.544C154.452 19.9481 154.164 19.16 154.164 18.1798V10.1067H150.589V7.10814H154.164V2.66797H157.797V7.10814H161.718V10.1067H157.797V17.5454C157.797 18.1221 158.066 18.4104 158.604 18.4104H161.372V21.409H157.336Z" fill="#353535"></path>
                <path d="M142.162 21.8142C140.778 21.8142 139.519 21.5259 138.385 20.9492C137.27 20.3726 136.386 19.5364 135.732 18.4408C135.079 17.3452 134.752 16.0189 134.752 14.4619V14.0583C134.752 12.5013 135.079 11.1751 135.732 10.0794C136.386 8.98381 137.27 8.14767 138.385 7.57102C139.519 6.99438 140.778 6.70605 142.162 6.70605C143.527 6.70605 144.699 6.94632 145.679 7.42686C146.66 7.9074 147.448 8.57054 148.044 9.41629C148.659 10.2428 149.062 11.1847 149.255 12.2419L145.737 12.9915C145.66 12.4149 145.487 11.8959 145.218 11.4346C144.949 10.9732 144.565 10.608 144.065 10.3389C143.584 10.0698 142.979 9.93527 142.248 9.93527C141.518 9.93527 140.855 10.0987 140.259 10.4254C139.682 10.733 139.221 11.2039 138.875 11.8382C138.548 12.4533 138.385 13.2125 138.385 14.116V14.4043C138.385 15.3077 138.548 16.0766 138.875 16.7109C139.221 17.326 139.682 17.7969 140.259 18.1236C140.855 18.4312 141.518 18.585 142.248 18.585C143.344 18.585 144.171 18.3063 144.728 17.7488C145.305 17.1722 145.67 16.4225 145.824 15.4999L149.341 16.336C149.091 17.3548 148.659 18.287 148.044 19.1328C147.448 19.9593 146.66 20.6128 145.679 21.0934C144.699 21.5739 143.527 21.8142 142.162 21.8142Z" fill="#353535"></path>
                <path d="M125.319 21.8142C123.897 21.8142 122.638 21.5163 121.542 20.9204C120.466 20.3053 119.62 19.4499 119.005 18.3543C118.409 17.2395 118.111 15.9324 118.111 14.4331V14.0871C118.111 12.5878 118.409 11.2904 119.005 10.1948C119.601 9.07992 120.437 8.22456 121.514 7.62869C122.59 7.0136 123.839 6.70605 125.262 6.70605C126.665 6.70605 127.885 7.02321 128.923 7.65752C129.961 8.27261 130.769 9.13758 131.345 10.2524C131.922 11.3481 132.21 12.6263 132.21 14.0871V15.3269H121.802C121.84 16.3072 122.206 17.1049 122.897 17.72C123.589 18.3351 124.435 18.6426 125.435 18.6426C126.453 18.6426 127.203 18.4216 127.684 17.9795C128.164 17.5374 128.529 17.0472 128.779 16.509L131.749 18.066C131.48 18.5657 131.086 19.1136 130.567 19.7094C130.067 20.2861 129.394 20.7858 128.549 21.2087C127.703 21.6124 126.626 21.8142 125.319 21.8142ZM121.831 12.6167H128.52C128.443 11.7902 128.107 11.127 127.511 10.6272C126.934 10.1275 126.175 9.87761 125.233 9.87761C124.253 9.87761 123.474 10.1275 122.897 10.6272C122.321 11.127 121.965 11.7902 121.831 12.6167Z" fill="#353535"></path>
                <path d="M111.143 21.4092V1.22656H114.776V21.4092H111.143Z" fill="#353535"></path>
                <path d="M95.0645 21.4092V1.22656H108.039V4.68644H98.8703V9.50144H107.232V12.9613H98.8703V17.9493H108.212V21.4092H95.0645Z" fill="#353535"></path>
              </svg>
            </a>
            <nav className="flex items-center">
              <a href="/tracker" className="opennem-nav-link">
                Tracker
              </a>
              <a href="/facilities" className="opennem-nav-link">
                Facilities
              </a>
              <a href="/scenarios" className="opennem-nav-link">
                Scenarios
              </a>
              <a href="/records" className="opennem-nav-link">
                Records
              </a>
              <a href="/analysis" className="opennem-nav-link">
                Analysis
              </a>
              <a href="/about" className="opennem-nav-link">
                About
              </a>
            </nav>
          </div>
        </div>
      </header>

      
      {/* Date Range Header */}
      <div className="opennem-stripes-container">
        <div className="opennem-stripes-header">
          <div className="opennem-date-range">
            {currentDateRange 
              ? formatDateRange(currentDateRange.start.toString(), currentDateRange.end.toString())
              : dates.length > 0 
                ? formatDateRange(dates[0], dates[dates.length - 1])
                : 'Loading...'}
          </div>
        </div>

        {/* Main Stripes Visualization */}
        <div 
          style={{ 
            position: 'relative',
            opacity: isNavigating ? 0.6 : 1,
            transition: 'opacity 100ms ease-out'
          }}
        >
          <div 
          ref={stripesContainerRef}
          className={`opennem-stripes-viz ${isDragging ? 'is-dragging' : ''}`}
          style={{ 
            userSelect: 'none'
          }}
          onMouseEnter={() => { isMouseOverStripes.current = true; }}
          onMouseOut={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              isMouseOverStripes.current = false;
              hideUnifiedTooltip();
              const hoverLines = document.querySelectorAll('.opennem-hover-line');
              hoverLines.forEach(line => {
                (line as HTMLElement).style.display = 'none';
              });
            }
          }}
        >
          {regionsWithData.map((region) => {
            // TEMPORARY: Only render NSW for testing
            if (region.name !== 'New South Wales') return null;
            
            return (
            <div key={region.name} className="opennem-region">
              <div className="opennem-region-header">
                {region.name}
              </div>
              <div className="opennem-region-content">
                {/* Group units by facility */}
                {Object.entries(
                  region.units.reduce((facilities, unit) => {
                    if (!facilities[unit.facility_name]) {
                      facilities[unit.facility_name] = [];
                    }
                    facilities[unit.facility_name].push(unit);
                    return facilities;
                  }, {} as Record<string, GeneratingUnitDTO[]>)
                ).map(([facilityName, facilityUnits], facilityIndex) => {
                  // Check if this is the very first facility
                  const isFirstFacility = region.name === regionsWithData[0].name && facilityIndex === 0;
                  
                  // Only render the first facility for testing
                  if (!isFirstFacility) return null;
                  
                  // Calculate row heights for all units in this facility
                  const rowHeights = facilityUnits.map(unit => {
                    const minHeight = useShortLabels ? 16 : 12;
                    return Math.max(minHeight, Math.min(40, unit.capacity / 30));
                  });
                  
                  // Set unit heights in TileManager
                  if (tileManagerRef.current) {
                    tileManagerRef.current.setUnitHeights(facilityName, rowHeights);
                  }
                  
                  return (
                    <div key={facilityName} className="opennem-facility-group">
                      <div className="opennem-stripe-row" style={{ display: 'flex' }}>
                        <div className="opennem-facility-label">
                          {!useShortLabels ? facilityName : ''}
                        </div>
                        <div 
                          ref={isFirstFacility ? firstFacilityRef : undefined}
                          className="opennem-stripe-data"
                          tabIndex={isFirstFacility ? 0 : undefined}
                          style={isFirstFacility ? { cursor: isDragging ? 'grabbing' : 'grab' } : {}}
                          onFocus={isFirstFacility ? () => setIsFirstFacilityFocused(true) : undefined}
                          onBlur={isFirstFacility ? () => setIsFirstFacilityFocused(false) : undefined}
                          onMouseDown={isFirstFacility ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.detail > 1) {
                            e.preventDefault();
                          }
                          // Focus the element when clicking
                          if (firstFacilityRef.current) {
                            firstFacilityRef.current.focus();
                          }
                          onDragStart(e.clientX);
                        } : undefined}
                        onTouchStart={isFirstFacility ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const touch = e.touches[0];
                          onDragStart(touch.clientX);
                        } : undefined}
                      >
                        <div className="opennem-stripe-data-inner">
                          {/* Mobile facility name overlay */}
                          {useShortLabels && (
                            <div className="opennem-mobile-facility-overlay">
                              {facilityName}
                            </div>
                          )}
                          
                          {currentDateRange && tileManagerRef.current && (
                            <TileViewport
                              facilityName={facilityName}
                              tileManager={tileManagerRef.current}
                              dates={dates}
                              unitHeights={rowHeights}
                              startYear={currentDateRange.start.year}
                              endYear={currentDateRange.end.year}
                            />
                          )}
                          
                          {/* Red vertical line on hover - only for first facility */}
                          {isFirstFacility && (
                            <div
                              className="opennem-hover-line"
                              style={{
                                display: 'none',
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                pointerEvents: 'none'
                              }}
                            />
                          )}
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* X-axis with month labels */}
                <div className="opennem-region-x-axis">
                  <div className="opennem-region-x-axis-inner">
                    {getMonthLabels(dates, region.units, data, useShortLabels).map((month) => (
                      <div
                        key={month.monthYear}
                        className="opennem-month-label"
                        style={{ 
                          backgroundColor: getCoalProportionColor(month.avgCapacityFactor),
                          width: `${month.width}%`,
                          left: `${month.startPosition}%`
                        }}
                      onMouseEnter={() => {
                        isMouseOverMonth.current = true;
                      }}
                      onMouseMove={(e) => {
                        isMouseOverMonth.current = true;
                        const rect = e.currentTarget.getBoundingClientRect();
                        updateMonthTooltip({
                          monthYear: month.monthYear,
                          avgCapacityFactor: month.avgCapacityFactor,
                          region: region.name,
                          x: e.clientX,
                          y: rect.top
                        });
                      }}
                      onMouseLeave={() => {
                        isMouseOverMonth.current = false;
                        hideUnifiedTooltip();
                      }}
                    >
                      {month.label}
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            </div>
          );
          })}
        </div>

        </div>
      </div>
    </>
  );
}