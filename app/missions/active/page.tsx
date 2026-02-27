"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Play, Pause, RotateCcw, Check, MapPin, ChevronDown, ChevronUp, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTapFeedback } from "../../hooks/useTapFeedback";
import type { Mission } from "@/lib/types";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function ActiveMissionPage() {
  const router = useRouter();
  const { withTap, triggerHaptic } = useTapFeedback();
  const [mission, setMission] = useState<Mission | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityRef = useRef(true);

  useEffect(() => {
    const stored = sessionStorage.getItem("activeMission");
    if (stored) {
      setMission(JSON.parse(stored));
    } else {
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      visibilityRef.current = !document.hidden;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRunning && visibilityRef.current) {
      intervalRef.current = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const toggleStep = useCallback((index: number) => {
    setCompletedSteps((prev) => {
      const isCompleting = !prev.includes(index);
      triggerHaptic(isCompleting ? "success" : "light");
      return isCompleting ? [...prev, index] : prev.filter((i) => i !== index);
    });
  }, [triggerHaptic]);

  const handleComplete = useCallback(() => {
    const completionData = {
      mission,
      duration: secondsElapsed,
      xpEarned: mission?.xp_reward || 0,
      completedAt: new Date().toISOString(),
    };
    sessionStorage.setItem("missionCompletion", JSON.stringify(completionData));
    router.push("/missions/complete");
  }, [mission, secondsElapsed, router]);

  if (!mission) {
    return (
      <main className="h-full flex items-center justify-center bg-[#fafafa]">
        <div className="w-8 h-8 border-2 border-[#ff6b9d] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const progress = (completedSteps.length / mission.steps.length) * 100;
  const allStepsCompleted = completedSteps.length === mission.steps.length;

  return (
    <main className="h-full safe-top safe-x bg-[#fafafa] pb-24 overflow-y-auto">
      {/* Header */}
      <header className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 text-[#666] mb-1">
          <MapPin className="w-3 h-3" />
          <span className="text-xs font-bold">{mission.location.suggestion}</span>
        </div>
        <h1 className="text-lg font-black text-[#1a1a1a] tracking-tight">{mission.title}</h1>
      </header>

      {/* Timer Card */}
      <section className="px-5 mb-5">
        <div className="bg-[#c084fc] border-2 border-[#1a1a1a] rounded-2xl p-5 hard-shadow">
          <div className="text-center">
            <div className="text-4xl font-mono font-black text-[#1a1a1a] tracking-wider">
              {formatTime(secondsElapsed)}
            </div>
            <p className="text-xs text-[#1a1a1a]/70 mt-1 font-bold">
              Target: {mission.duration_minutes} min
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={withTap(() => setSecondsElapsed(0), "light")}
              className="w-10 h-10 rounded-lg bg-white hard-border flex items-center justify-center text-[#666] tap-target hover:-translate-y-0.5 transition-all"
              aria-label="Reset timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={withTap(() => setIsRunning(!isRunning), "medium")}
              className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center tap-target transition-all duration-200 hard-border",
                isRunning
                  ? "bg-[#fbbf24] text-[#1a1a1a] hover:-translate-y-0.5"
                  : "bg-[#a3e635] text-[#1a1a1a] hover:-translate-y-0.5"
              )}
              aria-label={isRunning ? "Pause timer" : "Start timer"}
            >
              {isRunning ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Progress Bar */}
      <section className="px-5 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black text-[#1a1a1a]">Progress</span>
          <span className="text-xs text-[#666] font-bold">
            {completedSteps.length}/{mission.steps.length} steps
          </span>
        </div>
        <div className="h-2 bg-[#e5e5e5] rounded-full overflow-hidden hard-border">
          <motion.div
            className="h-full bg-[#ff6b9d] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </section>

      {/* Steps Checklist - Only show if there are steps */}
      {mission.steps.length > 0 && (
      <section className="px-5">
        <div className="bg-white border-2 border-[#1a1a1a] rounded-xl overflow-hidden hard-shadow">
          <button
            onClick={withTap(() => setExpanded(!expanded), "light")}
            className="w-full flex items-center justify-between p-3 tap-target"
          >
            <span className="font-black text-[#1a1a1a] text-sm">Mission Steps</span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-[#666]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#666]" />
            )}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 space-y-2">
                  {mission.steps.map((step, idx) => {
                    const isCompleted = completedSteps.includes(idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => toggleStep(idx)}
                        className={cn(
                          "w-full flex items-start gap-2 p-2.5 rounded-lg text-left tap-target transition-all duration-200 border-2",
                          isCompleted
                            ? "bg-[#a3e635]/20 border-[#a3e635]"
                            : "bg-white border-[#e5e5e5] hover:border-[#1a1a1a]"
                        )}
                      >
                        <div
                          className={cn(
                            "flex-shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors",
                            isCompleted
                              ? "bg-[#a3e635] border-[#a3e635]"
                              : "border-[#e5e5e5]"
                          )}
                        >
                          {isCompleted && <Check className="w-3 h-3 text-[#1a1a1a]" />}
                        </div>
                        <span
                          className={cn(
                            "text-xs leading-relaxed font-medium",
                            isCompleted
                              ? "text-[#1a1a1a] line-through"
                              : "text-[#666]"
                          )}
                        >
                          {step}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
      )}

      {/* XP Reward */}
      <section className="px-5 mt-5 mb-4">
        <div className="flex items-center justify-center gap-2">
          <Star className="w-5 h-5 text-[#fbbf24]" fill="currentColor" />
          <span className="text-xl font-black text-[#1a1a1a]">+{mission.xp_reward} XP</span>
        </div>
      </section>

      {/* Complete Button */}
      <div className="px-5 pb-4">
        {!showCompleteConfirm ? (
          <button
            onClick={withTap(() => setShowCompleteConfirm(true), "medium")}
            disabled={!allStepsCompleted}
            className={cn(
              "w-full py-3.5 rounded-xl font-black tap-target transition-all duration-200 border-2",
              allStepsCompleted
                ? "bg-[#a3e635] border-[#1a1a1a] text-[#1a1a1a] hard-shadow hard-shadow-hover"
                : "bg-[#e5e5e5] border-[#ccc] text-[#999] cursor-not-allowed"
            )}
          >
            {allStepsCompleted ? "Complete Mission" : "Complete all steps to finish"}
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2"
          >
            <button
              onClick={withTap(() => setShowCompleteConfirm(false), "light")}
              className="flex-1 py-3.5 rounded-xl font-black bg-white border-2 border-[#1a1a1a] text-[#1a1a1a] tap-target hard-shadow-sm hover:-translate-y-0.5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={withTap(handleComplete, "success")}
              className="flex-1 py-3.5 rounded-xl font-black bg-[#ff6b9d] border-2 border-[#1a1a1a] text-white hard-shadow hard-shadow-hover tap-target"
            >
              Confirm
            </button>
          </motion.div>
        )}
      </div>
    </main>
  );
}
