"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dices, Zap, Clock, MapPin, User, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Mood, UserPreferences } from "@/lib/types";
import { useTapFeedback } from "./hooks/useTapFeedback";
import { DraggableSlider } from "./components/DraggableSlider";
import { Button, SelectablePill, IconButton } from "./components/Button";
import { Logo } from "./components/Logo";

// Gumroad-style pop colors
const moods: { value: Mood; label: string; emoji: string; bg: string }[] = [
  { value: "chill", label: "Chill", emoji: "🌿", bg: "bg-emerald-400" },
  { value: "adventurous", label: "Adventure", emoji: "🚀", bg: "bg-orange-400" },
  { value: "creative", label: "Creative", emoji: "🎨", bg: "bg-pink-400" },
  { value: "social", label: "Social", emoji: "🤝", bg: "bg-blue-400" },
  { value: "focused", label: "Focused", emoji: "🎯", bg: "bg-purple-400" },
  { value: "playful", label: "Playful", emoji: "🎮", bg: "bg-yellow-400" },
];

const feelingLucky = { value: "random" as const, label: "Feeling Lucky", emoji: "🎲", bg: "bg-[#ff6b9d]" };

const energyLevels = [
  { value: "low", label: "Low", description: "Take it easy", color: "bg-emerald-400" },
  { value: "medium", label: "Medium", description: "Balanced", color: "bg-blue-400" },
  { value: "high", label: "High", description: "Full Send!", color: "bg-rose-400" },
];

// Gen-Z CTA texts that rotate
const ctaTexts = [
  "Roll a Vibe",
  "Find My Thing",
  "Surprise Me",
  "What's Good?",
  "Send It",
  "Let's Go",
  "Cook Something Up",
  "Drop a Quest",
  "Spin the Wheel",
  "Make It Happen",
];

export default function HomePage() {
  const router = useRouter();
  const { withTap, triggerHaptic } = useTapFeedback();
  const [duration, setDuration] = useState(30);
  const [budget, setBudget] = useState(0);
  const [selectedMood, setSelectedMood] = useState<Mood | "random">("random");
  const [energy, setEnergy] = useState<"low" | "medium" | "high">("medium");
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [ctaText, setCtaText] = useState("Roll a Vibe");

  useEffect(() => {
    const stored = localStorage.getItem("vibequest_preferences");
    if (!stored) {
      router.push("/onboarding");
    } else {
      setPreferences(JSON.parse(stored));
    }
    // Random CTA text on each visit
    setCtaText(ctaTexts[Math.floor(Math.random() * ctaTexts.length)]);
  }, [router]);

  const handleRollVibe = () => {
    triggerHaptic("heavy");
    // If "random" is selected, pick a random mood from the available moods
    const moodToPass = selectedMood === "random"
      ? moods[Math.floor(Math.random() * moods.length)].value
      : selectedMood;
    const questRequest = { duration, mood: moodToPass, energy, budget };
    sessionStorage.setItem("questRequest", JSON.stringify(questRequest));
    router.push("/quests");
  };

  const canRoll = selectedMood !== null;

  return (
    <main className="h-full bg-[#fafafa] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-5 pt-4 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg hard-border hard-shadow flex items-center justify-center overflow-hidden">
              <Logo size={40} />
            </div>
            <div>
              <h1 className="text-lg font-black text-[#1a1a1a] tracking-tight">VibeQuest</h1>
              {preferences?.location && (
                <button
                  onClick={() => router.push("/settings")}
                  className="flex items-center gap-1 text-xs font-medium text-[#666] hover:text-[#1a1a1a] transition-colors"
                >
                  <MapPin className="w-3 h-3" />
                  <span>{preferences.location.city}</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <IconButton
            onClick={() => router.push("/profile")}
            icon={User}
            ariaLabel="Profile"
            variant="secondary"
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 px-5 space-y-3 pt-2 pb-4 overflow-y-auto min-h-0">
        {/* Greeting */}
        <section>
          <h2 className="text-2xl font-black text-[#1a1a1a] leading-tight tracking-tight">
            Got a few <span className="text-[#ff6b9d]">minutes?</span>
          </h2>
          <p className="text-[#666] mt-1 text-sm font-medium">Let&apos;s find you something fun.</p>
        </section>

        {/* Duration Slider */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-[#1a1a1a]">How much time?</span>
            <span className="text-2xl font-black text-[#c084fc]">
              {duration}
              <span className="text-sm font-bold text-[#666] ml-1">min</span>
            </span>
          </div>

          <DraggableSlider
            value={duration}
            min={5}
            max={120}
            step={5}
            onChange={(val) => {
              setDuration(val);
              triggerHaptic("light");
            }}
            accentColor="#c084fc"
          />
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[#1a1a1a]">5m</span>
            <span className="text-xs font-bold text-[#1a1a1a]">60m</span>
            <span className="text-xs font-bold text-[#1a1a1a]">120m</span>
          </div>
        </section>

        {/* Budget Slider */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-[#1a1a1a]">Budget?</span>
            <span className="text-2xl font-black text-[#22d3ee]">
              {budget === 0 ? "Free" : `₹${budget}`}
            </span>
          </div>

          <DraggableSlider
            value={budget}
            min={0}
            max={2500}
            step={250}
            onChange={(val) => {
              setBudget(val);
              triggerHaptic("light");
            }}
            accentColor="#22d3ee"
          />
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[#1a1a1a]">Free</span>
            <span className="text-xs font-bold text-[#1a1a1a]">₹1250</span>
            <span className="text-xs font-bold text-[#1a1a1a]">₹2500</span>
          </div>
        </section>

        {/* Mood Selector */}
        <section className="mt-6">
          <span className="text-sm font-bold text-[#1a1a1a] block">What&apos;s your vibe?</span>
          <div className="flex gap-3 overflow-x-auto overflow-y-visible pb-2 pt-2 -mx-5 px-5" style={{ minHeight: '56px' }}>
            {/* Feeling Lucky pill - first */}
            <SelectablePill
              onClick={withTap(() => setSelectedMood("random"), "light")}
              selected={selectedMood === "random"}
              selectedClassName={feelingLucky.bg}
              ariaLabel="Feeling Lucky"
            >
              <span className="text-base">{feelingLucky.emoji}</span>
              <span className="whitespace-nowrap">{feelingLucky.label}</span>
            </SelectablePill>
            {moods.map((mood) => (
              <SelectablePill
                key={mood.value}
                onClick={withTap(() => setSelectedMood(mood.value), "light")}
                selected={selectedMood === mood.value}
                selectedClassName={mood.bg}
                ariaLabel={mood.label}
              >
                <span className="text-base">{mood.emoji}</span>
                <span className="whitespace-nowrap">{mood.label}</span>
              </SelectablePill>
            ))}
          </div>
        </section>

        {/* Energy Toggle */}
        <section>
          <span className="text-sm font-bold text-[#1a1a1a] block">Energy level</span>
          <div className="grid grid-cols-3 gap-3 py-2" style={{ minHeight: '76px' }}>
            {energyLevels.map((level) => (
              <button
                key={level.value}
                onClick={withTap(() => setEnergy(level.value as "low" | "medium" | "high"), "light")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border-2 border-[#1a1a1a] tap-target transition-all duration-200 hard-shadow-sm",
                  energy === level.value
                    ? `${level.color} text-white hard-shadow -translate-y-0.5`
                    : "bg-white text-[#1a1a1a] hard-shadow-hover"
                )}
              >
                <span className="text-sm font-black">{level.label}</span>
                <span className={cn(
                  "text-[10px] font-medium",
                  energy === level.value ? "text-white" : "text-[#1a1a1a]/70"
                )}>{level.description}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Sticky CTA Button */}
      <div className="flex-shrink-0 px-5 py-4 bg-gradient-to-t from-[#fafafa] via-[#fafafa] to-transparent">
        <Button
          onClick={handleRollVibe}
          disabled={!canRoll}
          size="lg"
          variant="primary"
        >
          <Dices className="w-5 h-5" />
          {ctaText}
        </Button>
      </div>
    </main>
  );
}
