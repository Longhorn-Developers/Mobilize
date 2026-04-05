import AsyncStorage from "@react-native-async-storage/async-storage";
import { Polygon } from "geojson";

import {
  Profile,
  POIRaw,
  AvoidanceAreaRaw,
  AvoidanceAreaDetailRaw,
  AvoidanceAreaReport,
} from "~/types/database";

const SESSION_TOKEN_KEY = "auth_session_token";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
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

  // Get profile by ID (legacy — used by useProfile hook)
  async getProfile(id: number) {
    return this.request<Profile>(`/profiles?id=${id}`);
  }

  // Get the current user + profile from /api/me
  async getMe(): Promise<{ user: any; profile: any }> {
    return this.authRequest<{ user: any; profile: any }>("/api/me");
  }

  // Get all POIs
  async getPOIs() {
    const pois = await this.request<POIRaw[]>("/pois");
    return pois.map((poi) => ({
      ...poi,
      location_geojson: JSON.parse(poi.location_geojson as any),
      metadata: poi.metadata ? JSON.parse(poi.metadata as any) : null,
    }));
  }

  // Get all avoidance areas
  async getAvoidanceAreas() {
    const areas = await this.request<AvoidanceAreaRaw[]>("/avoidance_areas");
    return areas.map((area) => ({
      ...area,
      boundary_geojson: JSON.parse(area.boundary_geojson as any),
    }));
  }

  // fetch construction areas
  async getConstructionAreas() {
    const FEATURE_URL = "https://services9.arcgis.com/w9x0fkENXvuWZY26/arcgis/rest/services/Closed_Areas_view_new/FeatureServer/0/query";
    const TOKEN = process.env.ARCGIS_TOKEN || null;
    const PAGE_SIZE = 8000;

    function buildUrl(offset = 0) {
      const u = new URL(FEATURE_URL);
      const p = u.searchParams;
      p.set("f", "json");
      p.set("where", "1=1");
      p.set("returnGeometry", "true");
      p.set("outFields", "OBJECTID");
      p.set("orderByFields", "OBJECTID ASC");
      p.set("outSR", "4326");
      p.set("resultOffset", String(offset));
      p.set("resultRecordCount", String(PAGE_SIZE));
      p.set("cacheHint", "true");
      if (TOKEN) p.set("token", TOKEN);
      return u.toString();
    }

    async function fetchPage(offset: number) {
      const url = buildUrl(offset);
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const json = await res.json();
      if (json.error) throw new Error(`ArcGIS error: ${JSON.stringify(json.error)}`);
      return json;
    }

    async function fetchAll() {
      let offset = 0;
      const all = [];
      for (;;) {
        const page = await fetchPage(offset);
        const feats = page.features ?? [];
        all.push(...feats);
        const more = page.exceededTransferLimit === true || feats.length === PAGE_SIZE;
        if (!more || feats.length === 0) break;
        offset += feats.length;
      }
      return all;
    }

    function convertFeature(f: any, idx: number) {
      const attrs = f.attributes ?? {};
      const id = attrs.OBJECTID ?? f.objectId ?? idx;
      const g = f.geometry ?? {};
      if (Array.isArray(g.rings) && g.rings.length) {
        const ring = g.rings[0];
        const pts = ring
          .map(([x, y]: [number, number]) => [Number(y), Number(x)])
          .filter(([lat, lon]: [number, number]) =>
            Number.isFinite(lat) && Number.isFinite(lon) &&
            lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
          );
        if (pts.length >= 2) return { id, points: pts };
        return null;
      }
      if (Array.isArray(g.paths) && g.paths.length) {
        const path = g.paths[0];
        const pts = path
          .map(([x, y]: [number, number]) => [Number(y), Number(x)])
          .filter(([lat, lon]: [number, number]) =>
            Number.isFinite(lat) && Number.isFinite(lon) &&
            lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
          );
        if (pts.length >= 2) return { id, points: pts };
        return null;
      }
      return null;
    }

    try {
      const feats = await fetchAll();
      const rows = [];
      for (let i = 0; i < feats.length; i++) {
        const rec = convertFeature(feats[i], i);
        if (rec) rows.push(rec);
      }
      return rows;
    } catch (err: any) {
      console.error("[constructionAreas] fetch failed:", err.message);
      return [];
    }
  }

  // Get single avoidance area by ID
  async getAvoidanceArea(id: string) {
    const area = await this.request<AvoidanceAreaDetailRaw>(`/avoidance_areas/${id}`);
    return {
      ...area,
      boundary_geojson: JSON.parse(area.boundary_geojson as any),
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
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:54321",
);
