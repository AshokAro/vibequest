"use client";

import { useCallback } from "react";
import { useHaptic } from "./useHaptic";

type HapticIntensity = "light" | "medium" | "heavy" | "success" | "error";

export function useTapFeedback() {
  const { triggerHaptic } = useHaptic();

  const onTap = useCallback(
    (callback?: () => void, intensity: HapticIntensity = "light") => {
      triggerHaptic(intensity);
      callback?.();
    },
    [triggerHaptic]
  );

  const withTap = useCallback(
    <T extends (...args: unknown[]) => void>(
      handler: T,
      intensity: HapticIntensity = "light"
    ): T => {
      return ((...args: unknown[]) => {
        triggerHaptic(intensity);
        handler(...args);
      }) as T;
    },
    [triggerHaptic]
  );

  return { onTap, withTap, triggerHaptic };
}
