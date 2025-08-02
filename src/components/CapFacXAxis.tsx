import React, { useEffect, useState, useRef } from 'react';
import { CalendarDate } from '@internationalized/date';
import { getDaysBetween, getMonthName } from '@/shared/date-utils';
import { getProportionColorHex } from '@/shared/capacity-factor-color-map';
import { CapFacYear } from '@/client/cap-fac-year';
import { yearDataVendor, getRegionNames, YearDataVendor } from '@/client/year-data-vendor';
import { useTouchAsHover } from '@/hooks/useTouchAsHover';

interface CapFacXAxisProps {
  dateRange: { start: CalendarDate; end: CalendarDate };
  regionCode: string;
  onMonthClick?: (year: number, month: number) => void;
  isMobile?: boolean;
}

export function CapFacXAxis({ 
  dateRange, 
  regionCode,
  onMonthClick,
  isMobile = false
}: CapFacXAxisProps) {
  const regionNames = getRegionNames(regionCode);
  const tooltipRegionName = isMobile ? regionNames.short : regionNames.long;
  const [yearDataMap, setYearDataMap] = useState<Map<number, CapFacYear>>(new Map());
  const [useShortLabels, setUseShortLabels] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const startYear = dateRange.start.year;
    const endYear = dateRange.end.year;
    
    // Skip if years are invalid
    if (!YearDataVendor.isValidYear(startYear) || !YearDataVendor.isValidYear(endYear)) {
      return;
    }
    
    const years = startYear === endYear ? [startYear] : [startYear, endYear];
    
    // Track current request years to ignore stale responses
    const currentYears = new Set(years);
    
    // Clear data for years we no longer need
    setYearDataMap(prevMap => {
      const newMap = new Map();
      for (const [year, data] of prevMap) {
        if (currentYears.has(year)) {
          newMap.set(year, data);
        }
      }
      return newMap;
    });
    
    // Fetch year data without waiting
    years.forEach(year => {
      try {
        yearDataVendor.requestYear(year)
          .then(yearData => {
            // Ignore if we've moved to different years
            if (!currentYears.has(year)) {
              return;
            }
            
            setYearDataMap(prevMap => {
              const newMap = new Map(prevMap);
              newMap.set(yearData.year, yearData);
              return newMap;
            });
          })
          .catch(err => {
            // Ignore if we've moved to different years
            if (!currentYears.has(year)) {
              return;
            }
            
            console.error(`CapFacXAxis: Failed to load year ${year}:`, err);
          });
      } catch (error) {
        // Handle synchronous validation errors
        console.error(`CapFacXAxis: Invalid year ${year}:`, error);
      }
    });
    
    // Cleanup function to mark requests as stale
    return () => {
      currentYears.clear();
    };
  }, [dateRange]);

  // Monitor container width to determine label format
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        // Switch to short labels if average month width is less than 50px
        // 365 days / 12 months ≈ 30.4 days per month on average
        const avgMonthWidth = width / 12;
        const shouldUseShort = avgMonthWidth < 50;
        
        // Only update if value actually changes
        setUseShortLabels(prev => {
          if (prev !== shouldUseShort) {
            return shouldUseShort;
          }
          return prev;
        });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const monthBars: { labelShort: string; labelLong: string; color: string; widthPercent: number; date: CalendarDate; capacityFactor: number | null }[] = [];
  
  // Total days in the date range (should be 365)
  const totalDays = getDaysBetween(dateRange.start, dateRange.end) + 1;
  
  let currentDate = dateRange.start;
  
  while (currentDate.compare(dateRange.end) <= 0) {
    const monthStart = currentDate;
    const year = monthStart.year;
    const month = monthStart.month;
    const monthLabelLong = getMonthName(monthStart);
    const monthLabelShort = monthLabelLong.charAt(0); // First letter only
    
    // Calculate month end
    let monthEnd = monthStart.set({ day: monthStart.calendar.getDaysInMonth(monthStart) });
    if (monthEnd.compare(dateRange.end) > 0) {
      monthEnd = dateRange.end;
    }
    
    // Get capacity factor for this month
    const yearData = yearDataMap.get(year);
    let capacityFactor: number | null = null;
    
    if (yearData && yearData.regionCapacityFactors.has(regionCode)) {
      const monthlyFactors = yearData.regionCapacityFactors.get(regionCode);
      if (monthlyFactors && month >= 1 && month <= 12) {
        capacityFactor = monthlyFactors[month - 1];
      }
    }
    
    // Calculate width as percentage
    const daysInMonth = getDaysBetween(monthStart, monthEnd) + 1;
    const widthPercent = (daysInMonth / totalDays) * 100;
    
    monthBars.push({
      labelShort: monthLabelShort,
      labelLong: monthLabelLong,
      color: getProportionColorHex(capacityFactor),
      widthPercent,
      date: monthStart,
      capacityFactor
    });
    
    // Move to next month
    currentDate = monthStart.add({ months: 1 }).set({ day: 1 });
  }
  
  const handleMouseEnter = (month: typeof monthBars[0]) => {
    const tooltipData = {
      startDate: month.date,
      endDate: null,
      label: tooltipRegionName,
      capacityFactor: month.capacityFactor,
      tooltipType: 'month',
      regionCode: regionCode
    };
    
    // Broadcast the tooltip data
    const event = new CustomEvent('tooltip-data-hover', { 
      detail: tooltipData
    });
    window.dispatchEvent(event);
  };

  const handleMonthClick = (month: typeof monthBars[0]) => {
    if (onMonthClick) {
      onMonthClick(month.date.year, month.date.month);
    }
  };

  // Touch handlers for hover functionality
  const findMonthAtPosition = (clientX: number, clientY: number) => {
    for (let i = 0; i < monthRefs.current.length; i++) {
      const element = monthRefs.current[i];
      if (element) {
        const rect = element.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && 
            clientY >= rect.top && clientY <= rect.bottom) {
          return monthBars[i];
        }
      }
    }
    return null;
  };

  const touchHandlers = useTouchAsHover({
    onHoverStart: (clientX, clientY) => {
      const month = findMonthAtPosition(clientX, clientY);
      if (month) {
        handleMouseEnter(month);
      }
    },
    onHoverMove: (clientX, clientY) => {
      const month = findMonthAtPosition(clientX, clientY);
      if (month) {
        handleMouseEnter(month);
      } else {
        const event = new CustomEvent('tooltip-data-hover-end');
        window.dispatchEvent(event);
      }
    },
    onHoverEnd: () => {
      const event = new CustomEvent('tooltip-data-hover-end');
      window.dispatchEvent(event);
    }
  });

  return (
    <div className="opennem-stripe-row" style={{ display: 'flex' }}>
      <div className="opennem-facility-label">
        {/* Empty label for alignment */}
      </div>
      <div className="opennem-stripe-data" ref={containerRef} style={{ cursor: 'default' }} {...touchHandlers}>
        <div style={{ display: 'flex', width: '100%', height: '16px' }}>
            {monthBars.map((month, idx) => (
              <div
                key={idx}
                ref={(el) => { monthRefs.current[idx] = el; }}
                className="opennem-month-label"
                style={{ 
                  backgroundColor: month.color,
                  width: idx === monthBars.length - 1 ? 'auto' : `${month.widthPercent}%`,
                  flex: idx === monthBars.length - 1 ? '1' : 'none',
                  position: 'relative',
                  cursor: onMonthClick ? 'pointer' : 'default'
                }}
                onMouseEnter={() => handleMouseEnter(month)}
                onMouseLeave={() => {
                  // Broadcast hover end
                  const event = new CustomEvent('tooltip-data-hover-end');
                  window.dispatchEvent(event);
                }}
                onClick={() => handleMonthClick(month)}
              >
                {useShortLabels ? month.labelShort : month.labelLong}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}