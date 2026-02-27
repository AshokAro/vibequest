"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MapPin,
  ArrowLeft,
  Check,
  LocateFixed,
  Loader2,
  Search,
  Building2,
  Compass,
  BookOpen,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTapFeedback } from "../hooks/useTapFeedback";
import { Button, SelectablePill } from "../components/Button";
import type { Interest, InterestOption, UserPreferences } from "@/lib/types";

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

const interests: InterestOption[] = [
  { value: "creative", label: "Creative", emoji: "🎨", description: "Making, documenting, observing" },
  { value: "music_sound", label: "Music & Sound", emoji: "🎵", description: "Live gigs, field recording" },
  { value: "movement_body", label: "Movement & Body", emoji: "🏃", description: "Running, yoga, strength" },
  { value: "food_drink", label: "Food & Drink", emoji: "🍜", description: "Street food, cafés, markets" },
  { value: "culture_knowledge", label: "Culture & Knowledge", emoji: "🏛️", description: "History, architecture, museums" },
  { value: "nature_outdoors", label: "Nature & Outdoors", emoji: "🌿", description: "Parks, birding, botany" },
  { value: "people_social", label: "People & Social", emoji: "🤝", description: "Watching, talking, markets" },
  { value: "mind_curiosity", label: "Mind & Curiosity", emoji: "🧩", description: "Puzzles, mapping, trivia" },
  { value: "collecting_hunting", label: "Collecting & Hunting", emoji: "🛍️", description: "Thrifting, books, ephemera" },
  { value: "niche_unexpected", label: "Niche & Unexpected", emoji: "✨", description: "Shadows, signage, patterns" },
];

const interestColors = [
  "bg-[#ff6b9d]",
  "bg-[#c084fc]",
  "bg-[#fbbf24]",
  "bg-[#22d3ee]",
  "bg-[#a3e635]",
  "bg-[#fb7185]",
  "bg-[#a78bfa]",
  "bg-[#f472b6]",
  "bg-[#60a5fa]",
  "bg-[#34d399]",
];

type SettingsTab = "location" | "interests";

// Inner component that uses useSearchParams
function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { withTap } = useTapFeedback();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tabParam = searchParams.get("tab");
    return tabParam === "interests" ? "interests" : "location";
  });
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [location, setLocation] = useState<UserPreferences["location"]>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [preferredTypes, setPreferredTypes] = useState<UserPreferences["preferredQuestTypes"]>(["outdoor", "indoor"]);
  const [manualCity, setManualCity] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const prefs = localStorage.getItem("vibequest_preferences");
    if (prefs) {
      const parsed: UserPreferences = JSON.parse(prefs);
      setPreferences(parsed);
      setLocation(parsed.location);
      // Filter out invalid/old interests that don't match current schema
      const validInterests = (parsed.interests || []).filter((i: Interest) =>
        VALID_INTERESTS.includes(i)
      );
      setSelectedInterests(validInterests);
      setPreferredTypes(parsed.preferredQuestTypes || ["outdoor", "indoor"]);
      // If we filtered out invalid interests, save the cleaned preferences back
      if (validInterests.length !== (parsed.interests || []).length) {
        const cleanedPrefs: UserPreferences = {
          ...parsed,
          interests: validInterests,
        };
        localStorage.setItem("vibequest_preferences", JSON.stringify(cleanedPrefs));
      }
    }
  }, []);

  const requestLocation = useCallback(() => {
    setIsLocating(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await response.json();
          const newLocation = {
            lat: latitude,
            lng: longitude,
            city: data.city || data.locality || "Your City",
            country: data.countryName || "",
          };
          setLocation(newLocation);
          savePreferences(newLocation, selectedInterests, preferredTypes);
        } catch {
          const newLocation = {
            lat: latitude,
            lng: longitude,
            city: "Your Location",
            country: "",
          };
          setLocation(newLocation);
          savePreferences(newLocation, selectedInterests, preferredTypes);
        }
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        setLocationError("Location access denied. Try manual entry.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [selectedInterests, preferredTypes]);

  const setManualLocation = useCallback(async () => {
    if (!manualCity.trim()) return;
    setIsLocating(true);
    setLocationError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualCity)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const newLocation = {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          city: result.display_name.split(",")[0],
          country: result.display_name.split(",").pop()?.trim() || "",
        };
        setLocation(newLocation);
        savePreferences(newLocation, selectedInterests, preferredTypes);
        setShowManualInput(false);
      } else {
        setLocationError("City not found.");
      }
    } catch {
      setLocationError("Failed to look up.");
    } finally {
      setIsLocating(false);
    }
  }, [manualCity, selectedInterests, preferredTypes]);

  const toggleInterest = (interest: Interest) => {
    const newInterests = selectedInterests.includes(interest)
      ? selectedInterests.filter((i) => i !== interest)
      : [...selectedInterests, interest];
    setSelectedInterests(newInterests);
    savePreferences(location, newInterests, preferredTypes);
  };

  const toggleQuestType = (type: "outdoor" | "indoor" | "social") => {
    const newTypes = preferredTypes.includes(type)
      ? preferredTypes.filter((t) => t !== type)
      : [...preferredTypes, type];
    setPreferredTypes(newTypes);
    savePreferences(location, selectedInterests, newTypes);
  };

  const savePreferences = (
    loc: UserPreferences["location"],
    ints: Interest[],
    types: UserPreferences["preferredQuestTypes"]
  ) => {
    const newPrefs: UserPreferences = {
      hasCompletedOnboarding: true,
      location: loc,
      interests: ints,
      preferredQuestTypes: types,
    };
    localStorage.setItem("vibequest_preferences", JSON.stringify(newPrefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <main className="h-full safe-top safe-x bg-[#fafafa] overflow-y-auto">
      {/* Header */}
      <header className="px-5 pt-4 pb-3 flex items-center justify-between">
        <Button
          onClick={() => router.push("/")}
          size="icon"
          variant="secondary"
          className="w-10 h-10"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-black text-[#1a1a1a]">Settings</h1>
        <div className="w-10" />
      </header>

      {/* Tabs */}
      <div className="px-5 mb-4">
        <div className="flex gap-2 p-1 bg-[#f5f5f5] rounded-xl">
          <button
            onClick={withTap(() => setActiveTab("location"), "light")}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-black transition-all",
              activeTab === "location"
                ? "bg-white text-[#1a1a1a] hard-border hard-shadow-sm"
                : "text-[#666] hover:text-[#1a1a1a]"
            )}
          >
            Location
          </button>
          <button
            onClick={withTap(() => setActiveTab("interests"), "light")}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-black transition-all",
              activeTab === "interests"
                ? "bg-white text-[#1a1a1a] hard-border hard-shadow-sm"
                : "text-[#666] hover:text-[#1a1a1a]"
            )}
          >
            Interests
          </button>
        </div>
      </div>

      {/* Saved Indicator */}
      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-[#a3e635] hard-border hard-shadow rounded-full px-4 py-2 flex items-center gap-2">
              <Check className="w-4 h-4 text-[#1a1a1a]" />
              <span className="text-sm font-black text-[#1a1a1a]">Saved!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Tab */}
      {activeTab === "location" && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="px-5 pb-8"
        >
          <div className="mb-6">
            <h2 className="text-xl font-black text-[#1a1a1a] mb-2">Your Location</h2>
            <p className="text-sm text-[#666] font-medium">
              Update where you&apos;re based for local quest suggestions.
            </p>
          </div>

          {/* Current Location */}
          {location ? (
            <div className="bg-[#a3e635] hard-border hard-shadow rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white hard-border flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-[#1a1a1a]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-[#1a1a1a]">Current Location</p>
                  <p className="text-xs font-bold text-[#1a1a1a]/70">
                    {location.city}{location.country ? `, ${location.country}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => setLocation(null)}
                  className="w-8 h-8 rounded-lg bg-white/50 flex items-center justify-center hover:bg-white transition-colors"
                >
                  <X className="w-4 h-4 text-[#1a1a1a]" />
                </button>
              </div>
            </div>
          ) : (
            <Button
              onClick={requestLocation}
              disabled={isLocating}
              size="md"
              variant="primary"
              fullWidth
              className="mb-4 py-4"
            >
              {isLocating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finding...
                </>
              ) : (
                <>
                  <LocateFixed className="w-4 h-4" />
                  Detect My Location
                </>
              )}
            </Button>
          )}

          {locationError && (
            <p className="mb-4 text-xs text-[#ff4444] font-bold text-center">
              {locationError}
            </p>
          )}

          {/* Manual Location Input */}
          {!location && (
            <div className="space-y-2">
              <p className="text-sm font-black text-[#1a1a1a]">Or enter manually</p>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                  <input
                    type="text"
                    value={manualCity}
                    onChange={(e) => setManualCity(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && setManualLocation()}
                    placeholder="Enter city name..."
                    className="w-full pl-10 pr-3 py-3 bg-white hard-border rounded-xl text-sm text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-[#ff6b9d] font-bold"
                  />
                </div>
                <Button
                  onClick={setManualLocation}
                  disabled={!manualCity.trim() || isLocating}
                  size="sm"
                  variant="primary"
                >
                  {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set"}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Interests Tab */}
      {activeTab === "interests" && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="px-5 pb-8"
        >
          <div className="mb-4">
            <h2 className="text-xl font-black text-[#1a1a1a] mb-2">Your Interests</h2>
            <p className="text-sm text-[#666] font-medium">
              Select what you love. We&apos;ll match quests to your vibe.
            </p>
          </div>

          {/* Quest Type Preference */}
          <div className="mb-4">
            <p className="text-xs font-black text-[#1a1a1a] mb-2">Quest Types</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "outdoor" as const, label: "Outdoor", icon: Compass, color: "bg-[#22d3ee]" },
                { value: "indoor" as const, label: "Indoor", icon: BookOpen, color: "bg-[#c084fc]" },
                { value: "social" as const, label: "Social", icon: Users, color: "bg-[#ff6b9d]" },
              ].map((type) => (
                <SelectablePill
                  key={type.value}
                  onClick={() => toggleQuestType(type.value)}
                  selected={preferredTypes.includes(type.value)}
                  selectedClassName={type.color}
                  ariaLabel={type.label}
                >
                  <type.icon className="w-3.5 h-3.5" />
                  <span>{type.label}</span>
                </SelectablePill>
              ))}
            </div>
          </div>

          {/* Interests Grid */}
          <p className="text-xs font-black text-[#1a1a1a] mb-2">
            Interests ({selectedInterests.length} selected)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {interests.map((interest, idx) => {
              const isSelected = selectedInterests.includes(interest.value);
              const colorClass = interestColors[idx % interestColors.length];
              return (
                <button
                  key={interest.value}
                  onClick={() => toggleInterest(interest.value)}
                  className={cn(
                    "p-3 rounded-xl border-2 border-[#1a1a1a] text-left tap-target transition-all duration-200 hard-shadow-sm",
                    isSelected
                      ? `${colorClass} text-white hard-shadow -translate-y-0.5`
                      : "bg-white text-[#1a1a1a] hard-shadow-hover"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg">{interest.emoji}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </div>
                  <p className="text-sm font-black">{interest.label}</p>
                  <p className={cn("text-xs font-bold", isSelected ? "text-white/80" : "text-[#666]")}>
                    {interest.description}
                  </p>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </main>
  );
}

// Wrapper component with Suspense for useSearchParams
export default function SettingsPage() {
  return (
    <Suspense fallback={
      <main className="h-full safe-top safe-x bg-[#fafafa] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#ff6b9d] border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <SettingsContent />
    </Suspense>
  );
}
