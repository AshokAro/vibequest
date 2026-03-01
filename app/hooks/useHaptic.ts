"use client";

import { useCallback, useEffect, useState } from "react";

type HapticType = "light" | "medium" | "heavy" | "success" | "error";

// Global audio context shared across the app
let globalAudioContext: AudioContext | null = null;
let isAudioContextInitialized = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!globalAudioContext) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      globalAudioContext = new AudioContextClass();
    }
  }

  return globalAudioContext;
}

function initAudioContext(): void {
  if (isAudioContextInitialized) return;

  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().then(() => {
      isAudioContextInitialized = true;
    }).catch(() => {
      // Will retry on next interaction
    });
  } else if (ctx?.state === "running") {
    isAudioContextInitialized = true;
  }
}

// Ensure audio is unlocked on first interaction
function setupAudioUnlock() {
  const unlockAudio = () => {
    initAudioContext();
  };

  // Use multiple events to ensure we catch the first interaction
  const events = ["touchstart", "click", "mousedown", "keydown"];
  events.forEach(event => {
    document.addEventListener(event, unlockAudio, { once: true, passive: true });
  });
}

// Setup unlock listeners immediately when this module loads
if (typeof window !== "undefined") {
  setupAudioUnlock();
}

export function useHaptic() {
  const [audioReady, setAudioReady] = useState(false);

  // Check and update audio ready state
  useEffect(() => {
    const checkState = () => {
      const ctx = getAudioContext();
      if (ctx?.state === "running") {
        setAudioReady(true);
        isAudioContextInitialized = true;
      }
    };

    checkState();

    // Poll for state changes (mobile browsers may suspend context)
    const interval = setInterval(checkState, 1000);

    return () => clearInterval(interval);
  }, []);

  const playTapSound = useCallback(async (intensity: HapticType = "light") => {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Always try to resume context before playing - critical for mobile
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
        isAudioContextInitialized = true;
        setAudioReady(true);
      } catch {
        return;
      }
    }

    // Double-check context is running
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Different frequencies and durations based on intensity
      const config = {
        light: { freq: 1200, duration: 0.02, vol: 0.08 },
        medium: { freq: 800, duration: 0.04, vol: 0.12 },
        heavy: { freq: 500, duration: 0.06, vol: 0.15 },
        success: { freq: 1500, duration: 0.08, vol: 0.12 },
        error: { freq: 300, duration: 0.1, vol: 0.12 },
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
      console.warn("Audio play failed:", e);
    }
  }, []);

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
