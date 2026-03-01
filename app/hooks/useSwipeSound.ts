"use client";

import { useCallback, useRef, useEffect, useState } from "react";

export function useSwipeSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [audioContextReady, setAudioContextReady] = useState(false);

  // Initialize audio context on mount and unlock on first interaction
  useEffect(() => {
    const createAudioContext = () => {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass();
          // Try to resume immediately if possible
          if (audioContextRef.current.state === "suspended") {
            audioContextRef.current.resume().then(() => {
              setAudioContextReady(true);
            }).catch(() => {
              // Will need user interaction
            });
          } else {
            setAudioContextReady(true);
          }
        }
      }
    };

    // Create context on mount
    createAudioContext();

    // Unlock audio context on first user interaction
    const unlockAudio = async () => {
      if (!audioContextRef.current) {
        createAudioContext();
      }
      if (audioContextRef.current?.state === "suspended") {
        try {
          await audioContextRef.current.resume();
          setAudioContextReady(true);
        } catch (e) {
          console.warn("Could not resume audio context:", e);
        }
      }
    };

    // Listen for interaction events to unlock audio
    const events = ["touchstart", "touchend", "click", "mousedown", "keydown"];
    events.forEach(event => {
      document.addEventListener(event, unlockAudio, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, unlockAudio);
      });
    };
  }, []);

  const playSwipeSound = useCallback(async (direction: "left" | "right" | "up") => {
    // Ensure we have an audio context
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }

    if (!audioContextRef.current) return;

    const ctx = audioContextRef.current;

    // Critical: Resume context if suspended (mobile browsers)
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
        setAudioContextReady(true);
      } catch {
        return; // Can't play if context won't resume
      }
    }

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Different sounds for different swipe directions
      const configs = {
        left: { freq: 400, duration: 0.15, vol: 0.1, type: "sawtooth" as const },
        right: { freq: 600, duration: 0.15, vol: 0.1, type: "sine" as const },
        up: { freq: 800, duration: 0.2, vol: 0.12, type: "triangle" as const },
      };

      const config = configs[direction];

      oscillator.frequency.setValueAtTime(config.freq, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(config.freq * 0.5, ctx.currentTime + config.duration);
      oscillator.type = config.type;

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(config.vol, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + config.duration);
    } catch (e) {
      // Silent fail
    }
  }, []);

  return { playSwipeSound, audioContextReady };
}
