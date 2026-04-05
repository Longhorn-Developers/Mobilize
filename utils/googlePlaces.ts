const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const PLACES_API_BASE_URL = "https://places.googleapis.com/v1";

// UT Austin coordinates for biasing search results
const UT_AUSTIN_LOCATION = {
  latitude: 30.2849,
  longitude: -97.7341,
};
const SEARCH_RADIUS = 2000; // 2km radius around UT campus

// Types for Google Places API (New) responses
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

  if (!GOOGLE_PLACES_API_KEY) {
    console.error("Google Places API key is not configured");
    return [];
  }

  try {
    const response = await fetch(
      `${PLACES_API_BASE_URL}/places:autocomplete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
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

    if (response.ok && data.suggestions) {
      return data.suggestions.map((suggestion: any) => ({
        place_id: suggestion.placePrediction?.placeId || "",
        description: suggestion.placePrediction?.text?.text || "",
        structured_formatting: {
          main_text: suggestion.placePrediction?.text?.text || "",
          secondary_text:
            suggestion.placePrediction?.structuredFormat?.secondaryText?.text ||
            "",
        },
      }));
    } else {
      console.error("Places Autocomplete error:", data);
      return [];
    }
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

  if (!GOOGLE_PLACES_API_KEY) {
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
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": fieldMask,
        },
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
      console.error("Place Details error:", data);
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