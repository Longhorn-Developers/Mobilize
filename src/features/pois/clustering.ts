// Clustering logic for pois

import * as turf from "@turf/turf";
import * as MapConstants from "~/src/features/map/constants";
import { getPOISubtype } from "./poiUtils";


export function clusterPOIs(pois: any[]): any[] {
const visited = new Set<number>();
const clusters: any[] = [];

for (let i = 0; i < pois.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    const group = [pois[i]];

    // Keep expanding until no new members are added
    let changed = true;
    while (changed) {
    changed = false;

    // Recompute centroid of current group
    const centroid = turf.centroid(
        turf.multiPoint(group.map((p) => [
        p.location_geojson.coordinates[0],
        p.location_geojson.coordinates[1],
        ]))
    );

    for (let j = 0; j < pois.length; j++) {
        if (visited.has(j)) continue;
        if (getPOISubtype(pois[j]) !== getPOISubtype(group[0])) continue;

        const dist = turf.distance(
        centroid,
        turf.point([
            pois[j].location_geojson.coordinates[0],
            pois[j].location_geojson.coordinates[1],
        ]),
        { units: "meters" }
        );

        if (dist <= MapConstants.CLUSTER_RADIUS) {
        group.push(pois[j]);
        visited.add(j);
        changed = true;
        }
    }
    }

    if (group.length === 1) {
    clusters.push(group[0]);
    } else {
    const centroid = turf.centroid(
        turf.multiPoint(group.map((p) => [
        p.location_geojson.coordinates[0],
        p.location_geojson.coordinates[1],
        ]))
    );
    clusters.push({
        ...group[0],
        location_geojson: {
        ...group[0].location_geojson,
        coordinates: centroid.geometry.coordinates,
        },
        clusteredPOIs: group,
    });
    }
}

return clusters;
}