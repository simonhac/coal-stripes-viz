import React, { useEffect, useState } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getDaysBetween } from '@/shared/date-utils';
import { getProportionColorHex } from '@/shared/capacity-factor-color-map';
import { CapFacYear } from '@/client/cap-fac-year';
import { yearDataVendor } from '@/client/year-data-vendor';

interface CapFacXAxisProps {
  dateRange: { start: CalendarDate; end: CalendarDate };
  regionCode?: string;
  onHover?: (tooltipData: any) => void;
  onHoverEnd?: () => void;
}

export function CapFacXAxis({ 
  dateRange, 
  regionCode = 'NSW1',
  onHover,
  onHoverEnd
}: CapFacXAxisProps) {
  const [yearDataMap, setYearDataMap] = useState<Map<number, CapFacYear>>(new Map());

  useEffect(() => {
    const startYear = dateRange.start.year;
    const endYear = dateRange.end.year;
    const years = startYear === endYear ? [startYear] : [startYear, endYear];
    
    // Track current request years to ignore stale responses
    const currentYears = new Set(years);
    
    // Clear data for years we no longer need
    setYearDataMap(prevMap => {
      const newMap = new Map();
      for (const [year, data] of prevMap) {
        if (currentYears.has(year)) {
          newMap.set(year, data);
        }
      }
      return newMap;
    });
    
    // Fetch year data without waiting
    years.forEach(year => {
      yearDataVendor.requestYear(year)
        .then(yearData => {
          // Ignore if we've moved to different years
          if (!currentYears.has(year)) {
            console.log(`CapFacXAxis: Ignoring stale response for year ${year}`);
            return;
          }
          
          setYearDataMap(prevMap => {
            const newMap = new Map(prevMap);
            newMap.set(yearData.year, yearData);
            return newMap;
          });
        })
        .catch(err => {
          // Ignore if we've moved to different years
          if (!currentYears.has(year)) {
            console.log(`CapFacXAxis: Ignoring stale error for year ${year}`);
            return;
          }
          
          console.error(`CapFacXAxis: Failed to load year ${year}:`, err);
        });
    });
    
    // Cleanup function to mark requests as stale
    return () => {
      currentYears.clear();
    };
  }, [dateRange]);
  const monthBars: { label: string; color: string; width: number; left: number; date: CalendarDate; capacityFactor: number | null }[] = [];
  
  let currentDate = dateRange.start;
  let currentLeft = 0;
  
  while (currentDate.compare(dateRange.end) <= 0) {
    const monthStart = currentDate;
    const year = monthStart.year;
    const month = monthStart.month;
    const monthLabel = monthStart.toDate('Australia/Brisbane').toLocaleDateString('en-AU', { 
      month: 'short',
      timeZone: 'Australia/Brisbane'
    });
    
    // Calculate month end
    let monthEnd = monthStart.set({ day: monthStart.calendar.getDaysInMonth(monthStart) });
    if (monthEnd.compare(dateRange.end) > 0) {
      monthEnd = dateRange.end;
    }
    
    // Get capacity factor for this month
    const yearData = yearDataMap.get(year);
    let capacityFactor: number | null = null;
    
    if (yearData && yearData.regionCapacityFactors.has(regionCode)) {
      const monthlyFactors = yearData.regionCapacityFactors.get(regionCode);
      if (monthlyFactors && month >= 1 && month <= 12) {
        capacityFactor = monthlyFactors[month - 1];
      }
    }
    
    // Calculate width and position in pixels (1 day = 1 pixel)
    const daysInMonth = getDaysBetween(monthStart, monthEnd) + 1;
    const width = daysInMonth;
    
    monthBars.push({
      label: monthLabel.charAt(0), // Single letter for month
      color: getProportionColorHex(capacityFactor),
      width,
      left: currentLeft,
      date: monthStart,
      capacityFactor
    });
    
    currentLeft += width;
    
    // Move to next month
    currentDate = monthStart.add({ months: 1 }).set({ day: 1 });
  }
  
  const handleMouseEnter = (month: typeof monthBars[0]) => {
    if (onHover) {
      onHover({
        date: month.date,
        label: 'New South Wales',
        capacityFactor: month.capacityFactor,
        isRegion: true
      });
    }
  };

  return (
    <div className="opennem-region-x-axis">
      <div className="opennem-region-x-axis-inner">
        {monthBars.map((month, idx) => (
          <div
            key={idx}
            className="opennem-month-label"
            style={{ 
              backgroundColor: month.color,
              width: `${month.width}px`,
              left: `${month.left}px`
            }}
            onMouseEnter={() => handleMouseEnter(month)}
            onMouseLeave={onHoverEnd}
          >
            {month.label}
          </div>
        ))}
      </div>
    </div>
  );
}