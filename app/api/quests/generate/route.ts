import { NextRequest, NextResponse } from "next/server";
import type { Quest, QuestRequest, Interest } from "@/lib/types";

// Simple in-memory cache for server-side caching (per-deployment, not persistent)
interface CachedPlace {
  name: string;
  address: string;
  rating?: number;
  timestamp: number;
}

interface CompletionFeedback {
  quest_id: string;
  quest_title: string;
  interests_used: string[];
  wildcard: boolean;
  completed_at: string;
  actually_completed: boolean;
  rating: "loved_it" | "good" | "meh" | null;
}

const SERVER_CACHE = new Map<string, CachedPlace[]>();
const SERVER_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Chain/franchise keywords to filter out
const CHAIN_KEYWORDS = [
  "mcdonald's", "starbucks", "kfc", "burger king", "subway", "domino's",
  "pizza hut", "taco bell", "wendy's", "dunkin'", "dunkin donuts",
  "costa coffee", "cafe coffee day", "ccd", "barista", "gvk",
  "ikea", "decathlon", "big bazaar", "reliance", "tata", "birla"
];

// Allowed place types for quests - filter out residential/lodging
const ALLOWED_PLACE_TYPES = [
  "park", "tourist_attraction", "museum", "art_gallery", "shopping_mall",
  "store", "restaurant", "cafe", "library", "book_store", "bakery",
  "food", "supermarket", "jewelry_store", "clothing_store", "shoe_store",
  "electronics_store", "hardware_store", "furniture_store", "home_goods_store",
  "bicycle_store", "pet_store", "florist", "department_store", "pharmacy",
  "bowling_alley", "movie_theater", "amusement_park", "aquarium", "zoo",
  "campground", "rv_park", "night_club", "bar", "casino", "stadium",
  "gym", "spa", "beauty_salon", "hair_care", "movie_rental", "meal_delivery",
  "meal_takeaway", "convenience_store", "liquor_store", "laundry", "parking",
  "gas_station", "car_repair", "car_wash", "transit_station", "train_station",
  "subway_station", "bus_station", "taxi_stand", "church", "hindu_temple",
  "mosque", "synagogue", "cemetery", "place_of_worship", "city_hall",
  "courthouse", "embassy", "fire_station", "local_government_office",
  "police", "post_office", "university", "school", "secondary_school",
  "primary_school", "hospital", "doctor", "dentist", "physiotherapist",
  "veterinary_care", "atm", "bank", "real_estate_agency", "travel_agency",
  "insurance_agency", "lawyer", "accounting", "finance", "plumber",
  "electrician", "roofing_contractor", "general_contractor", "moving_company",
  "storage", "funeral_home", "locksmith", "painter", "car_dealer"
];

// Place types to explicitly exclude (residential, lodging, private)
const EXCLUDED_PLACE_TYPES = [
  "lodging", "apartment", "guesthouse", "housing", "real_estate", "room",
  "rv_park_lodging", "hostel", "hotel", "motel", "resort", "vacation_rental",
  "private_residence", "residential", "house", "condo", "townhouse"
];

// City landmarks for fallback
const CITY_LANDMARKS: Record<string, string[]> = {
  "bangalore": ["Cubbon Park", "Lalbagh Botanical Garden", "MG Road", "Commercial Street", "Brigade Road", "Koramangala", "Indiranagar 100 Feet Road", "Church Street"],
  "bengaluru": ["Cubbon Park", "Lalbagh Botanical Garden", "MG Road", "Commercial Street", "Brigade Road", "Koramangala", "Indiranagar 100 Feet Road", "Church Street"],
  "mumbai": ["Marine Drive", "Gateway of India", "Colaba Causeway", "Bandra Bandstand", "Juhu Beach", "Chor Bazaar", "Fashion Street"],
  "bombay": ["Marine Drive", "Gateway of India", "Colaba Causeway", "Bandra Bandstand", "Juhu Beach", "Chor Bazaar", "Fashion Street"],
  "delhi": ["Connaught Place", "India Gate", "Chandni Chowk", "Lodhi Garden", "Hauz Khas Village", "Dilli Haat", "Lajpat Nagar Market"],
  "hyderabad": ["Charminar", "Hussain Sagar", "Golconda Fort", "Laad Bazaar", "Tank Bund", "Banjara Hills Road"],
  "chennai": ["Marina Beach", "Besant Nagar Beach", "T Nagar", "Pondy Bazaar", "Mylapore Temple", "Kapaleeshwarar Temple"],
};

// Interest category to location type mapping (for onboarding categories)
const INTEREST_CATEGORY_MAP: Record<string, string[]> = {
  "creative": ["street", "neighborhood", "heritage building", "park"],
  "music_sound": ["cultural center", "market area", "public space"],
  "movement_body": ["park", "running track", "open ground", "garden"],
  "food_drink": ["street food market", "local food area", "cafe area"],
  "culture_knowledge": ["heritage building", "old neighborhood", "monument", "museum"],
  "nature_outdoors": ["park", "lake", "botanical garden", "green space"],
  "people_social": ["busy market", "public square", "park", "community space"],
  "mind_curiosity": ["old neighborhood", "lane", "street", "library area"],
  "collecting_hunting": ["market", "bazaar", "flea market", "thrift store area"],
  "niche_unexpected": ["street", "old neighborhood", "heritage area", "downtown"],
};

// Specific interest to location type mapping
const INTEREST_LOCATION_MAP: Record<string, string[]> = {
  // Creative
  "photography": ["street", "neighborhood", "market area"],
  "sketching": ["park", "garden", "heritage building"],
  "painting": ["park", "garden", "heritage building"],
  "street_art": ["street", "neighborhood", "market area"],
  // Food
  "street_food": ["street food market", "local food area", "food street"],
  "cafe_hopping": ["cafe area", "coffee shop street"],
  // Movement
  "running": ["park", "running track", "open ground"],
  "yoga": ["park", "garden", "quiet open space"],
  // Culture
  "history": ["heritage building", "old neighborhood", "monument"],
  "museums": ["museum", "gallery", "cultural center"],
  // Nature
  "birdwatching": ["park", "lake", "bird sanctuary"],
  "parks": ["park", "garden", "green space"],
  // Markets
  "markets_bazaars": ["market", "bazaar", "shopping area"],
  "thrift_shopping": ["thrift store area", "secondhand market"],
  // Social
  "people_watching": ["busy market", "public square", "park"],
};

// XP calculation formula
function calculateXP(quest: Omit<Quest, "xp_reward">): number {
  const base = quest.duration_minutes * 2;
  const energyBonus = (quest.effort.physical + quest.effort.mental) * 10;
  const outdoorBonus = quest.location.type === "nearby" ? 10 : 0;
  const socialBonus = quest.intrinsic_rewards.social > 0 ? 15 : 0;
  const noveltyBonus = 10;

  return base + energyBonus + outdoorBonus + socialBonus + noveltyBonus;
}

// Step 1: Classify interests to location type queries
function generateLocationQueries(request: QuestRequest): string[] {
  const interests = request.interests || [];
  const city = request.location?.city || "";
  const locationTypes: string[] = [];

  // Map interests to location types (try category first, then specific)
  for (const interest of interests) {
    const normalizedInterest = interest.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z_]/g, "");
    // Try category mapping first
    const categoryTypes = INTEREST_CATEGORY_MAP[normalizedInterest] || INTEREST_CATEGORY_MAP[interest.toLowerCase()];
    if (categoryTypes) {
      locationTypes.push(...categoryTypes);
    } else {
      // Fall back to specific interest mapping
      const specificTypes = INTEREST_LOCATION_MAP[normalizedInterest] || INTEREST_LOCATION_MAP[interest.toLowerCase()];
      if (specificTypes) {
        locationTypes.push(...specificTypes);
      }
    }
  }

  // Deduplicate
  const uniqueTypes = [...new Set(locationTypes)];

  // If no interests mapped, use defaults based on mood
  if (uniqueTypes.length === 0) {
    const moodDefaults: Record<string, string[]> = {
      "chill": ["park", "cafe", "quiet street"],
      "adventurous": ["market", "old neighborhood", "heritage area"],
      "creative": ["street", "heritage building", "park"],
      "social": ["busy market", "public square", "food street"],
      "focused": ["library area", "quiet park", "cafe"],
      "playful": ["park", "game area", "busy street"],
    };
    uniqueTypes.push(...(moodDefaults[request.mood] || ["park", "market", "street"]));
  }

  // Build 3 queries with city context (reduced from 5 for API efficiency)
  // We still get great variety since the AI can work with any real location
  const queries: string[] = [];
  const numQueries = Math.min(3, uniqueTypes.length);
  for (let i = 0; i < numQueries; i++) {
    const type = uniqueTypes[i % uniqueTypes.length];
    queries.push(`${type} near ${city}`);
  }

  return queries;
}

// Check if a place is a chain
function isChain(placeName: string): boolean {
  const lowerName = placeName.toLowerCase();
  return CHAIN_KEYWORDS.some(chain => lowerName.includes(chain));
}

// Check if place has an allowed type (not residential/lodging)
function hasAllowedPlaceType(place: Record<string, unknown>): boolean {
  const types = place.types as string[] | undefined;
  if (!types || !Array.isArray(types)) {
    // If no types, check the name for excluded keywords
    const name = String(place.name || "").toLowerCase();
    const isExcludedName = EXCLUDED_PLACE_TYPES.some(type =>
      name.includes(type) || name.includes("apartment") || name.includes("guesthouse")
    );
    return !isExcludedName;
  }

  // Check if any type is explicitly excluded
  const hasExcludedType = types.some(type =>
    EXCLUDED_PLACE_TYPES.includes(type)
  );
  if (hasExcludedType) return false;

  // Check if any type is in our allowed list
  const hasAllowedType = types.some(type =>
    ALLOWED_PLACE_TYPES.includes(type)
  );

  // If it has an allowed type, it's good
  if (hasAllowedType) return true;

  // If no specific allowed type but also no excluded types, accept it
  // This handles places with generic types like "establishment", "point_of_interest"
  const hasGenericType = types.some(type =>
    ["establishment", "point_of_interest"].includes(type)
  );

  return hasGenericType;
}

// Get fallback landmark for city
function getFallbackLandmark(city: string): { name: string; address: string; rating?: number } | null {
  const normalizedCity = city.toLowerCase();
  const landmarks = CITY_LANDMARKS[normalizedCity];
  if (landmarks && landmarks.length > 0) {
    const landmark = landmarks[Math.floor(Math.random() * landmarks.length)];
    return {
      name: landmark,
      address: `${landmark}, ${city}`,
    };
  }
  return null;
}

// Helper: Get cache key for a city+query combination
function getServerCacheKey(city: string, query: string): string {
  return `${city.toLowerCase()}_${query.toLowerCase().replace(/\s+/g, "_")}`;
}

// Helper: Check server-side cache for a location
function getFromServerCache(city: string, query: string): CachedPlace | null {
  const key = getServerCacheKey(city, query);
  const cached = SERVER_CACHE.get(key);

  if (!cached) return null;

  // Check if cache is expired
  if (Date.now() - cached[0].timestamp > SERVER_CACHE_TTL) {
    SERVER_CACHE.delete(key);
    return null;
  }

  // Return random item from cached results for variety
  const randomIndex = Math.floor(Math.random() * cached.length);
  return cached[randomIndex];
}

// Helper: Save to server-side cache
function saveToServerCache(city: string, query: string, places: CachedPlace[]): void {
  const key = getServerCacheKey(city, query);
  SERVER_CACHE.set(key, places);
}

// Step 2: Search Google Maps for verified locations (with caching)
async function searchVerifiedLocations(
  queries: string[],
  lat: number,
  lng: number,
  city: string
): Promise<Array<{ name: string; address: string; rating?: number }>> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("Google Maps API key not configured");
    return queries.map(() => getFallbackLandmark(city) || { name: city, address: city });
  }

  const results: Array<{ name: string; address: string; rating?: number }> = [];
  const usedPlaceNames = new Set<string>(); // Track used places to avoid duplicates

  for (const query of queries) {
    // Check server-side cache first
    const cached = getFromServerCache(city, query);
    if (cached && !usedPlaceNames.has(cached.name)) {
      console.log(`[API] Server cache hit for: ${query}`);
      results.push({
        name: cached.name,
        address: cached.address,
        rating: cached.rating,
      });
      usedPlaceNames.add(cached.name);
      continue;
    }

    let locationFound = false;
    const searchResults: CachedPlace[] = [];

    // Use single 5000m radius instead of trying 3000m then 6000m
    // This cuts API calls in half while still finding good locations
    try {
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=5000&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(searchUrl);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        // Collect all valid results for caching, not just the first one
        for (const place of data.results) {
          const name = place.name || "";
          const rating = place.rating || 0;
          const userRatingsTotal = place.user_ratings_total || 0;
          const openNow = place.opening_hours?.open_now;

          if (isChain(name)) continue;
          if (rating === 0 || userRatingsTotal < 10) continue;
          if (openNow === false) continue;
          if (!hasAllowedPlaceType(place)) continue;

          const result: CachedPlace = {
            name: name,
            address: place.formatted_address || place.vicinity || "",
            rating: rating,
            timestamp: Date.now(),
          };

          searchResults.push(result);

          // Use the first valid result we find (if not already used)
          if (!locationFound && !usedPlaceNames.has(name)) {
            results.push(result);
            usedPlaceNames.add(name);
            locationFound = true;
          }
        }

        // Cache all valid results for future use
        if (searchResults.length > 0) {
          saveToServerCache(city, query, searchResults);
        }
      }
    } catch (error) {
      console.error(`Failed to search for "${query}":`, error);
    }

    // If no location found from API, use fallback
    if (!locationFound) {
      const fallback = getFallbackLandmark(city);
      if (fallback && !usedPlaceNames.has(fallback.name)) {
        results.push(fallback);
        usedPlaceNames.add(fallback.name);
      } else {
        results.push({
          name: query.replace(/ near .+$/, ""),
          address: city,
        });
      }
    }
  }

  return results;
}

// Helper: Aggregate completion history for AI prompt
function getCompletionHistoryBlock(): string {
  // Note: This runs server-side, so we can't access localStorage directly.
  // The client should send this data in the request body.
  // For now, return empty - we'll update the Request type to include it.
  return "";
}

// Helper: Build completion history summary from feedback data
function buildCompletionHistoryBlock(feedbackData: CompletionFeedback[]): string {
  if (!feedbackData || feedbackData.length === 0) {
    return "";
  }

  const loved: string[] = [];
  const good: string[] = [];
  const meh: string[] = [];
  const skipped: string[] = [];

  feedbackData.forEach((item) => {
    const interests = item.interests_used || [];
    if (item.actually_completed) {
      if (item.rating === "loved_it") {
        loved.push(...interests);
      } else if (item.rating === "good") {
        good.push(...interests);
      } else if (item.rating === "meh") {
        meh.push(...interests);
      }
    } else {
      skipped.push(...interests);
    }
  });

  // Count occurrences
  const count = (arr: string[]) => {
    const c: Record<string, number> = {};
    arr.forEach((i) => {
      c[i] = (c[i] || 0) + 1;
    });
    return c;
  };

  const lovedCounts = count(loved);
  const goodCounts = count(good);
  const mehCounts = count(meh);
  const skippedCounts = count(skipped);

  // Filter skipped to only those skipped > 2 times
  const frequentlySkipped = Object.entries(skippedCounts)
    .filter(([, count]) => count > 2)
    .map(([interest]) => interest);

  const formatInterests = (counts: Record<string, number>) =>
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([interest, count]) => `${interest} (${count}x)`)
      .join(", ") || "none";

  return `COMPLETION HISTORY:
The following is a summary of this user's past quest completions. Use it to avoid repeating mechanics they skip or rate poorly, and to weight toward mechanics they complete and rate highly.

Actually completed and rated 🤩: ${formatInterests(lovedCounts)}
Actually completed and rated 🙂: ${formatInterests(goodCounts)}
Actually completed and rated 😐: ${formatInterests(mehCounts)}
Marked done without completing: ${frequentlySkipped.join(", ") || "none"}

Rules:
- Do not generate a quest using the primary mechanic of any interest in skipped_interests if it has been skipped more than twice
- Avoid mechanics from meh_interests unless no better option exists
- Weight toward loved_interests when multiple mechanic options are available
- If no completion history exists yet, ignore this section entirely

`;
}

// Step 3: Generate quests with verified locations
async function generateQuests(
  request: QuestRequest,
  verifiedLocations: Array<{ name: string; address: string; rating?: number }>,
  completionFeedback?: CompletionFeedback[]
): Promise<string> {
  const verifiedLocationsBlock = verifiedLocations
    .map((loc, idx) => `Quest ${idx + 1} location: ${loc.name}, ${loc.address}`)
    .join("\n");

  const completionHistoryBlock = completionFeedback && completionFeedback.length > 0
    ? buildCompletionHistoryBlock(completionFeedback)
    : "";

  const userPrompt = `${completionHistoryBlock}Generate 5 quests for this user:

USER CONTEXT (treat these as hard constraints, not suggestions):
City: ${request.location?.city || "city center"}
Time available (MAX): ${request.duration} minutes
Budget (MAX): ₹${request.budget}
Mood: ${request.mood}
Energy level: ${request.energy}
Interests: ${request.interests?.join(", ") || "mixed exploration"}

Every quest must be completable within the above constraints. If travel is required, assume the user starts at the specified starting point and is on foot or using a 2-wheeler.

Output valid JSON with exactly 5 quests in this format:
{
  "quests": [
    {
      "title": "...",
      "duration": "...",
      "estimated_cost": "...",
      "description": "...",
      "interests_used": ["..."],
      "wildcard": false
    }
  ]
}`;

  const systemPrompt = `VERIFIED LOCATIONS — USE THESE EXACTLY:
The following 5 locations have been confirmed as real, currently open, and near the user's starting point via Google Maps. You must build each quest around its assigned location. Do not rename them, do not substitute them, do not invent nearby alternatives.

${verifiedLocationsBlock}

Your job is to write a quest for each of these locations. The location is fixed. The activity, constraint, and voice are yours to craft using the rules below.

You are a hyperlocal activity generator for an app called VibeQuest. Your persona is a friend who knows the city inside out — someone who has actually done weird, specific things in these neighborhoods and is passing on the tip. Write like that person. Confident, a little offbeat, occasionally wry. Not a travel blogger. Not a life coach. Not a bullet-point machine.

CORE RULE — REALITY FIRST:
Every location, venue, and place you mention must be genuinely real and publicly accessible.
- For well-known landmarks (Cubbon Park, KR Market, Marine Drive): name them directly.
- For street-level specifics (a chai stall, a hardware shop): describe the TYPE and NEIGHBORHOOD only. Never invent a business name.
- If you are not confident a place exists and is accessible: do not name it.
- If a quest requires spending money, state the exact estimated cost in INR.

WHAT A GOOD QUEST LOOKS LIKE:
"Walk to the north gate of Cubbon Park, pick any bench within 30 seconds of entering, and spend 20 minutes sketching only the shadows cast by the iron railings onto the footpath. Exactly 3 sketches. No people, no trees — only shadows."

Notice what this does not do: it does not explain why the constraint exists. It does not say "this constraint is designed to focus your attention." It just gives the rule and moves on. Do the same. State the task. State the rule. Trust the reader.

WHAT A BAD QUEST LOOKS LIKE (never do this):
"Stand at the edge of Sankey Tank as the golden hour light fractures across the water and breathe in the smell of earth and possibility at Sri Lakshmi Nature Café nearby..."
Why it fails: Invented business name, vague timing, zero actionable task, lyrical filler with no substance.

ALSO NEVER DO THIS:
"Photograph exactly 7 reflections. [Constraint: exactly 7 photos. This constraint encourages focused observation and limits decision fatigue.]"
Why it fails: The model is explaining its own design choices. The user does not need to know why the rule exists. Just give the rule.

DESCRIPTION RULES:
- Start with the action. No scene-setting opener, no "today you will..."
- Embed all constraints naturally into the prose — do not list them separately or label them
- Write with a little personality: dry wit, a specific unexpected detail, an offhand observation that makes it feel like someone who's actually been there wrote it
- 4-6 sentences. No more.
- Never explain why something works, why a rule exists, or what the user will "get out of it"
- Never use: "explore", "discover", "embrace", "soak in", "wander", "journey", "vibe" as a verb, "intention", "mindful", "presence", "unique", "hidden gem", "off the beaten path", "immersive"
- One sensory detail maximum, only if it is genuinely characteristic of that place

GOOD DESCRIPTION VOICE — examples of the register to aim for:
- "The autorickshaw repair strip on Old Madras Road has about 40 meters of tools, oil drums, and men who have strong opinions about everything. Walk it once, photograph exactly 5 tools you cannot name, then go look them up."
- "Malleshwaram's 8th Cross has a flower market that is basically over by 9am. Get there before that, buy the cheapest thing being sold (usually loose jasmine by the handful), and sit on the steps of the Kadu Malleshwara temple and draw it before it wilts. You have maybe 20 minutes before it stops being interesting."
- "Find the stretch of Commercial Street where the fabric shops start. Go into exactly 3 shops, touch the most expensive fabric they have, and leave without buying anything. Take note of which shopkeeper is the most unbothered by this."

These work because they have a point of view. They notice specific things. They have a light sense of humor without being jokey. Aim for this.

FINAL CHECK BEFORE OUTPUT:
Before writing each quest description, ask yourself:
- Does this sentence explain why a rule exists? DELETE IT.
- Does this sentence label a constraint? DELETE IT.
- Does this sentence tell the user what they will "get out of" this? DELETE IT.
- Does this read like a product description or a tip from a friend? If product description: REWRITE IT.

The description field in the JSON must contain ONLY: the action, the place, the rule, and the voice. Nothing else.

STEPS FORMAT:
Each quest must include 2-4 steps. Each step must be under 12 words. Write them the way you'd text someone directions — direct, slightly casual, no corporate tone.
- Good: "Get there before 9am or the market's already packing up"
- Bad: "Travel to the location during its operational opening hours"
No fluff. No explanation. Just what to do next.

INTRINSIC REWARDS FORMAT:
Rate each stat using only these three values:
- 0: this quest does not meaningfully involve this stat
- 1: this quest involves this stat in a supporting role (minor stat)
- 2: this stat is a primary focus of this quest (major stat)

Stats: fitness, calm, creativity, social, knowledge, discipline

CRITICAL RULE - EXACTLY 2 STATS:
Every quest must have EXACTLY 2 stats with non-zero values:
- 1 major stat rated at 2
- 1 minor stat rated at 1
- ALL other stats MUST be 0

If you generate more than 2 non-zero stats, the quest is invalid.
If you generate fewer than 2 non-zero stats, the quest is invalid.

OUTPUT EXAMPLES:

BAD OUTPUT (never produce this):
{
  "title": "The Bench Count",
  "duration": "20 minutes",
  "estimated_cost": "₹0",
  "description": "Head to Cubbon Park and photograph exactly 7 benches. Constraint: 7 photos only. This constraint helps develop a focused eye and prevents overwhelm. The park's greenery provides a calming backdrop for this mindful exercise.",
  "steps": ["Travel to Cubbon Park during opening hours", "Photograph benches as per the constraint", "Complete the activity"],
  "intrinsic_rewards": { "fitness": 3, "calm": 18, "creativity": 12, "social": 0, "knowledge": 5, "discipline": 9 },
  "interests_used": ["Photography"],
  "wildcard": false
}

GOOD OUTPUT:
{
  "title": "The Bench Count",
  "duration": "20 minutes",
  "estimated_cost": "₹0",
  "description": "Cubbon Park has an unreasonable number of benches for a city that never sits still. Photograph exactly 7 of them — different angles, no repeats, no people on them. Done in under 20 minutes if you move with purpose.",
  "steps": ["Head to Cubbon Park's north entrance", "Find and photograph exactly 7 different benches", "No repeats, no people — just the bench"],
  "intrinsic_rewards": { "fitness": 0, "calm": 0, "creativity": 2, "social": 0, "knowledge": 0, "discipline": 1 },
  "interests_used": ["Photography"],
  "wildcard": false
}

MISSION STRUCTURE (internal guide only — do not surface any of this in the output):
Every quest must contain all of the following, but woven into the prose — never labeled, never explained:
1. Physical anchor — a real, named, publicly accessible location
2. Tactile action — something physical the user does
3. Hard constraint — a number, time limit, or rule
4. One grounding detail — genuinely characteristic of that place
5. Feasibility — the quest must be obviously doable; no explanation needed

MOOD GUIDANCE:
- chill: slow-paced, observational, minimal movement, low social pressure
- adventurous: unfamiliar part of the neighborhood, slight uncertainty is part of the experience
- creative: making or documenting something with a clear output at the end
- social: requires real interaction with at least one stranger or local vendor
- focused: single-task, detail-obsessed, ignore everything else
- playful: has a game mechanic, a rule that makes it absurd or funny

INTEREST TAXONOMY AND QUEST MECHANICS:
Below is the full list of interests a user can select, grouped by category. For each interest, the mechanic column describes how it should shape the actual task — not just the theme. Do not name-drop the interest; let it change what the user does, finds, or makes.

CREATIVE
- Photography → framing rules, lighting constraints, restricted subjects (only reflections, only signage, only hands), composition challenges
- Sketching / Drawing → timed sketches, blind contour, architectural detail capture, shadow-only drawing
- Painting / Watercolor → on-site quick studies, color-matching to environment, single-color constraint
- Street Art / Murals → finding, documenting, mapping, counting, identifying styles across a defined route
- Journaling / Writing → write on-site: a paragraph, a fictional caption, a list of 10 observations, a one-sentence description of each person you see
- Poetry → write a constrained poem (exactly 5 lines, only words visible in the environment, no adjectives)
- Collage / Zine Making → collect found materials (tickets, wrappers, leaves), arrange and photograph
- Craft / DIY → build or assemble something from found or bought materials with a specific constraint
- Origami → fold something from found paper in a public space, leave it somewhere specific
- Calligraphy / Typography → hunt for specific letterforms, document font styles, find the oldest and newest signage on one street

MUSIC & SOUND
- Live Music → find a source of live sound within a defined radius, document it, time how long before it changes
- Playing an Instrument → bring an instrument, find a specific acoustic environment (underpass, stairwell, open courtyard), play for exactly 10 minutes
- Ambient Sound / Field Recording → record 5 distinct sounds within a 50-meter radius, identify their sources
- Music Discovery → ask a vendor or shopkeeper what they are listening to, find the song, listen to it on-site
- Singing / Humming → match a hum to the ambient noise frequency of a specific location

MOVEMENT & BODY
- Running / Jogging → timed runs between two named landmarks, interval sprints, distance targets on a specific road
- Cycling → route-based quests with named checkpoints, hill targets, distance within a time cap
- Yoga / Stretching → specific poses at a named outdoor location, hold for a count, use a bench or railing as a prop
- Hiking / Trekking → elevation-based quests, step counts, finding a specific viewpoint
- Swimming → lap counts, timed swims, open water observation quests near water bodies
- Strength Training → bodyweight challenge at a named park — push-up count, pull-up bar if available, stair repeats
- Martial Arts / Combat Sports → shadowboxing or form practice at a specific open space, timed rounds
- Dance → learn or practice a specific move in a public space, film it, count attempts
- Skateboarding / Parkour → find a specific type of urban feature (ledge, rail, gap) within a named area, document 3 attempts

FOOD & DRINK
- Street Food → order a specific regional item, compare the same dish from two stalls within walking distance, document both
- Café Hopping → visit exactly 2 cafés, order the same item at both, note the difference in one sentence each
- Cooking / Baking → buy exactly 3 raw ingredients from a market, go home and make something with only those
- Food Markets → navigate a named market with a ₹100 budget, buy the most interesting thing you can find
- Trying New Cuisines → find a cuisine you have never tried within the neighborhood, order the cheapest item on the menu
- Tea / Coffee → find a non-chain tea or coffee stall, ask how they make it, document the process in 3 photos
- Fermentation / Brewing → find a pickled, fermented, or cured food item at a market, buy it, eat it on-site

CULTURE & KNOWLEDGE
- History / Heritage → find a building or structure over 50 years old, photograph its oldest visible detail, estimate its age by asking someone nearby
- Architecture → count windows on one facade, identify the building material, find the structural detail that surprises you most
- Museums / Galleries → spend exactly 20 minutes, look at only 3 works or objects, write one sentence about each
- Archaeology / Ruins → find the oldest physical remnant in a named area — a wall, a well, a foundation
- Religion / Temples / Shrines → document the entry ritual of 3 different visitors without interfering, note what they carry
- Languages / Linguistics → find 5 instances of a non-English, non-Hindi script in signage within a defined area
- Philosophy → sit in one spot for 15 minutes and write down every assumption you make about the people passing by

NATURE & OUTDOORS
- Birdwatching → count distinct bird species at a named park or water body within 20 minutes, no app allowed
- Botany / Plants → identify 5 plant species in a named green space without using an app, sketch or photograph each
- Parks / Gardens → find the oldest tree in a named park, estimate its age, photograph its root system
- Stargazing → find the darkest spot within walking distance, identify 3 constellations, time how long until your eyes fully adjust
- Weather Watching → document how the sky changes over 15 minutes from one fixed spot — cloud movement, light shift
- Insects / Bugs → find 5 distinct insect species in a green space, document each, note what they are doing
- Foraging → identify one edible plant in a public green space, do not pick it, photograph and document it

PEOPLE & SOCIAL
- People Watching → count X type of person, document Y repeated behavior, time how long before Z event happens
- Talking to Strangers → ask 3 people the same unusual question, document their answers verbatim
- Community Events → find any public gathering happening within walking distance, attend for exactly 15 minutes
- Volunteering → find a local community space or NGO office, ask if they need help with anything for an hour
- Markets / Bazaars → negotiate the price of something you actually want to buy, document the opening and closing price
- Games / Board Games → find a public space where people are playing a game, watch for 10 minutes, ask to join or ask them to explain the rules
- Karaoke / Open Mics → find a venue with an open mic within the area, sign up or watch exactly 3 performers

MIND & CURIOSITY
- Puzzles / Problem Solving → invent a rule-based game using only what is physically present in a named location, play it for 15 minutes
- Reading → find a physical book or newspaper at a secondhand stall, read one chapter or article on-site, leave it somewhere visible
- Trivia / Quizzes → find 5 facts about the neighborhood you are in using only physical sources — plaques, signs, shopkeepers
- Maps / Cartography → hand-draw a map of a 200-meter stretch of a named street from memory after walking it once
- Urban Exploration → find the most architecturally unusual building on a named street, document 3 specific details that make it unusual
- Conspiracy / Hidden History → ask 2 long-term locals about something that used to exist in the neighborhood that is now gone
- Science / Experiments → design and run a simple observation experiment in a public space (e.g., time how long it takes for 10 people to look at their phones after sitting down)

COLLECTING & HUNTING
- Thrift Shopping / Secondhand → find the oldest item at a secondhand stall, negotiate a price, buy it only if under ₹150
- Flea Markets → find one object that has an interesting story, ask the seller about it, document the answer
- Antiques → find the oldest object in a named market area, photograph it, ask the seller its age and origin
- Stamps / Coins → find a philately or numismatics stall, ask to see something unusual, photograph it
- Vinyl / Cassettes → find a music stall or secondhand shop with physical media, ask the owner what they recommend
- Rare Books → find a secondhand bookshop or pavement stall, find the oldest book, read the first page on-site
- Ephemera / Paper Goods → collect 5 pieces of printed paper found in public (receipts, flyers, wrappers), arrange them by color or age

NICHE & UNEXPECTED (weight these heavily when selected — they unlock the most distinctive quests)
- Signage / Wayfinding → document every directional sign within a 100-meter stretch, map where they point
- Shadows & Light → photograph only shadows for 20 minutes — no objects, no people, only the shadow itself
- Grids & Patterns → find 5 distinct repeating patterns on a named street — tiles, grilles, brickwork, fabric
- Decay & Texture → document 5 surfaces showing visible age or wear on a single block — peeling paint, rust, cracked concrete
- Doors & Windows → photograph exactly 10 doors or windows on one street, rank them by age
- Staircases → find 3 staircases within a named neighborhood, photograph the top step of each
- Rooftops → find a legal vantage point where rooftops are visible, count water tanks on 10 buildings
- Puddles & Reflections → photograph only reflections — in water, glass, metal — for 20 minutes, no direct subjects
- Manhole Covers → find 5 distinct manhole cover designs within a named area, photograph and document the municipality name on each
- Typographical Errors in Public Signage → find 5 spelling or grammatical errors on public signage within a defined area, document each

INTEREST INTERSECTION RULE:
Where 2 or more of the user's interests can be combined into a single coherent quest, do so. Examples of natural intersections:
- Photography + Decay & Texture → shoot only decayed surfaces, with a composition rule
- Street Food + Talking to Strangers → ask a vendor about their most unusual regular customer while ordering
- Running + Maps / Cartography → run a route, then draw it from memory
- Journaling + People Watching → write a one-sentence fictional biography for each person you observe for 15 minutes
Do not force intersections that make the activity awkward or implausible.

WILDCARD RULE:
One of the 5 quests must use none of the user's selected interests and go somewhere genuinely unexpected. Good wildcard test: if you removed the user's interest list entirely, would this quest still exist? It should. A quest that avoids the user's stated interests but stays in adjacent territory does not count — go further. Do not explain that it is a wildcard in the description. Just write it. Mark it in the JSON only.

TIME AND BUDGET ARE MAXIMUMS, NOT TARGETS:
- Duration is the upper limit. Shorter is fine. Do not pad.
- Budget is the upper limit. Free is better than cheap. Cheap is better than spending. Never inflate cost to approach the limit.
- Each quest has its own duration and cost. They will vary. That is correct.

EDGE CASES:
- If time available is under 15 minutes: every quest must be completable within walking distance of the starting point. No travel time budget. The activity itself must fit the window.
- If budget is zero: every quest must be completely free. Do not suggest purchasing anything, including cheap items. Observation, movement, and writing quests only.

INDIAN CITY REFERENCE (use only confirmed real areas):
- Bangalore: Indiranagar, Church Street, Cubbon Park, 12th Main, KR Market, Lalbagh, Sankey Tank, MG Road, Brigade Road, Koramangala, Commercial Street, Malleshwaram, Jayanagar
- Mumbai: Bandra West, Marine Lines, Dadar, Colaba, Juhu Beach, Chor Bazaar, Fort, Dharavi, Mahim
- Delhi: Hauz Khas, Connaught Place, Chandni Chowk, Lodhi Garden, Lajpat Nagar, Dilli Haat
- Hyderabad: Jubilee Hills, Charminar, Necklace Road, Gachibowli, Abids, Laad Bazaar
- Chennai: Besant Nagar, Marina Beach, T Nagar, Royapuram, Mylapore, Pondy Bazaar

LOCATION RULE:
Every location in your output has been verified as real by the app backend before this prompt was generated. Use the verified name and address exactly as provided. Do not paraphrase the location name, do not add qualifiers like "a place called" or "reportedly", and do not invent any detail about the location beyond what is given. If you do not know something specific about the interior or layout of a location, describe the activity without inventing physical details you cannot confirm.

USER CONTEXT (hard constraints — not suggestions):
City: {{city}}
Starting point: {{starting_point}}
Time available (MAX): {{time}}
Budget (MAX): {{budget}}
Mood: {{mood}}
Energy level: {{energy}}
Interests: {{interests}}

Output must be valid JSON with exactly 5 quests in this format:
{
  "quests": [
    {
      "title": "...",
      "duration": "...",
      "estimated_cost": "...",
      "description": "...",
      "steps": ["...", "...", "..."],
      "intrinsic_rewards": {
        "fitness": 0,
        "calm": 0,
        "creativity": 0,
        "social": 0,
        "knowledge": 0,
        "discipline": 0
      },
      "interests_used": ["...", "..."],
      "wildcard": false
    }
  ]
}`;

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.85,
      max_tokens: 2500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

function parseAIResponse(content: string, request: QuestRequest): Quest[] {
  console.log("[parseAIResponse] Parsing content, length:", content.length);

  // Try to extract JSON from markdown code blocks first
  let jsonStr = content;

  // Remove markdown code block markers if present
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
    console.log("[parseAIResponse] Extracted from code block");
  } else {
    // Extract JSON from raw content (find the outermost curly braces)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
  }

  console.log("[parseAIResponse] JSON string preview:", jsonStr.substring(0, 200));

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    console.error("[parseAIResponse] JSON parse error:", parseError);
    console.error("[parseAIResponse] Content that failed to parse:", jsonStr.substring(0, 500));
    throw new Error("Failed to parse JSON response");
  }

  if (!parsed.quests || !Array.isArray(parsed.quests)) {
    console.error("[parseAIResponse] Invalid format - no quests array:", Object.keys(parsed));
    throw new Error("Invalid response format: missing quests array");
  }

  console.log("[parseAIResponse] Successfully parsed", parsed.quests.length, "quests");

  return parsed.quests.map((m: unknown, idx: number): Quest => {
    const quest = m as Record<string, unknown>;

    // Validate required fields
    if (!quest.title || !quest.description) {
      throw new Error(`Quest ${idx} missing required fields`);
    }

    // Log the intrinsic_rewards from AI
    console.log(`[parseAIResponse] Quest ${idx} intrinsic_rewards:`, quest.intrinsic_rewards || quest.stats);

    // Parse duration from string (e.g., "20 min" -> 20)
    const durationStr = String(quest.duration || quest.duration_minutes || request.duration);
    const durationMatch = durationStr.match(/(\d+)/);
    const durationMinutes = durationMatch ? parseInt(durationMatch[1]) : request.duration;

    // Parse cost from string (e.g., "Free" or "₹50" -> 0 or 50)
    const costStr = String(quest.estimated_cost || quest.budget_estimate || "0");
    const costMatch = costStr.match(/(\d+)/);
    const budgetEstimate = costMatch ? parseInt(costMatch[1]) : 0;

    // Combine description + constraint + feasibility into full description
    const fullDescription = [
      String(quest.description),
      quest.constraint ? `Constraint: ${quest.constraint}` : "",
      quest.feasibility ? `Why it works: ${quest.feasibility}` : "",
    ].filter(Boolean).join("\n\n");

    // Map energy to physical/mental levels
    const physicalLevel = request.energy === "high" ? 4 : request.energy === "medium" ? 3 : 1;
    const mentalLevel = request.energy === "high" ? 4 : request.energy === "medium" ? 3 : 2;

    // Use AI-provided steps if available, otherwise empty array
    const steps = Array.isArray(quest.steps) ? quest.steps.map(String) : [];

    // Use AI-provided intrinsic rewards if available, otherwise calculate based on interests/mood
    const interestsUsed = (quest.interests_used as string[]) || [];
    console.log(`[parseAIResponse] Quest ${idx} raw rewards from AI:`, quest.intrinsic_rewards, "stats:", quest.stats);
    const aiRewards = (quest.intrinsic_rewards || quest.stats) as Record<string, number> | undefined;
    console.log(`[parseAIResponse] Quest ${idx} aiRewards:`, aiRewards);
    const intrinsicRewards = aiRewards ? {
      fitness: Math.min(25, Math.max(0, aiRewards.fitness || 0)),
      calm: Math.min(25, Math.max(0, aiRewards.calm || 0)),
      creativity: Math.min(25, Math.max(0, aiRewards.creativity || 0)),
      social: Math.min(25, Math.max(0, aiRewards.social || 0)),
      knowledge: Math.min(25, Math.max(0, aiRewards.knowledge || 0)),
      discipline: Math.min(25, Math.max(0, aiRewards.discipline || 0)),
    } : {
      fitness: interestsUsed.some(i => ["running", "cycling", "strength_training", "skateboarding", "swimming", "hiking"].includes(i)) ? 15 : 0,
      calm: request.mood === "chill" || interestsUsed.includes("yoga") ? 15 : 0,
      creativity: interestsUsed.some(i => ["photography", "sketching", "painting", "street_art", "journaling", "poetry", "collage", "craft_diy", "calligraphy"].includes(i)) ? 20 : 0,
      social: request.mood === "social" || interestsUsed.some(i => ["talking_strangers", "markets_bazaars", "open_mics", "community_events"].includes(i)) ? 20 : 0,
      knowledge: interestsUsed.some(i => ["history", "architecture", "museums", "languages", "trivia", "botany", "birdwatching"].includes(i)) ? 15 : 0,
      discipline: interestsUsed.some(i => ["running", "yoga", "strength_training", "puzzles", "cartography"].includes(i)) ? 10 : 0,
    };

    // Check if this is a wildcard quest
    const isWildcard = !!quest.wildcard;

    // Bonus XP for wildcard quests (+25% bonus, min 25 XP)
    const baseXP = calculateXP({
      id: `quest-${Date.now()}-${idx}`,
      title: String(quest.title),
      description: fullDescription,
      steps,
      duration_minutes: durationMinutes,
      budget_estimate: budgetEstimate,
      effort: { physical: physicalLevel, mental: mentalLevel },
      location: { type: "nearby", suggestion: request.location?.city || "Local area" },
      intrinsic_rewards: intrinsicRewards,
    });
    const wildcardBonus = isWildcard ? Math.max(25, Math.floor(baseXP * 0.25)) : 0;

    console.log(`[API] Quest ${idx} final intrinsic_rewards:`, intrinsicRewards);

    const questData: Omit<Quest, "xp_reward"> = {
      id: `quest-${Date.now()}-${idx}`,
      title: String(quest.title),
      description: fullDescription,
      steps,
      duration_minutes: durationMinutes,
      budget_estimate: budgetEstimate,
      effort: {
        physical: physicalLevel,
        mental: mentalLevel,
      },
      location: {
        type: "nearby",
        suggestion: request.location?.city || "Local area",
      },
      intrinsic_rewards: intrinsicRewards,
      icon: isWildcard ? "🎲" : "✨",
      is_wildcard: isWildcard,
      interests_used: interestsUsed,
    };

    return {
      ...questData,
      xp_reward: baseXP + wildcardBonus,
    };
  });
}

// Add source flag to mock quests for debugging
function generateMockQuests(request: QuestRequest): Quest[] {
  const city = request.location?.city || "your city";
  const templates = [
    {
      title: `[MOCK] Photo Walk in ${city} Streets`,
      description: `[AI FAILED - FALLBACK] Explore the authentic streets of ${city} and capture 5 interesting photos of local life.`,
      steps: ["Grab your phone", "Walk around your area", "Find subjects that speak to you", "Take 5 thoughtful photos"],
      effort: { physical: 2, mental: 2 },
      location: { type: "nearby" as const, suggestion: `Main streets and alleys of ${city}` },
      rewards: { fitness: 5, calm: 10, creativity: 20, social: 0, knowledge: 0, discipline: 5 },
    },
    {
      title: `[MOCK] Coffee & Conversations`,
      description: `[AI FAILED - FALLBACK] Visit a local coffee spot and practice mindful observation or strike up a conversation.`,
      steps: ["Find a busy coffee shop nearby", "Order something new", "Observe or chat with someone", "Enjoy the moment"],
      effort: { physical: 1, mental: 3 },
      location: { type: "nearby" as const, suggestion: `Popular cafe in ${city}` },
      rewards: { fitness: 0, calm: 5, creativity: 0, social: 25, knowledge: 5, discipline: 10 },
    },
    {
      title: `[MOCK] Park Bench Meditation`,
      description: `[AI FAILED - FALLBACK] Find a peaceful spot in ${city} and practice mindfulness for 15 minutes.`,
      steps: ["Walk to a nearby park", "Find a comfortable bench", "Close your eyes and breathe", "Observe your surroundings"],
      effort: { physical: 1, mental: 2 },
      location: { type: "nearby" as const, suggestion: `Nearest park in ${city}` },
      rewards: { fitness: 0, calm: 25, creativity: 5, social: 0, knowledge: 0, discipline: 15 },
    },
    {
      title: `[MOCK] Local Landmark Visit`,
      description: `[AI FAILED - FALLBACK] Visit a notable landmark or point of interest in ${city} and learn something new about it.`,
      steps: ["Research a nearby landmark", "Walk or travel there", "Observe details carefully", "Take a photo or make notes"],
      effort: { physical: 3, mental: 3 },
      location: { type: "nearby" as const, suggestion: `Historic or cultural spot in ${city}` },
      rewards: { fitness: 10, calm: 5, creativity: 5, social: 0, knowledge: 20, discipline: 10 },
    },
    // Wildcard mock quest - appears last with bonus XP
    {
      title: `[MOCK WILDCARD] ${city} Architecture Hunt`,
      description: `[AI FAILED - FALLBACK] Find the oldest building on your street and photograph 3 unique architectural details others might miss.`,
      steps: ["Walk one block in any direction", "Identify the oldest structure", "Find 3 unusual details", "Document with photos"],
      effort: { physical: 2, mental: 3 },
      location: { type: "nearby" as const, suggestion: `Your neighborhood in ${city}` },
      rewards: { fitness: 5, calm: 10, creativity: 25, social: 0, knowledge: 15, discipline: 10 },
      is_wildcard: true,
    },
  ];

  return templates.map((template, idx) => {
    const isWildcard = (template as Record<string, unknown>).is_wildcard as boolean || false;
    const baseXP = calculateXP({
      id: `quest-${Date.now()}-${idx}`,
      title: template.title,
      description: template.description,
      steps: template.steps,
      duration_minutes: request.duration,
      budget_estimate: Math.floor(Math.random() * 10),
      effort: template.effort,
      location: template.location,
      intrinsic_rewards: template.rewards,
    });

    const quest: Omit<Quest, "xp_reward"> = {
      id: `quest-${Date.now()}-${idx}`,
      title: template.title,
      description: template.description,
      steps: template.steps,
      duration_minutes: request.duration,
      budget_estimate: Math.floor(Math.random() * 10),
      effort: template.effort,
      location: template.location,
      intrinsic_rewards: template.rewards,
      icon: isWildcard ? "🎲" : "✨",
      is_wildcard: isWildcard,
    };

    // Apply wildcard bonus XP
    const wildcardBonus = isWildcard ? Math.max(25, Math.floor(baseXP * 0.25)) : 0;

    return {
      ...quest,
      xp_reward: baseXP + wildcardBonus,
    };
  });
}


export async function POST(request: NextRequest) {
  try {
    const body: QuestRequest = await request.json();
    console.log("[API] Received request:", JSON.stringify(body));

    // Validate request
    if (!body.duration || body.duration < 5 || body.duration > 120) {
      console.log("[API] Invalid duration:", body.duration);
      return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    }

    let quests: Quest[];

    // Check if OpenAI key is configured
    if (!OPENAI_API_KEY) {
      console.log("[API] No OPENAI_API_KEY configured, using mock quests");
      quests = generateMockQuests(body);
      return NextResponse.json({ quests });
    }

    console.log("[API] OPENAI_API_KEY is set, attempting AI generation");

    try {
      // Step 1: Generate location queries from user interests
      const locationQueries = generateLocationQueries(body);
      console.log("[API] Generated location queries:", locationQueries);

      // Step 2: Search Google Maps for verified locations (if coordinates available)
      let verifiedLocations: Array<{ name: string; address: string; rating?: number }> = [];

      if (body.location?.lat && body.location?.lng && body.location?.city) {
        console.log("[API] Searching Google Maps for:", body.location.city);
        verifiedLocations = await searchVerifiedLocations(
          locationQueries,
          body.location.lat,
          body.location.lng,
          body.location.city
        );
      } else {
        // No coordinates, use fallback landmarks
        console.log("[API] No coordinates, using fallback landmarks");
        const city = body.location?.city || "city";
        verifiedLocations = locationQueries.map(() =>
          getFallbackLandmark(city) || { name: city, address: city }
        );
      }

      console.log("[API] Verified locations:", verifiedLocations.map(l => l.name));

      // Step 3: Generate quests with verified locations
      console.log("[API] Calling OpenAI...");
      const aiResponse = await generateQuests(body, verifiedLocations, body.completionFeedback);
      console.log("[API] OpenAI response length:", aiResponse.length);
      console.log("[API] OpenAI response preview:", aiResponse.substring(0, 500));

      // Prepare locations to return for client-side caching
      const locationsForCache = verifiedLocations.map(loc => ({
        name: loc.name,
        address: loc.address,
        rating: loc.rating,
        query: "", // Will be filled below
      }));

      // Associate each location with its query for better cache matching
      locationQueries.forEach((query, idx) => {
        if (locationsForCache[idx]) {
          locationsForCache[idx].query = query;
        }
      });

      quests = parseAIResponse(aiResponse, body);
      console.log("[API] Parsed quests count:", quests.length);

      // Ensure we got valid quests
      if (quests.length === 0) {
        throw new Error("No quests generated from AI response");
      }

      // Return quests with locations for client-side caching
      return NextResponse.json({ quests, locations: locationsForCache });
    } catch (aiError) {
      console.error("[API] AI generation failed:", aiError);
      console.log("[API] Falling back to mock quests");
      quests = generateMockQuests(body);
      return NextResponse.json({ quests });
    }
  } catch (error) {
    console.error("[API] Quest generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate quests" },
      { status: 500 }
    );
  }
}
