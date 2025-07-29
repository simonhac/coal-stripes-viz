import React from 'react';
import { CalendarDate } from '@internationalized/date';

interface DateRangeProps {
  dateRange: { start: CalendarDate; end: CalendarDate } | null;
}

export function DateRange({ dateRange }: DateRangeProps) {
  if (!dateRange) return <span>Loading...</span>;
  
  const format = (date: CalendarDate) => {
    const jsDate = date.toDate('Australia/Brisbane');
    const day = jsDate.getDate();
    const year = jsDate.getFullYear();
    const monthName = jsDate.toLocaleDateString('en-AU', { 
      month: 'short',
      timeZone: 'Australia/Brisbane'
    });
    // Ensure exactly 3 letters for month (fixes "Sept" -> "Sep")
    const shortMonth = monthName.substring(0, 3);
    return `${day} ${shortMonth} ${year}`;
  };
  
  return (
    <div className="opennem-date-range">
      {format(dateRange.start)} – {format(dateRange.end)}
    </div>
  );
}