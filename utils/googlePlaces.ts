import Constants from "expo-constants";
import { Platform } from "react-native";

const PLACES_API_BASE_URL = "https://places.googleapis.com/v1";

// UT Austin coordinates for biasing search results
const UT_AUSTIN_LOCATION = {
  latitude: 30.2849,
  longitude: -97.7341,
};
const SEARCH_RADIUS = 2000; // 2km radius around UT campus
const AUTOCOMPLETE_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat";

const getPlacesApiKey = () =>
  (
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    ""
  ).trim();

const getPlacesHeaders = () => {
  const apiKey = getPlacesApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
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

  if (
    data?.error?.status === "INVALID_ARGUMENT" &&
    typeof data?.error?.message === "string" &&
    data.error.message.toLowerCase().includes("api key expired")
  ) {
    console.error(
      `${label}: Google rejected the configured Places key as expired. Update EXPO_PUBLIC_GOOGLE_PLACES_API_KEY (or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) and restart Expo so the new env value is bundled.`,
      {
        code: data?.error?.code,
        status: data?.error?.status,
        message: data?.error?.message,
      },
    );
    return;
  }

  console.error(label, data);
};

// Types for Google Places API (New) responses
export interface PlaceAutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface PlaceOpeningHours {
  open_now?: boolean;
  weekday_text?: string[];
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
  photos?: {
    photo_reference: string;
    height: number;
    width: number;
  }[];
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: PlaceOpeningHours;
}

/**
 * Format opening hours for display.
 * Returns today's hours if available, otherwise the first line, or a fallback string.
 */
export const formatOpeningHours = (hours?: PlaceOpeningHours): string => {
  if (!hours) return "Hours not available";

  if (hours.open_now !== undefined) {
    const status = hours.open_now ? "Open now" : "Closed";
    if (hours.weekday_text && hours.weekday_text.length > 0) {
      const today = new Date().getDay(); // 0 = Sunday
      // weekday_text is Mon–Sun (0-indexed Monday = 0)
      const dayIndex = today === 0 ? 6 : today - 1;
      const todayText = hours.weekday_text[dayIndex];
      if (todayText) {
        const timePart = todayText.split(": ").slice(1).join(": ");
        return `${status} · ${timePart}`;
      }
    }
    return status;
  }

  if (hours.weekday_text && hours.weekday_text.length > 0) {
    return hours.weekday_text[0];
  }

  return "Hours not available";
};

/**
 * Search for places using Google Places Autocomplete (New API)
 * Biased towards UT Austin campus area
 */
export const searchPlaces = async (
  query: string
): Promise<PlaceAutocompletePrediction[]> => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  if (!getPlacesApiKey()) {
    console.error("Google Places API key is not configured");
    return [];
  }

  try {
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
    }

    logPlacesError("Places Autocomplete error", data);
    return [];
  } catch (error) {
    console.error("Error fetching place autocomplete:", error);
    return [];
  }
};

/**
 * Get detailed information about a specific place using the new API
 */
export const getPlaceDetails = async (
  placeId: string
): Promise<PlaceDetails | null> => {
  if (!placeId) {
    return null;
  }

  if (!getPlacesApiKey()) {
    console.error("Google Places API key is not configured");
    return null;
  }

  try {
    // fieldMask is required for the new Places API v1
    // Only Basic-tier fields to stay within the $200/month free credit
    const fieldMask = [
      "id",
      "displayName",
      "formattedAddress",
      "location",
      "photos",
      "types",
    ].join(",");

    const response = await fetch(
      `${PLACES_API_BASE_URL}/places/${placeId}`,
      {
        method: "GET",
        headers: { ...getPlacesHeaders(), "X-Goog-FieldMask": fieldMask },
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
        photos: data.photos?.map((photo: any) => ({
          photo_reference: photo.name,
          height: photo.heightPx,
          width: photo.widthPx,
        })),
        types: data.types,
      };
    } else {
      logPlacesError("Place Details error", data);
      return null;
    }
  } catch (error) {
    console.error("Error fetching place details:", error);
    return null;
  }
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
