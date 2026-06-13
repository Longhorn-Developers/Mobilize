/**
 * Shared GeoJSON / coordinate types used across the mobile client.
 * Import from here instead of typing coordinates as `any`.
 */

/** A longitude/latitude coordinate pair. */
export interface Coordinate {
  lng: number;
  lat: number;
}

/** A GeoJSON Point feature representing a campus building centroid or entrance. */
export interface BuildingFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    /** Short code used as the database key, e.g. "GDC", "WEL". */
    Building_Abbr?: string | null;
    /** Full human-readable building name, e.g. "Gates Dell Complex". */
    Building?: string | null;
    BldNme?: string | null;
    [key: string]: unknown;
  };
}

/** A GeoJSON Polygon feature (used for campus building footprints). */
export interface BuildingPolygonFeature {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
  properties: BuildingFeature["properties"];
}
