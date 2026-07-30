/**
 * Build-time local building database derived from buildings_simple.json.
 * Use this as the source of truth for known UT buildings before falling back
 * to Google Places or Mapbox for external locations.
 */

import { PlaceDetails } from "~/utils/googlePlaces";

 
const buildingsData: GeoJSON.FeatureCollection = require("../assets/geojson/buildings_simple.json");

export interface BuildingProperties {
  Building_Abbr: string;
  Description: string;
  Address_Full: string;
  Building_Details_URL: string | null;
  Shape__Area: number;
  OBJECTID: number;
  Building: string;
  City: string;
  State: string;
  Zip: string;
  // Computed
  centroid: { lat: number; lng: number };
  /** Raw polygon ring as [lng, lat][] — used by getCardinalLabel */
  polygonRing: [number, number][];
}

/** Compute polygon centroid from the first ring of a Polygon geometry. */
function computeCentroid(coords: number[][]): { lat: number; lng: number } {
  let sumLng = 0;
  let sumLat = 0;
  const n = coords.length;
  for (const [lng, lat] of coords) {
    sumLng += lng;
    sumLat += lat;
  }
  return { lat: sumLat / n, lng: sumLng / n };
}

/**
 * Index keyed by Building_Abbr (uppercase).
 * Built once at module load time (zero runtime cost).
 */
export const buildingIndex = new Map<string, BuildingProperties>();

for (const feature of buildingsData.features) {
  const p = feature.properties as any;
  if (!p?.Building_Abbr) continue;

  const coords: number[][] =
    feature.geometry.type === "Polygon"
      ? (feature.geometry as GeoJSON.Polygon).coordinates[0]
      : [];

  buildingIndex.set(p.Building_Abbr.toUpperCase(), {
    Building_Abbr: p.Building_Abbr,
    Description: p.Description ?? "",
    Address_Full: p.Address_Full ?? "",
    Building_Details_URL: p.Building_Details_URL ?? null,
    Shape__Area: p.Shape__Area ?? 0,
    OBJECTID: p.OBJECTID ?? 0,
    Building: p.Building ?? "",
    City: p.City ?? "",
    State: p.State ?? "",
    Zip: p.Zip ?? "",
    centroid: coords.length ? computeCentroid(coords) : { lat: 30.282, lng: -97.733 },
    polygonRing: coords as [number, number][],
  });
}

/**
 * Extract a building abbreviation from a free-form name or address string.
 * Matches codes inside parentheses "(GDC)" or bare leading codes "GDC Main".
 * Returns the abbreviation in uppercase, or null if none found.
 */
export function extractBuildingAbbreviation(value?: string | null): string | null {
  if (!value) return null;
  const parenMatch = value.match(/\(([A-Za-z0-9]{2,8})\)/);
  if (parenMatch?.[1]) return parenMatch[1].toUpperCase();
  const leadingCodeMatch = value.match(/^([A-Za-z0-9]{2,8})\b/);
  if (leadingCodeMatch?.[1]) return leadingCodeMatch[1].toUpperCase();
  return null;
}

/** Look up a building by its abbreviation (case-insensitive). */
export function findBuilding(abbr: string): BuildingProperties | null {
  return buildingIndex.get(abbr.toUpperCase()) ?? null;
}

/**
 * Fuzzy-match a search result name against known building descriptions.
 * Tries exact, then prefix, then substring (case-insensitive).
 */
export function findBuildingByName(name: string): BuildingProperties | null {
  if (!name) return null;
  const needle = name.toLowerCase();

  // 1. Exact abbreviation match
  const byAbbr = buildingIndex.get(needle.toUpperCase());
  if (byAbbr) return byAbbr;

  let prefixMatch: BuildingProperties | null = null;
  let substringMatch: BuildingProperties | null = null;

  for (const building of buildingIndex.values()) {
    const desc = building.Description.toLowerCase();
    if (desc === needle) return building;           // exact description
    if (!prefixMatch && desc.startsWith(needle)) prefixMatch = building;
    if (!substringMatch && desc.includes(needle)) substringMatch = building;
  }

  return prefixMatch ?? substringMatch ?? null;
}

/** Search campus buildings by abbreviation, name, or address. */
export function searchBuildings(query: string, limit = 8): BuildingProperties[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const matches: BuildingProperties[] = [];
  const seen = new Set<string>();

  const pushMatch = (building: BuildingProperties | null) => {
    if (!building || seen.has(building.Building_Abbr)) return;
    seen.add(building.Building_Abbr);
    matches.push(building);
  };

  pushMatch(findBuilding(query));
  pushMatch(findBuildingByName(query));

  for (const building of buildingIndex.values()) {
    if (matches.length >= limit) break;

    const abbr = building.Building_Abbr.toLowerCase();
    const description = building.Description.toLowerCase();
    const address = building.Address_Full.toLowerCase();

    const isMatch =
      abbr.startsWith(needle) ||
      description.startsWith(needle) ||
      description.includes(needle) ||
      address.includes(needle);

    if (isMatch) {
      pushMatch(building);
    }
  }

  return matches.slice(0, limit);
}

/**
 * Convert a BuildingProperties to a PlaceDetails-compatible shape so that
 * LocationDetailsBottomSheet can consume it without modification.
 */
export function buildingToPlaceDetails(b: BuildingProperties): PlaceDetails {
  return {
    place_id: `local_${b.Building_Abbr}`,
    name: b.Description,
    formatted_address: b.Address_Full || `${b.City}, ${b.State} ${b.Zip}`,
    geometry: {
      location: b.centroid,
    },
    types: ["university", "point_of_interest", "establishment"],
  };
}
