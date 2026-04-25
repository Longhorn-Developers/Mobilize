import {
  ClientRequestError,
  DEFAULT_REQUEST_TIMEOUT_MS,
  fetchWithTimeout,
  isRetriableCandidateError,
} from "~/utils/request-utils";

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:54321").replace(/\/+$/, "");
const FALLBACK_API_BASE_URL = "http://localhost:54321";

const API_BASE_CANDIDATES = Array.from(
  new Set([FALLBACK_API_BASE_URL, API_BASE_URL].map((url) => url.replace(/\/+$/, ""))),
).filter(Boolean);
let activeApiBaseUrl = API_BASE_CANDIDATES[0] ?? FALLBACK_API_BASE_URL;

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

const isJsonResponse = (response: Response) =>
  (response.headers.get("content-type") ?? "").toLowerCase().includes("application/json");

const parseJsonOrThrow = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const preview = text.slice(0, 200) || response.statusText || "Empty body";
  if (!isJsonResponse(response)) {
    const isHtml = /<!doctype html|<html/i.test(text);
    throw new ClientRequestError(
      isHtml ? "HTML_RESPONSE" : "NON_JSON",
      isHtml
        ? `API returned HTML instead of JSON while calling Places proxy (${response.status})`
        : `Non-JSON response (${response.status}): ${preview}`,
      { status: response.status, responsePreview: preview, url: response.url },
    );
  }

  if (!text.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ClientRequestError("MALFORMED_JSON", `Malformed JSON response (${response.status})`, {
      status: response.status,
      responsePreview: preview,
      url: response.url,
    });
  }
};

const getApiBaseCandidates = () => [
  activeApiBaseUrl,
  ...API_BASE_CANDIDATES.filter((candidate) => candidate !== activeApiBaseUrl),
];

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
      const data = await parseJsonOrThrow<any>(response);

      // Candidate proved API reachability by returning JSON.
      activeApiBaseUrl = apiBase;

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
  const random = Math.random().toString(36).slice(2, 12);
  return `places_${Date.now()}_${random}`;
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
    console.error("Google Places autocomplete proxy error:", error);
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
    console.error("Google Places details proxy error:", error);
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
