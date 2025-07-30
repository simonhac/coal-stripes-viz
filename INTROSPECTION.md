# Performance Monitoring Widget - Technical Introspection

## Overview

The performance monitoring widget is a custom-built, real-time performance analysis tool integrated into the Coal Stripes Visualization application. It provides immediate feedback on application performance metrics including frame rate, memory usage, operation timings, cache statistics, and feature flag management.

## Architecture

### Core Components

1. **PerformanceMonitor Class** (`/src/shared/performance-monitor.ts`)
   - Singleton pattern implementation
   - Central hub for all performance data collection
   - Manages timing operations, FPS calculation, and memory tracking

2. **PerformanceDisplay Component** (`/src/components/PerformanceDisplay.tsx`)
   - React component providing the UI overlay
   - Draggable widget with collapsible details
   - Real-time updates every 500ms
   - Three display modes: Performance, Cache, and Features
   - Position persistence using localStorage

3. **Configuration** (`/src/shared/config.ts`)
   - Centralized performance thresholds
   - FPS buffer size and slow operation detection settings

## Data Flow

```
Application Code
    ↓
perfMonitor.start/end()
    ↓
PerformanceMonitor (Singleton)
    ↓
Internal Metrics Storage
    ↓
PerformanceDisplay Component
    ↓
Visual UI Overlay
```

## Key Features

### 1. Frame Rate Monitoring
- Uses `requestAnimationFrame` to measure actual frame timings
- Maintains a rolling buffer of frame times
- Calculates average FPS over the buffer period
- Color-coded display: 
  - Green: >50 FPS
  - Yellow: 30-50 FPS  
  - Red: <30 FPS

### 2. Memory Tracking
- Leverages Chrome's `performance.memory` API
- Tracks JavaScript heap usage
- Displays used/total heap in MB
- Helps identify memory leaks and excessive allocations

### 3. Operation Timing
- Wrap any code block with `start()`/`end()` calls
- Automatic detection of slow operations (>16.67ms)
- Aggregates statistics per operation:
  - Total time
  - Average time
  - Call count
  - Maximum time
- Shows top 10 slowest operations by total time

### 4. Async Operation Support
- `measureAsync()` wrapper for Promise-based operations
- Maintains timing accuracy across async boundaries
- Includes metadata support for contextual information

### 5. Cache Monitoring
- Real-time cache statistics from yearDataVendor
- Displays:
  - Number of cached items
  - Total cache size in MB
  - Visual list of cached year labels
  - Pending requests
- Clear cache button for debugging

### 6. Feature Flag Management
- Interactive toggle switches for all feature flags
- Real-time enable/disable without code changes
- Reload button to apply changes
- Useful for A/B testing and gradual rollouts

### 7. Widget Positioning
- Fully draggable interface
- Position persistence using localStorage key "performance-monitor-coordinates"
- Viewport boundary validation
- Smooth opacity transitions for collapsed/expanded states

## Implementation Patterns

### Basic Usage
```typescript
// Simple operation timing
perfMonitor.start('my_operation');
// ... do work ...
perfMonitor.end('my_operation');

// With metadata
perfMonitor.start('fetch_data', { year: 2024 });
// ... fetch data ...
perfMonitor.end('fetch_data', { status: 'success' });
```

### Async Operations
```typescript
const result = await perfMonitor.measureAsync(
  'async_operation',
  async () => {
    return await fetchData();
  },
  { context: 'initial_load' }
);
```

### Synchronous Wrapper
```typescript
const result = perfMonitor.measure(
  'sync_operation',
  () => {
    return processData(input);
  },
  { size: input.length }
);
```

## Current Integration Points

The performance monitor is actively used in:

1. **Canvas Rendering** (`CompositeTile.tsx`)
   - Tile rendering operations
   - Canvas draw operations
   - Animation frame timing

2. **Data Fetching** (`year-data-vendor.ts`)
   - Year data loading
   - Cache operations
   - Network request timing

3. **Cache Operations** (`lru-cache.ts`)
   - Cache hit/miss tracking
   - Memory usage monitoring
   - Eviction operations

4. **User Interface** (`PerformanceDisplay.tsx`)
   - Widget rendering performance
   - State update tracking
   - Mode switching operations

## Extension Guidelines

### Adding New Metrics

1. **Identify the operation to measure**
   ```typescript
   perfMonitor.start('new_operation_name');
   // Your code here
   perfMonitor.end('new_operation_name');
   ```

2. **Add contextual metadata**
   ```typescript
   perfMonitor.start('data_processing', {
     recordCount: data.length,
     processingType: 'batch'
   });
   ```

3. **Use consistent naming conventions**
   - Use underscore_case for operation names
   - Prefix with module name: `cache_lookup`, `render_tile`
   - Be specific: `coal_data_fetch_year` not just `fetch`

### Adding New Visualizations

To extend the UI display:

1. **Add a new display mode**
   ```typescript
   type DisplayMode = 'performance' | 'caches' | 'features' | 'custom';
   ```

2. **Modify PerformanceDisplay component**
   - Add new state for your metric
   - Update the mode switching logic
   - Add your custom visualization panel
   - Consider performance impact of rendering

3. **Add data aggregation to PerformanceMonitor**
   ```typescript
   getCustomMetric(): CustomMetricData {
     // Aggregate and return your custom data
   }
   ```

4. **Export data for external analysis**
   ```typescript
   const report = perfMonitor.generateReport();
   // Send to analytics service or export as JSON
   ```

### Widget Customization

1. **Styling**
   - Modify color schemes in inline styles
   - Update button styles (greenButtonStyle, redButtonStyle)
   - Adjust opacity and transition timings

2. **Positioning**
   - Default position set in component state
   - localStorage key: "performance-monitor-coordinates"
   - Viewport boundary checking on load

3. **Interaction**
   - Drag behavior uses mouse events
   - Collapse/expand with disclosure triangle
   - Mode switching with segmented button control

### Creating Custom Monitors

For specialized monitoring needs:

1. **Extend the PerformanceMonitor class**
   ```typescript
   class NetworkPerformanceMonitor extends PerformanceMonitor {
     trackRequest(url: string, response: Response) {
       // Custom network-specific tracking
     }
   }
   ```

2. **Create domain-specific wrappers**
   ```typescript
   export const measureRenderOperation = (name: string, fn: Function) => {
     return perfMonitor.measure(`render_${name}`, fn, { 
       component: 'canvas' 
     });
   };
   ```

## Performance Considerations

The monitoring system itself is designed to have minimal impact:

- **Lightweight operations**: Uses native browser APIs
- **Batched updates**: UI refreshes only twice per second
- **Conditional compilation**: Can be disabled in production builds
- **Memory efficient**: Fixed-size buffers for FPS tracking
- **Smart rendering**: Only renders visible content based on disclosure state
- **Debounced persistence**: localStorage updates are debounced to avoid excessive writes

## Future Enhancement Ideas

1. **Performance Budgets**
   - Set thresholds for specific operations
   - Alert when budgets are exceeded
   - Track budget violations over time

2. **Historical Tracking**
   - Store performance data in localStorage
   - Compare performance across sessions
   - Identify performance regressions

3. **Network Performance**
   - Track API response times
   - Monitor request queuing
   - Measure bandwidth usage

4. **User-Centric Metrics**
   - Time to Interactive (TTI)
   - First Contentful Paint (FCP)
   - Interaction to Next Paint (INP)

5. **Export and Analysis**
   - Export performance traces
   - Integration with Chrome DevTools
   - Custom performance reports

## Best Practices

1. **Measure what matters**: Focus on operations that affect user experience
2. **Use descriptive names**: Make metrics self-documenting
3. **Include context**: Add metadata to understand performance variations
4. **Monitor in production**: Consider a lighter-weight production mode
5. **Act on the data**: Use insights to guide optimization efforts

## Troubleshooting

Common issues and solutions:

1. **No FPS showing**: The browser may not support `requestAnimationFrame`
2. **Memory not displayed**: Only works in Chrome/Chromium browsers
3. **Missing operations**: Ensure start/end calls are properly paired
4. **Performance overhead**: Disable in production or reduce update frequency
5. **Widget position off-screen**: Delete localStorage key "performance-monitor-coordinates"
6. **Cache data not updating**: Ensure yearDataVendor is properly initialized
7. **Feature flags not working**: Check that feature flag definitions exist in shared/feature-flags.ts

## Local Storage Usage

The widget uses localStorage for persistence:

- **Key**: `performance-monitor-coordinates`
- **Format**: `{"x": number, "y": number}`
- **Validation**: Coordinates are validated against viewport bounds on load
- **Fallback**: Centers horizontally at y=10 if invalid or missing

## Conclusion

The performance monitoring widget has evolved from a simple FPS counter to a comprehensive development tool featuring:
- Real-time performance metrics
- Cache monitoring and management
- Feature flag runtime control
- Persistent, draggable positioning
- Multiple visualization modes

Its extensible architecture makes it easy to add new metrics and visualizations as needed. By following the patterns established in this system, developers can maintain high performance standards and quickly identify areas for improvement.