import React, { useEffect, useRef, memo, useMemo } from 'react';
import { CoalUnit } from '@/shared/types';
import { perfMonitor } from '@/shared/performance-monitor';

interface FacilityCanvasProps {
  facilityName: string;
  units: CoalUnit[];
  dates: string[];
  rowHeights: number[]; // Height for each unit
  useShortLabels: boolean;
  onUnitHover?: (unitIndex: number | null, dateIndex: number | null, pixelX?: number, stripeWidth?: number) => void;
}

// Pre-calculate colors for all possible capacity factors
const COLOR_CACHE = new Map<number | null, string>();

function getCoalProportionColor(capacityFactor: number | null): string {
  if (COLOR_CACHE.has(capacityFactor)) {
    return COLOR_CACHE.get(capacityFactor)!;
  }

  let color: string;
  if (capacityFactor === null || capacityFactor === undefined) {
    color = '#e6f3ff';
  } else if (capacityFactor < 25) {
    color = '#ef4444';
  } else {
    const clampedCapacity = Math.min(100, Math.max(25, capacityFactor));
    const greyValue = Math.round(255 * (1 - clampedCapacity / 100));
    color = `rgb(${greyValue}, ${greyValue}, ${greyValue})`;
  }

  COLOR_CACHE.set(capacityFactor, color);
  return color;
}

export const FacilityCanvas = memo(({ 
  facilityName,
  units, 
  dates, 
  rowHeights,
  useShortLabels,
  onUnitHover
}: FacilityCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastHoveredUnit = useRef<number | null>(null);
  const lastHoveredDate = useRef<number | null>(null);
  
  // Calculate total height
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0);
  
  // Pre-calculate unit Y offsets
  const unitOffsets = useMemo(() => {
    const offsets: number[] = [0];
    for (let i = 0; i < rowHeights.length - 1; i++) {
      offsets.push(offsets[i] + rowHeights[i]);
    }
    return offsets;
  }, [rowHeights]);
  
  // Create data fingerprint for memoization
  const dataFingerprint = useMemo(() => {
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const unitHashes = units.map(u => 
      `${u.duid}-${u.history.start}-${u.history.last}-${u.history.data.length}`
    ).join('|');
    return `${facilityName}-${firstDate}-${lastDate}-${totalHeight}-${unitHashes}`;
  }, [facilityName, dates, units, totalHeight]);
  
  // Main render function
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    perfMonitor.start('facility_canvas_render', { facility: facilityName, units: units.length });
    
    // Get actual width from parent container
    const rect = canvas.getBoundingClientRect();
    const parent = canvas.parentElement;
    const parentRect = parent?.getBoundingClientRect();
    const width = parentRect?.width || rect.width || 1000;
    
    
    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = '100%';
    canvas.style.height = `${totalHeight}px`;
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, totalHeight);
    
    // Calculate stripe width
    const stripeWidth = width / dates.length;
    
    // Draw each unit's stripes
    units.forEach((unit, unitIndex) => {
      const yOffset = unitOffsets[unitIndex];
      const height = rowHeights[unitIndex];
      
      // Draw stripes for this unit
      dates.forEach((date, dateIndex) => {
        // Find the data index for this date
        const dataStartDate = unit.history.start;
        const dataEndDate = unit.history.last;
        
        // Check if this date is within the available data range
        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const dataStartObj = new Date(dataStartDate);
        const dataEndObj = new Date(dataEndDate);
        
        let capacityFactor = null;
        
        // Only try to get data if the date is within the available range
        if (dateObj >= dataStartObj && dateObj <= dataEndObj) {
          // Calculate the offset from the data start date
          const daysDiff = Math.floor((dateObj.getTime() - dataStartObj.getTime()) / (1000 * 60 * 60 * 24));
          
          // Get the capacity factor
          if (daysDiff >= 0 && daysDiff < unit.history.data.length) {
            capacityFactor = unit.history.data[daysDiff];
          }
        }
        
        const color = getCoalProportionColor(capacityFactor);
        
        ctx.fillStyle = color;
        ctx.fillRect(
          Math.floor(dateIndex * stripeWidth), 
          yOffset,
          Math.ceil(stripeWidth) + 1, // +1 to prevent gaps
          height
        );
      });
      
      // Draw unit separator line (subtle)
      if (unitIndex < units.length - 1) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, yOffset + height);
        ctx.lineTo(width, yOffset + height);
        ctx.stroke();
      }
    });
    
    perfMonitor.end('facility_canvas_render');
  }, [dataFingerprint, units, dates, rowHeights, unitOffsets, totalHeight]);
  
  // Handle mouse interactions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onUnitHover) return; // Only add listeners if hover callback is provided
    
    let rafId: number | null = null;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      
      rafId = requestAnimationFrame(() => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate which unit (row) we're hovering
        let hoveredUnit: number | null = null;
        for (let i = 0; i < unitOffsets.length; i++) {
          if (y >= unitOffsets[i] && y < (unitOffsets[i] + rowHeights[i])) {
            hoveredUnit = i;
            break;
          }
        }
        
        // Calculate which date (column) we're hovering
        const stripeWidth = rect.width / dates.length;
        const dateIndex = Math.floor(x / stripeWidth);
        const hoveredDate = dateIndex >= 0 && dateIndex < dates.length ? dateIndex : null;
        
        // Only fire callback if something changed and callback exists
        if (onUnitHover && (hoveredUnit !== lastHoveredUnit.current || hoveredDate !== lastHoveredDate.current)) {
          lastHoveredUnit.current = hoveredUnit;
          lastHoveredDate.current = hoveredDate;
          
          if (hoveredUnit !== null && hoveredDate !== null) {
            const pixelX = hoveredDate * stripeWidth + stripeWidth / 2;
            onUnitHover(hoveredUnit, hoveredDate, pixelX, stripeWidth);
          } else {
            onUnitHover(null, null);
          }
        }
        
        // Update tooltip directly for performance
        if (hoveredUnit !== null && hoveredDate !== null) {
          const unit = units[hoveredUnit];
          const dateStr = dates[hoveredDate];
          
          // Calculate the correct data index for this date
          const historyStartDate = new Date(unit.history.start);
          const historyEndDate = new Date(unit.history.last);
          const currentDate = new Date(dateStr);
          
          let capacityFactor = null;
          
          // Only try to get data if the date is within the available range
          if (currentDate >= historyStartDate && currentDate <= historyEndDate) {
            const daysDiff = Math.floor((currentDate.getTime() - historyStartDate.getTime()) / (1000 * 60 * 60 * 24));
            
            // Get the capacity factor for this date
            if (daysDiff >= 0 && daysDiff < unit.history.data.length) {
              capacityFactor = unit.history.data[daysDiff];
            }
          }
          
          updateTooltip({
            date: dateStr,
            unit: unit.duid,
            facility: facilityName,
            capacityFactor,
            x: e.clientX,
            y: rect.top + unitOffsets[hoveredUnit] + rowHeights[hoveredUnit] / 2
          });
        }
      });
    };
    
    const handleMouseLeave = () => {
      if (rafId) cancelAnimationFrame(rafId);
      lastHoveredUnit.current = null;
      lastHoveredDate.current = null;
      if (onUnitHover) {
        onUnitHover(null, null);
        hideTooltip();
      }
    };
    
    canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [units, dates, unitOffsets, rowHeights, onUnitHover, facilityName]);
  
  return (
    <canvas
      ref={canvasRef}
      className="opennem-facility-canvas"
      style={{ 
        display: 'block',
        width: '100%',
        height: totalHeight,
        cursor: onUnitHover ? 'pointer' : 'default'
      }}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - re-render when date range changes
  return (
    prevProps.facilityName === nextProps.facilityName &&
    prevProps.units.length === nextProps.units.length &&
    prevProps.dates.length === nextProps.dates.length &&
    prevProps.dates[0] === nextProps.dates[0] &&
    prevProps.dates[prevProps.dates.length - 1] === nextProps.dates[nextProps.dates.length - 1] &&
    prevProps.rowHeights.join(',') === nextProps.rowHeights.join(',') &&
    prevProps.units.every((u, i) => u.duid === nextProps.units[i].duid)
  );
});

// Helper functions for tooltip
function updateTooltip(data: any) {
  let tooltip = document.getElementById('unified-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'unified-tooltip';
    tooltip.className = 'opennem-tooltip';
    document.body.appendChild(tooltip);
  }

  const [year, month, day] = data.date.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const formattedDate = date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Australia/Brisbane'
  });

  const getCapacityText = (cf: number | null) => {
    if (cf === null) return 'No data';
    if (cf < 1) return 'Offline';
    if (cf < 25) return `${cf.toFixed(1)}% (Low)`;
    return `${cf.toFixed(1)}%`;
  };

  tooltip.innerHTML = `
    <div class="opennem-tooltip-date">${formattedDate}</div>
    <div class="opennem-tooltip-facility">${data.facility}: ${data.unit}</div>
    <div class="opennem-tooltip-value">
      ${getCapacityText(data.capacityFactor)}
    </div>
  `;

  // Position tooltip
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
}

function hideTooltip() {
  const tooltip = document.getElementById('unified-tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}