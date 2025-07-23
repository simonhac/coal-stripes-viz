import { useState, useEffect, useRef } from 'react';
import { CoalStripesData, PartialCoalStripesData } from '@/shared/types';
import { SmartCache } from '@/client/smart-cache';
import { CalendarDate, today } from '@internationalized/date';
import { perfMonitor } from '@/shared/performance-monitor';
import { DRAG_CONFIG } from '@/shared/config';

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
  setDateRange: (start: CalendarDate, end: CalendarDate, direction?: 'forward' | 'backward') => void;
  // Current date range being displayed
  currentDateRange: { start: CalendarDate; end: CalendarDate };
  // Drag interaction support
  isDragging: boolean;
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
    perfMonitor.start('useCoalStripes_fetchData', { days: requestDays });
    setLoading(true);
    setError(null);
    
    try {
      const url = `/api/coal-stripes?days=${requestDays}`;
      const response = await perfMonitor.measureAsync('useCoalStripes_fetch', 
        async () => await fetch(url)
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      const result = await perfMonitor.measureAsync('useCoalStripes_json', 
        async () => await response.json()
      );
      setData(result);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Coal stripes fetch error:', err);
      
    } finally {
      setLoading(false);
      perfMonitor.end('useCoalStripes_fetchData');
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
    endDate: initialEndDate = today('Australia/Brisbane'),
    autoFetch = true,
    containerWidth = 1200 // Default fallback, should be passed from component
  } = options;
  
  const [data, setData] = useState<CoalStripesData | PartialCoalStripesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: initialStartDate, end: initialEndDate });
  const [visualDateRange, setVisualDateRange] = useState({ start: initialStartDate, end: initialEndDate });
  
  // Drag interaction state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number>(0);
  const originalDateRange = useRef<{ start: CalendarDate, end: CalendarDate } | null>(null);
  const lastDaysDelta = useRef<number>(0);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Create SmartCache instance (only once) - this is our ONLY interface to data
  const smartCacheRef = useRef<SmartCache | null>(null);
  if (!smartCacheRef.current) {
    smartCacheRef.current = new SmartCache(10); // Max 10 year chunks for better performance
  }

  const fetchData = async (start: CalendarDate, end: CalendarDate) => {
    if (!smartCacheRef.current) return;
    
    perfMonitor.start('useCoalStripesRange_fetchData', { 
      start: start.toString(), 
      end: end.toString() 
    });
    setLoading(true);
    setError(null);
    
    try {
      // SmartCache handles EVERYTHING: cache hits, misses, server calls, partial data, preloading
      const result = await perfMonitor.measureAsync('useCoalStripesRange_smartCache', 
        async () => await smartCacheRef.current!.getDataForDateRange(start, end, true),
        { start: start.toString(), end: end.toString() }
      );
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Coal stripes range fetch error:', err);
    } finally {
      setLoading(false);
      perfMonitor.end('useCoalStripesRange_fetchData');
    }
  };

  const refetch = () => {
    fetchData(dateRange.start, dateRange.end);
  };

  const setDateRangeAndFetch = (start: CalendarDate, end: CalendarDate, direction?: 'forward' | 'backward') => {
    setDateRange({ start, end });
    setVisualDateRange({ start, end });
    // The useEffect will handle fetching when dateRange changes
    // Cache will auto-detect direction for preloading
  };

  // Drag interaction handlers
  const onDragStart = (clientX: number) => {
    setIsDragging(true);
    dragStartX.current = clientX;
    originalDateRange.current = { ...dateRange };
    lastDaysDelta.current = 0;
    
    // Add dragging class to body to prevent scrolling
    document.body.classList.add('dragging');
    
  };

  const onDragMove = (clientX: number) => {
    if (!isDragging) return;
    
    perfMonitor.start('onDragMove');
    const deltaX = clientX - dragStartX.current;
    
    // Calculate accurate pixels per day based on container width and current data
    const daysDisplayed = data && data.data && data.data.length > 0 && data.data[0].history 
      ? data.data[0].history.data.length 
      : 365;
    const pixelsPerDay = containerWidth / daysDisplayed;
    const daysDelta = Math.round(-deltaX / pixelsPerDay); // Negative because dragging right goes back in time
    
    // Only update if we've moved at least one day
    if (originalDateRange.current && daysDelta !== lastDaysDelta.current) {
      const newStart = originalDateRange.current.start.add({ days: daysDelta });
      const newEnd = originalDateRange.current.end.add({ days: daysDelta });
      
      // Get yesterday as the latest possible date
      const yesterday = today('Australia/Brisbane').subtract({ days: 1 });
      
      // Check boundaries
      let constrainedStart = newStart;
      let constrainedEnd = newEnd;
      
      // Prevent panning past yesterday
      if (newEnd.compare(yesterday) > 0) {
        const daysOverYesterday = newEnd.compare(yesterday);
        constrainedEnd = yesterday;
        constrainedStart = newStart.subtract({ days: daysOverYesterday });
      }
      
      // Update visual date range immediately for smooth feedback
      setVisualDateRange({ start: constrainedStart, end: constrainedEnd });
      
      // Cache will auto-detect pan direction for preloading
      
      // Clear any existing debounce timer
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Debounce the actual data fetch
      updateTimeoutRef.current = setTimeout(() => {
        // Just update the date range - the useEffect will handle fetching and preloading
        setDateRange({ start: constrainedStart, end: constrainedEnd });
      }, DRAG_CONFIG.DEBOUNCE_DELAY); // Debounce for smooth updates
      
      lastDaysDelta.current = daysDelta;
      
    }
    perfMonitor.end('onDragMove');
  };

  const onDragEnd = () => {
    setIsDragging(false);
    
    // Clear any pending timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
    
    // Ensure final data is fetched if needed
    if (visualDateRange.start !== dateRange.start || visualDateRange.end !== dateRange.end) {
      // Just update the date range - the useEffect will handle fetching
      setDateRange({ start: visualDateRange.start, end: visualDateRange.end });
    }
    
    dragStartX.current = 0;
    originalDateRange.current = null;
    lastDaysDelta.current = 0;
    
    // Remove dragging class from body
    document.body.classList.remove('dragging');
    
  };

  useEffect(() => {
    if (autoFetch) {
      fetchData(dateRange.start, dateRange.end);
    }
  }, [dateRange.start.toString(), dateRange.end.toString(), autoFetch]);
  
  // Subscribe to background updates
  useEffect(() => {
    if (!smartCacheRef.current) return;
    
    const unsubscribe = smartCacheRef.current.onBackgroundUpdate((year) => {
      // Refetch the current date range to get the updated data
      fetchData(dateRange.start, dateRange.end);
    });
    
    return unsubscribe;
  }, [dateRange.start, dateRange.end]);

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
    currentDateRange: visualDateRange, // Use visual date range for display
    // Drag interaction support
    isDragging,
    onDragStart,
    onDragMove,
    onDragEnd
  };
}

