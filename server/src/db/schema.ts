import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Verification db schemas

// Users table
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

// Session table (Better Auth required)
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

// Account table (Better Auth required - for OAuth providers)
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

// Verification table (Better Auth required)
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

// profile tables

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

    created_at: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),

    updated_at: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
});

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

export const avoidance_areas = sqliteTable('avoidance_areas', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: text('user_id')
        .notNull()
        .references(() => users.id),
    name: text('name').notNull(),
    description: text('description'),
    boundary_geojson: text('boundary_geojson').notNull(),
    created_at: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
    updated_at: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
});

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