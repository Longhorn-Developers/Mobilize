// Cloudflare D1 Database Types
// Generated types for the migrated database schema

export interface Database {
  profiles: {
    Row: {
      id: string;
      email: string;
      display_name: string | null;
      avatar_url: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id: string;
      email: string;
      display_name?: string | null;
      avatar_url?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      email?: string;
      display_name?: string | null;
      avatar_url?: string | null;
      created_at?: string;
      updated_at?: string;
    };
  };
  
  user_navigation_preferences: {
    Row: {
      id: string;
      user_id: string | null;
      avoid_areas: boolean | null;
      gradient_tolerance: number | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      user_id?: string | null;
      avoid_areas?: boolean | null;
      gradient_tolerance?: number | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      user_id?: string | null;
      avoid_areas?: boolean | null;
      gradient_tolerance?: number | null;
      created_at?: string;
      updated_at?: string;
    };
  };
  
  user_common_locations: {
    Row: {
      id: number;
      user_id: string | null;
      label: string;
      location_json: string;
      created_at: string;
      updated_at: string | null;
    };
    Insert: {
      id?: number;
      user_id?: string | null;
      label: string;
      location_json: string;
      created_at?: string;
      updated_at?: string | null;
    };
    Update: {
      id?: number;
      user_id?: string | null;
      label?: string;
      location_json?: string;
      created_at?: string;
      updated_at?: string | null;
    };
  };
  
  avoidance_areas: {
    Row: {
      id: string;
      user_id: string | null;
      name: string | null;
      boundary_json: string;
      description: string | null;
      created_at: string;
      updated_at: string | null;
    };
    Insert: {
      id?: string;
      user_id?: string | null;
      name?: string | null;
      boundary_json: string;
      description?: string | null;
      created_at?: string;
      updated_at?: string | null;
    };
    Update: {
      id?: string;
      user_id?: string | null;
      name?: string | null;
      boundary_json?: string;
      description?: string | null;
      created_at?: string;
      updated_at?: string | null;
    };
  };
  
  avoidance_area_reports: {
    Row: {
      id: string;
      avoidance_area_id: string | null;
      user_id: string | null;
      title: string | null;
      description: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      avoidance_area_id?: string | null;
      user_id?: string | null;
      title?: string | null;
      description?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      avoidance_area_id?: string | null;
      user_id?: string | null;
      title?: string | null;
      description?: string | null;
      created_at?: string;
      updated_at?: string;
    };
  };
  
  pois: {
    Row: {
      id: string;
      poi_type: 'accessible_entrance';
      metadata: string;
      location_json: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      poi_type: 'accessible_entrance';
      metadata: string;
      location_json: string;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      poi_type?: 'accessible_entrance';
      metadata?: string;
      location_json?: string;
      created_at?: string;
      updated_at?: string;
    };
  };
}

export type Tables<T extends keyof Database> = Database[T]['Row'];
export type TablesInsert<T extends keyof Database> = Database[T]['Insert'];
export type TablesUpdate<T extends keyof Database> = Database[T]['Update'];

// Helper types for common operations
export type Profile = Tables<'profiles'>;
export type AvoidanceArea = Tables<'avoidance_areas'>;
export type AvoidanceAreaReport = Tables<'avoidance_area_reports'>;
export type POI = Tables<'pois'>;
export type UserCommonLocation = Tables<'user_common_locations'>;
export type UserNavigationPreferences = Tables<'user_navigation_preferences'>;

// GeoJSON types for location data
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface LocationData {
  lat: number;
  lng: number;
}

export interface POIMetadata {
  name?: string | null;
  bld_name?: string | null;
  floor?: number | null;
  auto_opene: boolean;
}
