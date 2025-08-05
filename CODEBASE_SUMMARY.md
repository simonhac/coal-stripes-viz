# Coal Stripes Visualisation - TypeScript/React Codebase Summary

## Overview
This is a Next.js application that visualises Australian coal power plant capacity factors using an interactive stripes interface. The app fetches data from the OpenElectricity API and renders animated, draggable visualisations of coal facility performance over time.

---

## /src/shared/ Directory

### /src/shared/types.ts
**Purpose**: Core type definitions for capacity factor data and DTOs
**Exports**:
- Interfaces: UnitHistoryDTO (time series data), GeneratingUnitDTO (unit metadata + history), GeneratingUnitCapFacHistoryDTO (API response wrapper), GeneratingUnit (internal unit representation), Facility (grouped units by facility)

### /src/shared/date-utils.ts
**Purpose**: Date manipulation utilities using Adobe's @internationalized/date library
**Exports**:
- Functions: getDaysBetween (calculate days between dates), getDayIndex (day of year index), getDateFromIndex (date from day index), isLeapYear, parseAESTDateString (parse multiple date formats), getAESTDateTimeString (format AEST timestamps), getTodayAEST, getMonthName (3-letter abbreviations)

### /src/shared/config.ts
**Purpose**: Centralised configuration constants for the application
**Exports**:
- Constants: DATE_NAV_PHYSICS (drag/wheel/touch physics), PERF_CONFIG (performance monitoring), UI_CONFIG (responsive breakpoints), API_CONFIG, DATE_BOUNDARIES (data date ranges), TILE_CONFIG (debug rendering), SERVER_REQUEST_QUEUE_CONFIG, CLIENT_REQUEST_QUEUE_CONFIG, CACHE_CONFIG

### /src/shared/feature-flags.ts
**Purpose**: Dynamic feature flag management with localStorage persistence
**Exports**:
- Classes: FeatureFlagsStore (singleton for managing flags)
- Instances: featureFlags (singleton instance)

### /src/shared/performance-monitor.ts
**Purpose**: Performance monitoring utility for tracking render times and metrics
**Exports**:
- Classes: PerformanceMonitor (singleton for performance tracking)
- Interfaces: PerformanceMetric (metric data structure)
- Instances: perfMonitor (singleton instance)

### /src/shared/capacity-factor-color-map.ts
**Purpose**: Colour mapping for capacity factor values with pre-computed colour arrays
**Exports**:
- Classes: CapacityFactorColorMap (singleton colour mapper)
- Functions: getProportionColorHex, getProportionColorInt (convenience functions)
- Instances: capacityFactorColorMap (singleton instance)

### /src/shared/date-boundaries.ts
**Purpose**: Centralised date boundary calculations and validation
**Exports**:
- Functions: getDateBoundaries (returns all boundary calculations with utility methods)
- Types: DateBoundaries (return type with utility methods)

### /src/shared/lru-cache.ts
**Purpose**: Generic LRU cache implementation with size tracking and expiration
**Exports**:
- Classes: LRUCache<T> (generic cache with eviction)
- Interfaces: CacheStats (cache statistics), CacheItem<T> (cache entry)

### /src/shared/request-queue.ts
**Purpose**: Request queue with rate limiting, retries, and circuit breaker
**Exports**:
- Classes: RequestQueue<T> (queue implementation)
- Interfaces: QueuedRequest<T>, RequestQueueConfig, QueueStats

### /src/shared/request-queue-logger.ts
**Purpose**: Logging interface and implementations for request queues
**Exports**:
- Classes: ConsoleRequestQueueLogger, NoOpRequestQueueLogger
- Interfaces: RequestQueueLogger, LogEntry
- Types: LogEventType

---

## /src/client/ Directory

### /src/client/facility-factory.ts
**Purpose**: Factory functions for creating Facility objects from DTOs
**Exports**:
- Functions: createFacility (single facility from DTOs), createFacilitiesFromUnits (group units by facility)

### /src/client/cap-fac-year.ts
**Purpose**: Year data structure with facility tiles and regional aggregations
**Exports**:
- Interfaces: CapFacYear (complete year data with tiles)
- Functions: createCapFacYear (build year data with rendered tiles)

### /src/client/facility-year-tile.ts
**Purpose**: Canvas-based tile rendering for facility capacity factors
**Exports**:
- Classes: FacilityYearTile (renders facility data to canvas with tooltip support)

### /src/client/year-data-vendor.ts
**Purpose**: Data vendor with caching, prefetching, and capacity factor calculations
**Exports**:
- Classes: YearDataVendor (main data vendor with LRU cache)
- Interfaces: GenerationStats (capacity factor statistics)
- Functions: calculateAverageCapacityFactor, getRegionNames (long/short region names)
- Instances: yearDataVendor (singleton instance)

### /src/client/debugging/ Directory

#### /src/client/debugging/index.ts
**Purpose**: Main exports for debugging module
**Exports**:
- Types: SessionType (MOVE/WHEEL/TOUCH)
- Classes: InteractionSession, MoveSession, WheelSession, TouchSession, SessionManager

#### /src/client/debugging/types.ts
**Purpose**: Shared types for interaction sessions
**Exports**:
- Enums: SessionType (interaction types)

#### /src/client/debugging/SessionManager.ts
**Purpose**: Singleton manager for active interaction sessions
**Exports**:
- Classes: SessionManager (manages session lifecycle)

---

## /src/server/ Directory

### /src/server/cap-fac-data-service.ts
**Purpose**: Main data service that fetches and processes OpenElectricity API data
**Exports**:
- Classes: CapFacDataService (main service with caching and processing)
- Functions: getCoalDataService (singleton factory)

### /src/server/queued-oeclient.ts
**Purpose**: Wrapper around OpenElectricityClient with request queuing
**Exports**:
- Classes: OEClientQueued (queued API client wrapper)

### /src/server/request-logger.ts
**Purpose**: File-based request logging for server operations
**Exports**:
- Classes: RequestLogger (file logger with rotation)
- Functions: initializeRequestLogger, getRequestLogger, cleanupRequestLogger

### /src/server/file-request-queue-logger.ts
**Purpose**: File-based logger adapter for request queues
**Exports**:
- Classes: FileRequestQueueLogger (adapts RequestLogger to RequestQueueLogger interface)

---

## /src/components/ Directory

### /src/components/DateRange.tsx
**Purpose**: Display component for date range with proper formatting
**Exports**:
- Components: DateRange (shows formatted start/end dates)

### /src/components/OpenElectricityHeader.tsx
**Purpose**: Header component with OpenElectricity branding and navigation
**Exports**:
- Components: OpenElectricityHeader (header with logo and nav)

### /src/components/CapFacTooltip.tsx
**Purpose**: Tooltip component for displaying capacity factor data
**Exports**:
- Components: CapFacTooltip (tooltip with formatted data)
- Interfaces: TooltipData (tooltip data structure)
- Functions: getTooltipFormattedDate (date formatting utility)

### /src/components/FacilityLabel.tsx
**Purpose**: Interactive label for facilities with tooltip integration
**Exports**:
- Components: FacilityLabel (clickable facility label with hover/pin support)

### /src/components/RegionLabel.tsx
**Purpose**: Interactive label for regions with capacity factor calculation
**Exports**:
- Components: RegionLabel (clickable region label with responsive text)

### /src/components/CompositeTile.tsx
**Purpose**: Main visualisation component that renders facility stripes across year boundaries
**Exports**:
- Components: CompositeTile (complex canvas-based stripe rendering with tooltip support)

### /src/components/RegionSection.tsx
**Purpose**: Container component for a region's facilities with unified drag handling
**Exports**:
- Components: RegionSection (region container with facility tiles and drag support)

### /src/components/PerformanceDisplay.tsx
**Purpose**: Developer tool for monitoring performance, cache, and feature flags
**Exports**:
- Components: PerformanceDisplay (draggable performance monitor overlay)

### /src/components/CapFacXAxis.tsx
**Purpose**: Month-based x-axis with capacity factor colour coding
**Exports**:
- Components: CapFacXAxis (interactive monthly axis with regional data)

---

## /src/hooks/ Directory

### /src/hooks/useFeatureFlag.ts
**Purpose**: React hooks for feature flag integration
**Exports**:
- Functions: useFeatureFlag (single flag hook), useAllFeatureFlags (hook for all flags)

### /src/hooks/useTouchAsHover.ts
**Purpose**: Convert touch events to hover behaviour for mobile interaction
**Exports**:
- Functions: useTouchAsHover (touch-to-hover conversion)

### /src/hooks/useKeyboardNavigation.ts
**Purpose**: Keyboard navigation with animated transitions
**Exports**:
- Functions: useKeyboardNavigation (arrow keys, Home, T, S navigation)

### /src/hooks/useUnifiedDrag.ts
**Purpose**: Core drag physics engine independent of input method
**Exports**:
- Functions: useUnifiedDrag (unified drag state and physics)

### /src/hooks/useMouseDrag.ts
**Purpose**: Mouse event handlers for drag operations
**Exports**:
- Functions: useMouseDrag (mouse-specific drag handling)

### /src/hooks/useTouchDrag.ts
**Purpose**: Two-finger touch drag with gesture detection
**Exports**:
- Functions: useTouchDrag (two-finger touch drag)

### /src/hooks/useWheelDrag.ts
**Purpose**: Trackpad/wheel horizontal scrolling to drag conversion
**Exports**:
- Functions: useWheelDrag (wheel event to drag conversion)

### /src/hooks/useDateRangeAnimator.ts
**Purpose**: Central animator with rubber band physics, momentum, and spring animations
**Exports**:
- Functions: useDateRangeAnimator (physics-based date navigation)

---

## /src/app/ Directory

### /src/app/layout.tsx
**Purpose**: Next.js root layout with fonts and metadata
**Exports**:
- Components: RootLayout (root HTML layout)
- Constants: metadata (page metadata)

### /src/app/page.tsx
**Purpose**: Main application page with state management and region rendering
**Exports**:
- Components: Home (main page component with data loading and region sections)

### /src/app/api/capacity-factors/route.ts
**Purpose**: Next.js API route for capacity factor data
**Exports**:
- Functions: GET (API handler for year-based capacity factor requests)

---

## Key Architectural Patterns

1. **Separation of Concerns**: Clear separation between client (browser-only), server (API), and shared (universal) code
2. **Singleton Pattern**: Used extensively for caches, loggers, performance monitors, and data vendors
3. **Factory Pattern**: Used for creating facilities and year data structures
4. **Observer Pattern**: Custom events for tooltip coordination and date navigation
5. **Physics-Based Animation**: Sophisticated drag/momentum/spring physics for smooth interactions
6. **Caching Strategy**: LRU caches on both client and server with different expiration policies
7. **Request Queue Management**: Rate limiting, retries, and circuit breaker patterns
8. **Canvas Optimisation**: Pre-rendered tiles with efficient pixel manipulation
9. **Responsive Design**: Mobile-specific behaviours and breakpoints
10. **Type Safety**: Comprehensive TypeScript types throughout the application

The codebase demonstrates advanced React patterns, sophisticated state management, and high-performance canvas rendering for a data-intensive visualisation application.