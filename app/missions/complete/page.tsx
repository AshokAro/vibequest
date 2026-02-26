"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Sparkles, Share2, Home, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Mission } from "@/lib/types";

// Confetti component using CSS only
function Confetti() {
  const pieces = Array.from({ length: 20 });

  const colors = [
    "bg-[#ff6b9d]",
    "bg-[#c084fc]",
    "bg-[#22d3ee]",
    "bg-[#a3e635]",
    "bg-[#fbbf24]",
  ];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map((_, i) => (
        <motion.div
          key={i}
          className={cn("absolute w-3 h-3 hard-border", colors[i % 5])}
          initial={{
            x: "50%",
            y: "40%",
            scale: 0,
            rotate: 0,
          }}
          animate={{
            x: `${50 + (Math.random() - 0.5) * 80}%`,
            y: "-10%",
            scale: [0, 1, 0.5],
            rotate: Math.random() * 720 - 360,
          }}
          transition={{
            duration: 1.5 + Math.random(),
            ease: "easeOut",
            delay: Math.random() * 0.3,
          }}
        />
      ))}
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

export default function MissionCompletePage() {
  const router = useRouter();
  const [completion, setCompletion] = useState<{
    mission: Mission | null;
    duration: number;
    xpEarned: number;
    completedAt: string;
  } | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("missionCompletion");
    if (stored) {
      setCompletion(JSON.parse(stored));
    }
  }, []);

  const handleShare = async () => {
    if (!completion?.mission) return;

    const shareData = {
      title: "VibeQuest Mission Complete!",
      text: `I just completed "${completion.mission.title}" and earned ${completion.xpEarned} XP!`,
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

  const rewards = completion.mission?.intrinsic_rewards;

  return (
    <main className="h-full safe-top safe-x flex flex-col items-center justify-center px-5 py-6 bg-[#fafafa] relative overflow-hidden">
      <Confetti />

      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-16 h-16 rounded-xl bg-[#a3e635] hard-border hard-shadow flex items-center justify-center mb-4"
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
        Mission Complete!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-xs text-[#666] text-center mb-5 font-medium px-4"
      >
        {completion.mission?.title}
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
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white border-2 border-[#1a1a1a] text-[#1a1a1a] font-black tap-target hard-shadow-sm hover:-translate-y-0.5 transition-all"
        >
          <Share2 className="w-4 h-4" />
          Share Your Win
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => router.push("/")}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white border-2 border-[#1a1a1a] text-[#1a1a1a] font-black tap-target hover:-translate-y-0.5 transition-all"
          >
            <Home className="w-4 h-4" />
            Home
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#ff6b9d] border-2 border-[#1a1a1a] text-white font-black tap-target hard-shadow-sm hover:-translate-y-0.5 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            New
          </button>
        </div>
      </motion.div>
    </main>
  );
}
