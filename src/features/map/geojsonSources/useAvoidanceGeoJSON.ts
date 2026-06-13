// Converts avoidance areas into GeoJSON

import { useMemo } from "react";


export function useAvoidanceGeoJSON(avoidanceAreas: any[] | undefined): GeoJSON.FeatureCollection {
    return useMemo((): GeoJSON.FeatureCollection => ({
        type: "FeatureCollection",
        features: (avoidanceAreas ?? []).map((area: any) => ({
            type: "Feature" as const,
            id: String(area.id),
            properties: { id: String(area.id) },
            geometry: area.boundary_geojson as GeoJSON.Geometry,
        })),
        }),
        [avoidanceAreas],
    );
}