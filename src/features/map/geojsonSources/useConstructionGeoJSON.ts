// Converts construction areas to GeoJSON polygons

import { useMemo } from "react";

export function useConstructionGeoJSON(constructionAreas: any[] | undefined): GeoJSON.FeatureCollection {
    return useMemo((): GeoJSON.FeatureCollection => ({
        type: "FeatureCollection",
        features: (constructionAreas ?? []).flatMap((area: any) => {
            const coords = area.points.map(
            (c: [number, number]) => [c[1], c[0]] as [number, number],
            );
            if (coords.length < 3) return [];
            const ring: [number, number][] =
            coords[0][0] === coords[coords.length - 1][0] &&
            coords[0][1] === coords[coords.length - 1][1]
                ? coords
                : [...coords, coords[0]];
            return [
            {
                type: "Feature" as const,
                id: `C${area.id}`,
                properties: {
                id: `C${area.id}`,
                description: area.description ?? null,
                },
                geometry: {
                type: "Polygon",
                coordinates: [ring],
                } satisfies GeoJSON.Polygon,
            },
            ];
        }),
        }),
        [constructionAreas],
    );
}