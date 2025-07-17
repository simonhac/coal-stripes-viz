import { useState, useEffect } from 'react';
import { CoalStripesData } from '../lib/types';

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

// Helper hook for specific data access patterns
export function useCoalStripesWithRegions(options: UseCoalStripesOptions = {}) {
  const { data, loading, error, refetch } = useCoalStripes(options);
  
  // Compute derived data
  const regionsWithData = data ? Object.values(data.regions).filter(r => r.units.length > 0) : [];
  const totalUnits = data?.totalUnits || 0;
  const dateRange = data ? `${data.actualDateStart} to ${data.actualDateEnd}` : '';
  
  return {
    data,
    loading,
    error,
    refetch,
    regionsWithData,
    totalUnits,
    dateRange,
    lastGoodDay: data?.lastGoodDay || null
  };
}