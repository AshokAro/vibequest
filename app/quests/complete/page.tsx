"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Sparkles, Share2, User, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTapFeedback } from "../../hooks/useTapFeedback";
import { Button } from "../../components/Button";
import type { Quest } from "@/lib/types";

// Confetti component that hides after animation completes
function Confetti({ onComplete }: { onComplete: () => void }) {
  const pieces = Array.from({ length: 20 });

  const colors = [
    "bg-[#ff6b9d]",
    "bg-[#c084fc]",
    "bg-[#22d3ee]",
    "bg-[#a3e635]",
    "bg-[#fbbf24]",
  ];

  // Pre-calculate random values to avoid hydration mismatch
  const pieceData = pieces.map((_, i) => ({
    id: i,
    color: colors[i % 5],
    angle: (i / pieces.length) * 360 + Math.random() * 30,
    distance: 100 + Math.random() * 150,
    duration: 1.5 + Math.random() * 0.5,
    delay: Math.random() * 0.3,
    rotation: Math.random() * 720 - 360,
  }));

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[180px] w-0 h-0 pointer-events-none z-0">
      {pieceData.map((piece) => {
        const radians = (piece.angle * Math.PI) / 180;
        const endX = Math.cos(radians) * piece.distance;
        const endY = Math.sin(radians) * piece.distance - 80;

        return (
          <motion.div
            key={piece.id}
            className={cn("absolute w-3 h-3 hard-border", piece.color)}
            style={{ left: 0, top: 0 }}
            initial={{
              x: -6,
              y: -6,
              scale: 0,
              rotate: 0,
            }}
            animate={{
              x: endX - 6,
              y: endY - 6,
              scale: [0, 1, 0.5],
              rotate: piece.rotation,
            }}
            transition={{
              duration: piece.duration,
              ease: "easeOut",
              delay: piece.delay,
            }}
            onAnimationComplete={piece.id === 0 ? onComplete : undefined}
          />
        );
      })}
    </div>
  );
}

// Animated counter for XP
function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(value * easeProgress));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

// Stat bar with animation
function StatBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  // Auto-detect scale: values 0-2 use max=2, values >2 use max=25 (legacy support)
  const max = value <= 2 ? 2 : 25;
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#666] font-bold capitalize">{label}</span>
        <span className={cn("font-black", color)}>+{value}</span>
      </div>
      <div className="h-2 bg-[#e5e5e5] rounded-full overflow-hidden hard-border">
        <motion.div
          className={cn("h-full rounded-full", color.replace("text-", "bg-"))}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

const statColors: Record<string, string> = {
  fitness: "text-[#a3e635]",
  calm: "text-[#22d3ee]",
  creativity: "text-[#ff6b9d]",
  social: "text-[#fbbf24]",
  knowledge: "text-[#c084fc]",
  discipline: "text-[#1a1a1a]",
};

// Rating type
type Rating = "loved_it" | "good" | "meh" | null;

export default function QuestCompletePage() {
  const router = useRouter();
  const { withTap, triggerHaptic } = useTapFeedback();
  const [completion, setCompletion] = useState<{
    quest: Quest | null;
    duration: number;
    xpEarned: number;
    completedAt: string;
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);

  // Feedback state - pre-selected defaults
  const [actuallyCompleted, setActuallyCompleted] = useState(true);
  const [rating, setRating] = useState<Rating>("good");

  const handleConfettiComplete = useCallback(() => {
    setShowConfetti(false);
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("questCompletion");
    if (stored) {
      const parsed = JSON.parse(stored);
      setCompletion(parsed);

      // Save to quest history
      if (parsed.quest) {
        const historyItem = {
          id: `${parsed.quest.id}-${Date.now()}`,
          quest: parsed.quest,
          completedAt: parsed.completedAt || new Date().toISOString(),
          xpEarned: parsed.xpEarned,
          duration: parsed.duration,
        };

        const existingHistory = localStorage.getItem("vibequest_completed_quests");
        const history = existingHistory ? JSON.parse(existingHistory) : [];
        history.unshift(historyItem);
        // Keep only last 50 completed quests
        const trimmedHistory = history.slice(0, 50);
        localStorage.setItem("vibequest_completed_quests", JSON.stringify(trimmedHistory));

        // Update completed_quests count in preferences
        const prefs = localStorage.getItem("vibequest_preferences");
        if (prefs) {
          const parsedPrefs = JSON.parse(prefs);
          parsedPrefs.completedQuestsCount = (parsedPrefs.completedQuestsCount || 0) + 1;
          localStorage.setItem("vibequest_preferences", JSON.stringify(parsedPrefs));
        }

        // Update user stats with quest rewards
        const profile = localStorage.getItem("vibequest_profile");
        if (profile && parsed.quest?.intrinsic_rewards) {
          const parsedProfile = JSON.parse(profile);
          const rewards = parsed.quest.intrinsic_rewards;

          // Add rewards to stats (handle both 0-2 and 0-25 scales)
          // Scale up 0-2 values to 0-25 for display consistency
          const scale = (val: number) => val <= 2 ? val * 10 : val;

          parsedProfile.stats = {
            fitness: Math.min(100, (parsedProfile.stats?.fitness || 0) + scale(rewards.fitness)),
            calm: Math.min(100, (parsedProfile.stats?.calm || 0) + scale(rewards.calm)),
            creativity: Math.min(100, (parsedProfile.stats?.creativity || 0) + scale(rewards.creativity)),
            social: Math.min(100, (parsedProfile.stats?.social || 0) + scale(rewards.social)),
            knowledge: Math.min(100, (parsedProfile.stats?.knowledge || 0) + scale(rewards.knowledge)),
            discipline: Math.min(100, (parsedProfile.stats?.discipline || 0) + scale(rewards.discipline)),
          };

          localStorage.setItem("vibequest_profile", JSON.stringify(parsedProfile));
        }
      }
    }
  }, []);

  const handleShare = async () => {
    if (!completion?.quest) return;

    const shareData = {
      title: "VibeQuest Quest Complete!",
      text: `I just completed "${completion.quest.title}" and earned ${completion.xpEarned} XP!`,
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
    }
  };

  const handleDone = () => {
    triggerHaptic("success");

    // Log completion feedback
    if (completion?.quest) {
      const feedbackData = {
        quest_id: completion.quest.id,
        quest_title: completion.quest.title,
        interests_used: completion.quest.interests_used || [],
        wildcard: completion.quest.is_wildcard || false,
        completed_at: new Date().toISOString(),
        actually_completed: actuallyCompleted,
        rating: actuallyCompleted ? rating : null,
      };

      // Save to completion history for AI prompt analysis
      const existingFeedback = localStorage.getItem("vibequest_completion_feedback");
      const feedbackHistory = existingFeedback ? JSON.parse(existingFeedback) : [];
      feedbackHistory.unshift(feedbackData);
      // Keep last 100 entries
      const trimmedFeedback = feedbackHistory.slice(0, 100);
      localStorage.setItem("vibequest_completion_feedback", JSON.stringify(trimmedFeedback));

      console.log("[QuestComplete] Feedback logged:", feedbackData);
    }

    // Navigate home
    router.push("/");
  };

  const handleActuallyCompleted = (value: boolean) => {
    triggerHaptic("light");
    setActuallyCompleted(value);
    if (!value) {
      setRating(null);
    } else if (rating === null) {
      setRating("good");
    }
  };

  const handleRating = (value: Rating) => {
    triggerHaptic("light");
    setRating(value);
  };

  if (!completion) {
    return (
      <main className="h-full flex items-center justify-center bg-[#fafafa]">
        <div className="w-8 h-8 border-2 border-[#ff6b9d] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const rewards = completion.quest?.intrinsic_rewards;

  return (
    <main className="h-full safe-top safe-x flex flex-col items-center justify-center px-5 py-6 bg-[#fafafa] relative overflow-hidden">
      {showConfetti && <Confetti onComplete={handleConfettiComplete} />}

      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="relative z-10 w-16 h-16 rounded-xl bg-[#a3e635] hard-border hard-shadow flex items-center justify-center mb-4"
      >
        <Sparkles className="w-8 h-8 text-[#1a1a1a]" />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-black text-[#1a1a1a] text-center mb-1 tracking-tight"
      >
        Quest Complete!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-xs text-[#666] text-center mb-5 font-medium px-4"
      >
        {completion.quest?.title}
      </motion.p>

      {/* XP Display */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-[#fbbf24] border-2 border-[#1a1a1a] rounded-2xl p-5 mb-5 w-full max-w-[280px] hard-shadow"
      >
        <div className="text-center">
          <span className="text-xs text-[#1a1a1a]/70 font-black uppercase tracking-wider">
            XP Earned
          </span>
          <div className="text-4xl font-black text-[#1a1a1a] mt-1">
            <AnimatedNumber value={completion.xpEarned} />
          </div>
        </div>
      </motion.div>

      {/* Stats Growth */}
      {rewards && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-[280px] space-y-2 mb-5"
        >
          {rewards.fitness > 0 && (
            <StatBar label="fitness" value={rewards.fitness} color={statColors.fitness} />
          )}
          {rewards.calm > 0 && (
            <StatBar label="calm" value={rewards.calm} color={statColors.calm} />
          )}
          {rewards.creativity > 0 && (
            <StatBar label="creativity" value={rewards.creativity} color={statColors.creativity} />
          )}
          {rewards.social > 0 && (
            <StatBar label="social" value={rewards.social} color={statColors.social} />
          )}
          {rewards.knowledge > 0 && (
            <StatBar label="knowledge" value={rewards.knowledge} color={statColors.knowledge} />
          )}
          {rewards.discipline > 0 && (
            <StatBar label="discipline" value={rewards.discipline} color={statColors.discipline} />
          )}
        </motion.div>
      )}

      {/* Feedback Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="w-full max-w-[280px] space-y-4 mb-5"
      >
        {/* Did you do it? */}
        <div className="space-y-2">
          <span className="text-xs text-[#666] font-bold">Did you actually go?</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleActuallyCompleted(true)}
              className={cn(
                "flex-1 py-2.5 px-3 rounded-xl border-2 font-bold text-sm transition-all duration-200 tap-target",
                actuallyCompleted
                  ? "bg-[#a3e635] border-[#1a1a1a] hard-shadow"
                  : "bg-white border-[#e5e5e5] text-[#666]"
              )}
            >
              Went and did it ✅
            </button>
            <button
              onClick={() => handleActuallyCompleted(false)}
              className={cn(
                "flex-1 py-2.5 px-3 rounded-xl border-2 font-bold text-sm transition-all duration-200 tap-target",
                !actuallyCompleted
                  ? "bg-[#ff6b9d] border-[#1a1a1a] text-white hard-shadow"
                  : "bg-white border-[#e5e5e5] text-[#666]"
              )}
            >
              Not this time 👋
            </button>
          </div>
        </div>

        {/* How was it? - Only show if completed */}
        {actuallyCompleted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <span className="text-xs text-[#666] font-bold">How was it?</span>
            <div className="flex gap-2">
              {[
                { emoji: "😐", value: "meh" as const },
                { emoji: "🙂", value: "good" as const },
                { emoji: "🤩", value: "loved_it" as const },
              ].map(({ emoji, value }) => (
                <button
                  key={value}
                  onClick={() => handleRating(value)}
                  className={cn(
                    "flex-1 py-3 rounded-xl border-2 text-2xl transition-all duration-200 tap-target",
                    rating === value
                      ? "bg-white border-[#1a1a1a] hard-shadow scale-105"
                      : "bg-white border-[#e5e5e5] opacity-60"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="w-full max-w-[280px] space-y-2"
      >
        <Button
          onClick={handleShare}
          size="md"
          variant="secondary"
          fullWidth
          className="py-3"
        >
          <Share2 className="w-4 h-4" />
          Share Your Win
        </Button>

        <div className="flex gap-2">
          <Button
            onClick={() => router.push("/profile")}
            size="md"
            variant="secondary"
            className="flex-1 py-3"
          >
            <User className="w-4 h-4" />
            My Stats
          </Button>
          <Button
            onClick={handleDone}
            size="md"
            variant="primary"
            className="flex-1 py-3 bg-[#ff6b9d]"
          >
            <Check className="w-4 h-4" />
            Done
          </Button>
        </div>
      </motion.div>
    </main>
  );
}
