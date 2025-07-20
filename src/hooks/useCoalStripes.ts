import { useState, useEffect, useRef } from 'react';
import { CoalStripesData, PartialCoalStripesData } from '../lib/types';
import { SmartCache } from '../lib/smart-cache';
import { CalendarDate, today } from '@internationalized/date';

interface UseCoalStripesOptions {
  requestDays?: number;
  autoFetch?: boolean;
}

interface UseCoalStripesResult {
  data: CoalStripesData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface UseCoalStripesRangeOptions {
  startDate?: CalendarDate;
  endDate?: CalendarDate;
  autoFetch?: boolean;
  containerWidth?: number; // For calculating accurate drag sensitivity
}

interface UseCoalStripesRangeResult {
  data: CoalStripesData | PartialCoalStripesData | null;
  loading: boolean;
  error: string | null;
  isPartial: boolean;
  missingYears: number[];
  refetch: () => void;
  setDateRange: (start: CalendarDate, end: CalendarDate) => void;
  // Drag interaction support
  isDragging: boolean;
  dragOffset: number;
  onDragStart: (clientX: number) => void;
  onDragMove: (clientX: number) => void;
  onDragEnd: () => void;
}

export function useCoalStripes(options: UseCoalStripesOptions = {}): UseCoalStripesResult {
  const { requestDays = 365, autoFetch = true } = options;
  
  const [data, setData] = useState<CoalStripesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const url = `/api/coal-stripes?days=${requestDays}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Coal stripes fetch error:', err);
      
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchData();
  };

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [requestDays, autoFetch]);

  return {
    data,
    loading,
    error,
    refetch
  };
}

/**
 * Enhanced hook for client-side cached data with date range support
 * Uses SmartCache as the ONLY interface to data - cache handles everything
 */
export function useCoalStripesRange(options: UseCoalStripesRangeOptions = {}): UseCoalStripesRangeResult {
  const { 
    startDate: initialStartDate = today('Australia/Brisbane').subtract({ days: 364 }),
    endDate: initialEndDate = today('Australia/Brisbane').subtract({ days: 1 }), // Yesterday (avoid partial data)
    autoFetch = true,
    containerWidth = 1200 // Default fallback, should be passed from component
  } = options;
  
  const [data, setData] = useState<CoalStripesData | PartialCoalStripesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: initialStartDate, end: initialEndDate });
  
  // Drag interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX = useRef<number>(0);
  const dragStartOffset = useRef<number>(0);
  const originalDateRange = useRef<{ start: CalendarDate, end: CalendarDate } | null>(null);
  
  // Create SmartCache instance (only once) - this is our ONLY interface to data
  const smartCacheRef = useRef<SmartCache | null>(null);
  if (!smartCacheRef.current) {
    smartCacheRef.current = new SmartCache(5); // Max 5 year chunks
  }

  const fetchData = async (start: CalendarDate, end: CalendarDate) => {
    if (!smartCacheRef.current) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // SmartCache handles EVERYTHING: cache hits, misses, server calls, partial data
      const result = await smartCacheRef.current.getDataForDateRange(start, end);
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Coal stripes range fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchData(dateRange.start, dateRange.end);
  };

  const setDateRangeAndFetch = (start: CalendarDate, end: CalendarDate) => {
    setDateRange({ start, end });
    fetchData(start, end);
  };

  // Drag interaction handlers
  const onDragStart = (clientX: number) => {
    setIsDragging(true);
    dragStartX.current = clientX;
    dragStartOffset.current = dragOffset;
    originalDateRange.current = { ...dateRange };
    
    // Note: we'd need the container rect to accurately calculate the date
    // For now, just log the clientX position
    console.log(`🖱️  Drag started at ${clientX}`);
    // TODO: Pass container rect from component to calculate exact date
  };

  const onDragMove = (clientX: number) => {
    if (!isDragging) return;
    
    const deltaX = clientX - dragStartX.current;
    const newOffset = dragStartOffset.current + deltaX;
    
    // Calculate accurate pixels per day based on container width and current data
    const daysDisplayed = data && data.data && data.data.length > 0 && data.data[0].history 
      ? data.data[0].history.data.length 
      : 365;
    const pixelsPerDay = containerWidth / daysDisplayed;
    const daysDelta = Math.round(deltaX / pixelsPerDay);
    
    setDragOffset(newOffset);
    
    // Only update date range if we've moved at least one day's worth
    if (originalDateRange.current && Math.abs(daysDelta) > 0) {
      const newStart = originalDateRange.current.start.add({ days: -daysDelta });
      const newEnd = originalDateRange.current.end.add({ days: -daysDelta });
      
      console.log(`🖱️  Drag: ${deltaX}px = ${daysDelta} days (${pixelsPerDay.toFixed(1)} px/day)`);
      
      // Update date range (this will trigger cache/fetch via useEffect)
      setDateRange({ start: newStart, end: newEnd });
    }
  };

  const onDragEnd = () => {
    setIsDragging(false);
    setDragOffset(0);
    dragStartX.current = 0;
    dragStartOffset.current = 0;
    originalDateRange.current = null;
    console.log('🖱️  Drag ended');
  };

  useEffect(() => {
    if (autoFetch) {
      fetchData(dateRange.start, dateRange.end);
    }
  }, [dateRange.start.toString(), dateRange.end.toString(), autoFetch]);

  // Compute derived state
  const isPartial = data ? 'isPartial' in data && data.isPartial : false;
  const missingYears = data && 'missingYears' in data ? data.missingYears : [];

  return {
    data,
    loading,
    error,
    isPartial,
    missingYears,
    refetch,
    setDateRange: setDateRangeAndFetch,
    // Drag interaction support
    isDragging,
    dragOffset,
    onDragStart,
    onDragMove,
    onDragEnd
  };
}

