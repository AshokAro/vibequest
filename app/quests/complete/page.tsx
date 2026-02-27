"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Sparkles, Share2, Home, RotateCcw } from "lucide-react";
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
  max = 25,
  color,
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
}) {
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

export default function QuestCompletePage() {
  const router = useRouter();
  const { withTap } = useTapFeedback();
  const [completion, setCompletion] = useState<{
    quest: Quest | null;
    duration: number;
    xpEarned: number;
    completedAt: string;
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);

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
            onClick={() => router.push("/")}
            size="md"
            variant="secondary"
            className="flex-1 py-3"
          >
            <Home className="w-4 h-4" />
            Home
          </Button>
          <Button
            onClick={() => router.push("/")}
            size="md"
            variant="primary"
            className="flex-1 py-3"
          >
            <RotateCcw className="w-4 h-4" />
            New
          </Button>
        </div>
      </motion.div>
    </main>
  );
}
