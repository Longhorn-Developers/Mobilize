import { Polygon, Point } from "geojson";

import type {
  profiles,
  pois,
  avoidance_areas,
  avoidance_area_reports,
  reviews,
} from "~/server/src/db/schema";

// ── Raw DB types (direct Drizzle inference) ─────────────────────────────────
export type Profile = typeof profiles.$inferSelect;
/** Row as returned directly from the reviews table. `features` is a JSON string. */
export type ReviewFromDb = typeof reviews.$inferSelect;
export type POIRaw = typeof pois.$inferSelect;
export type AvoidanceAreaRaw = typeof avoidance_areas.$inferSelect;
export type AvoidanceAreaReportRaw = typeof avoidance_area_reports.$inferSelect;

// Legacy alias — prefer ReviewFromDb in new code.
export type ReviewRaw = ReviewFromDb;

// ── UI-ready types (parsed/joined) ───────────────────────────────────────────

/** Review with `features` parsed from JSON string to string[]. */
export interface ReviewForUI extends Omit<ReviewFromDb, "features"> {
  features: string[];
}

// Legacy alias — prefer ReviewForUI in new code.
export type Review = ReviewForUI;

/**
 * Avoidance area joined with the creator's profile display fields.
 * Note: avoidance_area_reports.user_id → users.id (text),
 *       so the join goes through profiles.user_id, not profiles.id.
 */
export type AvoidanceAreaWithProfile = AvoidanceAreaRaw & {
  profile_display_name: string | null;
  profile_avatar_url: string | null;
};

// Legacy alias — prefer AvoidanceAreaWithProfile in new code.
export type AvoidanceAreaDetailRaw = AvoidanceAreaWithProfile;

export type AvoidanceAreaReport = typeof avoidance_area_reports.$inferSelect & {
  profile_display_name?: string | null;
  profile_avatar_url?: string | null;
};

/** Review row joined with profile display fields and aggregated vote data. */
export type ReviewEntryRaw = ReviewFromDb & {
  profile_display_name: string;
  profile_avatar_url: string;
  vote_count: number;
  user_vote: number | null;
};

/** ReviewEntryRaw with `features` parsed to string[]. Ready for UI rendering. */
export interface ReviewEntry extends Omit<ReviewEntryRaw, "features"> {
  features: string[];
}

/** Shape returned by the /api/me endpoint. */
export interface ProfileWithUser {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    username: string | null;
    role: string;
  };
  profile: Profile | null;
  onboardingComplete: boolean;
}

// Parsed types (with GeoJSON fields as objects)
export interface POI extends Omit<POIRaw, "location_geojson" | "metadata"> {
  location_geojson: Point;
  metadata: Record<string, any> | null;
}

export interface AvoidanceArea
  extends Omit<AvoidanceAreaRaw, "boundary_geojson"> {
  boundary_geojson: Polygon;
}
