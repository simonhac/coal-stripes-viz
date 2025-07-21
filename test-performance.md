# Performance Testing Instructions

The application is now running at http://localhost:3002

## To test performance:

1. Open the application in Chrome (required for memory monitoring)
2. The Performance Display is shown in the top-right corner with:
   - Real-time FPS counter
   - Memory usage (Chrome only)
   - "Show Details" button to see operation timings
   - "Log Report" button to output detailed report to console
   - "Clear" button to reset metrics

## Test scenarios to try:

1. **Initial Load**: Observe the initial page load performance
2. **Panning/Dragging**: Click and drag to pan through time
3. **Hover Performance**: Move mouse over stripes to see tooltip performance
4. **Continuous Panning**: Pan back and forth repeatedly

## Key metrics to observe:

- **FPS**: Should stay above 30fps for smooth interaction
- **Canvas operations**: 
  - `canvas_draw`: Full canvas redraw time
  - `canvas_stripes`: Time to draw all stripes
- **Mouse events**:
  - `mouse_move`: Raw mouse move handling
  - `mouse_move_tooltip`: Tooltip update time
- **Data operations**:
  - `smartCache_getDataForDateRange`: Cache lookup time
  - `timeSeriesCache_*`: Low-level cache operations

## To generate a report:

1. Perform various interactions for 30-60 seconds
2. Click "Log Report" button
3. Open browser console (F12) to see the detailed report

The report will show:
- Current FPS
- Memory usage
- Operation counts and average/total times sorted by impact