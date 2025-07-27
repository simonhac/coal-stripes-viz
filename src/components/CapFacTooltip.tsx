import { useEffect } from 'react';
import { CalendarDate } from '@internationalized/date';

export interface TooltipData {
  date: CalendarDate;
  facilityName: string;
  unitName: string;
  capacityFactor: number | null;
  x: number;
  y: number;
}

interface CapFacTooltipProps {
  data: TooltipData | null;
}

export function CapFacTooltip({ data }: CapFacTooltipProps) {
  useEffect(() => {
    let tooltip = document.getElementById('unified-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'unified-tooltip';
      tooltip.className = 'opennem-tooltip';
      document.body.appendChild(tooltip);
    }

    if (!data) {
      tooltip.style.display = 'none';
      return;
    }

    const formattedDate = data.date.toDate('Australia/Brisbane').toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Australia/Brisbane'
    });

    const getCapacityText = (capacityFactor: number | null) => {
      if (capacityFactor === null) return 'No data';
      if (capacityFactor < 1) return 'Offline';
      if (capacityFactor < 25) return `${capacityFactor.toFixed(1)}% (Low)`;
      return `${capacityFactor.toFixed(1)}%`;
    };

    tooltip.innerHTML = `
      <div class="opennem-tooltip-date">${formattedDate}</div>
      <div class="opennem-tooltip-facility">${data.facilityName}: ${data.unitName}</div>
      <div class="opennem-tooltip-value">
        ${getCapacityText(data.capacityFactor)}
      </div>
    `;

    const viewportWidth = window.innerWidth;
    const margin = 5;
    const tooltipWidth = 150;

    let left = data.x;
    let transform = 'translate(-50%, -100%)';

    if (data.x + (tooltipWidth / 2) > viewportWidth - margin) {
      left = viewportWidth - tooltipWidth - margin;
      transform = 'translateY(-100%)';
    }

    if (data.x - (tooltipWidth / 2) < margin) {
      left = margin;
      transform = 'translateY(-100%)';
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = (data.y - 10) + 'px';
    tooltip.style.transform = transform;
    tooltip.style.display = 'block';
    tooltip.style.opacity = '1';
  }, [data]);

  return null; // This component manages a DOM element directly
}