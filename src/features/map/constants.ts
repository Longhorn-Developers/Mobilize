// Constants for map configuration settings

/* Center of UT Campus */
export const UT_CENTER: [number, number] = [-97.733, 30.282];

/* Configuration for at what zoom level certain icons appear */ 
export const MIN_ZOOM_FOR_POIS = 16;
export const MIN_ZOOM_FOR_SIDEWALKS = 17;
export const MIN_ZOOM_FOR_BUILDINGS = 14;
export const MIN_ZOOM_FOR_BARRIERS = 16;
export const MIN_ZOOM_FOR_LABELS = 15;
export const MAX_ZOOM_FOR_LABELS = 17;

export const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/* Minimum radius that two entrances of the same building & same type will cluster */
export const CLUSTER_RADIUS = 30;