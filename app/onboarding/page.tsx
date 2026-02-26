"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  MapPin,
  ArrowRight,
  Check,
  LocateFixed,
  Loader2,
  Search,
  Building2,
  Compass,
  BookOpen,
  Users,
  MapPinned,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTapFeedback } from "../hooks/useTapFeedback";
import type { Interest, InterestOption, UserPreferences } from "@/lib/types";

interface PlacePrediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

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

type OnboardingStep = "welcome" | "location" | "interests" | "ready";

export default function OnboardingPage() {
  const router = useRouter();
  const { withTap } = useTapFeedback();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [location, setLocation] = useState<UserPreferences["location"]>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [preferredTypes, setPreferredTypes] = useState<UserPreferences["preferredMissionTypes"]>(["outdoor", "indoor"]);
  const [manualCity, setManualCity] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [placePredictions, setPlacePredictions] = useState<PlacePrediction[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const prefs = localStorage.getItem("vibequest_preferences");
    if (prefs) {
      const parsed: UserPreferences = JSON.parse(prefs);
      if (parsed.hasCompletedOnboarding) {
        router.push("/");
      }
    }
  }, [router]);

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
          setLocation({
            lat: latitude,
            lng: longitude,
            city: data.city || data.locality || "Your City",
            country: data.countryName || "",
          });
        } catch {
          setLocation({
            lat: latitude,
            lng: longitude,
            city: "Your Location",
            country: "",
          });
        }
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        setLocationError("Location access denied. Try manual entry.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // Search places with debounce
  const searchPlaces = useCallback(async (input: string) => {
    if (!input.trim() || input.length < 2) {
      setPlacePredictions([]);
      return;
    }

    setIsSearchingPlaces(true);
    try {
      const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`);
      const data = await response.json();

      if (data.predictions) {
        setPlacePredictions(data.predictions);
        setShowPredictions(true);
      }
    } catch (error) {
      console.error("Failed to search places:", error);
    } finally {
      setIsSearchingPlaces(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (manualCity.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchPlaces(manualCity);
      }, 300);
    } else {
      setPlacePredictions([]);
      setShowPredictions(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [manualCity, searchPlaces]);

  const selectPlace = useCallback(async (prediction: PlacePrediction) => {
    setIsLocating(true);
    setShowPredictions(false);
    setLocationError(null);

    try {
      const response = await fetch(`/api/places/details?place_id=${prediction.place_id}`);
      const data = await response.json();

      if (data.location) {
        setLocation(data.location);
        setManualCity(prediction.main_text);
        setShowManualInput(false);
      } else {
        setLocationError("Could not get location details.");
      }
    } catch {
      setLocationError("Failed to get location details.");
    } finally {
      setIsLocating(false);
    }
  }, []);

  const setManualLocation = useCallback(async () => {
    if (!manualCity.trim()) return;
    // If there are predictions, use the first one
    if (placePredictions.length > 0) {
      await selectPlace(placePredictions[0]);
    } else {
      setLocationError("Please select a location from the list.");
    }
  }, [manualCity, placePredictions, selectPlace]);

  const toggleInterest = (interest: Interest) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const toggleMissionType = (type: "outdoor" | "indoor" | "social") => {
    setPreferredTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const completeOnboarding = () => {
    const preferences: UserPreferences = {
      hasCompletedOnboarding: true,
      location,
      interests: selectedInterests,
      preferredMissionTypes: preferredTypes,
    };
    localStorage.setItem("vibequest_preferences", JSON.stringify(preferences));
    router.push("/");
  };

  const canComplete = selectedInterests.length >= 2;

  return (
    <main className="h-[100dvh] safe-top safe-x bg-[#fafafa] flex flex-col overflow-hidden">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1.5 bg-[#e5e5e5]">
        <motion.div
          className="h-full bg-[#ff6b9d] hard-border-b"
          initial={{ width: "0%" }}
          animate={{
            width:
              step === "welcome" ? "25%" : step === "location" ? "50%" : step === "interests" ? "75%" : "100%",
          }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        {/* Welcome Step */}
        {step === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center flex-1 px-5 overflow-y-auto"
          >
            <div className="w-16 h-16 rounded-xl bg-[#ff6b9d] hard-border hard-shadow flex items-center justify-center mb-6">
              <span className="text-3xl">🎯</span>
            </div>

            <h1 className="text-2xl font-black text-[#1a1a1a] text-center mb-3 tracking-tight">
              VibeQuest
            </h1>

            <p className="text-sm text-[#666] text-center mb-8 max-w-xs font-medium leading-relaxed">
              Missions tailored to your location & interests. Just a few quick questions!
            </p>

            <button
              onClick={withTap(() => setStep("location"), "medium")}
              className="flex items-center gap-2 px-8 py-4 bg-[#1a1a1a] text-white font-black text-base rounded-xl tap-target hard-border hard-shadow hard-shadow-hover transition-all"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Location Step */}
        {step === "location" && (
          <motion.div
            key="location"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="flex flex-col flex-1 px-5 py-8 overflow-hidden"
          >
            <div className="flex-1">
              <div className="w-12 h-12 rounded-xl bg-[#22d3ee] hard-border hard-shadow flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-[#1a1a1a]" />
              </div>

              <h2 className="text-xl font-black text-[#1a1a1a] mb-2 tracking-tight">Where are you?</h2>
              <p className="text-xs text-[#666] font-medium mb-6">
                We&apos;ll suggest nearby missions—parks, cafes, hidden gems.
              </p>

              {location ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[#a3e635] hard-border hard-shadow rounded-xl p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white hard-border flex items-center justify-center">
                      <Check className="w-5 h-5 text-[#1a1a1a]" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-[#1a1a1a]">Found you!</p>
                      <p className="text-xs font-bold text-[#1a1a1a]/70">
                        {location.city}{location.country ? `, ${location.country}` : ""}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <button
                  onClick={withTap(requestLocation, "medium")}
                  disabled={isLocating}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm tap-target transition-all hard-border hard-shadow",
                    isLocating
                      ? "bg-[#e5e5e5] text-[#999] cursor-not-allowed shadow-none"
                      : "bg-[#c084fc] text-white hard-shadow-hover"
                  )}
                >
                  {isLocating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Finding...
                    </>
                  ) : (
                    <>
                      <LocateFixed className="w-4 h-4" />
                      Share Location
                    </>
                  )}
                </button>
              )}

              {locationError && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs text-[#ff4444] font-bold text-center">
                  {locationError}
                </motion.p>
              )}

              {/* Manual Location Input */}
              {!location && (
                <div className="mt-4">
                  {!showManualInput ? (
                    <button
                      onClick={withTap(() => setShowManualInput(true), "light")}
                      className="w-full flex items-center justify-center gap-1.5 py-3 text-[#666] hover:text-[#1a1a1a] font-bold text-xs tap-target transition-colors"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      Or enter city manually
                    </button>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 relative">
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                          <input
                            type="text"
                            value={manualCity}
                            onChange={(e) => {
                              setManualCity(e.target.value);
                              setShowPredictions(true);
                            }}
                            onFocus={() => setShowPredictions(true)}
                            placeholder="Search for a city..."
                            className="w-full pl-10 pr-3 py-3 bg-white hard-border rounded-lg text-sm text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-[#ff6b9d] font-bold"
                            autoFocus
                          />
                          {isSearchingPlaces && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666] animate-spin" />
                          )}
                        </div>
                        <button
                          onClick={withTap(() => { setShowManualInput(false); setShowPredictions(false); setLocationError(null); }, "light")}
                          className="px-4 py-3 rounded-lg font-black text-sm tap-target transition-all hard-border bg-[#e5e5e5] text-[#666] hover:text-[#1a1a1a]"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Autocomplete Dropdown */}
                      {showPredictions && placePredictions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute z-50 left-0 right-0 top-full mt-1 bg-white hard-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
                        >
                          {placePredictions.map((prediction) => (
                            <button
                              key={prediction.place_id}
                              onClick={() => selectPlace(prediction)}
                              className="w-full px-4 py-3 text-left hover:bg-[#f5f5f5] border-b border-[#e5e5e5] last:border-b-0 tap-target"
                            >
                              <div className="flex items-center gap-2">
                                <MapPinned className="w-4 h-4 text-[#ff6b9d] flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-[#1a1a1a] truncate">{prediction.main_text}</p>
                                  <p className="text-xs text-[#666] truncate">{prediction.secondary_text}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}

                      {showPredictions && manualCity.length >= 2 && !isSearchingPlaces && placePredictions.length === 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white hard-border rounded-lg shadow-lg p-4 text-center">
                          <p className="text-sm text-[#666]">No cities found. Try a different search.</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              <button
                onClick={withTap(() => setStep("interests"), "light")}
                className="w-full mt-4 py-3 text-[#999] font-bold text-xs hover:text-[#666] transition-colors"
              >
                Skip →
              </button>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={withTap(() => setStep("welcome"), "light")}
                className="flex-1 py-3 rounded-xl bg-white text-[#1a1a1a] font-black hard-border tap-target hover:-translate-y-0.5 transition-all text-sm"
              >
                Back
              </button>
              <button
                onClick={withTap(() => setStep("interests"), "medium")}
                className="flex-1 py-3 rounded-xl bg-[#1a1a1a] text-white font-black hard-border hard-shadow tap-target flex items-center justify-center gap-1.5 hard-shadow-hover text-sm"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Interests Step */}
        {step === "interests" && (
          <motion.div
            key="interests"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="flex flex-col flex-1 px-5 py-8 overflow-hidden"
          >
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-[#fbbf24] hard-border hard-shadow flex items-center justify-center mb-4">
                <span className="text-2xl">💖</span>
              </div>

              <h2 className="text-xl font-black text-[#1a1a1a] mb-2 tracking-tight">What do you love?</h2>
              <p className="text-xs text-[#666] font-medium mb-5">Pick at least 2. We&apos;ll match missions to you.</p>

              {/* Mission Type Preference */}
              <div className="mb-4">
                <p className="text-xs font-black text-[#1a1a1a] mb-2">Mission types</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "outdoor" as const, label: "Outdoor", icon: Compass, color: "bg-[#22d3ee]" },
                    { value: "indoor" as const, label: "Indoor", icon: BookOpen, color: "bg-[#c084fc]" },
                    { value: "social" as const, label: "Social", icon: Users, color: "bg-[#ff6b9d]" },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => toggleMissionType(type.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-[#1a1a1a] tap-target transition-all hard-shadow-sm text-xs",
                        preferredTypes.includes(type.value)
                          ? `${type.color} text-white hard-shadow -translate-y-1`
                          : "bg-white text-[#1a1a1a] hover:-translate-y-0.5"
                      )}
                    >
                      <type.icon className="w-3.5 h-3.5" />
                      <span className="font-bold">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs font-black text-[#1a1a1a] mb-2">
                Interests ({selectedInterests.length} picked)
              </p>
            </div>

            {/* Scrollable Interests Grid */}
            <div className="flex-1 overflow-y-auto min-h-0 -mx-5 px-5">
              <div className="grid grid-cols-2 gap-2 pb-4">
                {interests.map((interest, idx) => {
                  const isSelected = selectedInterests.includes(interest.value);
                  const colorClass = interestColors[idx % interestColors.length];
                  return (
                    <button
                      key={interest.value}
                      onClick={() => toggleInterest(interest.value)}
                      className={cn(
                        "p-3 rounded-lg border-2 border-[#1a1a1a] text-left tap-target transition-all duration-200 hard-shadow-sm",
                        isSelected
                          ? `${colorClass} text-white hard-shadow -translate-y-1`
                          : "bg-white text-[#1a1a1a] hover:-translate-y-0.5"
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
            </div>

            <div className="flex gap-2 mt-4 flex-shrink-0">
              <button
                onClick={() => setStep("location")}
                className="flex-1 py-3 rounded-xl bg-white text-[#1a1a1a] font-black hard-border tap-target hover:-translate-y-0.5 transition-all text-sm"
              >
                Back
              </button>
              <button
                onClick={() => setStep("ready")}
                disabled={!canComplete}
                className={cn(
                  "flex-1 py-3 rounded-xl font-black hard-border hard-shadow tap-target transition-all text-sm",
                  canComplete
                    ? "bg-[#ff6b9d] text-white hard-shadow-hover"
                    : "bg-[#e5e5e5] text-[#999] cursor-not-allowed shadow-none"
                )}
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}

        {/* Ready Step */}
        {step === "ready" && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center flex-1 px-5 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-16 h-16 rounded-xl bg-[#a3e635] hard-border hard-shadow flex items-center justify-center mb-6"
            >
              <Check className="w-8 h-8 text-[#1a1a1a]" />
            </motion.div>

            <h2 className="text-xl font-black text-[#1a1a1a] text-center mb-2 tracking-tight">You&apos;re Set!</h2>

            <p className="text-xs text-[#666] text-center mb-6 max-w-xs font-medium">
              Finding missions near <span className="text-[#ff6b9d] font-black">{location?.city || "you"}</span> that match your vibe.
            </p>

            <div className="flex flex-wrap justify-center gap-1.5 mb-6 max-w-[280px]">
              {selectedInterests.slice(0, 4).map((interest, idx) => {
                const i = interests.find((item) => item.value === interest);
                const colorClass = interestColors[idx % interestColors.length];
                return (
                  <span key={interest} className={cn("px-2 py-1 rounded-full text-xs font-black hard-border", colorClass, "text-white")}>
                    {i?.emoji} {i?.label}
                  </span>
                );
              })}
              {selectedInterests.length > 4 && (
                <span className="px-2 py-1 bg-white hard-border rounded-full text-xs font-black text-[#1a1a1a]">
                  +{selectedInterests.length - 4}
                </span>
              )}
            </div>

            <button
              onClick={completeOnboarding}
              className="flex items-center gap-2 px-8 py-4 bg-[#1a1a1a] text-white font-black text-sm rounded-xl tap-target hard-border hard-shadow hard-shadow-hover transition-all"
            >
              Start Questing
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
