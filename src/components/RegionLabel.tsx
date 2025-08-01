'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CalendarDate } from '@internationalized/date';
import { yearDataVendor, calculateAverageCapacityFactor, getRegionNames } from '@/client/year-data-vendor';

interface RegionLabelProps {
  regionCode: string;
  dateRange: { start: CalendarDate; end: CalendarDate };
  isMobile: boolean;
}

export function RegionLabel({
  regionCode,
  dateRange,
  isMobile
}: RegionLabelProps) {
  const regionNames = getRegionNames(regionCode);
  const regionName = regionNames.long;
  const [isPinned, setIsPinned] = useState(false);
  const touchHandledRef = useRef(false);

  // Listen for tooltip events to track if this region is pinned
  useEffect(() => {
    const handleTooltipUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail;
      
      // Check if this region is the one that's pinned
      if (data && data.regionCode === regionCode && data.tooltipType === 'period' && !data.facilityCode) {
        console.log(`RegionLabel ${regionCode}: Setting isPinned to ${data.pinned || false}`);
        setIsPinned(data.pinned || false);
      } else if (data) {
        // Another tooltip is active, so this one is not pinned
        console.log(`RegionLabel ${regionCode}: Another tooltip active, setting isPinned to false`);
        setIsPinned(false);
      }
    };

    const handleTooltipEnd = () => {
      console.log(`RegionLabel ${regionCode}: Tooltip end event, setting isPinned to false`);
      setIsPinned(false);
    };

    window.addEventListener('tooltip-data-hover', handleTooltipUpdate);
    window.addEventListener('tooltip-data-hover-end', handleTooltipEnd);

    return () => {
      window.removeEventListener('tooltip-data-hover', handleTooltipUpdate);
      window.removeEventListener('tooltip-data-hover-end', handleTooltipEnd);
    };
  }, [regionCode]);
  
  const sendTooltipData = (pinned: boolean = false) => {
    if (dateRange) {
      const stats = yearDataVendor.calculateRegionStats(regionCode, dateRange);
      const avgCapacityFactor = calculateAverageCapacityFactor(stats);
      if (avgCapacityFactor !== null) {
        // Use short name for tooltip on mobile
        const tooltipLabel = isMobile 
          ? regionNames.short 
          : regionNames.long;
          
        const tooltipData = {
          startDate: dateRange.start,
          endDate: dateRange.end,
          label: tooltipLabel,
          capacityFactor: avgCapacityFactor,
          tooltipType: 'period' as const,
          regionCode: regionCode,
          pinned
        };
        
        console.log(`RegionLabel ${regionCode}: Sending tooltip data with pinned=${pinned}`);
        // Broadcast the tooltip data
        const event = new CustomEvent('tooltip-data-hover', { 
          detail: tooltipData
        });
        window.dispatchEvent(event);
      }
    }
  };
  
  const handleMouseEnter = () => {
    // Don't send hover tooltip if already pinned
    if (!isPinned) {
      sendTooltipData(false);
    }
  };
  const handleClick = () => {
    // Ignore click if touch was just handled
    if (touchHandledRef.current) {
      console.log(`RegionLabel ${regionCode}: Ignoring click after touch`);
      touchHandledRef.current = false;
      return;
    }
    
    console.log(`RegionLabel ${regionCode}: Click handler, isPinned=${isPinned}`);
    if (isPinned) {
      // If already pinned, send hover-end event to unpin
      console.log(`RegionLabel ${regionCode}: Sending tooltip-data-hover-end event to unpin`);
      setIsPinned(false); // Update local state immediately
      const event = new CustomEvent('tooltip-data-hover-end');
      window.dispatchEvent(event);
    } else {
      // Pin the tooltip
      console.log(`RegionLabel ${regionCode}: Pinning tooltip`);
      setIsPinned(true); // Update local state immediately
      sendTooltipData(true);
    }
  };

  // For labels, we want touch to trigger click behavior
  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevent the default touch behavior but allow click to fire
    e.stopPropagation();
    
    // Set flag to ignore the subsequent click event
    touchHandledRef.current = true;
    
    // Touch on labels should immediately trigger the same as click
    console.log(`RegionLabel ${regionCode}: Touch start, isPinned=${isPinned}`);
    if (isPinned) {
      // If already pinned, send hover-end event to unpin
      console.log(`RegionLabel ${regionCode}: Sending tooltip-data-hover-end event to unpin (touch)`);
      setIsPinned(false); // Update local state immediately
      const event = new CustomEvent('tooltip-data-hover-end');
      window.dispatchEvent(event);
    } else {
      // Pin the tooltip
      console.log(`RegionLabel ${regionCode}: Pinning tooltip (touch)`);
      setIsPinned(true); // Update local state immediately
      sendTooltipData(true);
    }
  };

  return (
    <div 
      className="opennem-region-label"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => {
        // Only send hover-end if not pinned
        if (!isPinned) {
          const event = new CustomEvent('tooltip-data-hover-end');
          window.dispatchEvent(event);
        }
      }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
    >
      {regionName}
    </div>
  );
}