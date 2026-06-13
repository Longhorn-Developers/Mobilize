import { drizzle } from 'drizzle-orm/d1';
import { sql } from 'drizzle-orm';
import { DOMParser } from "@xmldom/xmldom";
import { kml } from "@tmcw/togeojson";

import { pois } from '../db/schema';

/**
 * KML data source for accessible entrance points on the UT Austin campus.
 * Hosted as a Google Maps "My Maps" layer exported as KML.
 * To change the source without a code redeploy, move this to a wrangler.toml [vars] entry.
 */
const ACCESSIBLE_ENTRANCES_KML_URL = 'https://www.google.com/maps/d/kml?forcekml=1&mid=1B_X9WRe0kkTlPbfYpmOQz7pHSQs';

/**
 * Fetches the accessible-entrances KML, converts it to GeoJSON, and upserts
 * all Point features into the `pois` table as "accessible_entrance" records.
 *
 * This is an **upsert-only** sync: existing POIs are updated, but no POIs are
 * deleted (the KML source does not track removals).
 *
 * Conflict resolution: uses `location_geojson` as the unique key, relying on
 * `JSON.stringify(geometry)` producing identical output for the same coordinates
 * across consecutive KML fetches.
 *
 * Properties extracted from the KML description field:
 *  - `BldName`    → building name
 *  - `Auto_Opene` → 1 if door is power-assisted, 0 otherwise
 *  - `Floor`      → numeric floor level (or null if non-numeric / missing)
 */
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
