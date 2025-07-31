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
  const handleMouseEnter = () => {
    const stats = yearDataVendor.calculateFacilityStats(regionCode, facilityCode, dateRange);
    const avgCapacityFactor = calculateAverageCapacityFactor(stats);
    if (avgCapacityFactor !== null) {
      const tooltipData = {
        startDate: dateRange.start,
        endDate: dateRange.end,
        label: facilityName,
        capacityFactor: avgCapacityFactor,
        tooltipType: 'period',
        regionCode: regionCode,
        facilityCode: facilityCode
      };
      
      // Broadcast the tooltip data
      const event = new CustomEvent('tooltip-data-hover', { 
        detail: tooltipData
      });
      window.dispatchEvent(event);
    }
  };

  return (
    <div 
      className="opennem-facility-label"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => {
        // Broadcast hover end
        const event = new CustomEvent('tooltip-data-hover-end');
        window.dispatchEvent(event);
      }}
    >
      {facilityName}
    </div>
  );
}