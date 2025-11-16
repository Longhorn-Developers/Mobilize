import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable("users", {
	id: integer("id").primaryKey({ autoIncrement: true }),

	email: text("email").notNull().unique(),
	username: text("username").notNull().unique(),

	auth_provider: text("auth_provider").notNull(), // "google" | "ut_sso"
	role: text("role").notNull(), // "public" | "student"

	created_at: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),

	updated_at: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

export const profiles = sqliteTable("profiles", {
	id: integer("id").primaryKey({ autoIncrement: true }),

	user_id: integer("user_id")
		.notNull()
		.references(() => users.id)
		.unique(),

	display_name: text("display_name").notNull(), // previously `name`
	avatar_url: text("avatar_url"),

	class_year: text("class_year"),
	major: text("major"),
	bio: text("bio"),

	mobility_incline: text("mobility_incline"),
	mobility_arm_range: text("mobility_arm_range"),

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
	user_id: integer('user_id')
		.notNull()
		.references(() => profiles.id),
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
	user_id: integer('user_id')
		.notNull()
		.references(() => profiles.id),
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
