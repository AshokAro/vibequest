export interface Mission {
  id: string;
  title: string;
  description: string;
  steps: string[];
  duration_minutes: number;
  budget_estimate: number;
  effort: {
    physical: number;
    mental: number;
  };
  location: {
    type: "nearby" | "home" | "online";
    suggestion: string;
  };
  intrinsic_rewards: {
    fitness: number;
    calm: number;
    creativity: number;
    social: number;
    knowledge: number;
    discipline: number;
  };
  xp_reward: number;
  icon?: string;
  is_wildcard?: boolean;
}

export interface UserProfile {
  id: string;
  level: number;
  xp: number;
  xp_to_next: number;
  momentum_score: number;
  stats: {
    fitness: number;
    calm: number;
    creativity: number;
    social: number;
    knowledge: number;
    discipline: number;
  };
  completed_missions: number;
}

export interface FeedItem {
  id: string;
  mission_title: string;
  reflection: string;
  author_name: string;
  completed_at: string;
  likes: number;
}

export type Mood = "chill" | "adventurous" | "creative" | "social" | "focused" | "playful";

export interface MissionRequest {
  duration: number;
  budget: number;
  mood: Mood;
  energy: "low" | "medium" | "high";
  location?: UserPreferences["location"];
  interests?: Interest[];
  preferredMissionTypes?: ("outdoor" | "indoor" | "social")[];
}

// Creative
export type CreativeInterest =
  | "photography"
  | "sketching"
  | "painting"
  | "street_art"
  | "journaling"
  | "poetry"
  | "collage"
  | "craft_diy"
  | "origami"
  | "calligraphy";

// Music & Sound
export type MusicInterest =
  | "live_music"
  | "playing_instrument"
  | "field_recording"
  | "music_discovery"
  | "singing";

// Movement & Body
export type MovementInterest =
  | "running"
  | "cycling"
  | "yoga"
  | "hiking"
  | "swimming"
  | "strength_training"
  | "martial_arts"
  | "dance"
  | "skateboarding";

// Food & Drink
export type FoodInterest =
  | "street_food"
  | "cafe_hopping"
  | "cooking"
  | "food_markets"
  | "new_cuisines"
  | "tea_coffee"
  | "fermentation";

// Culture & Knowledge
export type CultureInterest =
  | "history"
  | "architecture"
  | "museums"
  | "archaeology"
  | "religion"
  | "languages"
  | "philosophy";

// Nature & Outdoors
export type NatureInterest =
  | "birdwatching"
  | "botany"
  | "parks"
  | "stargazing"
  | "weather"
  | "insects"
  | "foraging";

// People & Social
export type SocialInterest =
  | "people_watching"
  | "talking_strangers"
  | "community_events"
  | "volunteering"
  | "markets_bazaars"
  | "board_games"
  | "open_mics";

// Mind & Curiosity
export type MindInterest =
  | "puzzles"
  | "reading"
  | "trivia"
  | "cartography"
  | "urban_exploration"
  | "hidden_history"
  | "science_experiments";

// Collecting & Hunting
export type CollectingInterest =
  | "thrift_shopping"
  | "flea_markets"
  | "antiques"
  | "stamps_coins"
  | "vinyl"
  | "rare_books"
  | "ephemera";

// Niche & Unexpected
export type NicheInterest =
  | "signage"
  | "shadows_light"
  | "patterns"
  | "decay_texture"
  | "doors_windows"
  | "staircases"
  | "rooftops"
  | "reflections"
  | "manhole_covers"
  | "typos";

// Interest categories (used in onboarding/settings)
export type InterestCategory =
  | "creative"
  | "music_sound"
  | "movement_body"
  | "food_drink"
  | "culture_knowledge"
  | "nature_outdoors"
  | "people_social"
  | "mind_curiosity"
  | "collecting_hunting"
  | "niche_unexpected";

// Specific interests (used in mission generation)
export type Interest =
  | CreativeInterest
  | MusicInterest
  | MovementInterest
  | FoodInterest
  | CultureInterest
  | NatureInterest
  | SocialInterest
  | MindInterest
  | CollectingInterest
  | NicheInterest
  | InterestCategory;

export interface UserPreferences {
  hasCompletedOnboarding: boolean;
  location: {
    lat: number;
    lng: number;
    city: string;
    country: string;
  } | null;
  interests: Interest[];
  preferredMissionTypes: ("outdoor" | "indoor" | "social")[];
}

export interface InterestOption {
  value: Interest;
  label: string;
  emoji: string;
  description: string;
}
