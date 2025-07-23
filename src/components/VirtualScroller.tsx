import React, { useRef, useState, useEffect, useCallback } from 'react';

interface VirtualScrollerProps {
  items: any[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number; // Number of items to render outside viewport
  renderItem: (item: any, index: number) => React.ReactNode;
  className?: string;
}

export const VirtualScroller: React.FC<VirtualScrollerProps> = ({
  items,
  itemHeight,
  containerHeight,
  overscan = 3,
  renderItem,
  className = ''
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      ref={scrollerRef}
      className={`virtual-scroller ${className}`}
      style={{
        height: containerHeight,
        overflowY: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      {/* Total height spacer */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Visible items container */}
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};