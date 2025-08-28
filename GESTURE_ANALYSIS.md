# Gesture and Animation Analysis: Coal Stripes Viz

## Executive Summary

We're experiencing fundamental conflicts between our gesture handling implementation and how @use-gesture/@react-spring are designed to work together. The main issue: **we're trying to use springs for both gesture tracking AND momentum animations, causing state conflicts**.

## Current Implementation Problems

### 1. **Spring State Management Conflict**
Our spring (`x: 0`) represents the offset from `startDateRef.current`. During drag:
- We update the spring value with `springApi.set({ x: dayOffset })`
- On release with momentum, we try to animate from current position to momentum target
- **Problem**: The spring appears to be reset to 0 by @use-gesture's internal state management

### 2. **Coordinate System Mismatch**
- Our system: negative = forward in time, positive = backward in time
- @use-gesture: positive movement = right/down, negative = left/up
- This creates confusion in momentum calculations

### 3. **Multiple Animation Controllers Fighting**
- During drag: Direct date updates via `onDateNavigate()`
- During drag: Also updating spring with `springApi.set()`
- After release: Spring animation via `springApi.start()`
- Spring onChange: Also calling `onDateNavigate()`

This creates multiple sources of truth and potential race conditions.

## How @use-gesture + @react-spring SHOULD Work

Based on the research, here's the canonical pattern:

### Correct Pattern 1: Direct Manipulation + Release Animation

```javascript
const [{ x }, api] = useSpring(() => ({ x: 0 }))

const bind = useDrag(({ 
  active, 
  movement: [mx], 
  velocity: [vx],
  memo = x.get() // Store initial position
}) => {
  if (active) {
    // Direct manipulation during drag
    api.set({ x: mx + memo, immediate: true })
  } else {
    // Calculate momentum on release
    const momentum = vx * 200 // Scale velocity
    api.start({ 
      x: mx + memo + momentum,
      config: { tension: 200, friction: 30 }
    })
  }
  return memo // Return for next gesture
})
```

### Correct Pattern 2: Bounds with Rubberband

```javascript
const bind = useDrag(({ offset: [ox], memo = x.get() }) => {
  api.set({ x: ox + memo })
  return memo
}, {
  bounds: { left: -maxOffset, right: 0 },
  rubberband: true
})
```

## Why Our Implementation Fails

### The Core Issue: State Synchronization

1. **@use-gesture manages its own internal offset state**
   - It expects to control the gesture lifecycle
   - It resets internal state after gestures complete
   - The `from: () => [0, 0]` config forces reset to origin

2. **Our spring is not the source of truth**
   - We update dates directly via `onDateNavigate()`
   - Spring is a secondary animation layer
   - This creates desynchronization

3. **The spring gets reset because:**
   - @use-gesture's internal state management
   - Possible conflict with bounds calculation
   - The spring's initial value (`x: 0`) being restored

## Recommended Solution

Given that we know the full date range (2006-2025, ~7000 days), we can use absolute positioning.

### Critical Implementation Detail: Integer Positions

To prevent duplicate renders and ensure consistent behavior, **all position values must be integers**:

1. **Round at the source**: Convert all date calculations to integers immediately
2. **Work with integers throughout**: No fractional days in calculations
3. **Prevent duplicate renders**: Track last position to skip unchanged updates

```javascript
// All boundaries as integers from the start
const MIN_VALID_POSITION = Math.round(daysBetween(EARLIEST_DATE, boundaries.earliestDataEndDay));
const MAX_VALID_POSITION = Math.round(daysBetween(EARLIEST_DATE, boundaries.latestDataDay));
const initialPosition = Math.round(daysBetween(EARLIEST_DATE, currentEndDate));

// Track last position to prevent duplicate painting
const lastPositionRef = useRef<number>(initialPosition);

// In spring onChange handler
const intPosition = Math.round(value.position);
if (intPosition === lastPositionRef.current) {
  return; // Skip duplicate renders
}
lastPositionRef.current = intPosition;
```

This prevents the CompositeTile from being painted with the same offset twice in a row (which would interrupt loading shimmers).

### Option 1: Absolute Position Spring (Recommended)

```javascript
// Dynamic bounds calculation - all integers
const boundaries = getDateBoundaries()  // From your existing code
const EARLIEST_DATE = boundaries.earliestDataDay  // Jan 1, 2006
const LATEST_DATE = boundaries.latestDataDay      // Today or latest available
const TOTAL_DAYS = Math.round(daysBetween(EARLIEST_DATE, LATEST_DATE))  // Integer

// Spring represents absolute position in days from earliest date
const initialPosition = Math.round(daysBetween(EARLIEST_DATE, currentEndDate))
const lastPositionRef = useRef<number>(initialPosition)

const [{ position }, springApi] = useSpring(() => ({ 
  position: initialPosition,  // Start at current date (integer)
  config: config.default,
  onChange: ({ value }) => {
    if (value.position !== undefined) {
      // Round once (spring may have fractional values during animation)
      const intPosition = Math.round(value.position)
      
      // Skip if position hasn't changed (prevent duplicate painting)
      if (intPosition === lastPositionRef.current) {
        return
      }
      lastPositionRef.current = intPosition
      
      // Convert absolute position to date
      const endDate = EARLIEST_DATE.add({ days: intPosition })
      const clampedDate = boundaries.clampEndDateToDisplayBounds(endDate)
      onDateNavigate(clampedDate, isDraggingRef.current)
    }
  }
}))

// Define bounds - including "no man's land" areas (as integers)
// These come from your existing boundary calculations
const MIN_VALID_POSITION = Math.round(daysBetween(EARLIEST_DATE, boundaries.earliestDataEndDay))
const MAX_VALID_POSITION = Math.round(daysBetween(EARLIEST_DATE, boundaries.latestDataDay))

// Gesture updates spring with absolute positioning (integer math)
const bind = useDrag(({ 
  active, 
  movement: [mx],  // Use movement, not offset
  velocity: [vx],
  first,
  memo
}) => {
  if (first) {
    // Store starting position on first touch (as integer)
    memo = Math.round(position.get())
  }
  
  const dayDelta = pixelsToDays(mx)  // Returns integer
  const newPosition = memo - dayDelta  // Integer arithmetic
  
  if (active) {
    // During drag: only update if position changed
    if (newPosition !== lastPositionRef.current) {
      springApi.set({ position: newPosition, immediate: true })
    }
  } else {
    // After release: check if we're out of bounds
    const isOutOfBounds = newPosition < MIN_VALID_POSITION || 
                          newPosition > MAX_VALID_POSITION
    
    if (isOutOfBounds) {
      // Spring back to nearest valid boundary (integer)
      const targetPosition = newPosition < MIN_VALID_POSITION 
        ? MIN_VALID_POSITION 
        : MAX_VALID_POSITION
      
      springApi.start({ 
        position: targetPosition,
        config: { tension: 200, friction: 30 }  // Smooth spring back
      })
    } else if (Math.abs(vx) > 0.2) {
      // Apply momentum (integer result)
      const momentumDays = Math.round(vx * 300 / pixelsPerDay)
      const targetPosition = newPosition - momentumDays  // Integer math
      
      // Clamp momentum target to valid display bounds (integers)
      const clamped = Math.max(MIN_VALID_POSITION, 
                               Math.min(MAX_VALID_POSITION, targetPosition))
      
      springApi.start({ 
        position: clamped,
        config: { tension: 200, friction: 30 }
      })
    }
  }
  return memo
}, {
  bounds: { 
    // Set bounds for rubber-band effect during drag
    // These are slightly beyond the valid display range to allow "peeking"
    left: -(position.get() - MIN_VALID_POSITION + 100) * pixelsPerDay,  
    right: (MAX_VALID_POSITION - position.get() + 100) * pixelsPerDay
  },
  rubberband: 0.15  // 15% elasticity when dragging past bounds
})
```

### Option 2: Simplify Without Springs During Gesture

```javascript
// No spring during gesture, only for momentum
const [{ momentum }, springApi] = useSpring(() => ({ 
  momentum: 0,
  config: { tension: 200, friction: 30 },
  onChange: ({ value }) => {
    if (value.momentum !== 0) {
      const targetDate = currentDate.add({ days: Math.round(value.momentum) })
      onDateNavigate(targetDate, false)
    }
  }
}))

const bind = useDrag(({ 
  active, 
  movement: [mx],
  velocity: [vx],
  last
}) => {
  if (active) {
    // Direct date update during drag
    const dayOffset = pixelsToDays(mx)
    const targetDate = startDate.add({ days: dayOffset })
    onDateNavigate(targetDate, true)
  } else if (last && Math.abs(vx) > 0.2) {
    // Only use spring for momentum after release
    const momentumDays = calculateMomentum(vx)
    springApi.start({ 
      from: { momentum: 0 },
      to: { momentum: momentumDays }
    })
  }
})
```

## Key Differences from Standard Patterns

Our use case is unusual because:

1. **We're mapping gestures to time navigation** rather than spatial position
2. **We have complex bounds** based on data availability, not just viewport
3. **We need to coordinate multiple regions** that respond to the same gesture
4. **We're using a custom coordinate system** (negative = future)

## Important Context: Known Date Range

We know the full date range at startup (calculated dynamically):
- **Earliest date**: From `boundaries.earliestDataDay` (typically Jan 1, 2006)
- **Latest date**: From `boundaries.latestDataDay` (today or latest data available)
- **Total range**: Calculated via `daysBetween()` (currently ~7,135 days from Jan 2006 to Aug 2025, but grows daily)

This means we can represent ANY date as an absolute offset from the earliest date:
```javascript
const boundaries = getDateBoundaries()
const EARLIEST_DATE = boundaries.earliestDataDay
const dateToOffset = (date) => daysBetween(EARLIEST_DATE, date)
const offsetToDate = (offset) => EARLIEST_DATE.add({ days: offset })
```

## Recommendations

1. **Use absolute positioning**: Since we know the full date range dynamically, use absolute positions rather than relative offsets
2. **Single source of truth**: Let the spring's position value (in days from earliest date) be the only source of truth
3. **Remove conflicting configurations**: The `from: () => [0, 0]` is likely causing resets
4. **Simplify the animation pipeline**: Spring onChange drives dates, gestures drive spring
5. **Leverage @use-gesture's built-ins**: Use its bounds and rubberband for edge handling
6. **Clear coordinate system**: 
   - Spring position: 0 = earliest date, TOTAL_DAYS = latest date (dynamically calculated)
   - Gesture movement: positive = drag right (go back in time)
   - This eliminates negative number confusion

## How Out-of-Bounds Behavior Works

With absolute positioning, we handle three distinct zones:

1. **Valid display range**: From `earliestDataEndDay` to `latestDataDay` (showing full 1-year windows)
2. **Out-of-bounds "no man's land"**: Before `earliestDataEndDay` or after `latestDataDay` (CompositeTile can render but shows partial/no data)
3. **Hard limits**: Beyond 0 or TOTAL_DAYS (impossible to reach)

### During Drag:
- @use-gesture's `rubberband: 0.15` creates elastic resistance when dragging past bounds
- User can "peek" into out-of-bounds areas with increasing resistance
- The further past bounds, the harder to drag

### On Release:
- If position is out-of-bounds: Spring animates back to nearest valid boundary
- If in-bounds with velocity: Momentum is applied but clamped to valid range
- Smooth physics-based animation in all cases

## Why Absolute Positioning Solves Our Problems

Using absolute positioning (0 to TOTAL_DAYS) instead of relative offsets solves multiple issues:

1. **No more spring resets**: Spring value represents a real position, not a relative offset
2. **Clear bounds**: Dynamically calculated from `boundaries` object (with elasticity beyond)
3. **Simple momentum**: Just add/subtract days to current position
4. **No negative confusion**: Position is always positive, movement direction is clear
5. **Single source of truth**: Spring position directly maps to displayed date
6. **Natural out-of-bounds**: Rubberband during drag, spring-back on release
7. **Future-proof**: As new data arrives, TOTAL_DAYS grows automatically
8. **No duplicate renders**: Integer positions with deduplication prevent painting the same offset twice

## Conclusion

The libraries work well together when used as designed:
- @use-gesture for capturing gesture data
- @react-spring for smooth animations
- Direct manipulation during gestures
- Springs for release animations only

Our current implementation tries to use relative offsets and multiple sources of truth, creating state conflicts. By switching to absolute positioning with the spring as the single source of truth, we can leverage the libraries' strengths and eliminate the fighting between different animation controllers.

## Implementation Notes (V2)

### Key Principles
1. **Integer positions throughout**: All position calculations use integers to prevent fractional days
2. **Deduplication**: Track last position to prevent redundant renders that interrupt loading states
3. **Single source of truth**: Spring position (integer) drives everything
4. **Efficient updates**: Only update spring/DOM when position actually changes

### Performance Optimizations
- Round positions at calculation time, not display time
- Skip spring updates when position unchanged
- Prevent CompositeTile from re-rendering with same offset (preserves shimmer animations)
- Use integer arithmetic throughout for consistency