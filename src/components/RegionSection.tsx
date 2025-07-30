'use client';

import React, { useState, useCallback, useRef } from 'react';
import { CalendarDate } from '@internationalized/date';
import { CompositeTile, CompositeTileRef } from './CompositeTile';
import { CapFacTooltip, TooltipData } from './CapFacTooltip';
import { CapFacXAxis } from './CapFacXAxis';

interface RegionSectionProps {
  regionCode: string;
  regionName: string;
  facilities: { code: string; name: string }[];
  endDate: CalendarDate;
  animatedDateRange: { start: CalendarDate; end: CalendarDate } | null;
  onMonthClick: (year: number, month: number) => void;
}

export function RegionSection({
  regionCode,
  regionName,
  facilities,
  endDate,
  animatedDateRange,
  onMonthClick
}: RegionSectionProps) {
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const tileRefs = useRef<Map<string, React.RefObject<CompositeTileRef | null>>>(new Map());
  
  // Initialize refs for facilities
  facilities.forEach(facility => {
    if (!tileRefs.current.has(facility.code)) {
      const newRef = React.createRef<CompositeTileRef>();
      tileRefs.current.set(facility.code, newRef);
    }
  });
  
  const handleHover = useCallback((data: TooltipData) => {
    setTooltipData(data);
  }, []);
  
  const handleHoverEnd = useCallback(() => {
    setTooltipData(null);
  }, []);
  
  // Calculate capacity-weighted average capacity factor for the region
  const calculateRegionAverage = useCallback(() => {
    if (!animatedDateRange) return null;
    
    let totalWeightedCapacityFactor = 0;
    let totalCapacity = 0;
    
    // Calculate weighted average across all facilities in this region
    facilities.forEach(facility => {
      const ref = tileRefs.current.get(facility.code);
      if (ref?.current) {
        const stats = ref.current.getStats();
        if (stats && stats.avgCapacityFactor !== null) {
          totalWeightedCapacityFactor += stats.avgCapacityFactor * stats.totalCapacity;
          totalCapacity += stats.totalCapacity;
        }
      }
    });
    
    return totalCapacity > 0 ? totalWeightedCapacityFactor / totalCapacity : null;
  }, [facilities, animatedDateRange]);
  
  return (
    <div key={regionCode} className="opennem-region">
      <div className="opennem-region-header">
        <span 
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => {
            if (animatedDateRange) {
              const avgCapacityFactor = calculateRegionAverage();
              if (avgCapacityFactor !== null) {
                handleHover({
                  startDate: animatedDateRange.start,
                  endDate: animatedDateRange.end,
                  label: regionName,
                  capacityFactor: avgCapacityFactor,
                  tooltipType: 'period'
                });
              }
            }
          }}
          onMouseLeave={handleHoverEnd}
        >
          {regionName}
        </span>
        <CapFacTooltip data={tooltipData} />
      </div>
      <div className="opennem-region-content">
        {/* Display tiles */}
        {animatedDateRange && (
          <div className="opennem-facility-group">
            {/* Display all facilities for this region */}
            {facilities.map(facility => {
              const ref = tileRefs.current.get(facility.code);
              if (!ref) return null; // This should never happen due to initialization above
              return (
                <CompositeTile
                  key={facility.code}
                  ref={ref}
                  endDate={endDate}
                  facilityCode={facility.code}
                  facilityName={facility.name}
                  animatedDateRange={animatedDateRange}
                  onHover={handleHover}
                  onHoverEnd={handleHoverEnd}
                  minCanvasHeight={25}
                />
              );
            })}
            
            <CapFacXAxis 
              dateRange={animatedDateRange}
              regionCode={regionCode}
              regionName={regionName}
              onHover={handleHover}
              onHoverEnd={handleHoverEnd}
              onMonthClick={onMonthClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}