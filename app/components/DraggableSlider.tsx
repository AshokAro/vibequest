"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface DraggableSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  className?: string;
  accentColor?: string;
  formatValue?: (value: number) => string;
}

export function DraggableSlider({
  value,
  min,
  max,
  step,
  onChange,
  className,
  accentColor = "#c084fc",
  formatValue,
}: DraggableSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(value);

  // Sync dragValue with prop value when not dragging
  useEffect(() => {
    if (!isDragging) {
      setDragValue(value);
    }
  }, [value, isDragging]);

  const calculateValueFromPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return min;

    const rect = containerRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawValue = min + percentage * (max - min);

    // Snap to step
    const steppedValue = Math.round(rawValue / step) * step;
    return Math.max(min, Math.min(max, steppedValue));
  }, [min, max, step]);

  const handleStart = useCallback((clientX: number) => {
    setIsDragging(true);
    const newValue = calculateValueFromPosition(clientX);
    setDragValue(newValue);
    onChange(newValue);
  }, [calculateValueFromPosition, onChange]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging) return;
    const newValue = calculateValueFromPosition(clientX);
    setDragValue(newValue);
    onChange(newValue);
  }, [isDragging, calculateValueFromPosition, onChange]);

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch events
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleStart(e.touches[0].clientX);
  }, [handleStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleEnd();
  }, [handleEnd]);

  // Mouse events
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  }, [handleStart]);

  // Global move/end handlers for drag continuity
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const handleMouseUp = () => {
      handleEnd();
    };

    const handleTouchMove = (e: TouchEvent) => {
      handleMove(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
      handleEnd();
    };

    // Add global listeners
    document.addEventListener("mousemove", handleMouseMove, { passive: false });
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  const displayValue = isDragging ? dragValue : value;
  const percentage = ((displayValue - min) / (max - min)) * 100;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-12 rounded-xl overflow-hidden hard-border cursor-pointer touch-none select-none",
        className
      )}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-white" />

      {/* Fill */}
      <div
        className="absolute top-0 left-0 h-full transition-all duration-75"
        style={{
          width: `${percentage}%`,
          backgroundColor: accentColor,
        }}
      />

      {/* Thumb handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-lg shadow-lg border-2 border-[#1a1a1a] transition-all duration-75"
        style={{
          left: `calc(${percentage}% - 16px)`,
          transform: `translateY(-50%) scale(${isDragging ? 1.1 : 1})`,
        }}
      />
    </div>
  );
}
