import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { avoidance_areas, pois, profiles, avoidance_area_reports } from './db/schema';

export interface Env {
	staging_mobilize_db: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

// Health check route
app.get('/health', (c) => {
	return c.text('OK');
});

// GET profiles by id
app.get('/profiles', async (c) => {
	const db = drizzle(c.env.staging_mobilize_db);
	const profileId = c.req.query('id');

	if (!profileId) {
		return c.text('Profile ID is required', 400);
	}

	const profile = await db
		.select()
		.from(profiles)
		.where(eq(profiles.id, Number(profileId)))
		.get();

	if (!profile) {
		return c.text('Profile not found', 404);
	}

	return c.json(profile);
});

// GET pois
app.get('/pois', async (c) => {
	const db = drizzle(c.env.staging_mobilize_db);
	const pois_result = await db.select().from(pois).all();
	return c.json(pois_result);
});

// GET avoidance_areas
app.get('/avoidance_areas', async (c) => {
	const db = drizzle(c.env.staging_mobilize_db);
	const avoidance_areas_result = await db.select().from(avoidance_areas).all();
	return c.json(avoidance_areas_result);
});

// GET single avoidance_area by id with profile info
app.get('/avoidance_areas/:id', async (c) => {
	const db = drizzle(c.env.staging_mobilize_db);
	const areaId = c.req.param('id');

	if (!areaId) {
		return c.text('Area ID is required', 400);
	}

	const area = await db
		.select({
			id: avoidance_areas.id,
			user_id: avoidance_areas.user_id,
			name: avoidance_areas.name,
			description: avoidance_areas.description,
			boundary_geojson: avoidance_areas.boundary_geojson,
			created_at: avoidance_areas.created_at,
			updated_at: avoidance_areas.updated_at,
			profile_display_name: profiles.display_name,
			profile_avatar_url: profiles.avatar_url,
		})
		.from(avoidance_areas)
		.leftJoin(profiles, eq(avoidance_areas.user_id, profiles.id))
		.where(eq(avoidance_areas.id, Number(areaId)))
		.get();

	if (!area) {
		return c.text('Area not found', 404);
	}

	return c.json(area);
});

// GET reports for a specific avoidance area
app.get('/avoidance_areas/:id/reports', async (c) => {
	const db = drizzle(c.env.staging_mobilize_db);
	const areaId = c.req.param('id');

	if (!areaId) {
		return c.text('Area ID is required', 400);
	}

	const reports = await db
		.select({
			id: avoidance_area_reports.id,
			user_id: avoidance_area_reports.user_id,
			description: avoidance_area_reports.description,
			title: avoidance_area_reports.title,
			created_at: avoidance_area_reports.created_at,
			updated_at: avoidance_area_reports.updated_at,
			profile_display_name: profiles.display_name,
		})
		.from(avoidance_area_reports)
		.leftJoin(profiles, eq(avoidance_area_reports.user_id, profiles.id))
		.where(eq(avoidance_area_reports.avoidance_area_id, Number(areaId)))
		.all();

	return c.json(reports);
});

export default app;
