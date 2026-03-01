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
- Well-known landmarks: name them directly
- Street-level specifics: describe TYPE and NEIGHBORHOOD only — never invent a business name
- If unsure a place exists and is accessible: do not name it
- If a quest requires spending money: state the exact estimated cost in INR

QUEST ACTION DIVERSITY:
Before writing, assign each of the 5 quests a different primary action type. No two quests can share one.

ACTION TYPES:
- MAKE: physically create or assemble something (fold origami and leave it, arrange found objects)
- COLLECT: bring something home or keep something (a leaf, a receipt, a locally made item)
- TASTE: eat or drink something specific to that location (regional dish, local brew, street snack)
- MOVE: complete a physical challenge (run a distance, do stair repeats, time yourself between two points)
- CONNECT: involve another person in real time (video call a friend and show them the view, ask a stranger one specific question)
- OBSERVE + RECORD: watch something specific and write it down or count it
- PHOTOGRAPH: shoot something with a specific framing rule or subject restriction
- EXPLORE: go to a part of a location most people miss, find something overlooked

Spread action types across the 5 quests. Draw from the full list and from the specific mechanics listed under the user's selected interests.

ARTEFACT RULE:
At least 2 of the 5 quests must produce a physical or shareable artefact — something the user has, sends, or leaves behind. Include the artefact naturally in the description — do not label it.

VOICE EXAMPLES — TONE ONLY, NOT ACTIVITY TEMPLATES:
These examples exist to show writing style only. Do not replicate the activities, locations, or mechanics shown. Generate entirely different quests.

What these examples demonstrate:
- Start with a specific observation about the place, not an instruction
- State the constraint plainly and move on — do not explain it
- End with something that acknowledges the oddness of the task without winking too hard at it

"Toit has a rotating tap list and the bartender will always have a strong opinion about which one to try. Sit at the bar, order whatever they recommend without looking at the menu, and write one sentence about it before you leave. One sentence. That's your review."

"Find the stretch of Commercial Street where the fabric shops start. Go into exactly 3 shops, touch the most expensive fabric they have, and leave without buying anything. Take note of which shopkeeper is the most unbothered by this."

These are voice references. The beer, the fabric — do not reuse these. Write new quests using the same register applied to entirely different activities and locations.

BAD QUEST (never do this):
"Stand at the edge of Sankey Tank as the golden hour light fractures across the water and breathe in the smell of earth and possibility at Sri Lakshmi Nature Café nearby..."
Fails: invented business name, vague timing, no actionable task, lyrical filler.

ALSO NEVER DO THIS:
"Photograph exactly 7 reflections. [Constraint: exactly 7 photos. This constraint encourages focused observation.]"
Fails: model explaining its own design choices.

DESCRIPTION RULES:
- Start with the action — no scene-setting, no "today you will..."
- Embed constraints naturally in the prose — never list or label them
- 4-5 sentences max
- Dry wit, specific unexpected detail, offhand observation — write like someone who's been there
- Never explain what the user will "get out of it"
- Banned words: "explore", "discover", "embrace", "soak in", "wander", "journey", "vibe" (as verb), "intention", "mindful", "presence", "unique", "hidden gem", "off the beaten path", "immersive"
- One sensory detail max, only if genuinely characteristic of the place

STEPS FORMAT:
Steps are the literal sequence of actions — not a summary of the description. Write like turn-by-turn directions mid-walk.

Each step must:
- Describe exactly one physical action
- Start with a verb
- Be under 12 words
- Be completable before the next step begins

Good steps (fabric shop quest):
1. "Find where the fabric shops begin on Commercial Street"
2. "Go into exactly 3 shops and touch the most expensive fabric"
3. "Leave without buying anything"
4. "Note which shopkeeper was most unbothered"

Bad steps:
1. "Visit Commercial Street"
2. "Go into some shops"
3. "Observe the shopkeepers"

Test: can someone follow these steps in real time without re-reading the description? If yes — correct.

TIME AND BUDGET — STAY CLOSE:
- Time and budget are upper limits — but stay within 20% of them
- A 60-minute budget should produce quests between 45-60 minutes, not 15
- A ₹500 budget should produce quests that use some of it — do not default to free every time
- Free and short quests are fine when the activity naturally fits — but none should feel like the user's input was ignored
- Each quest has its own duration and cost — they can vary across the 5

INTRINSIC REWARDS:
Rate each stat as:
- 0: not meaningfully involved
- 1: supporting role
- 2: primary focus

Stats: fitness, calm, creativity, social, knowledge, discipline

Every quest must have EXACTLY 2 non-zero stats: one "2" and one "1". All others must be 0.

- fitness: running, cycling, hiking, physical challenges
- calm: quiet observation, nature, slow-paced tasks
- creativity: making, writing, building, leaving something behind
- social: talking to strangers, calling a friend, real human interaction
- knowledge: learning, history, tasting something new, research
- discipline: strict rules, counting, repetition, structure

MOOD GUIDANCE:
- chill: slow-paced, observational, low social pressure
- adventurous: unfamiliar terrain, slight uncertainty
- creative: clear output or artefact at the end
- social: real interaction with at least one person
- focused: single-task, detail-obsessed
- playful: game mechanic, absurd rule

INTEREST TAXONOMY:
For each selected interest, use the specific mechanics listed below — these define what the quest actually does, not just its theme.

CREATIVE
- Photography → framing rules, restricted subjects (only reflections, only hands, only signage), composition constraints
- Sketching / Drawing → timed sketches, blind contour, shadow-only drawing, architectural detail
- Painting / Watercolor → on-site quick study, single-color constraint, color-match to environment
- Street Art / Murals → find, count, rank by age or style across a defined route
- Journaling / Writing → write on-site with a hard constraint (one sentence, 10 words only, fictional caption)
- Poetry → constrained poem using only words visible in the environment
- Collage / Zine Making → collect found materials (tickets, wrappers, leaves), arrange and keep or photograph
- Craft / DIY → build or assemble from found or bought materials, leave it or bring it home
- Origami → fold from found paper, leave it somewhere specific
- Calligraphy / Typography → hunt specific letterforms, find oldest and newest signage on one street

MUSIC & SOUND
- Live Music → find live sound, time how long before it changes, describe in one sentence
- Playing an Instrument → find a specific acoustic environment, play for exactly 10 minutes
- Ambient Sound / Field Recording → record 5 distinct sounds within 50 meters, identify sources
- Music Discovery → ask a vendor what they're listening to, find the song, listen on-site
- Singing / Humming → match a hum to the ambient frequency of a location

MOVEMENT & BODY
- Running / Jogging → timed run between two named points, interval sprints, distance target
- Cycling → route with named checkpoints, hill target, distance within time cap
- Yoga / Stretching → specific pose at a named outdoor location, use a bench or railing as prop
- Hiking / Trekking → step count, elevation target, find a specific viewpoint
- Strength Training → bodyweight challenge at a named park — push-up count, stair repeats
- Martial Arts / Combat Sports → shadowboxing or form practice, timed rounds
- Dance → practice a specific move in public, film it, count attempts
- Skateboarding / Parkour → find a specific urban feature (ledge, rail, gap), document 3 attempts

FOOD & DRINK
- Street Food → order a specific regional item, compare the same dish from two stalls, one sentence each
- Café Hopping → visit exactly 2 cafés, same item at both, compare in one sentence
- Cooking / Baking → buy exactly 3 raw ingredients from a market, go home and make something
- Food Markets → navigate with a ₹100 budget, buy the most interesting thing available
- Trying New Cuisines → find a cuisine never tried in this neighborhood, order the cheapest item
- Tea / Coffee → find a non-chain stall, ask how they make it, document in 3 photos
- Fermentation / Brewing → find a locally brewed or fermented item, consume on-site, rate in one sentence

CULTURE & KNOWLEDGE
- History / Heritage → find a building over 50 years old, photograph its oldest visible detail, ask someone nearby to estimate its age
- Architecture → count windows on one facade, identify the material, find the one detail that surprises you
- Museums / Galleries → 20 minutes max, 3 objects only, one sentence about each
- Archaeology / Ruins → find the oldest physical remnant in the area — wall, well, foundation stone
- Religion / Temples / Shrines → document the entry ritual of 3 different visitors without interfering
- Languages / Linguistics → find 5 instances of a non-English, non-Hindi script in signage
- Philosophy → sit in one spot for 15 minutes, write down every assumption you make about passersby

NATURE & OUTDOORS
- Birdwatching → count distinct species at a named location within 20 minutes, no app
- Botany / Plants → identify 5 plant species without an app, sketch or photograph each
- Parks / Gardens → find the oldest tree, observe its root system, estimate its age by asking someone nearby
- Stargazing → find the darkest nearby spot, identify 3 constellations
- Weather Watching → document sky changes over 15 minutes from one fixed spot
- Insects / Bugs → find 5 distinct species, document each, note what they are doing
- Foraging → identify one edible plant, do not pick it, photograph and document it

PEOPLE & SOCIAL
- People Watching → count a specific type of person, time how long before a specific event happens, write it down
- Talking to Strangers → ask 3 people the same unusual question, write their answers verbatim
- Community Events → find a public gathering within walking distance, attend for exactly 15 minutes
- Volunteering → find a local community space, ask if they need help for an hour
- Markets / Bazaars → negotiate the price of something you actually want, document opening and closing price
- Games / Board Games → find people playing a game in public, watch 10 minutes, ask to join or learn the rules
- Karaoke / Open Mics → find a venue with open mic, sign up or watch exactly 3 performers

MIND & CURIOSITY
- Puzzles / Problem Solving → invent a rule-based game using only what is physically present, play for 15 minutes
- Reading → find a physical book at a secondhand stall, read one chapter on-site, leave it somewhere visible
- Trivia / Quizzes → find 5 facts about the neighborhood using only physical sources — plaques, signs, shopkeepers
- Maps / Cartography → hand-draw a map of a 200-meter stretch from memory after walking it once
- Urban Exploration → find the most architecturally unusual building on a named street, document 3 specific details
- Conspiracy / Hidden History → ask 2 long-term locals about something that used to exist here that is now gone
- Science / Experiments → design and run a simple observation experiment in public

COLLECTING & HUNTING
- Thrift Shopping / Secondhand → find the oldest item, negotiate, buy only if under ₹150, bring it home
- Flea Markets → find one object with an interesting story, ask the seller, document the answer
- Antiques → find the oldest object in the area, photograph it, ask the seller its age and origin
- Stamps / Coins → find a philately or numismatics stall, ask to see something unusual
- Vinyl / Cassettes → find a music stall with physical media, ask the owner what they recommend
- Rare Books → find the oldest book at a pavement stall, read the first page on-site
- Ephemera / Paper Goods → collect 5 pieces of printed paper in public, arrange by color or age, keep them

NICHE & UNEXPECTED (weight heavily when selected):
- Signage / Wayfinding → document every directional sign within 100 meters, map where they point
- Shadows & Light → photograph only shadows for 20 minutes — no objects, no people
- Grids & Patterns → find 5 distinct repeating patterns on one street — tiles, grilles, brickwork
- Decay & Texture → document 5 surfaces showing visible age or wear on a single block
- Doors & Windows → photograph exactly 10 doors or windows on one street, rank by age
- Staircases → find 3 staircases in the neighborhood, photograph the top step of each
- Rooftops → find a legal vantage point, count water tanks on 10 buildings
- Puddles & Reflections → photograph only reflections for 20 minutes — water, glass, metal
- Manhole Covers → find 5 distinct designs, document the municipality name on each
- Typographical Errors → find 5 spelling or grammar errors on public signage, document each

INTEREST INTERSECTION RULE:
Combine 2 or more selected interests into one quest where it feels natural. Examples:
- Fermentation/Brewing + Talking to Strangers → ask the bartender what their most unusual regular orders, then try it
- Running + Maps/Cartography → run a route between two named points, draw it from memory after
Do not force intersections that make the activity awkward.

WILDCARD RULE:
One of the 5 quests must use none of the user's selected interests and must not resemble any of the voice examples in this prompt.

Wildcard test — all three must be true:
1. Would this quest exist if the interest list were removed entirely?
2. Does it use a mechanic not shown in any example in this prompt?
3. Is the primary action type different from the other 4 quests?

If all three are true: it is a valid wildcard. Do not mention it is a wildcard in the description. Mark it in the JSON only.

INDIAN CITY REFERENCE (confirmed real areas only):
- Bangalore: Indiranagar, Church Street, Cubbon Park, 12th Main, KR Market, Lalbagh, Sankey Tank, MG Road, Brigade Road, Koramangala, Commercial Street, Malleshwaram, Jayanagar, Toit Brewery (Museum Road)
- Mumbai: Bandra West, Marine Lines, Dadar, Colaba, Juhu Beach, Chor Bazaar, Fort, Dharavi, Mahim
- Delhi: Hauz Khas, Connaught Place, Chandni Chowk, Lodhi Garden, Lajpat Nagar, Dilli Haat
- Hyderabad: Jubilee Hills, Charminar, Necklace Road, Gachibowli, Abids, Laad Bazaar
- Chennai: Besant Nagar, Marina Beach, T Nagar, Royapuram, Mylapore, Pondy Bazaar

LOCATION RULE:
Use the verified name and address exactly as provided. Do not paraphrase, add qualifiers, or invent physical details you cannot confirm.

COMPLETION HISTORY:
Actually completed and rated 🤩: {{loved_interests}}
Actually completed and rated 😁: {{good_interests}}
Actually completed and rated 😐: {{meh_interests}}
Marked done without completing: {{skipped_interests}}

- Skip mechanics from skipped_interests if skipped more than twice
- Avoid meh_interests mechanics unless no better option exists
- Weight toward loved_interests and good_interests when multiple options are available
- If no history exists: ignore this section

USER CONTEXT:
City: {{city}}
Starting point: {{starting_point}}
Time available (MAX): {{time}}
Budget (MAX): {{budget}}
Mood: {{mood}}
Energy level: {{energy}}
Interests: {{interests}}

ICON RULE:
After writing each quest, find the single most specific physical noun in the description. Use that noun's emoji as the icon.

Test: "Is this emoji a specific noun from my description?" If yes → correct. If no → replace it.

Always emoji the subject, never the tool or action:
- Bench quest → 🪑 not 📸
- Jasmine quest → 🌸 not 🌿
- Beer quest → 🍺 not 🎵
- Fallen leaf quest → 🍃 not 🌳
- Video call quest → 📱 not 👥
- Manhole quest → 🕳️ not 🔍

Never use: ✨ 📸 🎵 ❓ ✏️ 🏃
All 5 icons must be different.

MANDATORY VERIFICATION:
Before finalising, check:

1. ACTION DIVERSITY: List the primary action type for each of the 5 quests. If any two match: rewrite one.
2. ARTEFACT CHECK: Confirm at least 2 quests produce a physical or shareable artefact.
3. STATS CHECK: Each quest must have exactly one "2", one "1", and four "0"s in intrinsic_rewards.
4. TIME + BUDGET CHECK: Each quest duration must be within 20% of the user's stated maximum. Each quest cost must be reasonable relative to the stated budget — not defaulting to free unless budget is zero.
5. ICON CHECK: Each icon must represent a specific noun from that quest's description. All 5 must be different.
6. WILDCARD CHECK: Confirm the wildcard quest passes all three wildcard tests. If not: rewrite it.

Output valid JSON with exactly 5 quests:

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
      "icon": "...",
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

    // Log the intrinsic_rewards and icon from AI
    console.log(`[parseAIResponse] Quest ${idx} intrinsic_rewards:`, quest.intrinsic_rewards || quest.stats);
    console.log(`[parseAIResponse] Quest ${idx} raw icon from AI:`, quest.icon);

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

    // Normalize AI rewards - override with interest-based stats since AI returns generic stats
    function normalizeRewards(rewards: Record<string, number> | undefined): { fitness: number; calm: number; creativity: number; social: number; knowledge: number; discipline: number } {
      // Build stats based on quest-specific interests_used, not AI's generic response
      const normalized: Record<string, number> = {
        fitness: 0, calm: 0, creativity: 0, social: 0, knowledge: 0, discipline: 0
      };

      // Determine primary stat based on first interest
      const primaryInterest = interestsUsed[0]?.toLowerCase() || "";

      // Map interest to primary stat
      const interestToStat: Record<string, string> = {
        "running": "fitness",
        "cycling": "fitness",
        "hiking": "fitness",
        "swimming": "fitness",
        "strength_training": "fitness",
        "yoga": "calm",
        "photography": "creativity",
        "sketching": "creativity",
        "painting": "creativity",
        "street_art": "creativity",
        "journaling": "creativity",
        "poetry": "creativity",
        "talking_strangers": "social",
        "people_watching": "social",
        "community_events": "social",
        "history": "knowledge",
        "architecture": "knowledge",
        "museums": "knowledge",
        "languages": "knowledge",
      };

      const primaryStat = interestToStat[primaryInterest];

      // Set primary stat based on first interest
      if (primaryStat) {
        normalized[primaryStat] = 2;
      } else {
        // Default primary based on mood
        if (request.mood === "chill") normalized.calm = 2;
        else if (request.mood === "creative") normalized.creativity = 2;
        else if (request.mood === "social") normalized.social = 2;
        else normalized.creativity = 2; // Default
      }

      // Set secondary stat based on second interest or default
      const secondaryInterest = interestsUsed[1]?.toLowerCase() || "";
      const secondaryStat = interestToStat[secondaryInterest];

      if (secondaryStat && secondaryStat !== primaryStat) {
        normalized[secondaryStat] = 1;
      } else {
        // Pick a different stat as minor
        const possibleMinors = ["discipline", "calm", "knowledge", "social"].filter(s => s !== primaryStat);
        normalized[possibleMinors[idx % possibleMinors.length]] = 1;
      }

      console.log(`[normalizeRewards] Quest ${idx}: interests=${interestsUsed.join(",")}, stats=${JSON.stringify(normalized)}`);

      return {
        fitness: normalized.fitness,
        calm: normalized.calm,
        creativity: normalized.creativity,
        social: normalized.social,
        knowledge: normalized.knowledge,
        discipline: normalized.discipline,
      };
    }

    const intrinsicRewards = normalizeRewards(aiRewards);
    console.log(`[parseAIResponse] Quest ${idx} normalized rewards:`, intrinsicRewards);

    // Check if this is a wildcard quest
    const isWildcard = !!quest.wildcard;

    // Generate unique ID using timestamp + random + index
    const uniqueId = `quest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${idx}`;

    // Bonus XP for wildcard quests (+25% bonus, min 25 XP)
    const baseXP = calculateXP({
      id: uniqueId,
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

    // Log raw icon from AI for debugging
    console.log(`[parseAIResponse] Quest ${idx} raw icon from AI:`, JSON.stringify(quest.icon));

    // Fallback: extract emoji from description if AI didn't provide one
    function extractIconFromDescription(description: string, title: string): string {
      // Common emoji mappings for quest activities
      const keywordToEmoji: Record<string, string> = {
        // Buildings/Places
        "temple": "🛕", "church": "⛪", "mosque": "🕌", "park": "🌳", "garden": "🌿",
        "bench": "🪑", "cafe": "☕", "coffee": "☕", "restaurant": "🍽️", "market": "🛒",
        "shop": "🏪", "store": "🏪", "museum": "🏛️", "library": "📚", "beach": "🏖️",
        "lake": "🌊", "river": "🌊", "tank": "🌊", "street": "🛣️", "road": "🛣️",
        // Actions
        "photograph": "📷", "photo": "📷", "sketch": "✏️", "draw": "✏️", "write": "✍️",
        "read": "📖", "walk": "🚶", "run": "🏃", "sit": "🪑", "stand": "🧍",
        "count": "🔢", "find": "🔍", "look": "👀", "watch": "👀", "observe": "🔭",
        // Objects
        "flower": "🌸", "tree": "🌳", "leaf": "🍃", "bird": "🐦", "dog": "🐕",
        "book": "📖", "paper": "📄", "pen": "🖊️", "pencil": "✏️", "phone": "📱",
        "camera": "📷", "money": "💰", "coin": "🪙", "rupee": "💰", "food": "🍽️",
        "chai": "☕", "tea": "☕", "snack": "🍿", "meal": "🍽️", "plate": "🍽️",
        "window": "🪟", "door": "🚪", "wall": "🧱", "sign": "🪧", "board": "🪧",
        "stair": "🪜", "step": "🪜", "roof": "🏠", "building": "🏢", "house": "🏠",
        // Activities
        "talk": "💬", "chat": "💬", "ask": "❓", "question": "❓", "answer": "💬",
        "conversation": "💬", "speak": "🗣️", "listen": "👂", "hear": "👂",
        "yoga": "🧘", "meditate": "🧘", "stretch": "🤸", "exercise": "💪",
        "dance": "💃", "sing": "🎤", "play": "🎮", "game": "🎲",
        // Nature
        "sun": "☀️", "sky": "🌤️", "cloud": "☁️", "rain": "🌧️", "wind": "💨",
        "stone": "🪨", "rock": "🪨", "sand": "🏖️", "grass": "🌱", "plant": "🌿",
        // Art/Culture
        "art": "🎨", "paint": "🎨", "color": "🎨", "music": "🎵", "song": "🎵",
        "drama": "🎭", "theater": "🎭", "film": "🎬", "movie": "🎬",
        // Time
        "clock": "⏰", "time": "⏰", "minute": "⏱️", "hour": "🕐", "day": "📅",
        // Social
        "people": "👥", "person": "🧑", "man": "👨", "woman": "👩", "child": "👶",
        "friend": "🧑‍🤝‍🧑", "group": "👥", "crowd": "👥", "stranger": "🚶",
        // Materials
        "wood": "🪵", "metal": "🔩", "glass": "🥃", "plastic": "🥤",
        // Shopping/Money
        "buy": "🛒", "sell": "🏷️", "price": "🏷️", "cheap": "💸", "expensive": "💎",
        "thrift": "👕", "bargain": "💰", "negotiate": "🤝",
        // Documenting
        "note": "📝", "list": "📋", "journal": "📓", "diary": "📔", "record": "🎙️",
        // Transportation
        "bus": "🚌", "train": "🚆", "metro": "🚇", "auto": "🛺",
        // Specific items
        "jasmine": "🌸", "fabric": "🧵", "cloth": "🧶", "sari": "🥻",
        "chair": "🪑", "table": "🪑", "seat": "💺",
        // Misc
        "shadow": "🌑", "light": "💡", "reflection": "🪞", "pattern": "🔲", "texture": "〰️",
        "old": "🏛️", "new": "✨", "ancient": "🏺", "modern": "🏢",
      };

      const text = (description + " " + title).toLowerCase();

      // Find first matching keyword
      for (const [keyword, emoji] of Object.entries(keywordToEmoji)) {
        if (text.includes(keyword)) {
          return emoji;
        }
      }

      // Default fallbacks based on quest type
      if (text.includes("photograph") || text.includes("photo")) return "📷";
      if (text.includes("walk") || text.includes("explore")) return "🚶";
      if (text.includes("draw") || text.includes("sketch")) return "✏️";
      if (text.includes("talk") || text.includes("conversation")) return "💬";
      if (text.includes("read") || text.includes("book")) return "📖";
      if (text.includes("food") || text.includes("eat")) return "🍽️";
      if (text.includes("park") || text.includes("nature")) return "🌳";
      if (text.includes("shop") || text.includes("market")) return "🛒";

      return "✨";
    }

    const finalIcon = quest.icon && String(quest.icon).trim()
      ? String(quest.icon).trim()
      : extractIconFromDescription(String(quest.description), String(quest.title));

    console.log(`[parseAIResponse] Quest ${idx} final icon:`, finalIcon);

    const questData: Omit<Quest, "xp_reward"> = {
      id: uniqueId,
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
      icon: finalIcon,
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
      // New format: exactly one stat = 2, one stat = 1, rest = 0
      rewards: { fitness: 0, calm: 0, creativity: 2, social: 0, knowledge: 0, discipline: 1 },
    },
    {
      title: `[MOCK] Coffee & Conversations`,
      description: `[AI FAILED - FALLBACK] Visit a local coffee spot and practice mindful observation or strike up a conversation.`,
      steps: ["Find a busy coffee shop nearby", "Order something new", "Observe or chat with someone", "Enjoy the moment"],
      effort: { physical: 1, mental: 3 },
      location: { type: "nearby" as const, suggestion: `Popular cafe in ${city}` },
      rewards: { fitness: 0, calm: 0, creativity: 0, social: 2, knowledge: 0, discipline: 1 },
    },
    {
      title: `[MOCK] Park Bench Meditation`,
      description: `[AI FAILED - FALLBACK] Find a peaceful spot in ${city} and practice mindfulness for 15 minutes.`,
      steps: ["Walk to a nearby park", "Find a comfortable bench", "Close your eyes and breathe", "Observe your surroundings"],
      effort: { physical: 1, mental: 2 },
      location: { type: "nearby" as const, suggestion: `Nearest park in ${city}` },
      rewards: { fitness: 0, calm: 2, creativity: 0, social: 0, knowledge: 0, discipline: 1 },
    },
    {
      title: `[MOCK] Local Landmark Visit`,
      description: `[AI FAILED - FALLBACK] Visit a notable landmark or point of interest in ${city} and learn something new about it.`,
      steps: ["Research a nearby landmark", "Walk or travel there", "Observe details carefully", "Take a photo or make notes"],
      effort: { physical: 3, mental: 3 },
      location: { type: "nearby" as const, suggestion: `Historic or cultural spot in ${city}` },
      rewards: { fitness: 1, calm: 0, creativity: 0, social: 0, knowledge: 2, discipline: 0 },
    },
    // Wildcard mock quest - appears last with bonus XP
    {
      title: `[MOCK WILDCARD] ${city} Architecture Hunt`,
      description: `[AI FAILED - FALLBACK] Find the oldest building on your street and photograph 3 unique architectural details others might miss.`,
      steps: ["Walk one block in any direction", "Identify the oldest structure", "Find 3 unusual details", "Document with photos"],
      effort: { physical: 2, mental: 3 },
      location: { type: "nearby" as const, suggestion: `Your neighborhood in ${city}` },
      rewards: { fitness: 0, calm: 0, creativity: 2, social: 0, knowledge: 1, discipline: 0 },
      is_wildcard: true,
    },
  ];

  return templates.map((template, idx) => {
    const isWildcard = (template as Record<string, unknown>).is_wildcard as boolean || false;
    const uniqueId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${idx}`;
    const baseXP = calculateXP({
      id: uniqueId,
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
      id: uniqueId,
      title: template.title,
      description: template.description,
      steps: template.steps,
      duration_minutes: request.duration,
      budget_estimate: Math.floor(Math.random() * 10),
      effort: template.effort,
      location: template.location,
      intrinsic_rewards: template.rewards,
      icon: (template as Record<string, unknown>).icon as string,
      is_wildcard: isWildcard,
      interests_used: [],
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
