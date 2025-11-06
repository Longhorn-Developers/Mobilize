import { Polygon } from "geojson";
import { Profile, POIRaw, AvoidanceAreaRaw, AvoidanceAreaDetailRaw, AvoidanceAreaReport } from "~/types/database";

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
}

// Export singleton instance
export const apiClient = new ApiClient(
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:54321",
);
