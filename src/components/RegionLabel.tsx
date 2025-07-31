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
        const tooltipData = {
          startDate: dateRange.start,
          endDate: dateRange.end,
          label: regionName,
          capacityFactor: avgCapacityFactor,
          tooltipType: 'period',
          regionCode: regionCode
        };
        onHover(tooltipData);
        
        // Broadcast the tooltip data
        const event = new CustomEvent('tooltip-data-hover', { 
          detail: tooltipData
        });
        window.dispatchEvent(event);
      }
    }
  };

  return (
    <span 
      style={{ cursor: 'pointer' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => {
        if (onHoverEnd) onHoverEnd();
        
        // Broadcast hover end
        const event = new CustomEvent('tooltip-data-hover-end');
        window.dispatchEvent(event);
      }}
    >
      {regionName}
    </span>
  );
}