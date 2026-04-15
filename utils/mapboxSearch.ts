// Mapbox Search Box API — replaces Google Places for autocomplete + place details.
// Uses the same EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN already used by the map.
// Free tier: 100k geocoding + 50k search requests/month.
//
// Types mirror googlePlaces.ts so callers need only update their import path.

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
const SEARCH_BASE = "https://api.mapbox.com/search/searchbox/v1";
// UT Austin — bias suggestions towards campus
const PROXIMITY = "-97.7341,30.2849";

// One session token per app launch (Mapbox billing groups suggest+retrieve pairs)
const SESSION_TOKEN = Math.random().toString(36).slice(2) + Date.now().toString(36);

// ── Shared types (same shape as googlePlaces.ts) ──────────────────────────────

export interface PlaceAutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  types?: string[];
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Autocomplete suggestions biased towards UT Austin campus.
 */
export const searchPlaces = async (
  query: string
): Promise<PlaceAutocompletePrediction[]> => {
  if (!query || query.trim().length < 2) return [];
  if (!MAPBOX_TOKEN) {
    console.error("EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not configured");
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: query.trim(),
      access_token: MAPBOX_TOKEN,
      session_token: SESSION_TOKEN,
      proximity: PROXIMITY,
      language: "en",
      limit: "5",
    });

    const res = await fetch(`${SEARCH_BASE}/suggest?${params}`);
    if (!res.ok) {
      console.error("Mapbox suggest error:", res.status);
      return [];
    }
    const data = await res.json();
    return (data.suggestions ?? []).map((s: any) => ({
      place_id: s.mapbox_id ?? "",
      description: s.full_address ?? s.name ?? "",
      structured_formatting: {
        main_text: s.name ?? "",
        secondary_text: s.place_formatted ?? "",
      },
    }));
  } catch (err) {
    console.error("searchPlaces error:", err);
    return [];
  }
};

/**
 * Retrieve full place details by mapbox_id (returned from searchPlaces as place_id).
 */
export const getPlaceDetails = async (
  mapboxId: string
): Promise<PlaceDetails | null> => {
  if (!mapboxId) return null;
  if (!MAPBOX_TOKEN) {
    console.error("EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not configured");
    return null;
  }

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      session_token: SESSION_TOKEN,
    });

    const res = await fetch(
      `${SEARCH_BASE}/retrieve/${encodeURIComponent(mapboxId)}?${params}`
    );
    if (!res.ok) {
      console.error("Mapbox retrieve error:", res.status);
      return null;
    }
    const data = await res.json();
    const feat = data.features?.[0];
    if (!feat) return null;

    const [lng, lat] = feat.geometry?.coordinates ?? [0, 0];
    const props = feat.properties ?? {};

    return {
      place_id: mapboxId,
      name: props.name ?? "",
      formatted_address:
        props.full_address ?? props.place_formatted ?? props.address ?? "",
      geometry: { location: { lat, lng } },
      types: props.feature_type ? [props.feature_type] : undefined,
    };
  } catch (err) {
    console.error("getPlaceDetails error:", err);
    return null;
  }
};

/**
 * Haversine distance in miles between two lat/lng coordinates.
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
};
