import React from 'react';
import { CalendarDate } from '@internationalized/date';

interface DateRangeProps {
  dateRange: { start: CalendarDate; end: CalendarDate } | null;
}

export function DateRange({ dateRange }: DateRangeProps) {
  if (!dateRange) return <span>Loading...</span>;
  
  const format = (date: CalendarDate) => 
    date.toDate('Australia/Brisbane').toLocaleDateString('en-AU', { 
      day: 'numeric',
      month: 'long', 
      year: 'numeric',
      timeZone: 'Australia/Brisbane'
    });
  
  return (
    <div className="opennem-date-range">
      {format(dateRange.start)} – {format(dateRange.end)}
    </div>
  );
}