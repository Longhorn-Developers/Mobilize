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

const SESSION_TOKEN_KEY = "auth_session_token";
const IS_DEV = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

const safeJsonParse = <T>(value: string | null | undefined): T | null => {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = (baseUrl || "http://localhost:54321").replace(/\/+$/, "");
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    const token = await AsyncStorage.getItem("auth_session_token");
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options?.headers,
        },
      });

      const text = await response.text();
      const responsePreview =
        text.slice(0, 120) || response.statusText || "Empty response body";

      if (IS_DEV) {
        console.log("API URL:", url);
        console.log("STATUS:", response.status);
        console.log("RESPONSE PREVIEW:", responsePreview);
      }

      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      const parsedBody = isJson ? safeJsonParse<any>(text) : null;

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
        throw new Error(
          `API Error ${response.status}: ${apiMessage}${hint ? ` (${hint})` : ""}`,
        );
      }

      if (!isJson) {
        throw new Error(
          `Non-JSON response (${response.status} ${response.statusText}): ${responsePreview}`
        );
      }

      return (parsedBody as T) ?? ({} as T);
    } catch (error) {
      console.error(`API request failed for ${url}:`, error);
      throw error;
    }
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

  // Health check
  async healthCheck(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/health`);
    return await response.text();
  }

  async getRoute(waypoints: any[], avoiding: any[]) {
    const FEATURE_URL = "https://api.openrouteservice.org/v2/directions/wheelchair";
    const TOKEN = process.env.EXPO_PUBLIC_OPENROUTE_KEY || "";

    const res = await fetch(FEATURE_URL, {
      method: "post",
      headers: {
        'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
        'Authorization': TOKEN,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        "coordinates": waypoints,
        "options": {
          "avoid_polygons": {
            "type": "MultiPolygon",
            "coordinates": avoiding.map((poly) => [poly]),
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  }

  // Get profile by ID (legacy — used by useProfile hook)
  async getProfile(id: number) {
    return this.request<Profile>(`/profiles?id=${id}`);
  }

  // Get current active profile
  async getMyProfile() {
    try {
      const me = await this.getMe();
      return (me?.profile as Profile | null) ?? null;
    } catch {
      return null;
    }
  }

  // Get the current user + profile from /api/me
  async getMe(): Promise<{ user: any; profile: any; onboardingComplete?: boolean }> {
    return this.authRequest<{ user: any; profile: any; onboardingComplete?: boolean }>("/api/me");
  }

  // Get all POIs
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

  // Get all avoidance areas
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

  // fetch construction areas (proxied through server to avoid mobile network issues)
  async getConstructionAreas() {
    return this.request<{ id: number; points: [number, number][] }[]>("/construction_areas");
  }

  // Get single avoidance area by ID
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

  // Get reports for a specific avoidance area
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

  // Get reviews list by POI ID
  async getReviews(poi_id: number) {
    const reviews = await this.request<ReviewEntryRaw[]>(
      `/reviews?poi_id=${poi_id}`,
    );

    return reviews.map((review) => ({
      ...review,
      features: safeJsonParse<string[]>(review.features) ?? [],
    })) as ReviewEntry[];
  }

  // Create a new review
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

  // Update an existing review
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

  // Soft delete an existing review
  async deleteReview(id: number) {
    return this.request<any>(`/reviews/${id}/delete`, {
      method: "PUT",
    });
  }

  // Upsert a vote on a review
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

  // Delete a vote from a review
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
    isAnonymous?: boolean;
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
    isAnonymous?: boolean;
    onboardingComplete?: boolean;
  }) {
    return this.authRequest<{ success: boolean; profile: any }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /** Public profile by username — no auth needed. */
  async getPublicProfile(username: string) {
    return this.request<{ user: any; profile: any }>(`/api/users/${username}`);
  }
}

// Export singleton instance
export const apiClient = new ApiClient(
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:54321"
);
