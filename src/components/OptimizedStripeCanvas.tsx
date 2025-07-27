import React, { useEffect, useRef, memo, useMemo } from 'react';
import { GeneratingUnitDTO } from '@/shared/types';
import { perfMonitor } from '@/shared/performance-monitor';
import { getProportionColorHex } from '@/shared/capacity-factor-color-map';

interface OptimizedStripeCanvasProps {
  unit: GeneratingUnitDTO;
  dates: string[];
  height: number;
  onHover?: (dateIndex: number | null, pixelX?: number, stripeWidth?: number) => void;
}

// Memoized canvas component - only re-renders when props actually change
export const OptimizedStripeCanvas = memo(({ 
  unit, 
  dates, 
  height,
  onHover
}: OptimizedStripeCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const lastHoveredIndex = useRef<number | null>(null);
  
  // Create a stable data fingerprint for change detection
  const dataFingerprint = useMemo(() => {
    // Include both the data AND the date range to trigger re-renders when panning
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const dataLength = unit.history.data.length;
    const historyStart = unit.history.start;
    const historyLast = unit.history.last;
    // Create a fingerprint that changes when either data or visible date range changes
    return `${unit.duid}-${firstDate}-${lastDate}-${historyStart}-${historyLast}-${dataLength}-${height}`;
  }, [unit.duid, dates, unit.history.data, unit.history.start, unit.history.last, height]);
  
  // Pre-render canvas content to ImageData
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Use offscreen canvas for rendering if available, otherwise use regular canvas
    const offscreenCanvas = typeof OffscreenCanvas !== 'undefined' 
      ? new OffscreenCanvas(1000, height)
      : document.createElement('canvas');
    
    if ('width' in offscreenCanvas) {
      offscreenCanvas.width = 1000;
      offscreenCanvas.height = height;
    }
    
    const ctx = offscreenCanvas.getContext('2d') as CanvasRenderingContext2D;
    if (!ctx) return;
    
    perfMonitor.start('canvas_prerender', { unit: unit.duid });
    
    // Calculate stripe width
    const width = 1000; // Standard width, will be scaled
    const stripeWidth = width / dates.length;
    
    // Draw all stripes at once using batch operations
    dates.forEach((date, index) => {
      // Check if this date is within the available data range
      const historyStartDate = new Date(unit.history.start);
      const historyEndDate = new Date(unit.history.last);
      const currentDate = new Date(date);
      
      let capacityFactor = null;
      
      // Only try to get data if the date is within the available range
      if (currentDate >= historyStartDate && currentDate <= historyEndDate) {
        const daysDiff = Math.floor((currentDate.getTime() - historyStartDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Get the capacity factor for this date
        if (daysDiff >= 0 && daysDiff < unit.history.data.length) {
          capacityFactor = unit.history.data[daysDiff];
        }
      }
      
      const color = getProportionColorHex(capacityFactor);
      
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.floor(index * stripeWidth), 
        0, 
        Math.ceil(stripeWidth) + 1, 
        height
      );
    });
    
    // Store the image data
    imageDataRef.current = ctx.getImageData(0, 0, width, height);
    
    perfMonitor.end('canvas_prerender');
    
    // Trigger actual canvas update
    updateCanvas();
  }, [dataFingerprint]);
  
  // Update the visible canvas
  const updateCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageDataRef.current) return;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    perfMonitor.start('canvas_draw_optimized', { unit: unit.duid });
    
    // Get actual width from DOM
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 1000;
    
    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;
    
    // Scale and draw the pre-rendered image
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false; // Crisp pixels
    
    // Create temporary canvas to hold scaled image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageDataRef.current.width;
    tempCanvas.height = imageDataRef.current.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(imageDataRef.current, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, width, height);
    }
    
    perfMonitor.end('canvas_draw_optimized');
  };
  
  // Handle resize
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      updateCanvas();
    });
    
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current.parentElement!);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [dataFingerprint]);
  
  // Optimized mouse handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    let rafId: number | null = null;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Cancel any pending RAF
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      // Throttle updates to 60fps
      rafId = requestAnimationFrame(() => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const stripeWidth = rect.width / dates.length;
        const index = Math.floor(x / stripeWidth);
        
        if (index >= 0 && index < dates.length && index !== lastHoveredIndex.current) {
          lastHoveredIndex.current = index;
          const pixelX = index * stripeWidth + stripeWidth / 2;
          onHover?.(index, pixelX, stripeWidth);
        }
      });
    };
    
    const handleMouseLeave = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      lastHoveredIndex.current = null;
      onHover?.(null, 0, 0);
    };
    
    canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [dates.length, onHover]);
  
  return (
    <canvas
      ref={canvasRef}
      className="opennem-stripe-canvas"
      style={{ 
        display: 'block',
        width: '100%',
        height: height,
        cursor: 'pointer'
      }}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  // Re-render when dates change (for panning) or when data changes
  return (
    prevProps.unit.duid === nextProps.unit.duid &&
    prevProps.dates.length === nextProps.dates.length &&
    prevProps.dates[0] === nextProps.dates[0] &&
    prevProps.dates[prevProps.dates.length - 1] === nextProps.dates[nextProps.dates.length - 1] &&
    prevProps.height === nextProps.height &&
    // Deep compare data only if length is same
    prevProps.unit.history.data.length === nextProps.unit.history.data.length
  );
});