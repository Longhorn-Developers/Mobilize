// GeoJSON attributes for use in mapping

import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import * as MapConstants from "~/src/features/map/constants";


export function useMapGeoJSON() {
    const [sidewalksGeoJSON, setSidewalksGeoJSON] = useState<GeoJSON.FeatureCollection>(MapConstants.EMPTY_FC);
    const [buildingsGeoJSON, setBuildingsGeoJSON] = useState<GeoJSON.FeatureCollection>(MapConstants.EMPTY_FC);
    const [barriersGeoJSON, setBarriersGeoJSON] = useState<GeoJSON.FeatureCollection>(MapConstants.EMPTY_FC);
    const [rampsGeoJSON, setRampsGeoJSON] = useState<GeoJSON.FeatureCollection>(MapConstants.EMPTY_FC);

    useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
        
        setSidewalksGeoJSON(require("~/assets/geojson/sidewalks_slim.json"));
        
        setBuildingsGeoJSON(require("~/assets/geojson/buildings_simple.json"));
        
        setBarriersGeoJSON(require("~/assets/geojson/UTA_Access_Barriers.json"));
        setRampsGeoJSON(require("~/assets/geojson/Ramps.json"));
    });
    }, []);
    return { sidewalksGeoJSON, buildingsGeoJSON, barriersGeoJSON, rampsGeoJSON };
}