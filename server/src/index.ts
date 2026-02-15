import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, getTableColumns } from 'drizzle-orm';
import { avoidance_areas, pois, profiles, avoidance_area_reports } from './db/schema';
import { syncPOIs } from './scheduled/poi-sync';

export interface Env {
	mobilize_db: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

// Health check route
app.get('/health', (c) => {
	return c.text('OK');
});

// GET profiles by id
app.get('/profiles', async (c) => {
	const db = drizzle(c.env.mobilize_db);
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

// GET all pois
// GET all pois
app.get('/pois', async (c) => {
    const db = drizzle(c.env.mobilize_db);
    const pois_result = await db.select().from(pois).all();
    console.log(`[API] GET /pois - Returning ${pois_result.length} POIs`);
    return c.json(pois_result);
});

// POST manually trigger POI sync (for debugging/testing)
app.post('/pois/sync', async (c) => {
    try {
        console.log('[API] POST /pois/sync - Starting manual POI sync');
        await syncPOIs(c.env);
        return c.json({ success: true, message: 'POI sync completed' });
    } catch (error) {
        console.error('[API] Error syncing POIs:', error);
        return c.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        }, 500);
    }
});

// GET all avoidance_areas
app.get('/avoidance_areas', async (c) => {
	const db = drizzle(c.env.mobilize_db);
	const avoidance_areas_result = await db.select().from(avoidance_areas).all();
	return c.json(avoidance_areas_result);
});

// GET single avoidance_area by id with profile info
app.get('/avoidance_areas/:id', async (c) => {
	const db = drizzle(c.env.mobilize_db);
	const areaId = Number(c.req.param('id'));

	if (isNaN(areaId)) {
		return c.text('Invalid Area ID', 400);
	}

	const area = await db
		.select({
			...getTableColumns(avoidance_areas),
			profile_display_name: profiles.display_name,
			profile_avatar_url: profiles.avatar_url,

		})
		.from(avoidance_areas)
		.leftJoin(profiles, eq(avoidance_areas.user_id, profiles.id))
		.where(eq(avoidance_areas.id, areaId))
		.get();

	if (!area) {
		return c.text('Area not found', 404);
	}

	return c.json(area);
});

// GET reports for a specific avoidance area id
app.get('/avoidance_areas/:id/reports', async (c) => {
	const db = drizzle(c.env.mobilize_db);
	const areaId = c.req.param('id');

	if (!areaId) {
		return c.text('Area ID is required', 400);
	}

	const reports = await db
		.select({
			...getTableColumns(avoidance_area_reports),
			profile_display_name: profiles.display_name,
		})
		.from(avoidance_area_reports)
		.leftJoin(profiles, eq(avoidance_area_reports.user_id, profiles.id))
		.where(eq(avoidance_area_reports.avoidance_area_id, Number(areaId)))
		.all();

	return c.json(reports);
});

// POST insert new avoidance area
app.post('/avoidance_areas', async (c) => {
	const db = drizzle(c.env.mobilize_db);

	let body;
	try {
		body = await c.req.json();
	} catch (e) {
		console.error('Error parsing JSON body:', e);
		return c.text('Invalid JSON body', 400);
	}

	const { user_id, name, description, boundary_geojson } = body;

	if (!user_id || !name || !boundary_geojson) {
		return c.text('Missing required fields', 400);
	}

	const result = await db
		.insert(avoidance_areas)
		.values({
			user_id,
			name,
			description: description || null,
			boundary_geojson: JSON.stringify(boundary_geojson),
		})
		.returning();

	return c.json(result);
});

// POST insert new avoidance area report
app.post('/avoidance_areas/:id/reports', async (c) => {
	const db = drizzle(c.env.mobilize_db);
	const areaId = Number(c.req.param('id'));

	if (isNaN(areaId)) {
		return c.text('Invalid Area ID', 400);
	}

	let body;
	try {
		body = await c.req.json();
	} catch (e) {
		console.error('Error parsing JSON body:', e);
		return c.text('Invalid JSON body', 400);
	}

	const { user_id, title, description } = body;

	if (!user_id || !title) {
		return c.text('Missing required fields', 400);
	}

	const result = await db
		.insert(avoidance_area_reports)
		.values({
			user_id,
			avoidance_area_id: areaId,
			title,
			description
		})
		.returning();

	return c.json(result);
});

export default {
	fetch: app.fetch,
	// Scheduled handler for cron triggers
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`Cron trigger fired at ${new Date(event.scheduledTime).toISOString()}`);

		// Run the POI sync
		ctx.waitUntil(syncPOIs(env));
	},
};
