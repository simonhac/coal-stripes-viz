- Always use Australian English spellings such as colour, visualise, optimise instead of American English spellings (eg. color, visualize and optimze). If you see American English spelling in my code, suggest a change.

- This project has a strong separation of concerns between the client and the server.
- The server talks to OpenElectricity using the OpenElectricityClient libarary.
- The client never talks directly to OpenElectricity, only to our server.

- When a generating unit is inoperable (due to maintenance or outages) it's capacity factor will be zero, not null/undefined.
- When a capacity factor is unknown — either because the associated date is in the future or, for dates in the past, the data collection infrastructure is faulty — this is always represented as null.

- Never interpret null as zero or vice versal. Often null means "no data". Zero is a zero quantity. These are distinct concepts different and must never be swapped.

- Except where necessary (ie. interfacing external code), do not use the built-in javascript Date object. Use Adobe's @internationalized/date, and note that we have many date functions in src/shared/date-utils.ts

- Environment variables are defined and stored in `.env.local`

- When searching code, prefer ast-grep for syntax-aware and structural matching, using flags like `--lang rust -p '<pattern>'` for language-specific structural searches, instead of text-only tools like rg or grep.

## @use-gesture Library Behavior

**IMPORTANT**: The `velocity` value from @use-gesture's `useDrag` is NOT a true velocity vector - it's always positive (it's actually speed):
- `velocity[0]` (vx) is always >= 0 - it's the absolute speed in pixels/ms
- To get the actual direction, you must use the `direction` field
- `direction[0]` (dx) is -1 (left), 0 (still), or 1 (right)
- True velocity vector = `velocity[0] * direction[0]`

This is confirmed by examining the source code where velocity is calculated as:
```javascript
const absoluteDelta = state.delta.map(Math.abs);
state.velocity = [absoluteDelta[0] / dt, absoluteDelta[1] / dt];
state.direction = state.delta.map(Math.sign);
```

When implementing momentum or physics-based animations with @use-gesture, always combine `velocity` with `direction` to get the correct motion vector.

## react-spring API: `set()` vs `start()`

### Use `start()` with `immediate: true` for drag operations

### The Official Difference:
- **`set()`** = Shorthand for `start({ immediate: true })` - instant update, no animation
- **`start()`** = Triggers animations with spring physics

### The Reality (Based on GitHub Issues):
- `set()` has known bugs, especially with `useSprings` (doesn't update properly)
- `set()` may not always update the spring's internal value correctly
- The react-spring team recommends using `start()` as the primary method

### Best Practice for Drag Gestures:
```javascript
// During drag - immediate updates
api.start({ 
  offset: targetValue, 
  immediate: true  // This is key for smooth dragging
})

// After release - animated transitions
api.start({ 
  offset: targetValue,
  config: { tension: 120, friction: 20 }
})
```

### Why This Matters:
`set()` has a bug where it doesn't properly update the spring's internal value, which causes the spring to "jump back" to its original position. Using `start({ immediate: true })` is more reliable and is the pattern used in all modern @use-gesture examples.

### Important: `immediate: true` doesn't stop at current position
`immediate: true` makes the spring jump to the target value immediately, but it doesn't cancel any queued animations. It just makes animations instant, not stopped.

To truly stop at the current position without any animation:
```javascript
// Stop all animations first, then set the position
springApi.stop();
springApi.start({
  offset: currentValue,
  immediate: true
});
```

**Recommendation:** Always use `start()` with the `immediate` flag for instant updates. Call `stop()` first if you need to cancel any pending animations.

## Gesture Hook State Management

**IMPORTANT**: In controlled gesture components, always use the parent's state as the source of truth, not internal refs or state.

### The Problem:
When implementing gesture hooks that track position internally (via refs or state), these can become stale when:
- The parent component changes position (e.g., during data loading)
- The component re-renders with a new position
- The user navigates via other means (keyboard, direct navigation)

### The Solution:
For drag and wheel handlers, always use the `currentOffset` prop from the parent:
```javascript
// ❌ Wrong - using potentially stale internal ref
const targetOffset = positionRef.current + delta;

// ✅ Correct - using parent's current state
const targetOffset = currentOffset + delta;
```

### Key Principle:
Internal refs (`positionRef`) should only be used for:
- Tracking position during active gestures
- Optimisation to avoid re-renders

But for **initialising** any gesture (drag start, wheel start), always use the parent's `currentOffset` to ensure you're starting from the correct position.
