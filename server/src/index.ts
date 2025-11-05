import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { avoidance_areas, pois, profiles } from './db/schema';

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

export default app;
