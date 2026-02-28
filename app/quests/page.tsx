"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, RefreshCw, MapPin, Clock, Zap, ChevronUp, DollarSign, Dumbbell, Brain, Palette, Users, BookOpen, Target, Star, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSwipe } from "../hooks/useSwipe";
import { useTapFeedback } from "../hooks/useTapFeedback";
import { Button, CircleButton } from "../components/Button";
import { cn } from "@/lib/utils";
import type { Quest, QuestRequest, Interest } from "@/lib/types";
import { getCachedLocations, saveLocationsToCache, getLocationsForQueries, type CachedLocation } from "@/lib/locationCache";

// TODO: Consolidate - VALID_INTERESTS is duplicated in profile/page.tsx, settings/page.tsx, and quests/page.tsx
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

// Stat colors from profile page (discipline uses gray instead of black for black text visibility)
const statColors: Record<string, string> = {
  fitness: "bg-[#a3e635]",
  calm: "bg-[#22d3ee]",
  creativity: "bg-[#ff6b9d]",
  social: "bg-[#fbbf24]",
  knowledge: "bg-[#c084fc]",
  discipline: "bg-[#94a3b8]",
};

// Mood to emoji mapping for quest cards
const questEmojis: Record<string, string> = {
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
  "Mixing the perfect quest...",
  "Scanning the city grid...",
  "Connecting the dots...",
  "Assembling your vibe...",
  "Crunching the data...",
  "Syncing with the universe...",
];

// Mock quests for MVP - in production these come from API
// Format: 1 major stat (2) + 1 minor stat (1), rest are 0
const mockQuests: Quest[] = [
  {
    id: "1",
    title: "Neighborhood Photo Walk",
    description: "Explore your local area and capture 5 interesting photos. Look for textures, colors, and unexpected beauty.",
    steps: ["Grab your phone or camera", "Walk for 10 minutes in any direction", "Capture 5 interesting photos", "Pick your favorite and share if you'd like"],
    duration_minutes: 25,
    budget_estimate: 0,
    effort: { physical: 2, mental: 1 },
    location: { type: "nearby", suggestion: "Your neighborhood streets" },
    intrinsic_rewards: { fitness: 0, calm: 0, creativity: 2, social: 0, knowledge: 0, discipline: 1 },
    xp_reward: 85,
    icon: "📸",
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
    intrinsic_rewards: { fitness: 0, calm: 1, creativity: 2, social: 0, knowledge: 0, discipline: 0 },
    xp_reward: 110,
    icon: "☕",
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
    intrinsic_rewards: { fitness: 0, calm: 2, creativity: 0, social: 0, knowledge: 0, discipline: 1 },
    xp_reward: 95,
  },
  {
    id: "4",
    title: "Local History Hunt",
    description: "Find the oldest building within 3 blocks and identify one architectural detail that reveals its age.",
    steps: ["Walk 3 blocks in any direction", "Identify the oldest building", "Find one historical detail", "Research its significance"],
    duration_minutes: 30,
    budget_estimate: 0,
    effort: { physical: 2, mental: 3 },
    location: { type: "nearby", suggestion: "Historic buildings in your area" },
    intrinsic_rewards: { fitness: 0, calm: 0, creativity: 1, social: 0, knowledge: 2, discipline: 0 },
    xp_reward: 105,
  },
  {
    id: "5",
    title: "Random Street Encounter",
    description: "A wildcard quest! Walk to the busiest street corner near you and strike up a conversation with someone wearing the color blue.",
    steps: ["Find the busiest intersection nearby", "Look for someone in blue", "Ask them about their day", "Listen actively for 2 minutes"],
    duration_minutes: 20,
    budget_estimate: 0,
    effort: { physical: 1, mental: 4 },
    location: { type: "nearby", suggestion: "Busy intersection" },
    intrinsic_rewards: { fitness: 0, calm: 0, creativity: 0, social: 2, knowledge: 0, discipline: 1 },
    xp_reward: 130,
    is_wildcard: true,
  },
];

function QuestCard({
  quest,
  onAccept,
  onDiscard,
  onRegenerate,
  isTop,
  mood,
}: {
  quest: Quest;
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
    // Handle both old scale (0-25) and new scale (0-2)
    if (value >= 2 || value >= 15) return "bg-[#a3e635] text-[#1a1a1a]";
    if (value >= 1 || value >= 10) return "bg-[#22d3ee] text-[#1a1a1a]";
    return "bg-[#e5e5e5] text-[#666]";
  };

  const getEnergyLabel = (physical: number) => {
    if (physical <= 1) return "Low";
    if (physical <= 3) return "Med";
    return "High";
  };

  const emoji = questEmojis[mood || "chill"] || "✨";
  const isWildcard = quest.is_wildcard;

  return (
    <motion.div
      layoutId={quest.id}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{
        scale: isTop ? 1 : 0.95,
        opacity: 1,
        zIndex: isTop ? 10 : 0,
      }}
      exit={{
        opacity: 0,
        scale: 0.8,
        x: isTop ? (position.x > 0 ? 500 : -500) : 0,
        transition: { duration: 0.2 },
      }}
      transition={{
        layout: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
        scale: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
        opacity: { duration: 0.15 },
      }}
      className={cn(
        "absolute inset-x-0 top-0 mx-auto",
        isTop ? "z-10" : "z-0"
      )}
      style={{
        height: 'calc(100vh - 240px)',
        maxHeight: '480px',
      }}
      {...(isTop ? handlers : {})}
    >
      <div
        className={cn(
          "rounded-2xl border-2 overflow-hidden tap-target no-select hard-shadow flex flex-col bg-white h-full",
          isWildcard
            ? "bg-gradient-to-br from-[#ffb3c7] via-[#ffffff] to-[#d9b3fc] border-[#ff6b9d]"
            : "bg-white border-[#1a1a1a]",
          isTop ? "cursor-grab active:cursor-grabbing" : ""
        )}
        style={{
          transform: isTop
            ? `translateX(${position.x}px) translateY(${position.y}px) rotate(${rotation}deg)`
            : 'translateX(0) translateY(0) rotate(0deg)',
        }}
      >
        {/* Content wrapper with swipe opacity */}
        <div
          className="flex flex-col h-full"
          style={{ opacity: isTop ? opacity : 1 }}
        >
        {/* Card Header - Emoji center, XP right */}
        <div className="relative px-4 pt-6 pb-4 flex-shrink-0">
          {/* Wildcard Badge - Top Left */}
          {isWildcard && (
            <div className="absolute top-4 left-4">
              <div className="flex items-center gap-1 bg-gradient-to-r from-[#ff6b9d] to-[#c084fc] hard-border rounded-full px-2.5 py-1 shimmer-effect">
                <Sparkles className="w-3 h-3 text-white relative z-10" />
                <span className="text-xs font-black text-white relative z-10">WILDCARD</span>
              </div>
            </div>
          )}

          {/* XP Badge - Top Right */}
          <div className={cn(
            "absolute top-4 right-4 flex items-center gap-1 hard-border rounded-full px-2.5 py-1",
            isWildcard ? "bg-[#ff6b9d] text-white" : "bg-[#fbbf24] text-[#1a1a1a]"
          )}>
            <Star className={cn("w-3 h-3", isWildcard ? "text-white" : "text-[#1a1a1a]")} fill="currentColor" />
            <span className="text-xs font-black">{quest.xp_reward}{isWildcard && "!"}</span>
          </div>

          {/* Emoji - Top Center */}
          <div className="text-center pt-4">
            <span className="text-5xl">{quest.icon}</span>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Title & Description */}
          <div className="px-5 pb-3">
            <h3 className="text-lg font-black text-[#1a1a1a] mb-2 leading-tight">{quest.title}</h3>
            <p
              className={cn(
                "text-sm text-[#666] font-medium leading-relaxed",
                !expanded && "line-clamp-7"
              )}
            >
              {quest.description}
            </p>
          </div>

        </div>

        {/* Bottom Section - Quest Details Grid + Rewards */}
        <div className="border-t-2 border-[#1a1a1a] bg-[#fafafa]">
          {/* Quest Details Grid - 2x2 */}
          <div className="grid grid-cols-2 border-b-2 border-[#1a1a1a]">
            <div className="flex items-center justify-start gap-2 py-3 px-4 border-r-2 border-b-2 border-[#1a1a1a]">
              <div className="w-8 h-8 rounded-lg bg-[#c084fc] hard-border flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-[#1a1a1a]" />
              </div>
              <span className="text-sm font-black text-[#1a1a1a]">{quest.duration_minutes}m</span>
            </div>
            <div className="flex items-center justify-start gap-2 py-3 px-4 border-b-2 border-[#1a1a1a] min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#22d3ee] hard-border flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-[#1a1a1a]" />
              </div>
              <span className="text-sm font-black text-[#1a1a1a] truncate">{quest.location.suggestion.split(",")[0]}</span>
            </div>
            <div className="flex items-center justify-start gap-2 py-3 px-4 border-r-2 border-[#1a1a1a]">
              <div className="w-8 h-8 rounded-lg bg-[#a3e635] hard-border flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-[#1a1a1a]" />
              </div>
              <span className="text-sm font-black text-[#1a1a1a]">{quest.budget_estimate === 0 ? "Free" : `₹${quest.budget_estimate}`}</span>
            </div>
            <div className="flex items-center justify-start gap-2 py-3 px-4">
              <div className="w-8 h-8 rounded-lg bg-[#ff6b9d] hard-border flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-[#1a1a1a]" />
              </div>
              <span className="text-sm font-black text-[#1a1a1a]">{getEnergyLabel(quest.effort.physical)}</span>
            </div>
          </div>

          {/* Rewards - Major (+20) and Minor (+10) stats */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-start gap-2">
              {Object.entries(quest.intrinsic_rewards || {})
                .filter(([, value]) => value > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([key, value]) => {
                  const Icon = statIcons[key] || Zap;
                  const isMajor = value === 2;
                  const statName = key.charAt(0).toUpperCase() + key.slice(1);
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1.5 rounded-lg hard-border",
                        statColors[key] || "bg-[#e5e5e5]",
                        "text-[#1a1a1a]"
                      )}
                      title={`${key}: ${isMajor ? 'Major' : 'Minor'}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-black">{statName}</span>
                      <span className="text-xs font-black">+{isMajor ? 20 : 10}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function QuestsPage() {
  const router = useRouter();
  const { triggerHaptic } = useTapFeedback();
  const [quests, setQuests] = useState<Quest[]>(mockQuests);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visualIndex, setVisualIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState<QuestRequest | null>(null);
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
    const stored = sessionStorage.getItem("questRequest");
    if (stored) {
      setRequest(JSON.parse(stored));
    }
  }, []);

  const handleAccept = useCallback(() => {
    triggerHaptic("success");
    const quest = quests[visualIndex];
    sessionStorage.setItem("activeQuest", JSON.stringify(quest));
    router.push("/quests/active");
  }, [quests, visualIndex, router, triggerHaptic]);

  const generateQuests = useCallback(async () => {
    if (!request) {
      console.log("[Frontend] No request data, skipping generation");
      return;
    }

    console.log("[Frontend] Starting quest generation with request:", request);
    setLoading(true);

    try {
      const prefs = localStorage.getItem("vibequest_preferences");
      const userPrefs = prefs ? JSON.parse(prefs) : null;
      console.log("[Frontend] User preferences:", userPrefs);

      const city = userPrefs?.location?.city;
      const cachedLocations = city ? getCachedLocations(city) : null;

      // If we have cached locations, include them in the request
      // The API will use them if available, reducing Google Maps calls
      // Filter out invalid/old interests that don't match current schema
      const validInterests = (userPrefs?.interests || []).filter((i: Interest) =>
        VALID_INTERESTS.includes(i)
      );

      // Get completion feedback history for AI prompt
      const completionFeedback = localStorage.getItem("vibequest_completion_feedback");
      const feedbackHistory = completionFeedback ? JSON.parse(completionFeedback) : [];

      const requestBody = {
        ...request,
        location: userPrefs?.location,
        interests: validInterests,
        preferredQuestTypes: userPrefs?.preferredQuestTypes,
        cachedLocations: cachedLocations || undefined,
        completionFeedback: feedbackHistory.slice(0, 50), // Send last 50 entries
      };
      console.log("[Frontend] Sending request body:", requestBody);

      const response = await fetch("/api/quests/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      console.log("[Frontend] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Frontend] API error:", errorText);
        throw new Error(`Failed to generate quests: ${response.status}`);
      }

      const data = await response.json();
      console.log("[Frontend] Received quests:", data.quests?.length);
      console.log("[Frontend] Quest icons:", data.quests?.map((q: Quest, i: number) => `${i}: "${q.icon}" (title: "${q.title?.substring(0, 30)}...")`));
      // Log full first quest to see what fields AI returns
      console.log("[Frontend] Full first quest:", JSON.stringify(data.quests?.[0], null, 2));

      // Save returned locations to cache for future use
      if (city && data.locations && data.locations.length > 0) {
        saveLocationsToCache(city, data.locations);
      }

      setQuests(data.quests);
      setCurrentIndex(0);
      setVisualIndex(0);
    } catch (error) {
      console.error("[Frontend] Failed to generate quests:", error);
    } finally {
      setLoading(false);
    }
  }, [request]);

  const handleRegenerate = useCallback(async () => {
    triggerHaptic("medium");
    await generateQuests();
  }, [generateQuests, triggerHaptic]);

  const handleDiscard = useCallback(() => {
    triggerHaptic("error");
    // Update currentIndex immediately for state tracking
    if (currentIndex < quests.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      // Delay visual index update to let the exit animation complete
      setTimeout(() => {
        setVisualIndex((prev) => prev + 1);
      }, 200);
    } else {
      handleRegenerate();
    }
  }, [currentIndex, quests.length, triggerHaptic, handleRegenerate]);

  useEffect(() => {
    if (request && quests === mockQuests) {
      generateQuests();
    }
  }, [request, generateQuests]);


  if (loading) {
    return (
      <main className="h-full flex items-center justify-center safe-top safe-x bg-[#fafafa]">
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
    <main className="h-full safe-top safe-x bg-[#fafafa] flex flex-col overflow-hidden touch-none">
      {/* Header */}
      <header className="px-5 pt-5 pb-3 flex-shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1a1a1a] tracking-tight">Pick One</h1>
          <p className="text-sm text-[#666] font-medium mt-1">
            {request ? `${request.duration} min • ${request.mood}` : "Swipe to browse"}
          </p>
        </div>
        <Button
          onClick={() => router.push("/")}
          size="icon"
          variant="secondary"
          className="w-10 h-10"
          ariaLabel="Close"
        >
          <X className="w-5 h-5" />
        </Button>
      </header>

      {/* Card Stack - Fixed height container */}
      <div className="relative mt-2 flex-1 px-5" style={{ minHeight: 0 }}>
        <div className="relative w-full h-full">
          <AnimatePresence mode="popLayout">
            {quests.slice(visualIndex, visualIndex + 2).map((quest, idx) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                onAccept={handleAccept}
                onDiscard={handleDiscard}
                onRegenerate={handleRegenerate}
                isTop={idx === 0}
                mood={request?.mood}
              />
            ))}
          </AnimatePresence>
        </div>

        {currentIndex >= quests.length && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              onClick={handleRegenerate}
              size="md"
              variant="primary"
              className="bg-[#c084fc]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>More Vibes</span>
            </Button>
          </div>
        )}
      </div>

      {/* Action Buttons - Fixed at bottom */}
      <div className="flex items-center justify-center gap-4 py-4 flex-shrink-0">
        <CircleButton
          onClick={handleDiscard}
          size="md"
          variant="danger"
          ariaLabel="Skip quest"
        >
          <X className="w-6 h-6" />
        </CircleButton>
        <CircleButton
          onClick={handleAccept}
          size="lg"
          variant="success"
          ariaLabel="Accept quest"
        >
          <Check className="w-8 h-8" strokeWidth={3} />
        </CircleButton>
      </div>

    </main>
  );
}
