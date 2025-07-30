import React from 'react';
import { CalendarDate } from '@internationalized/date';

export interface TooltipData {
  startDate: CalendarDate;
  endDate: CalendarDate | null;
  label: string;
  capacityFactor: number | null;
  tooltipType: 'day' | 'month' | 'period';
}

interface CapFacTooltipProps {
  data: TooltipData | null;
}

export function CapFacTooltip({ data }: CapFacTooltipProps) {
  if (!data) {
    return <div className="hover-date-value" style={{ visibility: 'hidden' }}></div>;
  }

  const formatDate = () => {
    const jsStartDate = data.startDate.toDate('Australia/Brisbane');
    
    const getMonthName = (date: Date) => {
      const monthName = date.toLocaleDateString('en-AU', {
        month: 'short',
        timeZone: 'Australia/Brisbane'
      });
      // Ensure exactly 3 letters for month (fixes "Sept" -> "Sep")
      return monthName.substring(0, 3);
    };
    
    switch (data.tooltipType) {
      case 'day':
        return `${jsStartDate.getDate()} ${getMonthName(jsStartDate)} ${jsStartDate.getFullYear()}`;
      
      case 'month':
        return `${getMonthName(jsStartDate)} ${jsStartDate.getFullYear()}`;
      
      case 'period':
        if (!data.endDate) {
          throw new Error('endDate is required for period tooltip type');
        }
        const jsEndDate = data.endDate.toDate('Australia/Brisbane');
        
        // Show date range
        const startDay = jsStartDate.getDate();
        const startMonth = getMonthName(jsStartDate);
        const startYear = jsStartDate.getFullYear();
        const endDay = jsEndDate.getDate();
        const endMonth = getMonthName(jsEndDate);
        const endYear = jsEndDate.getFullYear();
        
        if (startYear === endYear && startMonth === endMonth) {
          return `${startDay}–${endDay} ${startMonth} ${startYear}`;
        } else if (startYear === endYear) {
          return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${startYear}`;
        } else {
          return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
        }
    }
  };
  
  const formattedDate = formatDate();

  const getCapacityValue = (capacityFactor: number | null) => {
    if (capacityFactor === null) return '—';
    return `${capacityFactor.toFixed(1)}%`;
  };

  return (
    <div className="hover-date-value">
      <span className="hover-date">
        <time>{formattedDate}</time>
      </span>
      <span className="hover-values">
        <span className="tooltip-icon" style={{ backgroundColor: '#333' }}></span>
        {data.label} <strong>{getCapacityValue(data.capacityFactor)}</strong>
      </span>
    </div>
  );
}