import { useRef, useEffect, useCallback, useState } from 'react';
import { useSpring, config } from '@react-spring/web';
import { useDrag, useWheel } from '@use-gesture/react';
import { featureFlags } from '@/shared/feature-flags';
import { DATE_BOUNDARIES } from '@/shared/config';
import { isOffsetOutOfBounds } from '@/shared/date-boundaries';

interface GestureSpringOptions {
  currentOffset: number;  // The actual current offset from parent
  maxOffset: number;
  onOffsetChange: (offset: number, isDragging: boolean) => void;
}

// Constants - no magic numbers
const VELOCITY_THRESHOLD = 0.2;
const MOMENTUM_SCALE = 300;
const WHEEL_SENSITIVITY = 0.5;

/**
 * Pure gesture and spring physics hook
 * Deals only with numeric offsets, no date knowledge
 */
export function useGestureSpring({
  currentOffset,
  maxOffset,
  onOffsetChange,
}: GestureSpringOptions) {
  const minOffset = 0;  // Always 0 - the earliest offset
  const elementRef = useRef<HTMLDivElement>(null);
  const lastLoggedOffsetRef = useRef<number | null>(null);
  
  // Current position - use a ref to track the actual position
  const [currentPosition, setCurrentPosition] = useState(currentOffset);
  const positionRef = useRef(currentOffset);
  
  // Update ref when position changes
  const updatePosition = useCallback((newPos: number) => {
    positionRef.current = newPos;
    setCurrentPosition(newPos);
  }, []);
  
  // Animation config - when null, no spring is mounted
  const [animationConfig, setAnimationConfig] = useState<{
    from: number;
    to: number;
    config: any;
  } | null>(null);
  
  // Only create spring when we have an animation to run
  const [springValues, springApi] = useSpring(() => {
    if (!animationConfig) {
      // No animation, return static value
      return { offset: currentPosition };
    }
    
    return {
      from: { offset: animationConfig.from },
      to: { offset: animationConfig.to },
      config: animationConfig.config,
      onChange: (result) => {
        const rawOffset = result.value.offset;
        const roundedOffset = Math.round(rawOffset);
        
        if (featureFlags.get('gestureLogging') && roundedOffset !== lastLoggedOffsetRef.current) {
          console.log('📍 POS:', {
            offset: roundedOffset,
            raw: rawOffset.toFixed(2),
            outOfBounds: roundedOffset < minOffset || roundedOffset > maxOffset,
            ts: Date.now()
          });
          lastLoggedOffsetRef.current = roundedOffset;
        }
        
        // Update position during animation
        updatePosition(rawOffset);
        onOffsetChange(roundedOffset, false);
      },
      onRest: (result) => {
        const finalOffset = Math.round(result.value.offset);
        if (featureFlags.get('gestureLogging')) {
          console.log('🏁 ANIMATION COMPLETE:', {
            offset: finalOffset,
            ts: Date.now()
          });
        }
        
        // Update final position and clear animation
        updatePosition(finalOffset);
        onOffsetChange(finalOffset, false);
        setAnimationConfig(null); // Unmount the spring
      }
    };
  }, [animationConfig]); // Recreate spring when animation config changes
  
  // Track if we're dragging
  const isDraggingRef = useRef(false);
  
  // Get element width for pixel->day conversion
  const getPixelsPerDay = useCallback(() => {
    if (!elementRef.current) return 1;
    const width = elementRef.current.getBoundingClientRect().width;
    return width / DATE_BOUNDARIES.TILE_WIDTH;
  }, []);
  
  // Drag handler - no spring during drag, just direct updates
  const dragBind = useDrag(
    ({ 
      first,
      active,
      movement: [mx], 
      velocity: [vx],  // Note: This is always positive (it's speed, not velocity)
      direction: [dx],  // This is -1, 0, or 1 (the actual direction)
      memo  // Will be undefined on first call
    }) => {
      // Initialize memo with current offset on first drag
      if (memo === undefined) {
        memo = currentOffset;
      }
      if (first) {
        isDraggingRef.current = true; // Mark as dragging
        // Cancel any ongoing animation
        setAnimationConfig(null);
        
        if (featureFlags.get('gestureLogging')) {
          const pixPerDay = getPixelsPerDay();
          console.log('🎬 DRAG START:', { 
            offset: Math.round(memo),
            pixelsPerDay: pixPerDay.toFixed(2),
            elementWidth: elementRef.current?.getBoundingClientRect().width
          });
        }
      }
      
      const pixelsPerDay = getPixelsPerDay();
      const dayDelta = mx / pixelsPerDay; // Don't round - keep it smooth
      const targetOffset = memo - dayDelta; // Drag left = increase offset
      
      // Debug: log the relationship between movement and offset
      if (featureFlags.get('gestureLogging') && !active && Math.abs(vx) > 0.1) {
        console.log('🔍 DRAG PHYSICS:', {
          mx: mx.toFixed(1),
          speed: vx.toFixed(2),  // vx is always positive (speed)
          direction: dx,  // -1, 0, or 1
          mxDirection: mx > 0 ? 'RIGHT' : mx < 0 ? 'LEFT' : 'NONE',
          dragDirection: dx < 0 ? 'LEFT' : dx > 0 ? 'RIGHT' : 'NONE',
          offsetChange: (targetOffset - memo).toFixed(1),
          offsetDirection: targetOffset > memo ? 'INCREASING' : targetOffset < memo ? 'DECREASING' : 'NONE'
        });
      }
      
      if (active) {
        // During drag: allow some elasticity past bounds
        const ELASTIC_LIMIT = 100; // Max units past bounds
        const clampedOffset = Math.max(minOffset - ELASTIC_LIMIT, Math.min(maxOffset + ELASTIC_LIMIT, targetOffset));
        
        // Direct state update - no spring!
        updatePosition(clampedOffset);
        
        // Log and notify parent
        const roundedOffset = Math.round(clampedOffset);
        if (featureFlags.get('gestureLogging') && roundedOffset !== lastLoggedOffsetRef.current) {
          console.log('🎭 DRAG:', {
            offset: roundedOffset,
            raw: clampedOffset.toFixed(2),
            ts: Date.now()
          });
          lastLoggedOffsetRef.current = roundedOffset;
        }
        // Update parent during drag for real-time feedback
        onOffsetChange(roundedOffset, true); // true = dragging
      } else {
        // Released: clear dragging flag and check for momentum or snapback
        isDraggingRef.current = false;
        
        // Use the ACTUAL current position from the ref - this is where we visually are
        const releasePos = positionRef.current;
        const outOfBounds = isOffsetOutOfBounds(releasePos);
        
        if (outOfBounds) {
          // Snapback to nearest boundary - mount a spring for this
          const snapTarget = releasePos < minOffset ? minOffset : maxOffset;
          if (featureFlags.get('gestureLogging')) {
            console.log('🔙 SNAPBACK:', { 
              from: releasePos, 
              to: snapTarget,
              distance: snapTarget - releasePos
            });
          }
          // Mount a spring for snapback animation
          setAnimationConfig({
            from: releasePos,
            to: snapTarget,
            config: { tension: 120, friction: 20 } // Gentle spring
          });
        } else if (Math.abs(vx) > VELOCITY_THRESHOLD) {
          // Apply momentum - mount a spring for this
          // IMPORTANT: vx is always positive (it's speed), dx is the direction (-1, 0, 1)
          // We need to combine them to get the true velocity vector
          const trueVelocity = vx * dx;  // Combine speed with direction
          // In our viewport: drag right (dx=1) should decrease offset (go back in time)
          // So positive velocity should decrease offset
          const momentumPixels = trueVelocity * MOMENTUM_SCALE;
          const momentumDays = momentumPixels / pixelsPerDay; // Don't round
          const momentumTarget = releasePos - momentumDays;  // Subtract: positive velocity decreases offset
          const clampedTarget = Math.max(minOffset, Math.min(maxOffset, momentumTarget));
          
          if (featureFlags.get('gestureLogging')) {
            console.log('🚀 MOMENTUM:', { 
              speed: vx,  // Always positive
              direction: dx,  // -1, 0, or 1
              dragDirection: dx < 0 ? 'LEFT' : dx > 0 ? 'RIGHT' : 'NONE',
              trueVelocity,
              momentumDays: momentumDays.toFixed(1),
              from: releasePos,  // Log actual position
              to: clampedTarget,
              distance: clampedTarget - releasePos,
              expectedMotion: dx < 0 ? 'FORWARD_IN_TIME' : dx > 0 ? 'BACKWARD_IN_TIME' : 'NONE'
            });
          }
          
          // Mount a spring for momentum animation - from actual position
          setAnimationConfig({
            from: releasePos,
            to: clampedTarget,
            config: { tension: 170, friction: 26 }
          });
        } else {
          // No momentum, no out of bounds - stay exactly where we are
          // No spring needed!
          if (featureFlags.get('gestureLogging')) {
            console.log('✋ STAY:', { 
              at: releasePos
            });
          }
          // Just update the position, no animation
          updatePosition(releasePos);
          onOffsetChange(Math.round(releasePos), false);
        }
      }
      
      return memo;
    },
    {
      axis: 'x',
      filterTaps: true,
    }
  );
  
  // Wheel handler - direct updates during scroll, ephemeral spring after
  const wheelBind = useWheel(
    ({ delta: [dx], active }) => {
      const dayDelta = dx * WHEEL_SENSITIVITY; // Don't round - smooth scrolling
      const targetOffset = currentOffset + dayDelta;  // Use currentOffset from props, not stale ref
      const clampedOffset = Math.max(minOffset, Math.min(maxOffset, targetOffset));
      
      if (featureFlags.get('gestureLogging')) {
        console.log('🎡 WHEEL:', {
          dx,
          dayDelta,
          currentOffset: Math.round(positionRef.current),
          targetOffset,
          clampedOffset,
          active
        });
      }
      
      if (active) {
        // During scroll: cancel any animation and apply direct update
        setAnimationConfig(null);  // Cancel any ongoing animation
        updatePosition(clampedOffset);
        onOffsetChange(Math.round(clampedOffset), false);
      } else {
        // After scroll: create ephemeral spring for smooth animation
        // Only animate if we're not already at the target
        const currentPos = currentOffset;  // Use currentOffset from props
        if (Math.abs(currentPos - clampedOffset) > 0.1) {
          if (featureFlags.get('gestureLogging')) {
            console.log('🎢 WHEEL ANIMATION:', { 
              from: currentPos,
              to: clampedOffset,
              distance: clampedOffset - currentPos
            });
          }
          
          // Mount a spring for wheel animation
          setAnimationConfig({
            from: currentPos,
            to: clampedOffset,
            config: { tension: 300, friction: 30 }
          });
        } else {
          // Already at target, just update
          updatePosition(clampedOffset);
          onOffsetChange(Math.round(clampedOffset), false);
        }
      }
    },
    {
      axis: 'x'
    }
  );
  
  // Combine bindings - properly merge the event handler objects
  const bind = () => {
    return {
      ...dragBind(),
      ...wheelBind()
    };
  };
  
  // Prevent browser navigation on horizontal scroll
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.deltaX !== 0) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);
  
  return { bind, elementRef };
}
