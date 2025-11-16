import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, getTableColumns } from 'drizzle-orm';
import { avoidance_areas, pois, profiles, avoidance_area_reports, users } from './db/schema';
import { syncPOIs } from './scheduled/poi-sync';
import { createAuth } from './auth';

export interface Env {
	mobilize_db: D1Database;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
}

const app = new Hono<{ Bindings: Env }>();

// Initialize Better Auth
let auth: ReturnType<typeof createAuth> | null = null;

function getAuth(env: Env) {
	if (!auth) {
		auth = createAuth(env);
	}
	return auth;
}

// Mount Better Auth routes
app.all('/api/auth/*', async (c) => {
	const authInstance = getAuth(c.env);
	return await authInstance.handler(c.req.raw);
});

// Health check route
app.get('/health', (c) => {
	return c.text('OK');
});

// Auth status endpoint
app.get('/api/auth/me', async (c) => {
	const authInstance = getAuth(c.env);
	const session = await authInstance.api.getSession({
		headers: c.req.raw.headers
	});
	
	if (!session) {
		return c.json({ user: null, session: null }, 401);
	}
	
	return c.json({ user: session.user, session });
});

// Authentication middleware
async function requireAuth(c: any, next: any) {
	const authInstance = getAuth(c.env);
	const session = await authInstance.api.getSession({
		headers: c.req.raw.headers
	});
	
	if (!session) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
	
	c.set('user', session.user);
	c.set('session', session);
	await next();
}

// Role-based middleware
function requireRole(roles: string[]) {
	return async (c: any, next: any) => {
		const user = c.get('user');
		
		if (!user || !roles.includes(user.role)) {
			return c.json({ error: 'Forbidden' }, 403);
		}
		
		await next();
	};
}

// GET current user's profile
app.get('/profiles/me', requireAuth, async (c) => {
	const db = drizzle(c.env.mobilize_db);
	const user = c.get('user');

	const profile = await db
		.select()
		.from(profiles)
		.where(eq(profiles.id, user.id))
		.get();

	return c.json(profile);
});

// GET profiles by id (public read)
app.get('/profiles/:id', async (c) => {
	const db = drizzle(c.env.mobilize_db);
	const profileId = c.req.param('id');

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

// POST/PUT create or update profile
app.post('/profiles', requireAuth, async (c) => {
	const db = drizzle(c.env.mobilize_db);
	const user = c.get('user');
	
	let body;
	try {
		body = await c.req.json();
	} catch (e) {
		return c.text('Invalid JSON body', 400);
	}

	const { full_name, avatar_url, class_year, major, bio, mobility_incline, mobility_arm_range } = body;

	if (!full_name) {
		return c.text('Full name is required', 400);
	}

	const result = await db
		.insert(profiles)
		.values({
			id: user.id,
			full_name,
			avatar_url,
			class_year,
			major,
			bio,
			mobility_incline,
			mobility_arm_range,
			updated_at: new Date()
		})
		.onConflictDoUpdate({
			target: profiles.id,
			set: {
				full_name,
				avatar_url,
				class_year,
				major,
				bio,
				mobility_incline,
				mobility_arm_range,
				updated_at: new Date()
			}
		})
		.returning();

	return c.json(result);
});

// GET all pois
app.get('/pois', async (c) => {
	const db = drizzle(c.env.mobilize_db);
	const pois_result = await db.select().from(pois).all();
	return c.json(pois_result);
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
			profile_full_name: profiles.full_name,
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
			profile_full_name: profiles.full_name,
		})
		.from(avoidance_area_reports)
		.leftJoin(profiles, eq(avoidance_area_reports.user_id, profiles.id))
		.where(eq(avoidance_area_reports.avoidance_area_id, Number(areaId)))
		.all();

	return c.json(reports);
});

// POST insert new avoidance area (requires student role)
app.post('/avoidance_areas', requireAuth, requireRole(['student']), async (c) => {
	const db = drizzle(c.env.mobilize_db);
	const user = c.get('user');

	let body;
	try {
		body = await c.req.json();
	} catch (e) {
		console.error('Error parsing JSON body:', e);
		return c.text('Invalid JSON body', 400);
	}

	const { name, description, boundary_geojson } = body;

	if (!name || !boundary_geojson) {
		return c.text('Missing required fields', 400);
	}

	const result = await db
		.insert(avoidance_areas)
		.values({
			user_id: user.id,
			name,
			description: description || null,
			boundary_geojson: JSON.stringify(boundary_geojson),
		})
		.returning();

	return c.json(result);
});

// POST insert new avoidance area report (requires student role)
app.post('/avoidance_areas/:id/reports', requireAuth, requireRole(['student']), async (c) => {
	const db = drizzle(c.env.mobilize_db);
	const user = c.get('user');
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

	const { title, description } = body;

	if (!title) {
		return c.text('Missing required fields', 400);
	}

	const result = await db
		.insert(avoidance_area_reports)
		.values({
			user_id: user.id,
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
