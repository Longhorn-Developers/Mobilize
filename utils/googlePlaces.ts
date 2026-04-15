import { Platform } from "react-native";
import Constants from "expo-constants";

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
<<<<<<< HEAD
const PLACES_API_BASE_URL = "https://places.googleapis.com/v1";

// UT Austin coordinates for biasing search results
const UT_AUSTIN_LOCATION = {
  latitude: 30.2849,
  longitude: -97.7341,
};
const SEARCH_RADIUS = 2000; // 2km radius around UT campus
const AUTOCOMPLETE_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat";

const getPlacesHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY || "",
  };

  if (Platform.OS === "ios") {
    const expoConfig = (Constants.expoConfig as any) || {};
    const manifest2 = (Constants.manifest2 as any) || {};
    const bundleIdentifier =
      expoConfig?.ios?.bundleIdentifier ||
      manifest2?.extra?.expoClient?.iosBundleIdentifier;

    if (bundleIdentifier) {
      headers["X-Ios-Bundle-Identifier"] = bundleIdentifier;
    }
  }

  return headers;
};

const logPlacesError = (label: string, data: any) => {
  const reason = data?.error?.details?.[0]?.reason;

  if (data?.error?.status === "PERMISSION_DENIED") {
    console.error(
      `${label}: PERMISSION_DENIED. Key restrictions likely block this client.`,
      {
        code: data?.error?.code,
        status: data?.error?.status,
        message: data?.error?.message,
        reason,
      },
    );

    if (reason === "API_KEY_IOS_APP_BLOCKED") {
      console.error(
        "Google key is iOS-app restricted and rejected this request. Confirm bundle identifier restriction matches this app, or use an unrestricted/dev key for REST calls.",
      );
    }

    return;
  }

  console.error(label, data);
};

// Types for Google Places API (New) responses
=======
const PLACES_AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json";
const PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

// UT Austin coordinates for biasing search results
const UT_AUSTIN_LOCATION = {
  lat: 30.2849,
  lng: -97.7341,
};
const SEARCH_RADIUS = 2000; // 2km radius around UT campus

// Types for Google Places API responses
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d
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
<<<<<<< HEAD
 * Search for places using Google Places Autocomplete (New API)
=======
 * Search for places using Google Places Autocomplete
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d
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
<<<<<<< HEAD
    const response = await fetch(
      `${PLACES_API_BASE_URL}/places:autocomplete`,
      {
        method: "POST",
        headers: {
          ...getPlacesHeaders(),
          "X-Goog-FieldMask": AUTOCOMPLETE_FIELD_MASK,
        },
        body: JSON.stringify({
          input: query,
          locationBias: {
            circle: {
              center: {
                latitude: UT_AUSTIN_LOCATION.latitude,
                longitude: UT_AUSTIN_LOCATION.longitude,
              },
              radius: SEARCH_RADIUS,
            },
          },
        }),
      }
    );

    const data = await response.json();
    const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];

    if (response.ok) {
      // Google may return an empty object when no suggestions match.
      if (suggestions.length === 0) {
        return [];
      }

      return suggestions.map((suggestion: any) => ({
        place_id: suggestion.placePrediction?.placeId || "",
        description: suggestion.placePrediction?.text?.text || "",
        structured_formatting: {
          main_text: suggestion.placePrediction?.text?.text || "",
          secondary_text:
            suggestion.placePrediction?.structuredFormat?.secondaryText?.text ||
            "",
        },
      }));
<<<<<<< HEAD
    } else {
      console.error("Places Autocomplete error:", data);
=======
    const url = `${PLACES_AUTOCOMPLETE_URL}?input=${encodeURIComponent(query)}&location=${UT_AUSTIN_LOCATION.lat},${UT_AUSTIN_LOCATION.lng}&radius=${SEARCH_RADIUS}&key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      return data.predictions || [];
    } else if (data.status === "ZERO_RESULTS") {
      return [];
    } else {
      console.error("Places Autocomplete error:", data.status, data.error_message);
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d
      return [];
=======
>>>>>>> 8ecc139cc4beab84488d0634d70f9ee1c55494ac
    }

    logPlacesError("Places Autocomplete error", data);
    return [];
  } catch (error) {
    console.error("Error fetching place autocomplete:", error);
    return [];
  }
};

/**
<<<<<<< HEAD
 * Get detailed information about a specific place using the new API
=======
 * Get detailed information about a specific place
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d
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
<<<<<<< HEAD
    // fieldMask is required for the new Places API v1
    const fieldMask = [
      "id",
      "displayName",
      "formattedAddress",
      "location",
<<<<<<< HEAD
      "rating",
      "userRatingCount",
      "currentOpeningHours",
=======
    // Request specific fields to minimize API costs
    const fields = [
      "place_id",
      "name",
      "formatted_address",
      "geometry",
      "rating",
      "user_ratings_total",
      "opening_hours",
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d
=======
>>>>>>> 8ecc139cc4beab84488d0634d70f9ee1c55494ac
      "photos",
      "types",
    ].join(",");

<<<<<<< HEAD
    const response = await fetch(
      `${PLACES_API_BASE_URL}/places/${placeId}?fields=${encodeURIComponent(fieldMask)}`,
      {
        method: "GET",
        headers: getPlacesHeaders(),
      }
    );

    const data = await response.json();

    if (response.ok && data) {
      return {
        place_id: data.id || placeId,
        name: data.displayName?.text || "",
        formatted_address: data.formattedAddress || "",
        geometry: {
          location: {
            lat: data.location?.latitude || 0,
            lng: data.location?.longitude || 0,
          },
        },
        rating: data.rating,
        user_ratings_total: data.userRatingCount,
        opening_hours: data.currentOpeningHours
          ? {
              weekday_text: data.currentOpeningHours.weekdayDescriptions || [],
              open_now: data.currentOpeningHours.openNow || false,
            }
          : undefined,
        photos: data.photos?.map((photo: any) => ({
          photo_reference: photo.name,
          height: photo.heightPx,
          width: photo.widthPx,
        })),
        types: data.types,
      };
    } else {
<<<<<<< HEAD
      console.error("Place Details error:", data);
=======
    const url = `${PLACE_DETAILS_URL}?place_id=${placeId}&fields=${fields}&key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      return data.result;
    } else {
      console.error("Place Details error:", data.status, data.error_message);
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d
=======
      logPlacesError("Place Details error", data);
>>>>>>> 8ecc139cc4beab84488d0634d70f9ee1c55494ac
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