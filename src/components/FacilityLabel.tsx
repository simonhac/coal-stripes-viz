'use client';

import React from 'react';
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
  
  const handleMouseEnter = () => sendTooltipData(false);
  const handleClick = () => sendTooltipData(true);

  return (
    <div 
      className="opennem-facility-label"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => {
        // Broadcast hover end
        const event = new CustomEvent('tooltip-data-hover-end');
        window.dispatchEvent(event);
      }}
      onClick={handleClick}
    >
      {facilityName}
    </div>
  );
}