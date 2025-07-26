# Tile System Documentation

## Overview

The tile system is a performance optimization for rendering capacity factor visualizations. It pre-renders year-long strips of data into canvas tiles that can be efficiently composited when displaying date ranges. This avoids re-rendering the same data repeatedly during user interactions like panning.

## Architecture Components

### 1. TileManager (`src/client/tile-system/TileManager.ts`)
The central orchestrator that manages the entire tile lifecycle:
- **Viewport Management**: Tracks the current visible date range and viewport dimensions
- **Render Queue**: Prioritizes tile rendering (0=visible, 1=adjacent, 2+=distant)
- **Status Tracking**: Maintains state for each tile (empty → loading → loaded → rendering → ready)
- **Unit Heights**: Stores the pixel heights for each generating unit per facility
- **Cache Coordination**: Interfaces with both TileCache and YearDataCache

Key methods:
- `setViewport()`: Updates the visible date range and triggers re-rendering if width changes
- `setYearData()`: Feeds year data into the YearDataCache (data comes from parent, not fetched)
- `getTile()`: Returns a rendered tile from cache or queues it for rendering
- `processRenderQueue()`: Async worker that renders tiles in priority order

### 2. YearDataCache (`src/client/tile-system/YearDataCache.ts`)
An LRU cache for raw year data from the API:
- **Purpose**: Stores `GeneratingUnitCapFacHistoryDTO` objects by year
- **Capacity**: Default 10 years, evicts least recently used
- **Memory Tracking**: Estimates size using JSON.stringify length
- **Access Ordering**: Maintains access order for LRU eviction

Key features:
- Data is set externally (not fetched by the cache)
- Provides memory usage statistics
- Singleton instance exported as `yearDataCache`

### 3. TileCache (`src/client/tile-system/TileCache.ts`)
An LRU cache for rendered canvas tiles:
- **Purpose**: Stores pre-rendered `RenderedTile` objects
- **Capacity**: Default 50 tiles
- **Memory Estimation**: 4 bytes per pixel (width × height × 4)
- **Key Format**: `facilityName-year`

Key features:
- Wraps a generic LRU cache implementation
- Tracks memory usage per tile
- Clears on viewport width changes
- Singleton instance exported as `tileCache`

### 4. Tile (`src/client/tile-system/Tile.ts`)
The rendering engine for individual tiles:
- **Input**: TileData (facility, year, units with capacity factors)
- **Output**: Canvas with colored stripes representing capacity factors
- **Color Mapping**:
  - `null`: Light blue (#e6f3ff) - missing data
  - `< 25%`: Red (#ef4444) - low utilization
  - `25-100%`: Grayscale gradient - normal operation

Rendering process:
1. Creates canvas (OffscreenCanvas if available)
2. Renders each unit as horizontal bands
3. Each day is a vertical stripe colored by capacity factor
4. Adds subtle separator lines between units
5. Optional debug overlay shows year number

### 5. TileViewport (`src/components/TileViewport.tsx`)
React component that composites tiles into the viewport:
- **Props**: Facility name, date range, unit heights, tile manager
- **Rendering**: 
  1. Calculates which year tiles are needed
  2. Requests tiles from TileManager
  3. Composites tile portions onto viewport canvas
  4. Handles partial year rendering at boundaries

Key logic:
- Always displays 365 days (1 year) in the viewport
- May need 1 or 2 tiles depending on date range
- Calculates source/destination coordinates for copying

## Data Flow

1. **Parent Component** (e.g., main page):
   - Fetches year data from API
   - Creates/manages TileManager instance
   - Calls `tileManager.setYearData()` to populate cache

2. **TileViewport Requests Tile**:
   - Calls `tileManager.getTile()`
   - If cached, returns immediately
   - Otherwise queues for rendering

3. **Tile Rendering Pipeline**:
   ```
   YearDataCache → TileManager → Tile → TileCache
                         ↓
                   Render Queue
   ```

4. **Viewport Composition**:
   - TileViewport reads from TileCache
   - Composites tile portions based on date range
   - Displays final result

## Issues and Limitations

1. **Hard-coded Facilities**: Currently only supports "Eraring" facility (line 206 in TileManager)
2. **Memory Management**: No upper bound on total memory usage across both caches
3. **Synchronization**: Complex state management between loading, rendering, and caching
4. **Error Recovery**: Tiles marked as error won't retry automatically
5. **Viewport Assumptions**: Always assumes 365-day viewport width
6. **Missing Abstraction**: Direct coupling between components and specific data structures

## Configuration

From `src/shared/config.ts`:
```typescript
TILE_CONFIG: {
  SHOW_DEBUG_OVERLAY: false,
  DEBUG_BORDER_COLOR: 'red',
  DEBUG_BORDER_WIDTH: 2,
  DEBUG_TEXT_COLOR: 'red',
  DEBUG_TEXT_SIZE: 48
}
```

## Performance Characteristics

- **Initial Load**: Slow (must render visible tiles)
- **Panning**: Fast (tiles pre-rendered)
- **Zoom/Resize**: Slow (cache cleared, must re-render)
- **Memory Usage**: ~4MB per tile at typical resolutions
- **Render Time**: 50-200ms per tile depending on size

## Future Improvements Needed

1. Support multiple facilities dynamically
2. Implement tile recycling for memory constraints
3. Add progressive rendering for large datasets
4. Implement tile prefetching strategies
5. Add WebGL rendering for better performance
6. Decouple from specific data formats
7. Add proper error handling and retry logic
8. Implement tile invalidation on data updates