import React from 'react';
import { CalendarDate } from '@internationalized/date';
import { getMonthName } from '@/shared/date-utils';

interface DateRangeProps {
  dateRange: { start: CalendarDate; end: CalendarDate } | null;
}

export function DateRange({ dateRange }: DateRangeProps) {
  if (!dateRange) return <span>Loading...</span>;
  
  const format = (date: CalendarDate) => {
    return `${date.day} ${getMonthName(date)} ${date.year}`;
  };
  
  return (
    <div className="opennem-date-range">
      {format(dateRange.start)} – {format(dateRange.end)}
    </div>
  );
}