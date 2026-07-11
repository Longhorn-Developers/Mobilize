// Constants for map configuration settings

/* Center of UT Campus */
export const UT_CENTER: [number, number] = [-97.733, 30.282];

/* UT Tower (Main Building) — placeholder start for navigation until real GPS is wired */
export const UT_TOWER: [number, number] = [-97.7335, 30.2861];

/* Bounding box used to quickly reject coordinates that are nowhere near campus */
export const UT_CAMPUS_BOUNDS = {
  low: { latitude: 30.269, longitude: -97.747 },
  high: { latitude: 30.295, longitude: -97.721 },
} as const;

/* Max distance from UT_CENTER (in km) for a coordinate to be considered "on campus" */
export const CAMPUS_MATCH_RADIUS_KM = 2.5;

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
export const CLUSTER_RADIUS = 10;