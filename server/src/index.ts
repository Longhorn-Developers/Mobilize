import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { avoidance_areas, pois, profiles } from './db/schema';

export interface Env {
	staging_mobilize_db: D1Database;
}

export default {
	async fetch(request: Request, env: Env) {
		const db = drizzle(env.staging_mobilize_db);
		const url = new URL(request.url);

		// Route to add a test user
		// if (url.pathname === '/add') {
		// 	const newUser = await db.insert(users).values({ name: 'Test User' }).returning().get();

		// 	return Response.json(newUser);
		// }

		// health check route
		if (url.pathname === '/health') {
			return new Response('OK');
		}

		// GET profiles by id
		if (url.pathname === '/profiles') {
			const profileId = url.searchParams.get('id');
			if (!profileId) {
				return new Response('Profile ID is required', { status: 400 });
			}
			const profile = await db
				.select()
				.from(profiles)
				.where(eq(profiles.id, Number(profileId)))
				.get();
			if (!profile) {
				return new Response('Profile not found', { status: 404 });
			}

			return Response.json(profile);
		}

		// GET pois
		if (url.pathname === '/pois') {
			const pois_result = await db.select().from(pois).all();
			return Response.json(pois_result);
		}

		// GET avoidance_areas
		if (url.pathname === '/avoidance_areas') {
			const avoidance_areas_result = await db.select().from(avoidance_areas).all();
			return Response.json(avoidance_areas_result);
		}

		// Default route - 404 for non-existent API routes
		return new Response('Not Found', { status: 404 });
	},
};
