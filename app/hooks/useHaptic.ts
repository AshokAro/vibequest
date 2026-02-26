"use client";

import { useCallback, useRef, useEffect } from "react";

type HapticType = "light" | "medium" | "heavy" | "success" | "error";

export function useHaptic() {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize audio context on first user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
    };

    window.addEventListener("click", initAudio, { once: true });
    window.addEventListener("touchstart", initAudio, { once: true });

    return () => {
      window.removeEventListener("click", initAudio);
      window.removeEventListener("touchstart", initAudio);
    };
  }, []);

  const playTapSound = useCallback((intensity: HapticType = "light") => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Different frequencies and durations based on intensity
    const config = {
      light: { freq: 800, duration: 0.03, vol: 0.08 },
      medium: { freq: 600, duration: 0.05, vol: 0.12 },
      heavy: { freq: 400, duration: 0.08, vol: 0.15 },
      success: { freq: 1200, duration: 0.1, vol: 0.1 },
      error: { freq: 200, duration: 0.15, vol: 0.1 },
    };

    const { freq, duration, vol } = config[intensity];

    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }, []);

  const triggerHaptic = useCallback((type: HapticType = "light") => {
    // Vibration API (mobile)
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      const patterns = {
        light: 8,
        medium: 15,
        heavy: 25,
        success: [10, 30, 10],
        error: [20, 40, 20],
      };
      navigator.vibrate(patterns[type]);
    }

    // Play sound
    playTapSound(type);
  }, [playTapSound]);

  return { triggerHaptic, playTapSound };
}
