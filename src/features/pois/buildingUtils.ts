// Utility functions for buildings as defined in ~/assets/geojson/bulidings_simple.geojson

import * as turf from "@turf/turf";
import buildingsData from "~/assets/geojson/buildings_simple.json";
import {
  CAMPUS_MATCH_RADIUS_KM,
  UT_CAMPUS_BOUNDS,
  UT_CENTER,
} from "~/src/features/map/constants";

/* Gets the 3 character buliding abbreviation from full building string */
export const extractBuildingAbbreviation = (value?: string | null): string | null => {
    if (!value) return null;
    const parenMatch = value.match(/\(([A-Za-z0-9]{2,8})\)/);
    if (parenMatch?.[1]) return parenMatch[1].toUpperCase();
    const leadingCodeMatch = value.match(/^([A-Za-z0-9]{2,8})\b/);
    if (leadingCodeMatch?.[1]) return leadingCodeMatch[1].toUpperCase();
    return null;
  };

/* Normalizes building text by lowercasing, removing non-alphanumeric characters, and trimming whitespace */
export const normalizeCampusText = (value?: string | null) =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();  


export const findCampusBuildingFeature = (
  latitude: number,
  longitude: number,
  placeName?: string,
  placeAddress?: string,
) => {
  const point = turf.point([longitude, latitude]);
  const buildingsAny = buildingsData as any;
  const features: any[] = buildingsAny.features ?? [];

  const placeAbbreviation =
    extractBuildingAbbreviation(placeName) ??
    extractBuildingAbbreviation(placeAddress);
  if (placeAbbreviation) {
    const abbreviationMatch = features.find(
      (feature) =>
        String(feature?.properties?.Building_Abbr ?? "").toUpperCase() === placeAbbreviation,
    );
    if (abbreviationMatch) {
      return abbreviationMatch;
    }
  }

  const polygonMatch = features.find((feature) =>
    feature?.geometry && turf.booleanPointInPolygon(point, feature),
  );
  if (polygonMatch) {
    return polygonMatch;
  }

  const normalizedName = normalizeCampusText(placeName);
  const normalizedAddress = normalizeCampusText(placeAddress);
  if (normalizedName || normalizedAddress) {
    const nameMatch = features.find((feature) => {
      const description = normalizeCampusText(feature?.properties?.Description);
      const abbr = normalizeCampusText(feature?.properties?.Building_Abbr);
      return (
        (normalizedName &&
          ((description && (description.includes(normalizedName) || normalizedName.includes(description))) ||
            (abbr && normalizedName.includes(abbr)))) ||
        (normalizedAddress && description && normalizedAddress.includes(description))
      );
    });
    if (nameMatch) {
      return nameMatch;
    }
  }

  let nearestFeature: any = null;
  let nearestDistanceSq = Number.POSITIVE_INFINITY;
  for (const feature of features) {
    const center = turf.centerOfMass(feature as any)?.geometry?.coordinates;
    if (!Array.isArray(center) || center.length < 2) continue;
    const dx = Number(center[0]) - longitude;
    const dy = Number(center[1]) - latitude;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearestFeature = feature;
    }
  }

  // Approx ~225m threshold to avoid snapping far away locations.
  const MAX_SNAP_DISTANCE_SQ = 0.002 * 0.002;
  return nearestDistanceSq <= MAX_SNAP_DISTANCE_SQ ? nearestFeature : null;
};

/* Quick check that a coordinate is plausibly on UT campus before doing building lookups */
export const isLikelyCampusCoordinate = (latitude: number, longitude: number) => {
  const withinBounds =
    latitude >= UT_CAMPUS_BOUNDS.low.latitude &&
    latitude <= UT_CAMPUS_BOUNDS.high.latitude &&
    longitude >= UT_CAMPUS_BOUNDS.low.longitude &&
    longitude <= UT_CAMPUS_BOUNDS.high.longitude;
  if (!withinBounds) return false;

  const point = turf.point([longitude, latitude]);
  const distanceKm = turf.distance(point, turf.point(UT_CENTER), { units: "kilometers" });
  return Number.isFinite(distanceKm) && distanceKm <= CAMPUS_MATCH_RADIUS_KM;
};

export const isPoiInsideBuilding = (poi: any, buildingFeature: any) => {
  const coords = poi?.location_geojson?.coordinates;
  if (!coords?.length || !buildingFeature?.geometry) return false;
  const point = turf.point([Number(coords[0]), Number(coords[1])]);
  return turf.booleanPointInPolygon(point, buildingFeature as any);
};