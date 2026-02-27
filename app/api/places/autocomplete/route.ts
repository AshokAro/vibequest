import { NextRequest, NextResponse } from "next/server";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const input = searchParams.get("input");

  if (!input || input.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.error("[Places API] GOOGLE_MAPS_API_KEY not set");
    return NextResponse.json(
      { error: "Places API not configured" },
      { status: 500 }
    );
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", input);
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY);
    // Allow cities and localities (neighborhoods, districts, etc.)
    url.searchParams.set("types", "(regions)");

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[Places API] Error:", data.status, data.error_message);
      return NextResponse.json(
        { error: "Places API error", status: data.status },
        { status: 500 }
      );
    }

    const predictions = (data.predictions || []).map((p: {
      place_id: string;
      description: string;
      structured_formatting?: {
        main_text: string;
        secondary_text?: string;
      };
    }) => ({
      place_id: p.place_id,
      description: p.description,
      main_text: p.structured_formatting?.main_text || p.description.split(",")[0],
      secondary_text: p.structured_formatting?.secondary_text || p.description.split(",").slice(1).join(",").trim(),
    }));

    return NextResponse.json({ predictions });
  } catch (error) {
    console.error("[Places API] Fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch places" },
      { status: 500 }
    );
  }
}
