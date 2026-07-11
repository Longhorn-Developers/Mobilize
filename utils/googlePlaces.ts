import { getApiBaseCandidates, promoteApiBaseUrl } from "~/utils/api-base";
import {
  ClientRequestError,
  DEFAULT_REQUEST_TIMEOUT_MS,
  fetchWithTimeout,
  isRetriableCandidateError,
  parseJsonResponse,
} from "~/utils/request-utils";

export interface PlaceAutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export type PlacesAutocompleteScope = "campus" | "global";

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
  opening_hours?: PlaceOpeningHours;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
}


const requestPlacesProxy = async <T>(
  path: "/places/autocomplete" | "/places/details",
  payload: Record<string, unknown>,
): Promise<T> => {
  let lastError: unknown = null;

  for (const apiBase of getApiBaseCandidates()) {
    const requestUrl = `${apiBase}${path}`;
    try {
      const response = await fetchWithTimeout(
        requestUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        DEFAULT_REQUEST_TIMEOUT_MS,
      );
      const data = await parseJsonResponse<any>(response, requestUrl);

      // Candidate proved API reachability by returning JSON.
      promoteApiBaseUrl(apiBase);

      if (!response.ok) {
        const message = data?.error?.message ?? `Request failed (${response.status})`;
        throw new ClientRequestError("API_ERROR", message, {
          status: response.status,
          url: requestUrl,
          details: data,
        });
      }

      return data as T;
    } catch (error) {
      lastError = error;
      if (!isRetriableCandidateError(error)) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Places proxy request failed");
};

const buildSessionToken = () => {
  // Use crypto.getRandomValues for a well-distributed token; Math.random() is not suitable.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `places_${Date.now()}_${hex}`;
};

let activeSessionToken: string | null = null;
let lastSessionTouch = 0;
const SESSION_TTL_MS = 3 * 60 * 1000;

const getSessionToken = () => {
  const now = Date.now();
  if (!activeSessionToken || now - lastSessionTouch > SESSION_TTL_MS) {
    activeSessionToken = buildSessionToken();
  }
  lastSessionTouch = now;
  return activeSessionToken;
};

export const resetPlacesSession = () => {
  activeSessionToken = null;
  lastSessionTouch = 0;
};

export const formatOpeningHours = (_hours?: PlaceOpeningHours): string => {
  return "Hours not available";
};

export const searchPlaces = async (
  query: string,
  options?: { scope?: PlacesAutocompleteScope },
): Promise<PlaceAutocompletePrediction[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const scope: PlacesAutocompleteScope = options?.scope ?? "campus";

  try {
    const data = await requestPlacesProxy<any[]>(
      "/places/autocomplete",
      {
        input: trimmed,
        scope,
        sessionToken: getSessionToken(),
      },
    );

    if (!Array.isArray(data)) return [];
    return data.filter((item) => typeof item?.place_id === "string");
  } catch (error) {
    console.warn("Google Places autocomplete unavailable:", error);
    return [];
  }
};

export const getPlaceDetails = async (
  placeId: string,
  displayName?: string,
): Promise<PlaceDetails | null> => {
  const normalized = placeId.trim();
  if (!normalized) return null;

  try {
    const data = await requestPlacesProxy<any>(
      "/places/details",
      {
        placeId: normalized,
        displayName: displayName?.trim() || undefined,
        sessionToken: getSessionToken(),
      },
    );

    if (!data?.geometry?.location) return null;
    return data as PlaceDetails;
  } catch (error) {
    console.warn("Google Places details unavailable:", error);
    return null;
  }
};

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 3959;
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
  return Math.round(distance * 10) / 10;
};
