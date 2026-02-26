"use client";

import { useCallback, useRef, useEffect, useState } from "react";

type HapticType = "light" | "medium" | "heavy" | "success" | "error";

export function useHaptic() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [audioReady, setAudioReady] = useState(false);

  // Initialize audio context on first user interaction
  useEffect(() => {
    const initAudio = async () => {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass();
        }
      }

      // Resume audio context if suspended (needed for mobile browsers)
      if (audioContextRef.current?.state === "suspended") {
        try {
          await audioContextRef.current.resume();
          setAudioReady(true);
        } catch (e) {
          console.warn("Could not resume audio context:", e);
        }
      } else if (audioContextRef.current?.state === "running") {
        setAudioReady(true);
      }
    };

    // Multiple events to catch user interaction
    const events = ["click", "touchstart", "touchend", "mousedown", "keydown"];
    events.forEach(event => {
      window.addEventListener(event, initAudio, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, initAudio);
      });
    };
  }, []);

  const playTapSound = useCallback((intensity: HapticType = "light") => {
    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;

    // Ensure context is running before playing
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
      return;
    }

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Different frequencies and durations based on intensity
      const config = {
        light: { freq: 1200, duration: 0.02, vol: 0.05 },
        medium: { freq: 800, duration: 0.04, vol: 0.08 },
        heavy: { freq: 500, duration: 0.06, vol: 0.1 },
        success: { freq: 1500, duration: 0.08, vol: 0.08 },
        error: { freq: 300, duration: 0.1, vol: 0.08 },
      };

      const { freq, duration, vol } = config[intensity];

      oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.002);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      // Silent fail if audio can't play
    }
  }, [audioReady]);

  const triggerHaptic = useCallback((type: HapticType = "light") => {
    // Vibration API (mobile) - try immediately
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      const patterns = {
        light: 5,
        medium: 10,
        heavy: 20,
        success: [10, 30, 10],
        error: [20, 40, 20],
      };
      try {
        navigator.vibrate(patterns[type]);
      } catch (e) {
        // Vibration API might not be available
      }
    }

    // Play sound
    playTapSound(type);
  }, [playTapSound]);

  return { triggerHaptic, playTapSound, audioReady };
}
