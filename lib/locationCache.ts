// Client-side location cache to reduce Google Maps API usage
// Cache is per-city and expires after 24 hours

const CACHE_KEY_PREFIX = "vibequest_locations_";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHED_CITIES = 3; // Keep only 3 cities to avoid storage bloat

export interface CachedLocation {
  name: string;
  address: string;
  rating?: number;
  types?: string[];
  query: string; // The search query that found this location
}

interface CityCache {
  city: string;
  locations: CachedLocation[];
  timestamp: number;
}

/**
 * Get cached locations for a city
 */
export function getCachedLocations(city: string): CachedLocation[] | null {
  try {
    const key = `${CACHE_KEY_PREFIX}${city.toLowerCase().replace(/\s+/g, "_")}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const cache: CityCache = JSON.parse(stored);

    // Check if cache is expired
    if (Date.now() - cache.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }

    console.log(`[LocationCache] Hit for ${city}: ${cache.locations.length} locations`);
    return cache.locations;
  } catch (e) {
    console.error("[LocationCache] Error reading cache:", e);
    return null;
  }
}

/**
 * Save locations to cache for a city
 */
export function saveLocationsToCache(city: string, locations: CachedLocation[]): void {
  try {
    // Clean up old caches if we have too many cities
    cleanupOldCaches();

    const key = `${CACHE_KEY_PREFIX}${city.toLowerCase().replace(/\s+/g, "_")}`;
    const cache: CityCache = {
      city,
      locations,
      timestamp: Date.now(),
    };

    localStorage.setItem(key, JSON.stringify(cache));
    console.log(`[LocationCache] Saved ${locations.length} locations for ${city}`);
  } catch (e) {
    console.error("[LocationCache] Error saving cache:", e);
  }
}

/**
 * Get locations from cache that match the requested query types
 * Returns up to 5 locations, prioritizing variety
 */
export function getLocationsForQueries(
  city: string,
  queries: string[]
): CachedLocation[] | null {
  const cached = getCachedLocations(city);
  if (!cached || cached.length < 5) return null;

  // Try to find locations that match each query type
  const results: CachedLocation[] = [];
  const used = new Set<string>();

  for (const query of queries) {
    const queryType = query.replace(/ near .+$/, "").toLowerCase();

    // Find a cached location that matches this query type and hasn't been used
    const match = cached.find(
      (loc) =>
        loc.query.toLowerCase().includes(queryType) &&
        !used.has(loc.name)
    );

    if (match) {
      results.push(match);
      used.add(match.name);
    }
  }

  // If we didn't get enough matches, fill with random cached locations
  if (results.length < 5) {
    for (const loc of cached) {
      if (!used.has(loc.name) && results.length < 5) {
        results.push(loc);
        used.add(loc.name);
      }
    }
  }

  if (results.length >= 3) {
    console.log(`[LocationCache] Using ${results.length} cached locations for ${city}`);
    return results.slice(0, 5);
  }

  return null;
}

/**
 * Clean up old city caches to prevent storage bloat
 */
function cleanupOldCaches(): void {
  try {
    const caches: { key: string; timestamp: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const cache: CityCache = JSON.parse(stored);
          caches.push({ key, timestamp: cache.timestamp });
        }
      }
    }

    // Sort by timestamp (oldest first) and remove extras
    caches.sort((a, b) => a.timestamp - b.timestamp);

    while (caches.length >= MAX_CACHED_CITIES) {
      const oldest = caches.shift();
      if (oldest) {
        localStorage.removeItem(oldest.key);
        console.log(`[LocationCache] Removed old cache: ${oldest.key}`);
      }
    }
  } catch (e) {
    console.error("[LocationCache] Error cleaning up caches:", e);
  }
}

/**
 * Clear all location caches (useful for debugging)
 */
export function clearAllLocationCaches(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    console.log("[LocationCache] Cleared all caches");
  } catch (e) {
    console.error("[LocationCache] Error clearing caches:", e);
  }
}
