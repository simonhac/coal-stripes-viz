'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { CalendarDate } from '@internationalized/date';
import { CompositeTile } from './CompositeTile';
import { CapFacTooltip, TooltipData } from './CapFacTooltip';
import { CapFacXAxis } from './CapFacXAxis';
import { FacilityLabel } from './FacilityLabel';
import { RegionLabel } from './RegionLabel';

interface RegionSectionProps {
  regionCode: string;
  regionName: string;
  facilities: { code: string; name: string }[];
  endDate: CalendarDate;
  animatedDateRange: { start: CalendarDate; end: CalendarDate } | null;
  onMonthClick: (year: number, month: number) => void;
  hoveredDate: CalendarDate | null;
  onHoveredDateChange: (date: CalendarDate | null) => void;
}

export function RegionSection({
  regionCode,
  regionName,
  facilities,
  endDate,
  animatedDateRange,
  onMonthClick,
  hoveredDate,
  onHoveredDateChange
}: RegionSectionProps) {
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  
  // Listen for facility hover events from CompositeTile
  useEffect(() => {
    const handleFacilityHover = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail;
      
      // Listen to ALL hover events, not just from this region
      if (data) {
        console.log(`Region ${regionCode} received hover event from ${data.regionCode}:`, data);
        
        // For now, just update the hovered date for cross-region display
        if (data.date || data.startDate) {
          onHoveredDateChange(data.date || data.startDate);
        }
      }
    };
    
    const handleFacilityHoverEnd = () => {
      // console.log(`Region ${regionCode} received hover end`);
      onHoveredDateChange(null);
    };
    
    window.addEventListener('tooltip-data-hover', handleFacilityHover);
    window.addEventListener('tooltip-data-hover-end', handleFacilityHoverEnd);
    
    return () => {
      window.removeEventListener('tooltip-data-hover', handleFacilityHover);
      window.removeEventListener('tooltip-data-hover-end', handleFacilityHoverEnd);
    };
  }, [regionCode, onHoveredDateChange]);
  
  // Handle hover events from different sources and mediate them
  const handleHover = useCallback((data: TooltipData) => {
    console.log(`${regionCode} useCallback hover event (${data.tooltipType}):`, data);
    
    // Always update the tooltip
    setTooltipData(data);
  }, []);
  
  const handleHoverEnd = useCallback(() => {
    setTooltipData(null);
  }, []);
  
  return (
    <div key={regionCode} className="opennem-region">
      <div className="opennem-region-header">
        {animatedDateRange ? (
          <RegionLabel
            regionCode={regionCode}
            regionName={regionName}
            dateRange={animatedDateRange}
            onHover={handleHover}
            onHoverEnd={handleHoverEnd}
            hoveredDate={hoveredDate}
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
                    onHover={handleHover}
                    onHoverEnd={handleHoverEnd}
                  />
                  <CompositeTile
                    endDate={endDate}
                    facilityCode={facility.code}
                    facilityName={facility.name}
                    regionCode={regionCode}
                    animatedDateRange={animatedDateRange}
                    onHover={handleHover}
                    onHoverEnd={handleHoverEnd}
                    minCanvasHeight={25}
                  />
                </div>
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