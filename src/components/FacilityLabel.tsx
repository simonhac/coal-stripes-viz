'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CalendarDate } from '@internationalized/date';
import { yearDataVendor, calculateAverageCapacityFactor } from '@/client/year-data-vendor';

interface FacilityLabelProps {
  facilityCode: string;
  facilityName: string;
  regionCode: string;
  dateRange: { start: CalendarDate; end: CalendarDate };
}

export function FacilityLabel({
  facilityCode,
  facilityName,
  regionCode,
  dateRange
}: FacilityLabelProps) {
  const [isPinned, setIsPinned] = useState(false);
  const touchHandledRef = useRef(false);

  // Listen for tooltip events to track if this facility is pinned
  useEffect(() => {
    const handleTooltipUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail;
      
      // Check if this facility is the one that's pinned
      if (data && data.facilityCode === facilityCode && data.regionCode === regionCode) {
        console.log(`FacilityLabel ${facilityCode}: Setting isPinned to ${data.pinned || false}`);
        setIsPinned(data.pinned || false);
      } else if (data) {
        // Another tooltip is active, so this one is not pinned
        console.log(`FacilityLabel ${facilityCode}: Another tooltip active, setting isPinned to false`);
        setIsPinned(false);
      }
    };

    const handleTooltipEnd = () => {
      console.log(`FacilityLabel ${facilityCode}: Tooltip end event, setting isPinned to false`);
      setIsPinned(false);
    };

    window.addEventListener('tooltip-data-hover', handleTooltipUpdate);
    window.addEventListener('tooltip-data-hover-end', handleTooltipEnd);

    return () => {
      window.removeEventListener('tooltip-data-hover', handleTooltipUpdate);
      window.removeEventListener('tooltip-data-hover-end', handleTooltipEnd);
    };
  }, [facilityCode, regionCode]);

  const sendTooltipData = (pinned: boolean = false) => {
    const stats = yearDataVendor.calculateFacilityStats(regionCode, facilityCode, dateRange);
    const avgCapacityFactor = calculateAverageCapacityFactor(stats);
    if (avgCapacityFactor !== null) {
      const tooltipData = {
        startDate: dateRange.start,
        endDate: dateRange.end,
        label: facilityName,
        capacityFactor: avgCapacityFactor,
        tooltipType: 'period' as const,
        regionCode: regionCode,
        facilityCode: facilityCode,
        pinned
      };
      
      // Broadcast the tooltip data
      const event = new CustomEvent('tooltip-data-hover', { 
        detail: tooltipData
      });
      window.dispatchEvent(event);
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
      console.log(`FacilityLabel ${facilityCode}: Ignoring click after touch`);
      touchHandledRef.current = false;
      return;
    }
    
    console.log(`FacilityLabel ${facilityCode}: Click handler, isPinned=${isPinned}`);
    if (isPinned) {
      // If already pinned, send hover-end event to unpin
      console.log(`FacilityLabel ${facilityCode}: Sending tooltip-data-hover-end event to unpin`);
      setIsPinned(false); // Update local state immediately
      const event = new CustomEvent('tooltip-data-hover-end');
      window.dispatchEvent(event);
    } else {
      // Pin the tooltip
      console.log(`FacilityLabel ${facilityCode}: Pinning tooltip`);
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
    console.log(`FacilityLabel ${facilityCode}: Touch start, isPinned=${isPinned}`);
    if (isPinned) {
      // If already pinned, send hover-end event to unpin
      console.log(`FacilityLabel ${facilityCode}: Sending tooltip-data-hover-end event to unpin (touch)`);
      setIsPinned(false); // Update local state immediately
      const event = new CustomEvent('tooltip-data-hover-end');
      window.dispatchEvent(event);
    } else {
      // Pin the tooltip
      console.log(`FacilityLabel ${facilityCode}: Pinning tooltip (touch)`);
      setIsPinned(true); // Update local state immediately
      sendTooltipData(true);
    }
  };

  return (
    <div 
      className="opennem-facility-label"
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
      {facilityName}
    </div>
  );
}