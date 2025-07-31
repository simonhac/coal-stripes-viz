'use client';

import React, { useState, useCallback } from 'react';
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
  
  const handleHover = useCallback((data: TooltipData) => {
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