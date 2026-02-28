"use client";

import { useState, useRef, useCallback } from "react";

interface SwipeState {
  x: number;
  y: number;
  velocity: number;
}

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  threshold?: number;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  threshold = 100,
}: UseSwipeOptions) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    startPos.current = { x: clientX, y: clientY };
    currentPos.current = { x: clientX, y: clientY };
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    currentPos.current = { x: clientX, y: clientY };

    const deltaX = clientX - startPos.current.x;
    const deltaY = clientY - startPos.current.y;

    // Add resistance to vertical movement
    setPosition({
      x: deltaX,
      y: deltaY * 0.3,
    });
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);

    const deltaX = currentPos.current.x - startPos.current.x;
    const deltaY = currentPos.current.y - startPos.current.y;

    const didSwipeRight = deltaX > threshold;
    const didSwipeLeft = deltaX < -threshold;
    const didSwipeUp = deltaY < -threshold && Math.abs(deltaX) < threshold / 2;

    if (didSwipeRight) {
      onSwipeRight?.();
      // Keep position for exit animation - don't reset
    } else if (didSwipeLeft) {
      onSwipeLeft?.();
      // Keep position for exit animation - don't reset
    } else if (didSwipeUp) {
      onSwipeUp?.();
      // Keep position for exit animation - don't reset
    } else {
      // No swipe triggered, reset position
      setPosition({ x: 0, y: 0 });
    }
  }, [threshold, onSwipeLeft, onSwipeRight, onSwipeUp]);

  const rotation = position.x * 0.05;
  const opacity = Math.min(1, Math.max(0.5, 1 - Math.abs(position.x) / (threshold * 2)));

  return {
    position,
    rotation,
    opacity,
    isDragging,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onMouseDown: handleTouchStart,
      onMouseMove: handleTouchMove,
      onMouseUp: handleTouchEnd,
      onMouseLeave: handleTouchEnd,
    },
  };
}
