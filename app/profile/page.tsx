"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Settings, Trophy, Target, Flame, Zap, User, ArrowLeft, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTapFeedback } from "../hooks/useTapFeedback";
import type { UserProfile, UserPreferences, Interest } from "@/lib/types";

// TODO: Consolidate - VALID_INTERESTS is duplicated in profile/page.tsx, settings/page.tsx, and missions/page.tsx
// Move to lib/constants.ts in future cleanup
const VALID_INTERESTS: Interest[] = [
  "creative", "music_sound", "movement_body", "food_drink", "culture_knowledge",
  "nature_outdoors", "people_social", "mind_curiosity", "collecting_hunting", "niche_unexpected",
  // Specific interests
  "photography", "sketching", "painting", "street_art", "journaling", "poetry", "collage", "craft_diy", "origami", "calligraphy",
  "live_music", "playing_instrument", "field_recording", "music_discovery", "singing",
  "running", "cycling", "yoga", "hiking", "swimming", "strength_training", "martial_arts", "dance", "skateboarding",
  "street_food", "cafe_hopping", "cooking", "food_markets", "new_cuisines", "tea_coffee", "fermentation",
  "history", "architecture", "museums", "archaeology", "religion", "languages", "philosophy",
  "birdwatching", "botany", "parks", "stargazing", "weather", "insects", "foraging",
  "people_watching", "talking_strangers", "community_events", "volunteering", "markets_bazaars", "board_games", "open_mics",
  "puzzles", "reading", "trivia", "cartography", "urban_exploration", "hidden_history", "science_experiments",
  "thrift_shopping", "flea_markets", "antiques", "stamps_coins", "vinyl", "rare_books", "ephemera",
  "signage", "shadows_light", "patterns", "decay_texture", "doors_windows", "staircases", "rooftops", "reflections", "manhole_covers", "typos",
];

const interestLabels: Record<string, string> = {
  creative: "Creative",
  music_sound: "Music",
  movement_body: "Movement",
  food_drink: "Food",
  culture_knowledge: "Culture",
  nature_outdoors: "Nature",
  people_social: "Social",
  mind_curiosity: "Mind",
  collecting_hunting: "Collecting",
  niche_unexpected: "Niche",
};

const interestColors: Record<string, string> = {
  creative: "bg-[#ff6b9d]",
  music_sound: "bg-[#c084fc]",
  movement_body: "bg-[#fbbf24]",
  food_drink: "bg-[#22d3ee]",
  culture_knowledge: "bg-[#a3e635]",
  nature_outdoors: "bg-[#fb7185]",
  people_social: "bg-[#a78bfa]",
  mind_curiosity: "bg-[#f472b6]",
  collecting_hunting: "bg-[#60a5fa]",
  niche_unexpected: "bg-[#34d399]",
};

// Mock user data - in production, fetch from API
const mockUser: UserProfile = {
  id: "user-1",
  level: 7,
  xp: 2840,
  xp_to_next: 3500,
  momentum_score: 85,
  stats: {
    fitness: 45,
    calm: 62,
    creativity: 78,
    social: 34,
    knowledge: 56,
    discipline: 71,
  },
  completed_missions: 23,
};

// XP Progress Ring
function XPProgressRing({
  level,
  xp,
  xpToNext,
  momentum,
}: {
  level: number;
  xp: number;
  xpToNext: number;
  momentum: number;
}) {
  const progress = (xp / xpToNext) * 100;
  const circumference = 2 * Math.PI * 60;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative w-36 h-36 mx-auto">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(255, 107, 157, 0.15) 0%, transparent 70%)`,
        }}
      />

      <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r="60"
          fill="none"
          stroke="#e5e5e5"
          strokeWidth="8"
        />
        <motion.circle
          cx="70"
          cy="70"
          r="60"
          fill="none"
          stroke="#ff6b9d"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-[#1a1a1a]">{level}</span>
        <span className="text-xs font-bold text-[#666] uppercase tracking-wider mt-0.5">Level</span>
      </div>

      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-0.5 bg-[#fbbf24] hard-border rounded-full">
        <Flame className="w-3 h-3 text-[#1a1a1a]" />
        <span className="text-xs font-black text-[#1a1a1a]">{momentum}</span>
      </div>
    </div>
  );
}

// Stat Bar
function StatBar({
  label,
  value,
  max = 100,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
  icon: React.ElementType;
}) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("w-3.5 h-3.5", color)} />
          <span className="text-xs font-black text-[#1a1a1a] capitalize">{label}</span>
        </div>
        <span className={cn("text-xs font-black", color)}>{value}</span>
      </div>
      <div className="h-2 bg-[#e5e5e5] rounded-full overflow-hidden hard-border">
        <motion.div
          className={cn("h-full rounded-full", color.replace("text-", "bg-"))}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

const statColors = {
  fitness: "text-[#a3e635]",
  calm: "text-[#22d3ee]",
  creativity: "text-[#ff6b9d]",
  social: "text-[#fbbf24]",
  knowledge: "text-[#c084fc]",
  discipline: "text-[#1a1a1a]",
};

export default function ProfilePage() {
  const [user] = useState<UserProfile>(mockUser);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const router = useRouter();
  const { withTap } = useTapFeedback();

  useEffect(() => {
    const stored = localStorage.getItem("vibequest_preferences");
    if (stored) {
      const parsed: UserPreferences = JSON.parse(stored);
      // Filter out invalid/old interests that don't match current schema
      const validInterests = (parsed.interests || []).filter((i: Interest) =>
        VALID_INTERESTS.includes(i)
      );
      if (validInterests.length !== (parsed.interests || []).length) {
        // Save cleaned preferences back if there were invalid interests
        const cleanedPrefs: UserPreferences = {
          ...parsed,
          interests: validInterests,
        };
        localStorage.setItem("vibequest_preferences", JSON.stringify(cleanedPrefs));
        setPreferences(cleanedPrefs);
      } else {
        setPreferences(parsed);
      }
    }
  }, []);

  return (
    <main className="h-full safe-top safe-x bg-[#fafafa] pb-6 overflow-y-auto">
      {/* Header */}
      <header className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={withTap(() => router.push("/"), "light")}
            className="w-9 h-9 rounded-lg bg-white hard-border hard-shadow-sm flex items-center justify-center text-[#1a1a1a] tap-target hover:-translate-y-0.5 transition-all"
            aria-label="Back to Quests"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-black text-[#1a1a1a] tracking-tight">Profile</h1>
        </div>
        <button
          onClick={withTap(() => router.push("/settings"), "light")}
          className="w-9 h-9 rounded-lg bg-white hard-border hard-shadow-sm flex items-center justify-center text-[#1a1a1a] tap-target hover:-translate-y-0.5 transition-all"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      <div className="px-5 space-y-6">
        {/* Avatar & Progress */}
        <section className="py-3">
          <XPProgressRing
            level={user.level}
            xp={user.xp}
            xpToNext={user.xp_to_next}
            momentum={user.momentum_score}
          />

          <div className="text-center mt-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hard-border rounded-lg hard-shadow-sm">
              <Zap className="w-3.5 h-3.5 text-[#fbbf24]" />
              <span className="text-xs font-black text-[#1a1a1a]">
                {user.xp_to_next - user.xp} XP to next level
              </span>
            </div>
          </div>
        </section>

        {/* Interests Rail */}
        {preferences?.interests && preferences.interests.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#ff6b9d] hard-border flex items-center justify-center">
                  <span className="text-[10px]">💖</span>
                </div>
                <h2 className="text-xs font-black text-[#1a1a1a] uppercase tracking-wider">Your Vibes</h2>
              </div>
              <button
                onClick={withTap(() => router.push("/settings?tab=interests"), "light")}
                className="flex items-center gap-1 text-xs font-bold text-[#666] hover:text-[#1a1a1a] transition-colors tap-target"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {preferences.interests.map((interest) => (
                <span
                  key={interest}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold text-white hard-border hard-shadow-sm",
                    interestColors[interest] || "bg-[#999]"
                  )}
                >
                  {interestLabels[interest] || interest}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Stats Overview */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-[#c084fc] hard-border flex items-center justify-center">
              <Target className="w-3 h-3 text-white" />
            </div>
            <h2 className="text-xs font-black text-[#1a1a1a] uppercase tracking-wider">Your Stats</h2>
          </div>

          <div className="bg-white border-2 border-[#1a1a1a] rounded-xl p-4 space-y-3 hard-shadow">
            <StatBar label="fitness" value={user.stats.fitness} color={statColors.fitness} icon={Trophy} />
            <StatBar label="calm" value={user.stats.calm} color={statColors.calm} icon={Target} />
            <StatBar label="creativity" value={user.stats.creativity} color={statColors.creativity} icon={Target} />
            <StatBar label="social" value={user.stats.social} color={statColors.social} icon={Target} />
            <StatBar label="knowledge" value={user.stats.knowledge} color={statColors.knowledge} icon={Target} />
            <StatBar label="discipline" value={user.stats.discipline} color={statColors.discipline} icon={Target} />
          </div>
        </section>

        {/* Stats Summary */}
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-[#a3e635] border-2 border-[#1a1a1a] rounded-xl p-3 text-center hard-shadow">
            <span className="text-2xl font-black text-[#1a1a1a]">{user.completed_missions}</span>
            <p className="text-xs font-black text-[#1a1a1a]/70 mt-0.5">Missions Done</p>
          </div>
          <div className="bg-[#22d3ee] border-2 border-[#1a1a1a] rounded-xl p-3 text-center hard-shadow">
            <span className="text-2xl font-black text-[#1a1a1a]">{Math.floor(user.xp / 50)}</span>
            <p className="text-xs font-black text-[#1a1a1a]/70 mt-0.5">Hours Active</p>
          </div>
        </section>

        {/* Momentum Info */}
        <section className="bg-[#fbbf24] border-2 border-[#1a1a1a] rounded-xl p-3 hard-shadow">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white hard-border flex items-center justify-center flex-shrink-0">
              <Flame className="w-4 h-4 text-[#1a1a1a]" />
            </div>
            <div>
              <h3 className="text-xs font-black text-[#1a1a1a]">Momentum</h3>
              <p className="text-xs font-black text-[#1a1a1a]/70 mt-0.5 leading-relaxed">
                Complete missions to build momentum. Higher momentum gives you a small XP bonus.
              </p>
            </div>
          </div>
        </section>

        {/* Dev: Feed Link */}
        <div className="pt-4 border-t border-[#e5e5e5]">
          <button
            onClick={() => router.push("/feed")}
            className="w-full text-center text-xs text-[#999] hover:text-[#666] font-medium py-2 transition-colors"
          >
            Dev: Feed
          </button>
        </div>
      </div>
    </main>
  );
}
