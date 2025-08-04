import { useCallback, useEffect, useRef } from 'react';

interface MouseDragOptions {
  startDrag: (x: number) => void;
  updateDrag: (x: number) => void;
  endDrag: (options?: { applyMomentum?: boolean }) => void;
  isActive: boolean;
}

/**
 * Hook that converts mouse events to drag operations
 * Returns event handlers to attach to draggable elements
 */
export function useMouseDrag({
  startDrag,
  updateDrag,
  endDrag,
  isActive,
}: MouseDragOptions) {
  // Track if mouse button is actually pressed
  const isMouseDownRef = useRef(false);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    
    e.preventDefault();
    isMouseDownRef.current = true;
    startDrag(e.clientX);
    
    // Update cursor
    document.body.style.cursor = 'grabbing';
  }, [startDrag]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Only handle if not dragging (dragging is handled globally)
    if (!isActive) return;
  }, [isActive]);

  // Global mouse handlers
  useEffect(() => {
    // Only listen for mouse events if this is a mouse drag (not wheel or touch)
    if (!isActive || !isMouseDownRef.current) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Double-check mouse is still down (in case we missed a mouseup)
      if (!isMouseDownRef.current) return;
      updateDrag(e.clientX);
    };

    const handleGlobalMouseUp = () => {
      isMouseDownRef.current = false;
      document.body.style.cursor = '';
      endDrag({ applyMomentum: false }); // No momentum for mouse
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isActive, updateDrag, endDrag]);

  return {
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
  };
}