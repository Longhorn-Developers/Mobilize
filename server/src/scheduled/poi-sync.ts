import { drizzle } from 'drizzle-orm/d1';
import { pois } from '../db/schema';
import type { Env } from '../index';

export async function syncPOIs(env: Env): Promise<void> {
	const db = drizzle(env.mobilize_db);

	const samplePOIs = [
		{
			poi_type: 'accessible_entrance',
			metadata: JSON.stringify({
				name: 'University Station',
				route: '801',
				schedule: 'Monday-Friday 6AM-10PM',
				auto_opene: false,
			}),
			location_geojson: JSON.stringify({
				type: 'Point',
				coordinates: [-97.7431, 30.2849], // Austin, TX coordinates
			}),
		},
		{
			poi_type: 'accessible_entrance',
			metadata: JSON.stringify({
				name: 'Main Building Bike Rack',
				capacity: 20,
				covered: true,
				auto_opene: true,
			}),
			location_geojson: JSON.stringify({
				type: 'Point',
				coordinates: [-97.7421, 30.2859],
			}),
		},
	];

	try {
		// Insert POIs into the database
		const result = await db.insert(pois).values(samplePOIs).returning();

		console.log(`Successfully inserted ${result.length} POIs at ${new Date().toISOString()}`);
		console.log('Inserted POI IDs:', result.map((poi) => poi.id));
	} catch (error) {
		console.error('Error inserting POIs:', error);
		throw error;
	}
}
