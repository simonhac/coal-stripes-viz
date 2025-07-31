'use client';

import React from 'react';
import { CalendarDate } from '@internationalized/date';
import { yearDataVendor } from '@/client/year-data-vendor';

interface FacilityLabelProps {
  facilityCode: string;
  facilityName: string;
  regionCode: string;
  dateRange: { start: CalendarDate; end: CalendarDate };
  onHover?: (tooltipData: any) => void;
  onHoverEnd?: () => void;
}

export function FacilityLabel({
  facilityCode,
  facilityName,
  regionCode,
  dateRange,
  onHover,
  onHoverEnd
}: FacilityLabelProps) {
  const handleMouseEnter = () => {
    if (onHover) {
      const avgCapacityFactor = yearDataVendor.calculateFacilityAverage(regionCode, facilityCode, dateRange);
      if (avgCapacityFactor !== null) {
        onHover({
          startDate: dateRange.start,
          endDate: dateRange.end,
          label: facilityName,
          capacityFactor: avgCapacityFactor,
          tooltipType: 'period'
        });
      }
    }
  };

  return (
    <div 
      className="opennem-facility-label"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onHoverEnd}
    >
      {facilityName}
    </div>
  );
}