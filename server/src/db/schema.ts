import { sqliteTable, text, integer, index, unique, blob } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Database schema for MobilizeUT.
 *
 * FK design notes:
 *  - reviews.user_id  → profiles.id  (integer PK): reviews are authored by campus profiles
 *  - votes.user_id    → profiles.id  (integer PK): votes are cast by campus profiles
 *  - avoidance_areas.user_id          → users.id (text PK): area ownership lives on the auth user
 *  - avoidance_area_reports.user_id   → users.id (text PK): report authorship same reasoning
 *  The avoidance-area routes bridge this by LEFT JOINing profiles on profiles.user_id.
 *
 * Note on pois.location_geojson unique constraint:
 *  The poi-sync scheduled task relies on this column as the ON CONFLICT target for upserts.
 *  It assumes JSON.stringify produces identical output for the same KML geometry across runs.
 *  If coordinate precision or property order ever varies between fetches, duplicate POIs can be
 *  created. A more robust key would be a deduplicated external_key from the KML feature ID.
 */

/** Auth users managed by Better Auth. role is "public" (default) or "student" (@utexas.edu email). username is set during profile-setup onboarding. */
export const users = sqliteTable("user", {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }),
    image: text("image"),
    
    username: text("username").unique(),
    role: text("role").default("public"), // "public" | "student"
    
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
});

/** Bearer-token sessions. The `token` column is what the mobile client stores in AsyncStorage and sends as "Authorization: Bearer <token>". */
export const session = sqliteTable("session", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
});

/** OAuth provider link table required by Better Auth. Stores Google access/refresh tokens per user. */
export const account = sqliteTable("account", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
});

/** Email verification tokens required by Better Auth (not actively used — Google OAuth is the only auth path). */
export const verification = sqliteTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .default(sql`(unixepoch())`),
});

/**
 * Campus-facing profile for each user (created during onboarding).
 * Uses a separate auto-increment integer PK (`id`) so that reviews and votes can
 * reference it without embedding the auth user's UUID in every row.
 * `user_id` is a unique FK back to users.id.
 */
export const profiles = sqliteTable("profiles", {
    id: integer("id").primaryKey({ autoIncrement: true }),

    user_id: text("user_id")
        .notNull()
        .references(() => users.id)
        .unique(),

    display_name: text("display_name").notNull(),
    avatar_url: text("avatar_url"),

    class_year: text("class_year"),
    major: text("major"),
    bio: text("bio"),

    mobility_preference: text("mobility_preference"), // "walking" | "wheelchair" | "cane" | "other"

    is_anonymous: integer("is_anonymous", { mode: "boolean" }).notNull().default(false),
    onboarding_completed_at: integer("onboarding_completed_at", { mode: "timestamp" }),

    created_at: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),

    updated_at: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
});

/**
 * Accessibility reviews submitted by campus profiles.
 * `features` is stored as a JSON string (string[] of feature tag IDs).
 * Soft-deleted via `deleted_at`; hard deletes are not used.
 * `poi_id` cascades on POI delete so orphaned reviews are never left behind.
 */
export const reviews = sqliteTable('reviews', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	user_id: integer('user_id')
		.notNull()
		.references(() => profiles.id),
	rating: integer('rating').notNull(),
	features: text('features'),
	content: text('content'),
	poi_id: integer('poi_id')
		.notNull()
		.references(() => pois.id, { onDelete: "cascade" }),
	created_at: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updated_at: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
		.$onUpdate(() => new Date()),
	deleted_at: integer('deleted_at', { mode: 'timestamp' })
},
(table) => [
	index('poi_deleted_idx').on(table.poi_id, table.deleted_at),
    index('reviews_user_poi_deleted_idx').on(table.user_id, table.poi_id, table.deleted_at),
]);

/** Upvotes/downvotes (+1/-1) on reviews. One vote per (user, review) pair enforced by unique constraint. */
export const votes = sqliteTable('votes', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: integer('user_id').notNull().references(() => profiles.id),
    review_id: integer('review_id').notNull().references(() => reviews.id, { onDelete: "cascade" }),
    vote: integer('vote').notNull(),
},
(table) => [
    unique().on(table.user_id, table.review_id),
]);

/**
 * Points of Interest — accessibility features on campus (ramps, auto doors, etc.).
 * `poi_type`: "ramp" | "auto_door" | "manual_door" — drives the map icon and filter logic.
 * `metadata`: JSON blob with source-specific fields (external_key, bld_name, floor, etc.).
 * `location_geojson`: GeoJSON Point stored as a JSON string; unique constraint used as upsert key by poi-sync.
 */
export const pois = sqliteTable('pois', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    poi_type: text('poi_type').notNull(),
    metadata: text('metadata'),
    location_geojson: text('location_geojson').notNull().unique(),
    created_at: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
    updated_at: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
});

/**
 * User-reported zones to avoid (construction, broken elevators, etc.).
 * `boundary_geojson`: GeoJSON Polygon stored as JSON string.
 * References users.id (not profiles.id) because area ownership is tied to the auth identity,
 * not the campus profile.
 */
export const avoidance_areas = sqliteTable('avoidance_areas', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: text('user_id')
        .notNull()
        .references(() => users.id),
    name: text('name').notNull(),
    description: text('description'),
    boundary_geojson: text('boundary_geojson').notNull(),
    images: text('images'),
    created_at: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
    updated_at: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
});

/**
 * Follow-up reports/comments on an avoidance area (e.g. "still blocked as of today").
 * Also references users.id for the same reason as avoidance_areas.
 */
export const avoidance_area_reports = sqliteTable('avoidance_area_reports', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: text('user_id')
        .notNull()
        .references(() => users.id),
    avoidance_area_id: integer('avoidance_area_id')
        .notNull()
        .references(() => avoidance_areas.id),
    title: text('title').notNull(),
    description: text('description'),
    created_at: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
    updated_at: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
});
