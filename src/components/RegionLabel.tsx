'use client';

import React from 'react';
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
  const handleMouseEnter = () => {
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
          tooltipType: 'period',
          regionCode: regionCode
        };
        
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
        // Broadcast hover end
        const event = new CustomEvent('tooltip-data-hover-end');
        window.dispatchEvent(event);
      }}
    >
      {regionName}
    </span>
  );
}