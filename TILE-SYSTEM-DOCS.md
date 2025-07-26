# Facility Tile Vendor Documentation

## Overview

The facility tile vendor is a performance optimization for rendering capacity factor visualizations for a facility. It pre-renders year-long strips of data for each unit in a facility into a canvas tile that can be efficiently composited when displaying date ranges. This avoids re-rendering the same data repeatedly during user interactions like panning.

The tile represents a facility in a given year. Using the faclity's code and the requested year we can assign it a label, eg "ERR-2025" which can be used as the cache key.

We are rebuilding this from the ground up, to eventuyally replace the tile system (see src/client/tile-system). Don't make any reference to it.


## Architecture Components

Much like the yearDataVendor, the FacilityTileVendor is based on an LRUcache.

The clients of the 

The height of the 



Later we will add a preloading manager, but for now don't include any preloading.




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

### 2. FacilityYearTileCache (`src/client/tile-system/YearDataCache.ts`)
Holds tiles for facilities, for a particular pixel width.
Uses the LRUcache, much like yearDataVendor.
- main function: async requestTile(facility: string, year: number): Promise<GeneratingUnitCapFacHistoryDTO> {
- **Purpose**: Holds tiles for facilities, for a particular pixel width.
- **Capacity**: Default 100 tiles
- **Memory Tracking**: 4 bytes per pixel (width × height × 4)
- **Key Format**: `{facilityCode}-{year}-{width}w`


Key features:
- Data is set externally (not fetched by the cache)
- Provides memory usage statistics
- Singleton instance exported as `yearDataCache`


Key features:
- Wraps a generic LRU cache implementation
- Tracks memory usage per tile
- Clears on viewport width changes
- Singleton instance exported as `tileCache`

### 4. FacilityYearTile
The rendering engine for individual tiles should have the exact same output as src/client/tile-system/Tile.ts 
- **Input**: facility, year, units with capacity factors, canvas width
- **Output**: Canvas with colored stripes representing capacity factors
- **Color Mapping**:
  - `null`: Light blue (#e6f3ff) - missing data
  - `< 25%`: Red (#ef4444) - low utilization
  - `25-100%`: Grayscale gradient - normal operation

Rendering process:
1. Creates canvas (OffscreenCanvas if available)
2. Renders each unit as horizontal bands
3. Each day is a vertical stripe colored by capacity factor
5. Optional debug overlay shows year number

### 5. FacilityDateRangeViewport
React component that composites tiles into the viewport:
- **Props**: Facility name, startDate, endDate
- **Rendering**:
  1. Calculates which year tiles are needed
  2. Requests tiles from TileManager
  3. Composites tile portions onto viewport canvas
  4. Handles partial year rendering at boundaries

Key logic:
- Always displays 365 days (1 year) in the viewport
- May need 1 or 2 tiles depending on date range
- Calculates source/destination coordinates for copying
- Has a function to translate coordinates back to a specific unit and date

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