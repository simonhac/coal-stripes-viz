'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { CalendarDate } from '@internationalized/date';
import { CompositeTile } from './CompositeTile';
import { CapFacTooltip, TooltipData, getTooltipFormattedDate } from './CapFacTooltip';
import { CapFacXAxis } from './CapFacXAxis';
import { FacilityLabel } from './FacilityLabel';
import { RegionLabel } from './RegionLabel';
import { getMonthName } from '@/shared/date-utils';

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
  
  // Debug helper to format tooltip data
  const formatTooltipDebug = (data: TooltipData): string => {
    // Format date
    const dateStr = getTooltipFormattedDate(data);
    
    // Build identifier
    const network = data.network || '';
    const region = data.regionCode;
    const facility = data.facilityCode || '';
    const unit = data.unitName || '';
    const parts = [network, region, facility, unit].filter(p => p);
    const identifier = parts.length > 0 ? parts.join('.') : data.label;
    
    // Format capacity factor
    const cf = data.capacityFactor !== null 
      ? `${data.capacityFactor.toFixed(1)}%` 
      : '—';
    
    return `${dateStr} ${identifier} ${cf}`.trim();
  };
  
  // Listen for ALL tooltip hover events
  useEffect(() => {
    const handleTooltipHover = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail as TooltipData;
      
      if (data) {
        // Check if hover is from our region or another region
        if (data.regionCode === regionCode) {
          console.log(`${regionCode} got hover: ${formatTooltipDebug(data)}`);
          setTooltipData(data);
        } else {
          console.log(`${regionCode} got ${data.regionCode}'s update`);
        }
        
      }
    };
    
    const handleTooltipHoverEnd = () => {
      // Clear tooltip for this region
      setTooltipData(null);
    };
    
    window.addEventListener('tooltip-data-hover', handleTooltipHover);
    window.addEventListener('tooltip-data-hover-end', handleTooltipHoverEnd);
    
    return () => {
      window.removeEventListener('tooltip-data-hover', handleTooltipHover);
      window.removeEventListener('tooltip-data-hover-end', handleTooltipHoverEnd);
    };
  }, [regionCode]);
  
  return (
    <div key={regionCode} className="opennem-region">
      <div className="opennem-region-header">
        {animatedDateRange ? (
          <RegionLabel
            regionCode={regionCode}
            regionName={regionName}
            dateRange={animatedDateRange}
          />
        ) : (
          <span>{regionName}</span>
        )}
        <CapFacTooltip data={tooltipData} />
      </div>
      <div className="opennem-region-content">
        {/* Display tiles */}
        {animatedDateRange && (
          <div className="opennem-facility-group">
            {/* Display all facilities for this region */}
            {facilities.map(facility => {
              return (
                <div key={facility.code} className="opennem-stripe-row" style={{ display: 'flex' }}>
                  <FacilityLabel
                    facilityCode={facility.code}
                    facilityName={facility.name}
                    regionCode={regionCode}
                    dateRange={animatedDateRange}
                  />
                  <CompositeTile
                    endDate={endDate}
                    facilityCode={facility.code}
                    facilityName={facility.name}
                    regionCode={regionCode}
                    animatedDateRange={animatedDateRange}
                    minCanvasHeight={25}
                  />
                </div>
              );
            })}
            
            <CapFacXAxis 
              dateRange={animatedDateRange}
              regionCode={regionCode}
              regionName={regionName}
              onMonthClick={onMonthClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}