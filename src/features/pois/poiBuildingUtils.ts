// Utility functions connecting POIs to bulidings

import * as turf from "@turf/turf";
import { extractBuildingAbbreviation, isPoiInsideBuilding } from "~/src/features/pois/buildingUtils";


export function findEntrancePoiForBuilding (entrances: any[], buildingFeature: any) {
    if (!entrances.length || !buildingFeature) return null;
  
    const buildingAbbr = String(buildingFeature?.properties?.Building_Abbr ?? "").toUpperCase();
    if (buildingAbbr) {
      const abbreviationMatch = entrances.find((entry) => {
        const entryAbbr =
          extractBuildingAbbreviation(entry?.metadata?.bld_name) ??
          extractBuildingAbbreviation(entry?.metadata?.name);
        return entryAbbr === buildingAbbr;
      });
      if (abbreviationMatch) return abbreviationMatch;
    }
  
    const geometryMatch = entrances.find((entry) => isPoiInsideBuilding(entry, buildingFeature));
    return geometryMatch ?? null;
}

export function buildPoiFromCampusBuilding (POIs: any[], placeDetails: any, buildingFeature: any) {
    if (!buildingFeature) {
        return null;
    }
    
    const matchedEntrance = findEntrancePoiForBuilding(POIs, buildingFeature);
    if (matchedEntrance) {
        return matchedEntrance;
    }
    
    const buildingAbbr = buildingFeature?.properties?.Building_Abbr;
    const buildingName = buildingFeature?.properties?.Description;
    if (!buildingName) return null;
    
    const centroidCoords = turf.centerOfMass(buildingFeature as any)?.geometry?.coordinates as
        | [number, number]
        | undefined;
    const lng = placeDetails?.geometry?.location?.lng ?? centroidCoords?.[0];
    const lat = placeDetails?.geometry?.location?.lat ?? centroidCoords?.[1];
    if (lng == null || lat == null) return null;
    
    return {
        id: `search-${placeDetails?.place_id ?? buildingAbbr ?? buildingName}`,
        poi_type: "accessible_entrance",
        location_geojson: {
        type: "Point",
        coordinates: [lng, lat],
        },
        metadata: {
        name: buildingName,
        bld_name: buildingAbbr ? `(${buildingAbbr}) ${buildingName}` : buildingName,
        },
    };
}