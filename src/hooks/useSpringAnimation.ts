import { useRef, useCallback, useEffect } from 'react';

interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
  precision?: number;
}

interface SpringState {
  position: number;
  velocity: number;
  target: number;
  isAnimating: boolean;
}

export function useSpringAnimation(
  initialValue: number = 0,
  config: SpringConfig = {}
) {
  const {
    stiffness = 170,
    damping = 26,
    mass = 1,
    precision = 0.01
  } = config;

  const stateRef = useRef<SpringState>({
    position: initialValue,
    velocity: 0,
    target: initialValue,
    isAnimating: false
  });

  const animationFrameRef = useRef<number | null>(null);
  const callbackRef = useRef<((value: number) => void) | null>(null);

  const animate = useCallback(() => {
    const state = stateRef.current;
    
    // Calculate spring force
    const springForce = -stiffness * (state.position - state.target);
    const dampingForce = -damping * state.velocity;
    const acceleration = (springForce + dampingForce) / mass;
    
    // Update velocity and position
    state.velocity += acceleration * 0.016; // ~60fps
    state.position += state.velocity * 0.016;
    
    // Check if animation should stop
    const displacement = Math.abs(state.position - state.target);
    const speed = Math.abs(state.velocity);
    
    if (displacement < precision && speed < precision) {
      state.position = state.target;
      state.velocity = 0;
      state.isAnimating = false;
      
      if (callbackRef.current) {
        callbackRef.current(state.position);
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }
    
    // Continue animation
    if (callbackRef.current) {
      callbackRef.current(state.position);
    }
    
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [stiffness, damping, mass, precision]);

  const springTo = useCallback((
    target: number,
    onUpdate: (value: number) => void,
    initialVelocity: number = 0
  ) => {
    const state = stateRef.current;
    state.target = target;
    state.velocity = initialVelocity;
    callbackRef.current = onUpdate;
    
    if (!state.isAnimating) {
      state.isAnimating = true;
      animate();
    }
  }, [animate]);

  const setPosition = useCallback((position: number) => {
    const state = stateRef.current;
    state.position = position;
    state.target = position;
    state.velocity = 0;
    state.isAnimating = false;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const getPosition = useCallback(() => {
    return stateRef.current.position;
  }, []);

  const getVelocity = useCallback(() => {
    return stateRef.current.velocity;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    springTo,
    setPosition,
    getPosition,
    getVelocity
  };
}