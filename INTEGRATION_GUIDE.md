# Integration Guide for Performance Optimizations

## Current Architecture

The application uses an optimized tile-based rendering system for visualizing coal capacity factors:

### Key Components

1. **OptimizedStripeCanvas**: The main visualization component that renders capacity factor data as colored stripes
2. **PerformanceDisplay**: Real-time performance monitoring widget (toggle with Cmd+P)
3. **FacilityYearTile**: Optimized tile renderer using integer colors for 5x faster rendering
4. **YearDataVendor**: Manages year-based data fetching and caching with pre-rendered tiles

### Usage Example

```typescript
import { OptimizedStripeCanvas } from '../components/OptimizedStripeCanvas';
import { PerformanceDisplay } from '../components/PerformanceDisplay';

// In your component:
<OptimizedStripeCanvas
  unit={unit}
  dates={dates}
  height={rowHeight}
  onHover={handleHover}
/>
```

## Performance Features

- **Integer Color Optimization**: Uses pre-computed 32-bit integers instead of string colors
- **Tile-based Rendering**: Pre-renders facility data as tiles for instant display
- **Smart Caching**: LRU cache with configurable memory limits
- **Direct Pixel Manipulation**: Uses Uint32Array for fast canvas operations

## Testing

1. The server runs on http://localhost:3003
2. Open the performance display with Cmd+P
3. Visit `/tile-test` to see the tile rendering system in action
4. Monitor:
   - FPS and render times
   - Memory usage
   - Cache hit rates

## Configuration

See `src/shared/config.ts` for performance tuning options:
- `YEAR_DATA_CACHE_MAX_YEARS`: Maximum years to cache (default: 5)
- `TILE_CONFIG`: Tile rendering settings
- `REQUEST_QUEUE_CONFIG`: API request management