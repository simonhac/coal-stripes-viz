# Integration Guide for Performance Optimizations

## Quick Start

To integrate the performance optimizations into your existing page, make these changes:

### 1. Import the Optimized Components

Replace:
```typescript
import { StripeCanvas } from '../components/StripeCanvas';
```

With:
```typescript
import { OptimizedStripeCanvas } from '../components/OptimizedStripeCanvas';
import { VirtualScroller } from '../components/VirtualScroller';
```

### 2. Replace StripeCanvas Usage

Replace:
```typescript
<StripeCanvas
  unit={unit}
  dates={dates}
  height={rowHeight}
  onHover={handleHover}
/>
```

With:
```typescript
<OptimizedStripeCanvas
  unit={unit}
  dates={dates}
  height={rowHeight}
  onHover={handleHover}
/>
```

### 3. Implement Virtual Scrolling (Optional but Recommended)

For maximum performance with 50+ units, wrap your unit list with VirtualScroller. See `page-optimized.tsx` for a complete example.

### 4. Key Differences

- **OptimizedStripeCanvas**: Pre-renders stripes for faster redraws, uses memoization
- **VirtualScroller**: Only renders visible items, dramatically reducing DOM nodes
- Cache optimizations are automatic - no changes needed

## Testing

1. The server is running on http://localhost:3003
2. Open the performance display with Cmd+P
3. Compare canvas render times before/after
4. You should see:
   - Fewer canvas operations
   - Faster render times
   - Smoother dragging

## Rollback

If you need to rollback, simply revert to using `StripeCanvas` instead of `OptimizedStripeCanvas`.