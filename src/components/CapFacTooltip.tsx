import React from 'react';
import { CalendarDate } from '@internationalized/date';

export interface TooltipData {
  date: CalendarDate;
  label: string;
  capacityFactor: number | null;
  isRegion?: boolean;
}

interface CapFacTooltipProps {
  data: TooltipData | null;
}

export function CapFacTooltip({ data }: CapFacTooltipProps) {
  if (!data) {
    return <div className="hover-date-value" style={{ visibility: 'hidden' }}></div>;
  }

  const formattedDate = data.isRegion 
    ? data.date.toDate('Australia/Brisbane').toLocaleDateString('en-AU', {
        month: 'short',
        year: 'numeric',
        timeZone: 'Australia/Brisbane'
      })
    : data.date.toDate('Australia/Brisbane').toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Australia/Brisbane'
      });

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