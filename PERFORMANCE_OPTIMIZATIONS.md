# Performance Optimizations for Coal Stripes Visualization

## Problem
With 50 canvases, the application was sluggish during drag operations:
- Canvas operations: 406ms total (222ms draw + 184ms stripes)
- Data fetching: 81.3ms total  
- Multi-year view creation: 63ms
- Total drag latency was making the UI feel unresponsive

## Implemented Solutions

### 1. **Virtual Scrolling Component** (`VirtualScroller.tsx`)
- Only renders visible canvases + small overscan
- Reduces active canvases from 50 to ~10-15 visible ones
- Dramatically reduces canvas redraw operations

### 2. **Optimized Canvas Rendering** (`OptimizedStripeCanvas.tsx`)
- Pre-renders stripe data to ImageData
- Uses memoization to prevent unnecessary redraws
- Implements offscreen canvas for batch rendering
- Throttles mouse events to 60fps with requestAnimationFrame
- Color values are cached to avoid recalculation

### 3. **Improved Data Caching**
- Added fast path for repeat cache requests
- Stores last request result to skip redundant calculations
- Increased drag debounce from 150ms to 300ms to reduce fetch frequency

### 4. **Memory Optimizations**
- Canvas contexts use `{ alpha: false }` for better performance
- Image smoothing disabled for crisp pixel rendering
- ResizeObserver for efficient canvas resizing

## Expected Performance Improvements

### Before:
- 350 canvas draw operations during drag
- 406ms total canvas time
- 81ms data fetching time
- Sluggish UI response

### After (Expected):
- ~50 canvas operations (only visible ones)
- <50ms total canvas time
- <20ms data fetching time (with cache hits)
- Smooth 60fps drag operations

## Implementation Guide

1. Replace `StripeCanvas` with `OptimizedStripeCanvas` in your component
2. Wrap your canvas list with `VirtualScroller` for large datasets
3. The cache optimizations are already active

## Next Steps

1. Consider WebGL rendering for even better performance
2. Implement web workers for data processing
3. Add progressive rendering for initial load
4. Consider using a single large canvas instead of 50 individual ones