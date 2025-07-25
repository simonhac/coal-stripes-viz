# Performance Monitoring Widget - Technical Introspection

## Overview

The performance monitoring widget is a custom-built, real-time performance analysis tool integrated into the Coal Stripes Visualization application. It provides immediate feedback on application performance metrics including frame rate, memory usage, and operation timings.

## Architecture

### Core Components

1. **PerformanceMonitor Class** (`/src/shared/performance-monitor.ts`)
   - Singleton pattern implementation
   - Central hub for all performance data collection
   - Manages timing operations, FPS calculation, and memory tracking

2. **PerformanceDisplay Component** (`/src/components/PerformanceDisplay.tsx`)
   - React component providing the UI overlay
   - Fixed-position widget with collapsible details
   - Real-time updates every 500ms

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

### 4. Async Operation Support
- `measureAsync()` wrapper for Promise-based operations
- Maintains timing accuracy across async boundaries
- Includes metadata support for contextual information

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

1. **Canvas Rendering** (`CoalStripesCanvas.tsx`)
   - Pre-rendering operations
   - Draw calls to visible canvas
   - Frame-by-frame rendering performance

2. **Data Fetching** (`useCoalStripes.ts`)
   - API call timing
   - JSON parsing performance
   - Overall fetch operation duration

3. **Cache Operations** (`smart-cache.ts`)
   - Cache lookup performance
   - Data retrieval timing
   - Background fetch operations

4. **User Interactions** (`useCoalStripes.ts`)
   - Drag gesture performance
   - Date range calculations
   - UI responsiveness metrics

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

1. **Modify PerformanceDisplay component**
   - Add new state for your metric
   - Update the display logic
   - Consider performance impact of rendering

2. **Add data aggregation to PerformanceMonitor**
   ```typescript
   getCustomMetric(): CustomMetricData {
     // Aggregate and return your custom data
   }
   ```

3. **Export data for external analysis**
   ```typescript
   const report = perfMonitor.generateReport();
   // Send to analytics service or export as JSON
   ```

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

## Conclusion

The performance monitoring widget provides a powerful foundation for understanding and optimizing application performance. Its extensible architecture makes it easy to add new metrics and visualizations as needed. By following the patterns established in this system, developers can maintain high performance standards and quickly identify areas for improvement.