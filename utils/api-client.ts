// API Client for Hono Backend
// Configuration for local development and production

const API_BASE_URL = __DEV__
  ? "http://localhost:1234" // Local Wrangler dev server
  : "https://mobilize-ut.workers.dev"; // Replace with your production Worker URL

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
      console.error(`API request failed for ${endpoint}:`, error);
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
    const areas = await this.request<AvoidanceAreaRaw[]>("/avoidance_areas");
    // Parse the boundary_geojson string to JSON
    return areas.map((area) => ({
      ...area,
      boundary_geojson: JSON.parse(area.boundary_geojson),
    }));
  }

  // Get single avoidance area by ID with profile info
  async getAvoidanceArea(id: number) {
    const area = await this.request<AvoidanceAreaDetailRaw>(
      `/avoidance_areas/${id}`,
    );
    return {
      ...area,
      boundary_geojson: JSON.parse(area.boundary_geojson),
    };
  }

  // Get reports for a specific avoidance area
  async getAvoidanceAreaReports(id: number) {
    return this.request<AvoidanceAreaReport[]>(
      `/avoidance_areas/${id}/reports`,
    );
  }
}

// Type definitions based on the schema
export interface Profile {
  id: number;
  display_name: string;
  avatar_url: string | null;
}

// Raw types (as returned from API with stringified JSON)
interface POIRaw {
  id: number;
  poi_type: string;
  metadata: string | null;
  location_geojson: string;
  created_at: string;
  updated_at: string;
}

interface AvoidanceAreaRaw {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  boundary_geojson: string;
  created_at: string;
  updated_at: string;
}

interface AvoidanceAreaDetailRaw extends AvoidanceAreaRaw {
  profile_display_name: string | null;
  profile_avatar_url: string | null;
}

// Parsed types (with JSON objects)
export interface POI {
  id: number;
  poi_type: string;
  metadata: any;
  location_geojson: {
    type: string;
    coordinates: [number, number];
  };
  created_at: string;
  updated_at: string;
}

export interface AvoidanceArea {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  boundary_geojson: {
    type: string;
    coordinates: [number, number][][];
  };
  created_at: string;
  updated_at: string;
}

export interface AvoidanceAreaDetail extends AvoidanceArea {
  profile_display_name: string | null;
  profile_avatar_url: string | null;
}

export interface AvoidanceAreaReport {
  id: number;
  user_id: number;
  description: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  profile_display_name: string | null;
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);
