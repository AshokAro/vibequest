"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, RefreshCw, MapPin, Clock, Zap, ChevronUp, DollarSign, Dumbbell, Brain, Palette, Users, BookOpen, Target, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSwipe } from "../hooks/useSwipe";
import { useTapFeedback } from "../hooks/useTapFeedback";
import { cn } from "@/lib/utils";
import type { Mission, MissionRequest } from "@/lib/types";
// @ts-ignore - types are in app/lib not root lib

// Stat icon mapping
const statIcons: Record<string, React.ElementType> = {
  fitness: Dumbbell,
  calm: Zap,
  creativity: Palette,
  social: Users,
  knowledge: BookOpen,
  discipline: Target,
};

// Mood to emoji mapping for mission cards
const missionEmojis: Record<string, string> = {
  chill: "🌿",
  adventurous: "🚀",
  creative: "🎨",
  social: "🤝",
  focused: "🎯",
  playful: "🎮",
};

// Rotating loading messages
const loadingMessages = [
  "Cooking up vibes...",
  "Brewing something fire...",
  "Consulting the algorithm...",
  "Plotting your next move...",
  "Mixing the perfect mission...",
  "Scanning the city grid...",
  "Connecting the dots...",
  "Assembling your vibe...",
  "Crunching the data...",
  "Syncing with the universe...",
];

// Mock missions for MVP - in production these come from API
const mockMissions: Mission[] = [
  {
    id: "1",
    title: "Neighborhood Photo Walk",
    description: "Explore your local area and capture 5 interesting photos. Look for textures, colors, and unexpected beauty.",
    steps: ["Grab your phone or camera", "Walk for 10 minutes in any direction", "Capture 5 interesting photos", "Pick your favorite and share if you'd like"],
    duration_minutes: 25,
    budget_estimate: 0,
    effort: { physical: 2, mental: 1 },
    location: { type: "nearby", suggestion: "Your neighborhood streets" },
    intrinsic_rewards: { fitness: 5, calm: 10, creativity: 15, social: 0, knowledge: 0, discipline: 5 },
    xp_reward: 85,
  },
  {
    id: "2",
    title: "Coffee Shop Sketch Session",
    description: "Visit a local caf and sketch what you see. No art skills required - just observe and put pencil to paper.",
    steps: ["Find a nearby coffee shop", "Order your favorite drink", "Sketch the scene for 15 minutes", "Reflect on what you noticed"],
    duration_minutes: 30,
    budget_estimate: 5,
    effort: { physical: 1, mental: 3 },
    location: { type: "nearby", suggestion: "Local coffee shop" },
    intrinsic_rewards: { fitness: 0, calm: 15, creativity: 20, social: 5, knowledge: 0, discipline: 10 },
    xp_reward: 110,
  },
  {
    id: "3",
    title: "Sunset Park Bench Meditation",
    description: "Find a park bench and practice 10 minutes of mindful observation. Watch the world go by without your phone.",
    steps: ["Walk to the nearest park", "Find a comfortable bench", "Set a 10-minute timer", "Observe without judgment", "Breathe deeply"],
    duration_minutes: 20,
    budget_estimate: 0,
    effort: { physical: 1, mental: 2 },
    location: { type: "nearby", suggestion: "Local park bench" },
    intrinsic_rewards: { fitness: 0, calm: 25, creativity: 0, social: 0, knowledge: 0, discipline: 15 },
    xp_reward: 95,
  },
];

function MissionCard({
  mission,
  onAccept,
  onDiscard,
  onRegenerate,
  isTop,
  mood,
}: {
  mission: Mission;
  onAccept: () => void;
  onDiscard: () => void;
  onRegenerate: () => void;
  isTop: boolean;
  mood?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const { position, rotation, opacity, handlers } = useSwipe({
    onSwipeLeft: onDiscard,
    onSwipeRight: onAccept,
    onSwipeUp: onRegenerate,
    threshold: 80,
  });

  const getRewardStyle = (value: number) => {
    if (value >= 15) return "bg-[#a3e635] text-[#1a1a1a]";
    if (value >= 10) return "bg-[#22d3ee] text-[#1a1a1a]";
    return "bg-[#e5e5e5] text-[#666]";
  };

  const getEnergyLabel = (physical: number) => {
    if (physical <= 1) return "Low";
    if (physical <= 3) return "Med";
    return "High";
  };

  const emoji = missionEmojis[mood || "chill"] || "✨";

  return (
    <motion.div
      className={cn(
        "absolute inset-x-4 top-0 mx-auto w-auto",
        isTop ? "z-10" : "z-0 scale-95 opacity-50"
      )}
      style={{
        transform: isTop
          ? `translateX(${position.x}px) translateY(${position.y}px) rotate(${rotation}deg)`
          : undefined,
        opacity: isTop ? opacity : undefined,
      }}
      {...(isTop ? handlers : {})}
    >
      <div
        className={cn(
          "bg-white rounded-2xl border-2 border-[#1a1a1a] overflow-hidden tap-target no-select hard-shadow flex flex-col",
          isTop ? "cursor-grab active:cursor-grabbing" : "opacity-50 scale-95"
        )}
        style={{ height: 'calc(100vh - 240px)', maxHeight: '480px' }}
      >
        {/* Card Header - Emoji center, XP right */}
        <div className="relative px-4 pt-6 pb-4 flex-shrink-0">
          {/* XP Badge - Top Right */}
          <div className="absolute top-4 right-4 flex items-center gap-1 bg-[#fbbf24] hard-border rounded-full px-2.5 py-1">
            <Star className="w-3 h-3 text-[#1a1a1a]" fill="currentColor" />
            <span className="text-xs font-black text-[#1a1a1a]">{mission.xp_reward}</span>
          </div>

          {/* Emoji - Top Center */}
          <div className="text-center">
            <span className="text-5xl">{mission.icon || "✨"}</span>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Title & Description */}
          <div className="px-5 pb-3">
            <h3 className="text-lg font-black text-[#1a1a1a] mb-2 leading-tight">{mission.title}</h3>
            <p
              className={cn(
                "text-sm text-[#666] font-medium leading-relaxed",
                !expanded && "line-clamp-7"
              )}
            >
              {mission.description}
            </p>
          </div>

        </div>

        {/* Bottom Section - Mission Details Grid + Rewards */}
        <div className="border-t-2 border-[#1a1a1a] bg-[#fafafa]">
          {/* Mission Details Grid - 2x2 */}
          <div className="grid grid-cols-2 border-b-2 border-[#1a1a1a]">
            <div className="flex items-center justify-start gap-2 py-3 px-4 border-r-2 border-b-2 border-[#1a1a1a]">
              <div className="w-8 h-8 rounded-lg bg-[#c084fc] hard-border flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-[#1a1a1a]" />
              </div>
              <span className="text-sm font-black text-[#1a1a1a]">{mission.duration_minutes}m</span>
            </div>
            <div className="flex items-center justify-start gap-2 py-3 px-4 border-b-2 border-[#1a1a1a] min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#22d3ee] hard-border flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-[#1a1a1a]" />
              </div>
              <span className="text-sm font-black text-[#1a1a1a] truncate">{mission.location.suggestion.split(",")[0]}</span>
            </div>
            <div className="flex items-center justify-start gap-2 py-3 px-4 border-r-2 border-[#1a1a1a]">
              <div className="w-8 h-8 rounded-lg bg-[#a3e635] hard-border flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-[#1a1a1a]" />
              </div>
              <span className="text-sm font-black text-[#1a1a1a]">{mission.budget_estimate === 0 ? "Free" : `₹${mission.budget_estimate}`}</span>
            </div>
            <div className="flex items-center justify-start gap-2 py-3 px-4">
              <div className="w-8 h-8 rounded-lg bg-[#ff6b9d] hard-border flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-black text-[#1a1a1a]">{getEnergyLabel(mission.effort.physical)}</span>
            </div>
          </div>

          {/* Rewards - Icon + Value */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-start gap-2">
              {Object.entries(mission.intrinsic_rewards)
                .filter(([, value]) => value > 0)
                .map(([key, value]) => {
                  const Icon = statIcons[key] || Zap;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1.5 rounded-lg hard-border",
                        getRewardStyle(value)
                      )}
                      title={`${key}: +${value}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-black">+{value}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function MissionsPage() {
  const router = useRouter();
  const { triggerHaptic } = useTapFeedback();
  const [missions, setMissions] = useState<Mission[]>(mockMissions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState<MissionRequest | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotate loading messages every 2 seconds
  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => {
        const nextIndex = (prev + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[nextIndex]);
        return nextIndex;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    const stored = sessionStorage.getItem("missionRequest");
    if (stored) {
      setRequest(JSON.parse(stored));
    }
  }, []);

  const handleAccept = useCallback(() => {
    triggerHaptic("success");
    const mission = missions[currentIndex];
    sessionStorage.setItem("activeMission", JSON.stringify(mission));
    router.push("/missions/active");
  }, [missions, currentIndex, router, triggerHaptic]);

  const generateMissions = useCallback(async () => {
    if (!request) return;

    setLoading(true);

    try {
      const prefs = localStorage.getItem("vibequest_preferences");
      const userPrefs = prefs ? JSON.parse(prefs) : null;

      const response = await fetch("/api/missions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...request,
          location: userPrefs?.location,
          interests: userPrefs?.interests,
          preferredMissionTypes: userPrefs?.preferredMissionTypes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate missions");
      }

      const data = await response.json();
      setMissions(data.missions);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Failed to generate missions:", error);
    } finally {
      setLoading(false);
    }
  }, [request]);

  const handleRegenerate = useCallback(async () => {
    triggerHaptic("medium");
    await generateMissions();
  }, [generateMissions, triggerHaptic]);

  const handleDiscard = useCallback(() => {
    triggerHaptic("error");
    if (currentIndex < missions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleRegenerate();
    }
  }, [currentIndex, missions.length, triggerHaptic, handleRegenerate]);

  useEffect(() => {
    if (request && missions === mockMissions) {
      generateMissions();
    }
  }, [request, generateMissions]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center safe-top safe-x bg-[#fafafa]">
        <div className="text-center">
          <div className="w-14 h-14 bg-[#c084fc] hard-border hard-shadow rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <RefreshCw className="w-7 h-7 text-white animate-spin" />
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={loadingMessage}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              className="text-[#1a1a1a] font-black"
            >
              {loadingMessage}
            </motion.p>
          </AnimatePresence>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen safe-top safe-x bg-[#fafafa] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-5 pt-5 pb-3 flex-shrink-0">
        <h1 className="text-2xl font-black text-[#1a1a1a] tracking-tight">Pick One</h1>
        <p className="text-sm text-[#666] font-medium mt-1">
          {request ? `${request.duration} min • ${request.mood}` : "Swipe to browse"}
        </p>
      </header>

      {/* Card Stack */}
      <div className="relative px-5 mt-2 flex-1" style={{ minHeight: 0 }}>
        <AnimatePresence>
          {missions.slice(currentIndex, currentIndex + 3).map((mission, idx) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onAccept={handleAccept}
              onDiscard={handleDiscard}
              onRegenerate={handleRegenerate}
              isTop={idx === 0}
              mood={request?.mood}
            />
          ))}
        </AnimatePresence>

        {currentIndex >= missions.length && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-2 px-6 py-3 bg-[#c084fc] text-white font-black hard-border hard-shadow hard-shadow-hover rounded-xl tap-target transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>More Vibes</span>
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-4 py-4 flex-shrink-0">
        <button
          onClick={handleDiscard}
          className="w-14 h-14 rounded-full bg-white border-2 border-[#1a1a1a] flex items-center justify-center text-[#666] tap-target hard-shadow-sm hover:-translate-y-0.5 transition-all"
          aria-label="Skip mission"
        >
          <X className="w-6 h-6" />
        </button>
        <button
          onClick={handleAccept}
          className="w-16 h-16 rounded-full bg-[#a3e635] border-2 border-[#1a1a1a] flex items-center justify-center text-[#1a1a1a] tap-target hard-shadow hard-shadow-hover transition-all"
          aria-label="Accept mission"
        >
          <Check className="w-8 h-8" strokeWidth={3} />
        </button>
      </div>

    </main>
  );
}
