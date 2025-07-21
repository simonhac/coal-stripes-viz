# Coal Stripes Visualization Performance Analysis Report

## Executive Summary

We've implemented comprehensive performance instrumentation across the coal stripes visualization application to identify bottlenecks. The instrumentation covers:

- Canvas rendering operations
- React component renders and hooks
- Data processing and caching
- Event handlers (mouse, drag)
- Memory usage and FPS monitoring

## Instrumentation Added

### 1. Performance Monitor System (`performance-monitor.ts`)
- Real-time FPS tracking using requestAnimationFrame
- Memory usage monitoring (Chrome only)
- Operation timing with performance.mark/measure
- Metric aggregation and reporting

### 2. Canvas Operations (`StripeCanvas.tsx`)
- `canvas_draw`: Complete draw cycle timing
- `canvas_setup`: Canvas initialization and scaling
- `canvas_clear`: Canvas clearing operation
- `canvas_stripes`: Individual stripe drawing loop

### 3. React Hooks (`useCoalStripes.ts`)
- `useCoalStripes_fetchData`: Initial data fetch
- `useCoalStripesRange_fetchData`: Range-based data fetch
- `useCoalStripesRange_smartCache`: Smart cache operations
- `onDragMove`: Drag interaction handling

### 4. Cache Operations (`smart-cache.ts`, `time-series-cache.ts`)
- `smartCache_getDataForDateRange`: Main cache interface
- `smartCache_cacheCheck`: Initial cache lookup
- `smartCache_fetchYears`: Year data fetching
- `smartCache_autoPreload`: Predictive preloading
- `timeSeriesCache_*`: Low-level cache operations

### 5. Event Handlers
- `mouse_move`: Mouse movement processing
- `mouse_move_hover_update`: Hover state changes
- `mouse_move_tooltip`: Tooltip DOM updates

## Key Performance Insights

### Potential Bottlenecks to Investigate

1. **Canvas Rendering**
   - Each stripe is drawn individually in a loop
   - Canvas size recalculation on every draw
   - No dirty rectangle optimization
   - Potential overdraw with overlapping stripes

2. **Mouse Event Handling**
   - Tooltip updates using direct DOM manipulation
   - Frequent getBoundingClientRect calls
   - No event throttling on mousemove

3. **Data Processing**
   - Date parsing operations using string manipulation
   - Array operations for filtering and combining data
   - Multiple passes over data during cache operations

4. **React Re-renders**
   - Multiple state updates during drag operations
   - Potential unnecessary re-renders of canvas components
   - No React.memo optimization on components

5. **Memory Allocation**
   - Creating new date objects frequently
   - Array allocations during data filtering
   - String concatenation in hot paths

## Performance Testing Guide

1. **Open the application** at http://localhost:3002 in Chrome
2. **Use the Performance Display** (top-right corner) to monitor:
   - FPS (should stay above 30 for smooth interaction)
   - Memory usage trends
   - Operation timings

3. **Test Scenarios**:
   - Initial page load
   - Rapid panning back and forth
   - Continuous mouse hovering
   - Long-distance panning

4. **Generate Report**:
   - Click "Log Report" button in Performance Display
   - Check browser console for detailed metrics

## Optimization Recommendations

Based on the instrumentation, here are potential optimizations to consider:

1. **Canvas Optimization**
   - Implement dirty rectangle rendering
   - Use OffscreenCanvas for stripe rendering
   - Batch stripe drawing operations
   - Cache rendered stripes as image data

2. **Event Handler Optimization**
   - Throttle mousemove events (already debounced at 150ms for drag)
   - Use passive event listeners where possible
   - Implement virtual scrolling for large datasets

3. **Data Structure Optimization**
   - Use typed arrays for capacity factor data
   - Implement object pooling for date operations
   - Pre-calculate frequently used values

4. **React Optimization**
   - Add React.memo to StripeCanvas components
   - Use useMemo for expensive calculations
   - Optimize state update batching

5. **Caching Improvements**
   - Implement indexed lookup for date ranges
   - Use Web Workers for background data processing
   - Add memory pressure handling

## Next Steps

1. Run the application and collect baseline metrics
2. Identify the most impactful bottlenecks from real usage
3. Implement targeted optimizations based on data
4. Measure improvements and iterate

The performance monitoring infrastructure is now in place to make data-driven optimization decisions.