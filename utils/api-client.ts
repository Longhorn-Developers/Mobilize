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

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
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
    } catch (error) {
      console.error(`API request failed for ${url}:`, error);
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/health`);
    return await response.text();
  }

  // Get profile by ID
  async getProfile(id: number) {
    return this.request<Profile>(`/profiles?id=${id}`);
  }

  // Get reviews list by POI ID
  async getReviews(poi_id: number) {
    const reviews = await this.request<ReviewEntryRaw[]>(
      `/reviews?poi_id=${poi_id}`,
    );

    return reviews.map((review) => ({
      ...review,
      features: review.features ? JSON.parse(review.features) : [],
    })) as ReviewEntry[];
  }

  // Get all POIs
  async getPOIs() {
    const pois = await this.request<POIRaw[]>("/pois");
    // Parse the location_geojson string to JSON
    return pois.map((poi) => ({
      ...poi,
      location_geojson: JSON.parse(poi.location_geojson),
      metadata: poi.metadata ? JSON.parse(poi.metadata) : null,
    }));
  }

  // Get all avoidance areas
  async getAvoidanceAreas() {
    const areas = await this.request<AvoidanceAreaRaw[]>(
      "/avoidance_areas", 
      { headers: { "Accept": "application/json" } }
    );

    // Parse the boundary_geojson string to JSON
    return areas.map((area) => ({
      ...area,
      boundary_geojson: JSON.parse(area.boundary_geojson),
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
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const json = await res.json();
      if (json.error) throw new Error(`UH OHH ARCGIS ERROR: ${JSON.stringify(json.error)}`);
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

      if (Number.isFinite(g.x) && Number.isFinite(g.y)) {
        const lat = Number(g.y), lon = Number(g.x);
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        }
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
      console.error("UH OHHH UNHANDLED PARSING ERROR", err.message);
    }

    
  }

  // Get single avoidance area by ID with profile info
  async getAvoidanceArea(id: string) {
    const area = await this.request<AvoidanceAreaDetailRaw>(
      `/avoidance_areas/${id}`,
    );
    return {
      ...area,
      boundary_geojson: JSON.parse(area.boundary_geojson),
    };
  }

  

  // Get reports for a specific avoidance area
  async getAvoidanceAreaReports(id: string) {
    return this.request<AvoidanceAreaReport[]>(
      `/avoidance_areas/${id}/reports`,
    );
  }

  async insertAvoidanceArea(data: {
    user_id: number;
    name: string;
    description?: string;
    boundary_geojson: Polygon;
  }) {
    return this.request<any>("/avoidance_areas", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async insertAvoidanceAreaReport(data: {
    user_id: number;
    avoidance_area_id: string;
    title: string;
    description?: string;
  }) {
    return this.request<any>(
      `/avoidance_areas/${data.avoidance_area_id}/reports`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
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
}

// Export singleton instance
export const apiClient = new ApiClient(
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:54321",
);
