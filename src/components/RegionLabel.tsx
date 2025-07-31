'use client';

import React from 'react';
import { CalendarDate } from '@internationalized/date';
import { yearDataVendor, calculateAverageCapacityFactor } from '@/client/year-data-vendor';

interface RegionLabelProps {
  regionCode: string;
  regionName: string;
  dateRange: { start: CalendarDate; end: CalendarDate };
  onHover?: (tooltipData: any) => void;
  onHoverEnd?: () => void;
}

export function RegionLabel({
  regionCode,
  regionName,
  dateRange,
  onHover,
  onHoverEnd
}: RegionLabelProps) {
  const handleMouseEnter = () => {
    if (onHover && dateRange) {
      const stats = yearDataVendor.calculateRegionStats(regionCode, dateRange);
      const avgCapacityFactor = calculateAverageCapacityFactor(stats);
      if (avgCapacityFactor !== null) {
        onHover({
          startDate: dateRange.start,
          endDate: dateRange.end,
          label: regionName,
          capacityFactor: avgCapacityFactor,
          tooltipType: 'period'
        });
      }
    }
  };

  return (
    <span 
      style={{ cursor: 'pointer' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onHoverEnd}
    >
      {regionName}
    </span>
  );
}