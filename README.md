# VibeQuest

A hyperlocal activity generator that creates spontaneous, real-world missions based on your mood, interests, and location. Built as a mobile-first PWA with AI-powered mission generation.

![VibeQuest](https://img.shields.io/badge/VibeQuest-Live%20Missions-ff6b9d)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![PWA](https://img.shields.io/badge/PWA-Ready-green)

## What is VibeQuest?

VibeQuest eliminates decision fatigue by generating unique, actionable missions you can complete in your city. Instead of scrolling through generic "things to do" lists, you get hyperlocal, personalized activities that match your current vibe.

**Example missions:**
- "Photograph exactly 7 benches in Cubbon Park from different angles. Done in under 20 minutes if you move with purpose."
- "Find a filter coffee stall in Malleshwaram market. Ask how they make it, document the process in 3 photos."

## Features

- **AI-Powered Mission Generation** — GPT-4o-mini creates unique missions based on your mood, energy level, and interests
- **Real Location Verification** — Google Maps Places API ensures every location actually exists
- **Mobile-First PWA** — Install on your phone, works offline with service worker
- **Interest Taxonomy** — 10 categories covering Creative, Movement, Food, Culture, Nature, Social, and niche interests
- **Gamified XP System** — Complete missions to earn XP across fitness, calm, creativity, social, knowledge, and discipline
- **Smart Constraints** — Every mission has hard constraints (time limits, specific counts) to make it actionable

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **UI Components:** shadcn/ui
- **Animations:** Framer Motion
- **PWA:** next-pwa with custom service worker
- **AI:** OpenAI GPT-4o-mini
- **Maps:** Google Maps Places API
- **Deployment:** Vercel

## Architecture

The mission generation pipeline runs in 3 steps:

1. **Classify** — User interests are mapped to location type queries
2. **Verify** — Google Maps Places API finds 5 real, verified locations nearby
3. **Generate** — AI writes missions around those exact locations

This ensures no hallucinated cafés or fictional landmarks—every place is real and currently operational.

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key
- Google Maps API key (optional but recommended)

### Installation

```bash
# Clone the repo
git clone https://github.com/AshokAro/vibequest.git
cd vibequest

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your API keys

# Run dev server
npm run dev
```

Open http://localhost:3000 in your browser.

### Environment Variables

Create `.env.local`:

```env
# Required
OPENAI_API_KEY=sk-proj-your-key-here

# Optional (enables verified location search)
GOOGLE_MAPS_API_KEY=AIza-your-key-here
```

Get your keys:
- [OpenAI API Key](https://platform.openai.com/api-keys)
- [Google Maps API Key](https://developers.google.com/maps/documentation/places/web-service/get-api-key) (enable Places API)

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Add environment variables in the Vercel dashboard
5. Deploy

The project is pre-configured for Vercel with:
- `vercel.json` for API route timeouts (30s for AI generation)
- `next.config.ts` optimized for PWA builds
- Static export disabled (serverless API routes required)

## Project Structure

```
app/
├── api/missions/generate/    # AI mission generation endpoint
├── components/               # MobileFrame, BottomNav
├── hooks/                    # useTapFeedback, useSwipe, useHaptic
├── missions/                 # Mission listing, active, complete flows
├── feed/                     # Social feed (placeholder)
├── profile/                  # User profile & stats
├── settings/                 # Location & interests settings
├── onboarding/               # First-time user flow
└── offline/                  # Offline fallback page

lib/
├── types.ts                  # TypeScript definitions
└── utils.ts                  # Utility functions

public/
├── manifest.json             # PWA manifest
└── icons/                    # App icons
```

## Design Philosophy

**Voice:** Every mission reads like a tip from a friend who knows the city—not a travel blog or life coach. Dry wit, specific details, zero lyrical filler.

**Constraints:** Every mission has a hard rule (number, time limit, specific subject). This eliminates decision fatigue and makes completion satisfying.

**Reality First:** No invented business names. No "a cozy café nearby." Every location is verified or described precisely by type and neighborhood.

## Customization

### Adding New Cities

Edit `CITY_LANDMARKS` in `app/api/missions/generate/route.ts`:

```typescript
const CITY_LANDMARKS: Record<string, string[]> = {
  "your-city": ["Landmark 1", "Landmark 2", "Famous Street"],
};
```

### Modifying Interest Mappings

Edit `INTEREST_LOCATION_MAP` in the same file to change which location types are searched for each interest.

## License

MIT — use it, fork it, break it, fix it.

## Credits

Built with the hyperlocal philosophy: specific places, real constraints, and a voice that sounds like someone who's actually been there.
