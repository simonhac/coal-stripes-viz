# Time-Scrolling Feature - Todo List (MVP + Enhanced)

## Overview
Implement smooth, continuous time-scrolling for the coal stripes visualization with year long data chunks. Users can scroll by days, weeks, months, or years using click-drag or two-finger swipe gestures.

## Key Design Principles
- **Smooth continuous scrolling**: Pixel-perfect mapping to days (not discrete year jumps)
- **year long data chunks**: Efficient API loading strategy, loading from 1 jan to 31 dec for each year
- **365-day viewport**: Always show exactly 365 days, sliding window through time
- **Gesture-based**: Direct manipulation via mouse drag or two-finger touch swipe

---

# VERSION 1: MINIMUM VIABLE PRODUCT (MVP)
*Core time-scrolling functionality with smooth performance*

## Success Criteria for V1
- [ ] Smooth 60 FPS dragging without lag
- [ ] Load historical data seamlessly 
- [ ] Instant visual feedback during scroll
- [ ] Works with mouse drag and two-finger horizontal touch swipe
- [ ] < 2 second load time for new data

## V1 Phase 1: Basic Data Management

### 1.1 Simple TimeSeriesCache
- [ ] Create `src/lib/time-series-cache.ts`
- [ ] Basic cache structure:
  ```typescript
  interface CacheEntry {
    chunkKey: string; // e.g., "2024-01-01" - only for cache lookup
    startDate: CalendarDate;
    endDate: CalendarDate;
    data: CoalStripesData;
    lastAccessed: number;
  }
  
  interface ViewWindow {
    centerDate: CalendarDate;
    startDate: CalendarDate;
    endDate: CalendarDate;
    pixelsPerDay: number;
  }
  ```
- [ ] Essential methods:
  - [ ] `getDataForDateRange(start: CalendarDate, end: CalendarDate): CoalStripesData | null`
  - [ ] `addChunk(startDate: CalendarDate, data: CoalStripesData): void`
  - [ ] `hasDataForDate(date: CalendarDate): boolean`
  - [ ] `getCacheStats(): { sizeMB: number, chunkCount: number }`
  - [ ] `clear(): void`

### 1.2 Update Coal Data Service
- [ ] Add `getCoalStripesDataRange(startDate: CalendarDate, endDate: CalendarDate)`
- [ ] Keep existing `getCoalStripesData(days: number)` unchanged
- [ ] Simple request deduplication (prevent duplicate API calls)
- [ ] **Add comprehensive API logging**:
  - [ ] Log start of every fetch with date range
  - [ ] Log success with elapsed time and cache statistics
  - [ ] Log failures with error details
  - [ ] Include memory usage tracking

## V1 Phase 2: Core Scrolling Implementation

### 2.1 Basic Scroll State
- [ ] Create `src/hooks/useTimeScroll.ts`
- [ ] Simple state management:
  ```typescript
  interface TimeScrollState {
    viewWindow: ViewWindow;
    isDragging: boolean;
    dragStartX: number;
    dragStartCenterDate: string;
    currentDragDelta: number;
  }
  ```

### 2.2 Pixel-to-Time Mapping
- [ ] Calculate viewport pixels per day:
  ```typescript
  const pixelsPerDay = viewportWidth / 365;
  const pixelsToDays = (pixels: number) => pixels / pixelsPerDay;
  ```
- [ ] Convert drag distance to date offset
- [ ] Handle timezone consistently (Australia/Brisbane)

### 2.3 Drag Gestures (Essential)
- [ ] **Mouse events**:
  - [ ] `onMouseDown`: Record start position and date
  - [ ] `onMouseMove`: Calculate new center date, update view
  - [ ] `onMouseUp`: Finalize position
- [ ] **Touch events**:
  - [ ] `onTouchStart`: Support single touch
  - [ ] `onTouchMove`: Handle horizontal swipe
  - [ ] `onTouchEnd`: Finalize position
- [ ] **Immediate visual feedback**:
  ```typescript
  // Move container instantly during drag
  containerElement.style.transform = `translateX(${deltaX}px)`;
  ```

### 2.4 Basic Data Loading
- [ ] Load adjacent chunks when approaching boundaries
- [ ] Simple preloading: 1 chunk ahead in scroll direction
- [ ] Show loading indicator when fetching

## V1 Phase 3: Essential Performance

### 3.1 Smooth Rendering
- [ ] Use CSS transforms for movement (GPU accelerated)
- [ ] `will-change: transform` for performance hints
- [ ] RequestAnimationFrame for smooth updates

### 3.2 Simple Loading States
- [ ] **Skeleton placeholders**:
  - [ ] Grey stripes with correct dimensions
  - [ ] Maintain layout during loading
  - [ ] Simple loading animation
- [ ] **Basic transitions**:
  - [ ] Smooth replacement when data loads
  - [ ] No jarring layout shifts

### 3.3 Memory Management (Basic)
- [ ] Limit cache to 5 chunks maximum
- [ ] Evict oldest chunks when limit reached
- [ ] Clear cache on page refresh

## V1 Phase 4: Essential UI

### 4.1 Date Range Indicator
- [ ] Show current date range during scroll
- [ ] Format: "20 Jul 2023 - 19 Jul 2024"  
- [ ] Update in real-time during drag
- [ ] Hide when not scrolling

### 4.2 Loading Feedback
- [ ] Thin progress bar during chunk loads
- [ ] Simple "Loading..." text if needed
- [ ] Error message for failed loads

### 4.3 Reset Control
- [ ] "Today" button to return to present
- [ ] Keyboard shortcut (Home key)

## V1 Phase 5: Essential Testing

### 5.1 Core Functionality Tests
- [ ] Test drag scrolling by known distances
- [ ] Test data loading at boundaries  
- [ ] Test cache eviction
- [ ] Test error handling

### 5.2 Performance Validation
- [ ] Measure FPS during scrolling
- [ ] Test memory usage with extended use
- [ ] Verify on mobile devices

## V1 Implementation Timeline
- **Week 1**: Data management + basic scrolling
- **Week 2**: Polish performance + loading states  
- **Week 3**: Testing + bug fixes

---

# VERSION 2: ENHANCED FEATURES
*Advanced optimizations and user experience improvements*

## V2 Success Criteria
- [ ] Buttery smooth scrolling even with fast gestures
- [ ] Instant historical context via monthly previews
- [ ] Advanced gesture physics (momentum, rubber-band)
- [ ] Comprehensive accessibility
- [ ] Rich timeline navigation

## V2 Phase 1: Advanced Data Strategies

### 1.1 Monthly Preview System
- [ ] **Monthly data pre-fetching**:
  ```typescript
  // Load 5 years of monthly data on startup
  const loadMonthlyOverview = async () => {
    return await getCoalStripesDataRange(
      '2019-01-01', '2024-12-31', 
      { interval: '1M' }
    );
  };
  ```
- [ ] **Three-tier rendering**:
  - [ ] Skeleton (0ms)
  - [ ] Monthly preview (50-100ms)  
  - [ ] Daily detail (1-2s)

### 1.2 Smart Interpolation
- [ ] **Pattern-based estimation**:
  - [ ] Use same month from adjacent years
  - [ ] Seasonal pattern recognition
  - [ ] Facility-specific capacity curves
- [ ] **Optimistic rendering**:
  - [ ] Generate estimates from available data
  - [ ] Smooth transition to real data

### 1.3 Advanced Caching
- [ ] **Sliding window cache** (7+ years)
- [ ] **LRU eviction** with usage tracking
- [ ] **Memory pressure handling**
- [ ] **Compression** for older data

## V2 Phase 2: Advanced Interactions

### 2.1 Gesture Physics
- [ ] **Momentum scrolling**:
  - [ ] Calculate velocity on release
  - [ ] Smooth deceleration with friction
  - [ ] Configurable momentum settings
- [ ] **Rubber-band effects**:
  - [ ] Resistance when hitting data boundaries
  - [ ] Visual feedback for limits
  - [ ] Smooth bounce-back animation

### 2.2 Multi-touch Gestures
- [ ] Two-finger swipe optimization
- [ ] Pinch-to-zoom timeline (future)
- [ ] Gesture recognition improvements

### 2.3 Velocity-based Prediction
- [ ] **Smart preloading**:
  ```typescript
  const predictDestination = (velocity: number, direction: number) => {
    const predictedDays = velocity * direction * 2;
    const targetDate = addDays(currentDate, predictedDays);
    preloadChunkForDate(targetDate);
  };
  ```
- [ ] **Priority loading queue**
- [ ] **Request cancellation** for abandoned scrolls

## V2 Phase 3: Advanced Performance

### 3.1 Canvas Rendering (Optional)
- [ ] Evaluate performance gains vs DOM
- [ ] Implement if needed for 60+ FPS
- [ ] Maintain hover interactions

### 3.2 Virtual Rendering
- [ ] Only render visible facilities + buffer
- [ ] Dynamic loading based on scroll speed
- [ ] Intersection observer optimization

### 3.3 Advanced Loading States
- [ ] **Progressive enhancement layers**
- [ ] **Smart caching strategies**
- [ ] **Background prefetching**
- [ ] **Performance monitoring**

## V2 Phase 4: Rich UI Features

### 4.1 Timeline Component
- [ ] **Mini timeline** showing data availability
- [ ] **Current position indicator**
- [ ] **Click-to-jump** functionality
- [ ] **Year markers** and navigation

### 4.2 Navigation Controls
- [ ] **Previous/Next year buttons**
- [ ] **Play button** for animated scrolling
- [ ] **Keyboard shortcuts** (arrows, page up/down)
- [ ] **URL state** for shareable positions

### 4.3 Advanced Visual Feedback
- [ ] **Loading progress indicators**
- [ ] **Gesture hints** for new users
- [ ] **Smooth transitions** between states
- [ ] **Error recovery** UI

## V2 Phase 5: Accessibility & Polish

### 5.1 Accessibility
- [ ] **ARIA labels** for time navigation
- [ ] **Keyboard-only navigation**
- [ ] **Screen reader announcements**
- [ ] **High contrast mode** support

### 5.2 Configuration
- [ ] **User preferences**:
  - [ ] Scroll sensitivity
  - [ ] Momentum on/off  
  - [ ] Animation preferences
- [ ] **Developer settings**:
  - [ ] Cache size limits
  - [ ] Debug performance stats
  - [ ] API rate limiting

### 5.3 Advanced Testing
- [ ] **Comprehensive gesture testing**
- [ ] **Performance benchmarking**
- [ ] **Memory leak detection**
- [ ] **Cross-browser compatibility**
- [ ] **Mobile device testing**

## V2 Implementation Timeline
- **Month 1**: Monthly previews + advanced caching
- **Month 2**: Gesture physics + performance optimization
- **Month 3**: Rich UI + accessibility + testing

---

# FINAL SUCCESS METRICS

## Version 1 (MVP)
- [ ] 60 FPS scrolling on modern devices
- [ ] < 100ms drag response time
- [ ] < 2s historical data loading
- [ ] Works on desktop + mobile
- [ ] Intuitive gesture response

## Version 2 (Enhanced)  
- [ ] < 50ms instant preview display
- [ ] Momentum physics feel natural
- [ ] Comprehensive accessibility compliance
- [ ] Advanced timeline navigation
- [ ] < 300MB memory with 7 years cached

## Configuration Example
```typescript
// V1 - Simple config
interface V1Config {
  maxCacheChunks: number;    // Default: 5
  pixelSensitivity: number;  // Default: 1.0
}

// V2 - Advanced config  
interface V2Config extends V1Config {
  enableMomentum: boolean;
  momentumFriction: number;
  enableMonthlyPreviews: boolean;
  maxCacheYears: number;
  preloadAggressiveness: 'low' | 'medium' | 'high';
}
```

---

## CRITICAL IMPLEMENTATION NOTES

### ⚠️ Date Handling Requirements

**NEVER use JavaScript Date objects - they are awful and cause timezone issues!**

**ALWAYS use @internationalized/date for all date operations:**

```typescript
import { CalendarDate, ZonedDateTime, today, parseDate } from '@internationalized/date';

// ✅ CORRECT - Use CalendarDate objects throughout
interface ViewWindow {
  centerDate: CalendarDate;        // NOT string!
  startDate: CalendarDate;         // NOT string!  
  endDate: CalendarDate;           // NOT string!
  pixelsPerDay: number;
}

interface CacheEntry {
  chunkKey: string;               // Only for cache lookup
  startDate: CalendarDate;        // Proper date object
  endDate: CalendarDate;          // Proper date object  
  data: CoalStripesData;
  lastAccessed: number;
}

// ✅ CORRECT - Date arithmetic with CalendarDate
const scrollToOffset = (currentDate: CalendarDate, dayOffset: number) => {
  return currentDate.add({ days: dayOffset });
};

const daysBetween = (start: CalendarDate, end: CalendarDate) => {
  return start.until(end).days;
};

// ✅ CORRECT - Only stringify for API boundaries
const fetchDataForRange = (start: CalendarDate, end: CalendarDate) => {
  return api.getData({
    dateStart: start.toString(),  // Only convert here
    dateEnd: end.toString()       // Only convert here  
  });
};

// ❌ WRONG - Never do this
const badDate = new Date('2024-01-01');  // NEVER!
const badString = '2024-01-01';          // Minimize these
```

**Key Principles:**
- Use CalendarDate/ZonedDateTime objects throughout the application
- Only convert to strings at API boundaries and display formatting
- Leverage @internationalized/date's timezone-safe arithmetic
- All date state should be CalendarDate objects, not strings

### 📊 Performance Logging Requirements

**ALL API fetches must include clean console output with:**

```typescript
// Example console output format:
console.log(`📡 API fetch: 2023-07-20 → 2024-07-19 (365 days) | ${elapsed}ms | Cache: ${cacheSize}MB (${chunks} chunks)`);
console.log(`✅ API success: 2023-01-01 → 2023-03-31 (90 days) | 1,247ms | Memory: 127MB (3 chunks)`);
console.log(`❌ API failed: 2022-06-01 → 2023-05-31 (365 days) | 3,891ms | Error: Rate limit exceeded`);

// Implementation requirements:
const logApiRequest = (start: CalendarDate, end: CalendarDate, type: 'start' | 'success' | 'error', elapsed?: number, error?: string) => {
  const days = start.until(end).days;
  const range = `${start.toString()} → ${end.toString()} (${days} days)`;
  
  if (type === 'start') {
    console.log(`📡 API fetch: ${range}`);
  } else if (type === 'success') {
    const cacheStats = getCacheStats(); // { sizeMB: number, chunkCount: number }
    console.log(`✅ API success: ${range} | ${elapsed}ms | Cache: ${cacheStats.sizeMB}MB (${cacheStats.chunkCount} chunks)`);
  } else {
    console.log(`❌ API failed: ${range} | ${elapsed}ms | Error: ${error}`);
  }
};
```

**Required for all data fetching operations:**
- Daily data requests (`interval: '1d'`)
- Monthly data requests (`interval: '1M'`) 
- Cache hits vs misses
- Background preloading
- Failed requests with error details

**Memory statistics to track:**
- Total cache size in MB
- Number of cached chunks
- Browser memory usage (if available via `performance.memory`)
- Data compression ratios (V2)