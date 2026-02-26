import { NextRequest, NextResponse } from "next/server";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get("place_id");

  if (!placeId) {
    return NextResponse.json(
      { error: "place_id required" },
      { status: 400 }
    );
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.error("[Places API] GOOGLE_MAPS_API_KEY not set");
    return NextResponse.json(
      { error: "Places API not configured" },
      { status: 500 }
    );
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY);
    url.searchParams.set("fields", "geometry,formatted_address,name");

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK") {
      console.error("[Places API] Details error:", data.status, data.error_message);
      return NextResponse.json(
        { error: "Place details error", status: data.status },
        { status: 500 }
      );
    }

    const result = data.result;
    const location = result.geometry?.location;

    if (!location) {
      return NextResponse.json(
        { error: "No location data found" },
        { status: 404 }
      );
    }

    // Parse city from formatted address
    const addressParts = result.formatted_address?.split(",") || [];
    const city = result.name || addressParts[0]?.trim() || "Unknown City";
    const country = addressParts[addressParts.length - 1]?.trim() || "";

    return NextResponse.json({
      location: {
        lat: location.lat,
        lng: location.lng,
        city,
        country,
      },
    });
  } catch (error) {
    console.error("[Places API] Fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch place details" },
      { status: 500 }
    );
  }
}
