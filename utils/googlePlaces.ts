const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const PLACES_AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json";
const PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

// UT Austin coordinates for biasing search results
const UT_AUSTIN_LOCATION = {
  lat: 30.2849,
  lng: -97.7341,
};
const SEARCH_RADIUS = 2000; // 2km radius around UT campus

// Types for Google Places API responses
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
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: {
    weekday_text: string[];
    open_now: boolean;
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  types?: string[];
}

/**
 * Search for places using Google Places Autocomplete
 * Biased towards UT Austin campus area
 */
export const searchPlaces = async (
  query: string
): Promise<PlaceAutocompletePrediction[]> => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  if (!GOOGLE_PLACES_API_KEY) {
    console.error("Google Places API key is not configured");
    return [];
  }

  try {
    const url = `${PLACES_AUTOCOMPLETE_URL}?input=${encodeURIComponent(query)}&location=${UT_AUSTIN_LOCATION.lat},${UT_AUSTIN_LOCATION.lng}&radius=${SEARCH_RADIUS}&key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      return data.predictions || [];
    } else if (data.status === "ZERO_RESULTS") {
      return [];
    } else {
      console.error("Places Autocomplete error:", data.status, data.error_message);
      return [];
    }
  } catch (error) {
    console.error("Error fetching place autocomplete:", error);
    return [];
  }
};

/**
 * Get detailed information about a specific place
 */
export const getPlaceDetails = async (
  placeId: string
): Promise<PlaceDetails | null> => {
  if (!placeId) {
    return null;
  }

  if (!GOOGLE_PLACES_API_KEY) {
    console.error("Google Places API key is not configured");
    return null;
  }

  try {
    // Request specific fields to minimize API costs
    const fields = [
      "place_id",
      "name",
      "formatted_address",
      "geometry",
      "rating",
      "user_ratings_total",
      "opening_hours",
      "photos",
      "types",
    ].join(",");

    const url = `${PLACE_DETAILS_URL}?place_id=${placeId}&fields=${fields}&key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      return data.result;
    } else {
      console.error("Place Details error:", data.status, data.error_message);
      return null;
    }
  } catch (error) {
    console.error("Error fetching place details:", error);
    return null;
  }
};

/**
 * Format opening hours into a readable string
 * Returns something like "7 AM to 10 PM" or "Closed"
 */
export const formatOpeningHours = (
  openingHours?: PlaceDetails["opening_hours"]
): string => {
  if (!openingHours || !openingHours.weekday_text) {
    return "Hours not available";
  }

  // Get today's hours (0 = Sunday, 1 = Monday, etc.)
  const today = new Date().getDay();
  const todayHours = openingHours.weekday_text[today === 0 ? 6 : today - 1];

  if (!todayHours) {
    return "Hours not available";
  }

  // Extract just the time part (remove day name)
  // e.g., "Monday: 7:00 AM – 10:00 PM" -> "7:00 AM – 10:00 PM"
  const timePart = todayHours.split(": ")[1];
  return timePart || "Hours not available";
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
};