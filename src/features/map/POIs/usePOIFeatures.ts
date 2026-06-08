// Hook for poi interactions

import { useMemo } from "react";
import { clusterPOIs } from "~/src/features/pois/clustering";
import { isEntrancePoi } from "~/src/features/pois/poiUtils";

export function usePOIFeatures(POIs: any[] | undefined) {
  const entrances = useMemo(() => (POIs ?? []).filter(isEntrancePoi), [POIs]);

  const clusteredEntrancePOIs = useMemo(() => clusterPOIs(entrances), [entrances]);

  const poiGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: clusteredEntrancePOIs.map((poi) => ({
      type: "Feature" as const,
      id: String(poi.id),
      properties: {
        id: String(poi.id),
        icon: poi.metadata?.auto_opene ? "autoDoor" : "manualDoor",
        clusterCount: poi.clusteredPOIs?.length ?? 1,
      },
      geometry: poi.location_geojson as GeoJSON.Geometry,
    })),
  }), [clusteredEntrancePOIs]);

  return { entrances, clusteredEntrancePOIs, poiGeoJSON };
}