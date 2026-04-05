import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* Helper functions to get direction based buliding names */ 
export const getCardinalLabel = (entrance: any, buildingFeature: any): string | null => {
  if (!entrance.location_geojson?.coordinates || !buildingFeature?.geometry?.coordinates) return null;

  const [eLng, eLat] = entrance.location_geojson.coordinates;
  const coords: [number, number][] = buildingFeature.geometry.coordinates[0];
  const centroidLng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
  const centroidLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

  const dLat = eLat - centroidLat;
  const dLng = eLng - centroidLng;

  const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
  const normalized = (angle + 360) % 360;

  if (normalized >= 337.5 || normalized < 22.5) return "North Entrance";
  if (normalized < 67.5) return "Northeast Entrance";
  if (normalized < 112.5) return "East Entrance";
  if (normalized < 157.5) return "Southeast Entrance";
  if (normalized < 202.5) return "South Entrance";
  if (normalized < 247.5) return "Southwest Entrance";
  if (normalized < 292.5) return "West Entrance";
  return "Northwest Entrance";
};

export const getCardinalLabelFromNeighbors = (entrance: any, neighbors: any[]): string | null => {
  if (!entrance.location_geojson?.coordinates || neighbors.length < 2) return null;

  const [eLng, eLat] = entrance.location_geojson.coordinates;
  const validNeighbors = neighbors.filter(p => p.location_geojson?.coordinates);
  if (!validNeighbors.length) return null;

  const centroidLng = validNeighbors.reduce((sum, p) => sum + p.location_geojson.coordinates[0], 0) / validNeighbors.length;
  const centroidLat = validNeighbors.reduce((sum, p) => sum + p.location_geojson.coordinates[1], 0) / validNeighbors.length;

  const dLat = eLat - centroidLat;
  const dLng = eLng - centroidLng;
  if (Math.abs(dLat) < 0.00001 && Math.abs(dLng) < 0.00001) return null;

  const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
  const normalized = (angle + 360) % 360;

  if (normalized >= 337.5 || normalized < 22.5) return "North Entrance";
  if (normalized < 67.5) return "Northeast Entrance";
  if (normalized < 112.5) return "East Entrance";
  if (normalized < 157.5) return "Southeast Entrance";
  if (normalized < 202.5) return "South Entrance";
  if (normalized < 247.5) return "Southwest Entrance";
  if (normalized < 292.5) return "West Entrance";
  return "Northwest Entrance";
};

export const getEntranceLabel = (entrance: any, entrances: any[], building: any) => {
  const rawName = entrance.metadata?.name ?? "";
  const isUsefulName =
    rawName.length > 0 &&
    !rawName.match(/^(Point |kml_)/i) &&
    !rawName.match(/^\([A-Z]+\)\s+[A-Z\s]+$/);

  const cardinalLabel =
      getCardinalLabel(entrance, building) ??
      getCardinalLabelFromNeighbors(entrance, entrances);

  return isUsefulName ? rawName : (cardinalLabel ?? `Entrance`);
}