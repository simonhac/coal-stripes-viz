'use client';

import React from 'react';
import { CalendarDate } from '@internationalized/date';
import { yearDataVendor, calculateAverageCapacityFactor, getRegionNames } from '@/client/year-data-vendor';
import { useTouchAsHover } from '@/hooks/useTouchAsHover';

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
        
        // Broadcast the tooltip data
        const event = new CustomEvent('tooltip-data-hover', { 
          detail: tooltipData
        });
        window.dispatchEvent(event);
      }
    }
  };
  
  const handleMouseEnter = () => sendTooltipData(false);
  const handleClick = () => sendTooltipData(true);

  // Touch handlers - treat as click for labels
  const touchHandlers = useTouchAsHover({
    onHoverStart: () => sendTooltipData(true), // Send pinned tooltip on touch
    onHoverMove: () => {}, // No need to update on move for labels
    onHoverEnd: () => {} // Don't end on touch release since it's pinned
  });

  return (
    <div 
      className="opennem-region-label"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => {
        // Broadcast hover end
        const event = new CustomEvent('tooltip-data-hover-end');
        window.dispatchEvent(event);
      }}
      onClick={handleClick}
      {...touchHandlers}
    >
      {regionName}
    </div>
  );
}