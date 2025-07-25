import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { GeneratingUnitDTO } from '@/shared/types';
import { perfMonitor } from '@/shared/performance-monitor';

interface StripeCanvasProps {
  unit: GeneratingUnitDTO;
  dates: string[];
  height: number;
  onHover?: (dateIndex: number | null, pixelX?: number, stripeWidth?: number) => void;
}

// Get color based on capacity factor
function getCoalProportionColor(capacityFactor: number | null): string {
  // Light blue for missing data
  if (capacityFactor === null || capacityFactor === undefined) return '#e6f3ff';
  
  // Red for anything under 25%
  if (capacityFactor < 25) return '#ef4444';
  
  // Map capacity factor directly to grey scale
  const clampedCapacity = Math.min(100, Math.max(25, capacityFactor));
  
  // Invert so that higher capacity = darker (lower grey value)
  const greyValue = Math.round(255 * (1 - clampedCapacity / 100));
  
  return `rgb(${greyValue}, ${greyValue}, ${greyValue})`;
}

// Global paint counter
let globalPaintCount = 0;

// Callback to notify parent of paint count changes
let paintCountCallback: ((count: number) => void) | null = null;

export const setPaintCountCallback = (callback: (count: number) => void) => {
  paintCountCallback = callback;
};

export const StripeCanvas: React.FC<StripeCanvasProps> = ({ 
  unit, 
  dates, 
  height,
  onHover
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastHoveredIndex = useRef<number | null>(null);
  const hoveredIndexRef = useRef<number | null>(null);
  const canvasWidthRef = useRef<number>(0);
  
  // Create stable data key for dependency tracking
  const dataKey = useMemo(() => {
    return `${unit.duid}-${dates.length}-${dates[0]}-${height}`;
  }, [unit.duid, dates.length, dates[0], height]);
  
  // Store props in refs to avoid recreating handlers
  const propsRef = useRef({ unit, dates, height, onHover });
  useEffect(() => {
    propsRef.current = { unit, dates, height, onHover };
  }, [unit, dates, height, onHover]);
  
  // Use native event listeners for better performance
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Define drawCanvas inside useEffect to have access to current props
    const drawCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const { unit, dates, height } = propsRef.current;
      
      // Get actual width from DOM
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      
      // Set canvas size (account for device pixel ratio)
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = '100%';
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Draw each stripe
      const stripeWidth = width / dates.length;
      
      dates.forEach((date, index) => {
        const capacityFactor = unit.history.data[index];
        const color = getCoalProportionColor(capacityFactor);
        
        ctx.fillStyle = color;
        // Draw slightly wider to prevent gaps due to rounding
        ctx.fillRect(Math.floor(index * stripeWidth), 0, Math.ceil(stripeWidth) + 1, height);
      });
      
      // Draw hover overlay if needed
      if (hoveredIndexRef.current !== null) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.fillRect(hoveredIndexRef.current * stripeWidth, 0, stripeWidth, height);
      }
    };
    
    const handleNativeMouseMove = (e: MouseEvent) => {
      perfMonitor.start('mouse_move');
      const { unit, dates, onHover } = propsRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      // Use actual canvas width from the DOM
      const actualWidth = rect.width;
      const stripeWidth = actualWidth / dates.length;
      const index = Math.floor(x / stripeWidth);
      
      if (index >= 0 && index < dates.length) {
        // Only call onHover when index changes
        if (lastHoveredIndex.current !== index) {
          perfMonitor.start('mouse_move_hover_update');
          lastHoveredIndex.current = index;
          // Pass the pixel position and stripe width
          const pixelX = index * stripeWidth + stripeWidth / 2; // Center of stripe
          onHover?.(index, pixelX, stripeWidth);
          perfMonitor.end('mouse_move_hover_update');
        }
        
        // Update tooltip directly for maximum performance
        perfMonitor.start('mouse_move_tooltip');
        const capacityFactor = unit.history.data[index];
        
        // Direct DOM manipulation for 60Hz performance
        let tooltip = document.getElementById('unified-tooltip');
        if (!tooltip) {
          tooltip = document.createElement('div');
          tooltip.id = 'unified-tooltip';
          tooltip.className = 'opennem-tooltip';
          document.body.appendChild(tooltip);
        }
        
        // Parse and format date
        const dateStr = dates[index];
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const formattedDate = date.toLocaleDateString('en-AU', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'Australia/Brisbane'
        });
        
        // Format capacity factor
        const getCapacityText = (cf: number | null) => {
          if (cf === null) return 'No data';
          if (cf < 1) return 'Offline';
          if (cf < 25) return `${cf.toFixed(1)}% (Low)`;
          return `${cf.toFixed(1)}%`;
        };
        
        // Update tooltip content
        tooltip.innerHTML = `
          <div class="opennem-tooltip-date">${formattedDate}</div>
          <div class="opennem-tooltip-facility">${unit.facility_name}: ${unit.duid}</div>
          <div class="opennem-tooltip-value">
            ${getCapacityText(capacityFactor)}
          </div>
        `;
        
        // Position tooltip
        const viewportWidth = window.innerWidth;
        const margin = 5;
        const tooltipWidth = 150;
        
        let left = e.clientX;
        let transform = 'translate(-50%, -100%)';
        
        if (e.clientX + (tooltipWidth / 2) > viewportWidth - margin) {
          left = viewportWidth - tooltipWidth - margin;
          transform = 'translateY(-100%)';
        }
        
        if (e.clientX - (tooltipWidth / 2) < margin) {
          left = margin;
          transform = 'translateY(-100%)';
        }
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = (rect.top - 10) + 'px';
        tooltip.style.transform = transform;
        tooltip.style.display = 'block';
        tooltip.style.opacity = '1';
        perfMonitor.end('mouse_move_tooltip');
      }
      perfMonitor.end('mouse_move');
    };
    
    const handleNativeMouseLeave = () => {
      const { onHover } = propsRef.current;
      lastHoveredIndex.current = null;
      onHover?.(null, 0, 0);
      
      // Hide tooltip
      const tooltip = document.getElementById('unified-tooltip');
      if (tooltip) {
        tooltip.style.display = 'none';
      }
    };
    
    canvas.addEventListener('mousemove', handleNativeMouseMove);
    canvas.addEventListener('mouseleave', handleNativeMouseLeave);
    
    return () => {
      canvas.removeEventListener('mousemove', handleNativeMouseMove);
      canvas.removeEventListener('mouseleave', handleNativeMouseLeave);
    };
  }, []);
  
  // Draw the stripes on mount and when data changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Use requestAnimationFrame to ensure DOM has rendered
    requestAnimationFrame(() => {
      perfMonitor.start('canvas_draw', { 
        unit: unit.duid, 
        dates: dates.length,
        height 
      });
      
      // Get actual width from DOM
      perfMonitor.start('canvas_setup');
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || canvas.offsetWidth || 1000; // Fallback values
      
      // Set canvas size (account for device pixel ratio)
      const dpr = window.devicePixelRatio || 1;
      // Add extra pixels to prevent gaps
      const extraHeight = 2;
      canvas.width = width * dpr;
      canvas.height = (height + extraHeight) * dpr;
      // Force canvas to fill its container
      canvas.style.width = '100%';
      canvas.style.height = `${height + extraHeight}px`;
      canvas.style.marginBottom = `-${extraHeight}px`; // Overlap with next row
      ctx.scale(dpr, dpr);
      perfMonitor.end('canvas_setup');
      
      // Clear canvas
      perfMonitor.start('canvas_clear');
      ctx.clearRect(0, 0, width, height);
      perfMonitor.end('canvas_clear');
      
      // Increment paint counter
      globalPaintCount++;
      if (paintCountCallback) {
        paintCountCallback(globalPaintCount);
      }
      
      // Draw each stripe
      perfMonitor.start('canvas_stripes');
      const stripeWidth = width / dates.length;
      
      dates.forEach((date, index) => {
        const capacityFactor = unit.history.data[index];
        const color = getCoalProportionColor(capacityFactor);
        
        ctx.fillStyle = color;
        // Draw slightly wider to prevent gaps due to rounding
        const x = index * stripeWidth;
        const w = stripeWidth + 1; // Add 1 pixel overlap
        const h = height + 2; // Extend beyond canvas height
        ctx.fillRect(Math.floor(x), 0, Math.ceil(w), h);
      });
      perfMonitor.end('canvas_stripes', { stripeCount: dates.length });
      
      // No hover overlay in initial draw - we'll handle it differently
      perfMonitor.end('canvas_draw');
    });
  }, [dataKey, unit.history.data.length]);
  
  
  return (
    <canvas
      ref={canvasRef}
      className="opennem-stripe-canvas"
      style={{ 
        display: 'block',
        width: '100%',
        height: '100%',
        cursor: 'pointer'
      }}
      data-unit={unit.duid}
      data-facility={unit.facility_name}
    />
  );
};