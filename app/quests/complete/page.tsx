"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Sparkles, Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTapFeedback } from "../../hooks/useTapFeedback";
import { Button } from "../../components/Button";
import type { Quest, SkillLevel } from "@/lib/types";
import { addXp, addSkillPoints, calculateMomentum, getDaysDifference, getTotalSkillPoints } from "@/lib/leveling";

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

// Stat bar with animation - shows current skill level + increase
function StatBar({
  label,
  value,
  color,
  isMajor,
  currentValue,
}: {
  label: string;
  value: number;
  color: string;
  isMajor: boolean;
  currentValue: number;
}) {
  const increase = isMajor ? 20 : 10;
  const newValue = Math.min(100, currentValue + increase);
  const fillPercentage = newValue;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold capitalize text-[#1a1a1a]">
          {label}
        </span>
        <span className={cn("font-black", color)}>+{increase}</span>
      </div>
      <div className="h-2 bg-[#e5e5e5] rounded-full overflow-hidden hard-border">
        <motion.div
          className={cn("h-full rounded-full", color.replace("text-", "bg-"))}
          initial={{ width: `${currentValue}%` }}
          animate={{ width: `${fillPercentage}%` }}
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
  const [currentStats, setCurrentStats] = useState<Record<string, number>>({
    fitness: 0, calm: 0, creativity: 0, social: 0, knowledge: 0, discipline: 0
  });
  const [skillLevels, setSkillLevels] = useState<Record<string, { before: SkillLevel; after: SkillLevel }>>({});

  // Feedback state - no default selection
  const [rating, setRating] = useState<Rating>(null);

  const handleConfettiComplete = useCallback(() => {
    setShowConfetti(false);
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("questCompletion");
    if (!stored) return;

    const parsed = JSON.parse(stored);
    setCompletion(parsed);

    // Update user stats (XP, skills, etc.) immediately
    // History is saved later in handleDone() to include the rating
    if (parsed.quest) {
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

          // Helper to ensure skill has proper structure (handles old format migration)
          const ensureSkill = (skill: unknown): SkillLevel => {
            if (typeof skill === 'object' && skill !== null && 'level' in skill) {
              const s = skill as Record<string, unknown>;
              // Ensure all required fields exist with valid numbers
              return {
                level: typeof s.level === 'number' ? s.level : 1,
                progress: typeof s.progress === 'number' ? s.progress : 0,
                pointsInLevel: typeof s.pointsInLevel === 'number' ? s.pointsInLevel : 0,
                pointsToNext: typeof s.pointsToNext === 'number' ? s.pointsToNext : 100,
              };
            }
            // Migration from old number format (or invalid data)
            const points = typeof skill === 'number' ? skill : 0;
            return {
              level: 1,
              progress: Math.min(100, points),
              pointsInLevel: points % 100,
              pointsToNext: 100,
            };
          };

          // Get current stats BEFORE updating (for display)
          const beforeStats = {
            fitness: ensureSkill(parsedProfile.stats?.fitness),
            calm: ensureSkill(parsedProfile.stats?.calm),
            creativity: ensureSkill(parsedProfile.stats?.creativity),
            social: ensureSkill(parsedProfile.stats?.social),
            knowledge: ensureSkill(parsedProfile.stats?.knowledge),
            discipline: ensureSkill(parsedProfile.stats?.discipline),
          };

          // Calculate skill points to add (20 for major/2, 10 for minor/1)
          const getPoints = (val: number) => val === 2 ? 20 : val === 1 ? 10 : 0;

          console.log("[QuestComplete] Processing rewards:", JSON.stringify(rewards));
          console.log("[QuestComplete] Before stats:", JSON.stringify(beforeStats));

          // Update each skill with leveling
          // Use getTotalSkillPoints to properly calculate cumulative points for progressive difficulty
          const updatedSkills = {
            fitness: addSkillPoints(getTotalSkillPoints(beforeStats.fitness.level, beforeStats.fitness.pointsInLevel), getPoints(rewards.fitness)),
            calm: addSkillPoints(getTotalSkillPoints(beforeStats.calm.level, beforeStats.calm.pointsInLevel), getPoints(rewards.calm)),
            creativity: addSkillPoints(getTotalSkillPoints(beforeStats.creativity.level, beforeStats.creativity.pointsInLevel), getPoints(rewards.creativity)),
            social: addSkillPoints(getTotalSkillPoints(beforeStats.social.level, beforeStats.social.pointsInLevel), getPoints(rewards.social)),
            knowledge: addSkillPoints(getTotalSkillPoints(beforeStats.knowledge.level, beforeStats.knowledge.pointsInLevel), getPoints(rewards.knowledge)),
            discipline: addSkillPoints(getTotalSkillPoints(beforeStats.discipline.level, beforeStats.discipline.pointsInLevel), getPoints(rewards.discipline)),
          };

          // Convert back to SkillLevel format
          const afterStats = {
            fitness: { level: updatedSkills.fitness.level, progress: updatedSkills.fitness.progressPercent, pointsInLevel: updatedSkills.fitness.pointsInLevel, pointsToNext: updatedSkills.fitness.pointsToNext },
            calm: { level: updatedSkills.calm.level, progress: updatedSkills.calm.progressPercent, pointsInLevel: updatedSkills.calm.pointsInLevel, pointsToNext: updatedSkills.calm.pointsToNext },
            creativity: { level: updatedSkills.creativity.level, progress: updatedSkills.creativity.progressPercent, pointsInLevel: updatedSkills.creativity.pointsInLevel, pointsToNext: updatedSkills.creativity.pointsToNext },
            social: { level: updatedSkills.social.level, progress: updatedSkills.social.progressPercent, pointsInLevel: updatedSkills.social.pointsInLevel, pointsToNext: updatedSkills.social.pointsToNext },
            knowledge: { level: updatedSkills.knowledge.level, progress: updatedSkills.knowledge.progressPercent, pointsInLevel: updatedSkills.knowledge.pointsInLevel, pointsToNext: updatedSkills.knowledge.pointsToNext },
            discipline: { level: updatedSkills.discipline.level, progress: updatedSkills.discipline.progressPercent, pointsInLevel: updatedSkills.discipline.pointsInLevel, pointsToNext: updatedSkills.discipline.pointsToNext },
          };

          setCurrentStats({
            fitness: beforeStats.fitness.progress,
            calm: beforeStats.calm.progress,
            creativity: beforeStats.creativity.progress,
            social: beforeStats.social.progress,
            knowledge: beforeStats.knowledge.progress,
            discipline: beforeStats.discipline.progress,
          });

          setSkillLevels({
            fitness: { before: beforeStats.fitness, after: afterStats.fitness },
            calm: { before: beforeStats.calm, after: afterStats.calm },
            creativity: { before: beforeStats.creativity, after: afterStats.creativity },
            social: { before: beforeStats.social, after: afterStats.social },
            knowledge: { before: beforeStats.knowledge, after: afterStats.knowledge },
            discipline: { before: beforeStats.discipline, after: afterStats.discipline },
          });

          // Update XP and level
          const currentXp = parsedProfile.xp || 0;
          const xpGained = parsed.xpEarned || 0;
          const xpResult = addXp(currentXp, xpGained);

          // Update momentum (+1 for completing a quest)
          const lastQuestDate = parsedProfile.lastQuestDate;
          const today = new Date().toISOString().split('T')[0];
          const daysSinceLastQuest = lastQuestDate ? getDaysDifference(lastQuestDate, today) : 0;
          const currentMomentum = parsedProfile.momentum_score || 0;
          const newMomentum = calculateMomentum(currentMomentum, 1, daysSinceLastQuest);

          parsedProfile.xp = xpResult.newTotalXp;
          parsedProfile.level = xpResult.level;
          parsedProfile.xp_to_next = xpResult.xpToNext;
          parsedProfile.momentum_score = newMomentum;
          parsedProfile.lastQuestDate = today;
          parsedProfile.stats = afterStats;

          localStorage.setItem("vibequest_profile", JSON.stringify(parsedProfile));

          // Clear session storage to prevent re-processing on refresh
          sessionStorage.removeItem("questCompletion");
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

    if (completion?.quest) {
      // Save to quest history (now with rating)
      const existingHistory = localStorage.getItem("vibequest_completed_quests");
      const history = existingHistory ? JSON.parse(existingHistory) : [];

      const historyItem = {
        id: `${completion.quest.id}-${Date.now()}`,
        quest: completion.quest,
        completedAt: new Date().toISOString(),
        xpEarned: completion.xpEarned,
        duration: completion.duration,
        rating: rating,
      };

      history.unshift(historyItem);
      localStorage.setItem("vibequest_completed_quests", JSON.stringify(history.slice(0, 50)));

      // Log completion feedback for AI
      const feedbackData = {
        quest_id: completion.quest.id,
        quest_title: completion.quest.title,
        interests_used: completion.quest.interests_used || [],
        wildcard: completion.quest.is_wildcard || false,
        completed_at: new Date().toISOString(),
        actually_completed: true,
        rating: rating,
      };

      const existingFeedback = localStorage.getItem("vibequest_completion_feedback");
      const feedbackHistory = existingFeedback ? JSON.parse(existingFeedback) : [];
      feedbackHistory.unshift(feedbackData);
      localStorage.setItem("vibequest_completion_feedback", JSON.stringify(feedbackHistory.slice(0, 100)));

      console.log("[QuestComplete] History and feedback saved:", historyItem);
    }

    // Navigate home
    router.push("/");
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
          {Object.entries(rewards)
            .filter(([, value]) => value > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([key, value]) => (
              <StatBar
                key={key}
                label={key}
                value={value}
                color={statColors[key]}
                isMajor={value === 2}
                currentValue={currentStats[key] || 0}
              />
            ))}
        </motion.div>
      )}

      {/* Feedback Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="w-full max-w-[280px] space-y-4 mb-5"
      >
        {/* How was it? */}
        <div className="space-y-2">
          <span className="text-xs text-[#666] font-bold">How was it?</span>
          <div className="grid grid-cols-3 gap-3">
            {[
              { emoji: "😐", value: "meh" as const, color: "bg-[#ff6b9d]" },
              { emoji: "😁", value: "good" as const, color: "bg-[#22d3ee]" },
              { emoji: "🤩", value: "loved_it" as const, color: "bg-[#a3e635]" },
            ].map(({ emoji, value, color }) => (
              <button
                key={value}
                onClick={() => handleRating(value)}
                className={cn(
                  "flex items-center justify-center px-2 py-3 rounded-xl border-2 border-[#1a1a1a] tap-target transition-all duration-200 hard-shadow-sm",
                  rating === value
                    ? cn(color, "text-[#1a1a1a] hard-shadow -translate-y-0.5")
                    : "bg-white text-[#1a1a1a] hard-shadow-hover"
                )}
              >
                <span className="text-xl">{emoji}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="w-full max-w-[280px] grid grid-cols-2 gap-3"
      >
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 px-2 py-3 rounded-xl border-2 border-[#1a1a1a] bg-white text-[#1a1a1a] tap-target transition-all duration-200 hard-shadow hard-shadow-hover"
        >
          <Share2 className="w-4 h-4" />
          <span className="text-sm font-black">Share the W</span>
        </button>
        <button
          onClick={handleDone}
          className="flex items-center justify-center gap-2 px-2 py-3 rounded-xl border-2 border-[#1a1a1a] bg-[#ff6b9d] text-white tap-target transition-all duration-200 hard-shadow"
        >
          <Check className="w-4 h-4" />
          <span className="text-sm font-black">Done</span>
        </button>
      </motion.div>
    </main>
  );
}
