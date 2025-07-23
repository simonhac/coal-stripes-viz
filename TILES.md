# Tile-Based Rendering Implementation

## Phase 1: Core Infrastructure
- [ ] Create `TileManager` class to orchestrate tile lifecycle
- [ ] Create `Tile` class for individual tile rendering
- [ ] Create `TileCache` with LRU eviction
- [ ] Create `Viewport` class for managing visible area
- [ ] Add ResizeObserver to detect viewport changes
- [ ] Implement cache clearing on viewport resize

## Phase 2: API Changes
- [ ] Create new endpoint `/api/coal-stripes/facility/[facility]/year/[year]`
- [ ] Return single facility data for one year
- [ ] Remove year boundary constraints
- [ ] Add batch endpoint for multiple facility-years

## Phase 3: Tile Rendering
- [ ] Implement client-side canvas pre-rendering per tile
- [ ] Calculate tile dimensions based on viewport width
- [ ] Create render queue with priority (visible → adjacent → distant)
- [ ] Add terse logging: `[TILE] Rendered: ERARING-2023 (45ms)`
- [ ] Implement progressive rendering from center outward

## Phase 4: Viewport & Scrolling
- [ ] Replace current panning with tile-based viewport
- [ ] Implement smooth scrolling with CSS transforms
- [ ] Calculate visible tiles based on scroll position
- [ ] Add 1-tile buffer zone for pre-loading
- [ ] Handle tile loading/unloading on scroll

## Phase 5: Performance Testing
- [ ] Create rendering speed benchmark
- [ ] Measure tile render times
- [ ] Test with first NSW facility only
- [ ] Visual testing of smooth scrolling
- [ ] Memory usage profiling

## Phase 6: Integration
- [ ] Replace existing canvas components with tile system
- [ ] Maintain hover/tooltip functionality
- [ ] Update month labels to work with tiles
- [ ] Handle partial year data gracefully

## Phase 7: Optimization
- [ ] Consider Web Workers for rendering
- [ ] Implement RequestAnimationFrame batching
- [ ] Add Intersection Observer for visibility
- [ ] Optimize canvas drawing operations

## Future
- [ ] Extend to all facilities
- [ ] Add vertical scrolling for facilities
- [ ] Implement zoom levels