import React from 'react';
import { CalendarDate } from '@internationalized/date';
import { getDaysBetween } from '@/shared/date-utils';
import { getProportionColorHex } from '@/shared/capacity-factor-color-map';
import { CapFacYear } from '@/client/cap-fac-year';

interface CapFacXAxisProps {
  dateRange: { start: CalendarDate; end: CalendarDate };
  yearDataMap: Map<number, CapFacYear>;
  regionCode?: string;
}

export function CapFacXAxis({ 
  dateRange, 
  yearDataMap,
  regionCode = 'NSW1'
}: CapFacXAxisProps) {
  const monthBars: { label: string; color: string; width: number; left: number }[] = [];
  
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
      left: currentLeft
    });
    
    currentLeft += width;
    
    // Move to next month
    currentDate = monthStart.add({ months: 1 }).set({ day: 1 });
  }
  
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
          >
            {month.label}
          </div>
        ))}
      </div>
    </div>
  );
}