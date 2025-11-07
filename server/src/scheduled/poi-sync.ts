import { drizzle } from 'drizzle-orm/d1';
import { sql } from 'drizzle-orm';
import { DOMParser } from "@xmldom/xmldom";
import { kml } from "@tmcw/togeojson";

import { pois } from '../db/schema';
import type { Env } from '../index';

const ACCESSIBLE_ENTRANCES_KML_URL = 'https://www.google.com/maps/d/kml?forcekml=1&mid=1B_X9WRe0kkTlPbfYpmOQz7pHSQs'; // Replace with actual KML data source URL

export async function syncPOIs(env: Env): Promise<void> {
	const db = drizzle(env.mobilize_db);

	// fetch the KML data from the URL
	const kmlResponse = await fetch(ACCESSIBLE_ENTRANCES_KML_URL);
	if (!kmlResponse.ok) {
		throw new Error(`Failed to fetch KML data: ${kmlResponse.statusText}`);
	}
	const kmlText = await kmlResponse.text();

	// parse the KML to GeoJSON
	const dom = new DOMParser().parseFromString(kmlText, "text/xml");
	const geoJSON = kml(dom);

	// prepare the data for insertion
	const poisData = geoJSON.features.map((feature) => {
		const { properties, geometry } = feature;
		if (!properties || !geometry || geometry.type !== "Point") {
			return null;
		}

		// Extract additional data from the description
		const description = properties.description;
		const blgNameMatch = description.match(/BldName\s*(.*)/);
		const autoOpeneMatch = description.match(/Auto_Opene\s+(\d)/);
		const floorMatch = description.match(/Floor\s+(\w+)/);

		const metadata = {
			name: properties.name,
			bld_name: blgNameMatch ? blgNameMatch[1] : null,
			floor: floorMatch
				? isNaN(parseInt(floorMatch[1], 10))
					? null
					: parseInt(floorMatch[1], 10)
				: null,
			auto_opene: autoOpeneMatch ? autoOpeneMatch[1] === "1" : false,
		};

		return {
			poi_type: "accessible_entrance",
			metadata: JSON.stringify(metadata),
			location_geojson: JSON.stringify(geometry),
		};
	});

	try {
		// Upsert POIs into the database in batches
		const validPoisData = poisData.filter((poi) => poi !== null);
		const BATCH_SIZE = 25;
		let totalInserted = 0;

		for (let i = 0; i < validPoisData.length; i += BATCH_SIZE) {
			const batch = validPoisData.slice(i, i + BATCH_SIZE);
			const result = await db.insert(pois)
				.values(batch)
				.onConflictDoUpdate({
					target: pois.location_geojson,
					set: {
						poi_type: sql`excluded.poi_type`,
						metadata: sql`excluded.metadata`,
						updated_at: sql`CURRENT_TIMESTAMP`,
					},
				})
				.returning({ id: pois.id });

			totalInserted += result.length;
		}

		console.log(`Successfully upserted ${totalInserted} POIs at ${new Date().toISOString()}`);
	} catch (error) {
		console.error('Error upserting POIs:', error);
		throw error;
	}
}
