import { drizzle } from 'drizzle-orm/d1';
import { pois } from './db/schema';

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

		// // Route to get all users
		// if (url.pathname === '/users') {
		// 	const allUsers = await db.select().from(users).all();
		// 	return Response.json(allUsers);
		// }

		// Route to get all pois
		if (url.pathname === '/pois') {
			const pois_result = await db.select().from(pois).all();
			return Response.json(pois_result);
		}

		// Default route
		return new Response('Mobilize Server is running!');
	},
};
