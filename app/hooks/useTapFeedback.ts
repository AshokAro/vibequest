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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withTap = useCallback(
    <T extends (...args: any[]) => void>(
      handler: T,
      intensity: HapticIntensity = "light"
    ): ((...args: Parameters<T>) => void) => {
      return (...args: Parameters<T>) => {
        triggerHaptic(intensity);
        handler(...args);
      };
    },
    [triggerHaptic]
  );

  return { onTap, withTap, triggerHaptic };
}
