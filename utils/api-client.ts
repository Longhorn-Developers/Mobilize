/** Typed HTTP client for all MobilizeUT API calls. Automatically retries across multiple base URL candidates (local dev, devtunnel, configured env var). */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Polygon } from "geojson";

import {
  Profile,
  POIRaw,
  AvoidanceAreaRaw,
  AvoidanceAreaDetailRaw,
  AvoidanceAreaReport,
  ReviewEntryRaw,
  ReviewEntry,
} from "~/types/database";
import { promoteApiBaseUrl } from "~/utils/api-base";
import {
  ClientRequestError,
  DEFAULT_REQUEST_TIMEOUT_MS,
  fetchWithTimeout,
  isRetriableCandidateError,
} from "~/utils/request-utils";
import { SESSION_TOKEN_KEY } from "~/utils/useAuth";
const IS_DEV = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

const safeJsonParse = <T>(value: string | null | undefined): T | null => {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

/**
 * HTTP client for all MobilizeUT API calls.
 *
 * @param baseUrl - The primary API base URL (EXPO_PUBLIC_API_URL). Falls back to
 *   localhost:54321 for local dev if the configured URL is unreachable.
 *
 * Retry logic: requests are attempted across `getBaseCandidates()` in order:
 *   1. Last successful URL (promoted via promoteApiBaseUrl)
 *   2. Hardcoded localhost fallback
 *   3. Configured env-var URL
 * Only network-level failures (ECONNREFUSED, HTML responses, timeouts) trigger
 * a fallback; HTTP 4xx/5xx errors from a responding server are thrown immediately.
 */
class ApiClient {
  private baseUrl: string;
  private readonly configuredBaseUrl: string;
  private readonly fallbackBaseUrl: string;

  constructor(baseUrl: string) {
    this.configuredBaseUrl = (baseUrl || "http://localhost:54321").replace(/\/+$/, "");
    this.fallbackBaseUrl = "http://localhost:54321";
    // Local-first by default for emulator/dev stability.
    this.baseUrl = this.fallbackBaseUrl;
  }

  private getBaseCandidates() {
    const candidates = [this.baseUrl, this.fallbackBaseUrl, this.configuredBaseUrl]
      .map((url) => (url || "").replace(/\/+$/, ""))
      .filter(Boolean);
    return Array.from(new Set(candidates));
  }

  /**
   * Parses the response body as JSON. Throws ClientRequestError with a specific code:
   * - HTML_RESPONSE: server returned an HTML page (wrong URL / proxy error)
   * - NON_JSON: non-JSON content-type (e.g. plain text)
   * - MALFORMED_JSON: content-type is JSON but the body failed to parse
   */
  private parseJsonBody<T>(
    response: Response,
    text: string,
    url: string,
    responsePreview: string,
  ): T {
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.toLowerCase().includes("application/json");

    if (!isJson) {
      const isHtml = /<!doctype html|<html/i.test(text);
      throw new ClientRequestError(
        isHtml ? "HTML_RESPONSE" : "NON_JSON",
        isHtml
          ? `API returned HTML at ${url}. Check EXPO_PUBLIC_API_URL and tunnel/local forwarding.`
          : `Non-JSON response (${response.status} ${response.statusText}): ${responsePreview}`,
        {
          status: response.status,
          url,
          responsePreview,
        },
      );
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return {} as T;
    }

    const parsed = safeJsonParse<T>(trimmed);
    if (parsed == null) {
      throw new ClientRequestError(
        "MALFORMED_JSON",
        `Malformed JSON response (${response.status} ${response.statusText})`,
        {
          status: response.status,
          url,
          responsePreview,
        },
      );
    }

    return parsed;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
    let lastError: unknown = null;

    for (const baseUrlCandidate of this.getBaseCandidates()) {
      const url = `${baseUrlCandidate}${endpoint}`;
      try {
        const response = await fetchWithTimeout(
          url,
          {
            ...options,
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...options?.headers,
            },
          },
          DEFAULT_REQUEST_TIMEOUT_MS,
        );

        const text = await response.text();
        const responsePreview =
          text.slice(0, 120) || response.statusText || "Empty response body";

        if (IS_DEV) {
          console.log("API URL:", url);
          console.log("STATUS:", response.status);
          console.log("RESPONSE PREVIEW:", responsePreview);
        }

        const parsedBody = this.parseJsonBody<any>(
          response,
          text,
          url,
          responsePreview,
        );

        // If this candidate responded with JSON, it is a valid API endpoint.
        this.baseUrl = baseUrlCandidate;
        promoteApiBaseUrl(baseUrlCandidate);

        if (!response.ok) {
          const hint =
            parsedBody?.error?.details?.hint ||
            parsedBody?.details?.hint ||
            null;
          const apiMessage =
            parsedBody?.error?.message ||
            parsedBody?.error ||
            parsedBody?.message ||
            responsePreview;
          throw new ClientRequestError(
            "API_ERROR",
            `API Error ${response.status}: ${apiMessage}${hint ? ` (${hint})` : ""}`,
            {
              status: response.status,
              url,
              responsePreview,
              details: parsedBody,
            },
          );
        }

        return (parsedBody as T) ?? ({} as T);
      } catch (error) {
        lastError = error;
        if (IS_DEV) {
          console.error(`API request failed for ${url}:`, error);
        }

        if (!isRetriableCandidateError(error)) {
          throw error instanceof Error ? error : new Error(String(error));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("API request failed");
  }

  /** Like request() but attaches the stored Bearer token automatically. */
  private async authRequest<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
    return this.request<T>(endpoint, {
      ...options,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
  }

  /** Returns the raw health check JSON string. Useful for devtools / debugging. */
  async healthCheck(): Promise<string> {
    const response = await this.request<{ status: string; missingTables?: string[] }>("/health");
    return JSON.stringify(response);
  }

  async getRoute(waypoints: any[], avoiding: any[]) {
    const FEATURE_URL = "https://api.openrouteservice.org/v2/directions/wheelchair";
    const TOKEN = process.env.EXPO_PUBLIC_OPENROUTE_KEY || "";

    const res = await fetch(FEATURE_URL, {
      method: "post",
      headers: {
        Accept: "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
        Authorization: TOKEN,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        coordinates: waypoints,
        options: {
          avoid_polygons: {
            type: "MultiPolygon",
            coordinates: avoiding.map((poly) => [poly]),
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  }

  /** @deprecated Use getMe() instead — kept for the legacy useProfile hook. */
  async getProfile(id: number) {
    return this.request<Profile>(`/profiles?id=${id}`);
  }

  /** Convenience wrapper: returns the profile portion of /api/me, or null on any error. */
  async getMyProfile() {
    try {
      const me = await this.getMe();
      return (me?.profile as Profile | null) ?? null;
    } catch {
      return null;
    }
  }

  /** Returns the authenticated user, their profile row, and whether onboarding is complete. */
  async getMe(): Promise<{ user: any; profile: any; onboardingComplete?: boolean }> {
    return this.authRequest<{ user: any; profile: any; onboardingComplete?: boolean }>("/api/me");
  }

  /** Returns all POIs with location_geojson and metadata parsed from JSON strings. */
  async getPOIs() {
    const pois = await this.request<POIRaw[]>("/pois");
    return pois.map((poi) => ({
      ...poi,
      location_geojson:
        safeJsonParse<any>(poi.location_geojson as any) ??
        ({ type: "Point", coordinates: [0, 0] } as any),
      metadata: safeJsonParse<Record<string, any>>(poi.metadata as any),
    }));
  }

  /** Returns all avoidance areas with boundary_geojson parsed. Areas with unparseable geometry are filtered out. */
  async getAvoidanceAreas() {
    const areas = await this.request<AvoidanceAreaRaw[]>("/avoidance_areas");
    return areas
      .map((area) => {
        const boundary = safeJsonParse<any>(area.boundary_geojson as any);
        if (!boundary) return null;
        return {
          ...area,
          boundary_geojson: boundary,
        };
      })
      .filter(Boolean) as any;
  }

  /** Returns active construction/closed areas from the UT ArcGIS proxy as [{id, points, description?}]. */
  async getConstructionAreas() {
    return this.request<{ id: number; points: [number, number][]; description?: string }[]>("/construction_areas");
  }

  /** Returns a single avoidance area with parsed boundary_geojson. Throws if geometry is unparseable. */
  async getAvoidanceArea(id: string) {
    const area = await this.request<AvoidanceAreaDetailRaw>(`/avoidance_areas/${id}`);
    const boundary = safeJsonParse<any>(area.boundary_geojson as any);
    if (!boundary) {
      throw new Error("Avoidance area geometry could not be parsed");
    }
    return {
      ...area,
      boundary_geojson: boundary,
    };
  }

  /** Returns all reports/comments for an avoidance area. No auth required. */
  async getAvoidanceAreaReports(id: string) {
    return this.request<AvoidanceAreaReport[]>(`/avoidance_areas/${id}/reports`);
  }

  /** Create a new avoidance area. Requires student session token. */
  async insertAvoidanceArea(data: {
    name: string;
    description?: string;
    boundary_geojson: Polygon;
  }) {
    return this.authRequest<any>("/avoidance_areas", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /** Post a report/comment on an avoidance area. Requires student session token. */
  async insertAvoidanceAreaReport(data: {
    avoidance_area_id: string;
    title: string;
    description?: string;
  }) {
    return this.authRequest<any>(
      `/avoidance_areas/${data.avoidance_area_id}/reports`,
      {
        method: "POST",
        body: JSON.stringify({ title: data.title, description: data.description }),
      },
    );
  }

  /** Returns non-deleted reviews for a POI with features parsed from JSON string to string[]. */
  async getReviews(poi_id: number) {
    const reviews = await this.request<ReviewEntryRaw[]>(
      `/reviews?poi_id=${poi_id}`,
    );

    return reviews.map((review) => ({
      ...review,
      features: safeJsonParse<string[]>(review.features) ?? [],
    })) as ReviewEntry[];
  }

  /** Creates or updates a review for the given POI. Requires authenticated session. */
  async insertReview(data: {
    user_id: number;
    poi_id: number;
    rating: number;
    features?: string;
    content?: string;
  }) {
    return this.request<any>("/reviews", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /** Updates an existing review's rating, features, and/or content. Caller must be the review author. */
  async updateReview(
    id: number,
    data: {
      rating: number;
      poi_id?: number;
      features?: string;
      content?: string;
    },
  ) {
    return this.request<any>(`/reviews/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /** Soft-deletes a review (sets deleted_at). Caller must be the review author. */
  async deleteReview(id: number) {
    return this.request<any>(`/reviews/${id}/delete`, {
      method: "PUT",
    });
  }

  /** Creates or updates the caller's vote (+1 or -1) on a review. Requires completed profile. */
  async upsertVote(
    data: {
      review_id: number;
      vote: 1 | -1;
    },
  ) {
    return this.request<any>("/votes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /** Removes the caller's vote on a review. Requires completed profile. */
  async deleteVote(review_id: number) {
    return this.request<any>(`/votes/${review_id}`, {
      method: "DELETE",
    });
  }

  /** First-time profile setup (called from profile-setup.tsx). */
  async createProfile(data: {
    firstName: string;
    lastName: string;
    username: string;
    classYear?: string;
    major?: string;
    bio?: string;
  }) {
    return this.authRequest<{ success: boolean; profile: any }>("/api/profile", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /** Update an existing profile (called from profile.tsx or mobility-preferences.tsx). */
  async updateProfile(data: {
    displayName?: string;
    classYear?: string;
    major?: string;
    bio?: string;
    mobilityPreference?: string;
    onboardingComplete?: boolean;
  }) {
    return this.authRequest<{ success: boolean; profile: any }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /** Public profile by username - no auth needed. */
  async getPublicProfile(username: string) {
    return this.request<{ user: any; profile: any }>(`/api/users/${username}`);
  }

  async resolveRampPOI(data: {
    externalKey: string;
    latitude: number;
    longitude: number;
    buildingAbbr?: string;
    buildingName?: string;
  }) {
    return this.request<any>("/pois/ramp/resolve", {
      method: "POST",
      body: JSON.stringify({
        external_key: data.externalKey,
        latitude: data.latitude,
        longitude: data.longitude,
        building_abbr: data.buildingAbbr,
        building_name: data.buildingName,
      }),
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient(
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:54321",
);

