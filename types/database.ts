import { Polygon, Point } from "geojson";

import type {
  profiles,
  pois,
  avoidance_areas,
  avoidance_area_reports,
  reviews,
} from "~/server/src/db/schema";

// Use Drizzle's inferred types
export type Profile = typeof profiles.$inferSelect;
export type ReviewRaw = typeof reviews.$inferSelect;
export type POIRaw = typeof pois.$inferSelect;
export type AvoidanceAreaRaw = typeof avoidance_areas.$inferSelect;
export type AvoidanceAreaReportRaw = typeof avoidance_area_reports.$inferSelect;

export interface Review extends Omit<ReviewRaw, "features"> {
  features: string[];
}

// Extended types for joined queries
export type AvoidanceAreaDetailRaw = AvoidanceAreaRaw & {
  profile_display_name: string | null;
  profile_avatar_url: string | null;
};

export type AvoidanceAreaReport = typeof avoidance_area_reports.$inferSelect & {
  profile_display_name?: string | null;
  profile_avatar_url?: string | null;
};

// Parsed types (with GeoJSON fields as objects)
export interface POI extends Omit<POIRaw, "location_geojson" | "metadata"> {
  location_geojson: Point;
  metadata: Record<string, any> | null;
}

export interface AvoidanceArea
  extends Omit<AvoidanceAreaRaw, "boundary_geojson"> {
  boundary_geojson: Polygon;
}
