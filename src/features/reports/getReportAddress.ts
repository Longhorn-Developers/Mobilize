/** Finds the address of the campus building closest to a report's area, since we don't store addresses -R.L. */
/** This is kinda the most inaccurate way to do this, but since its a UT app, the addresses are always "prettttty" close to the wanted spot */
import * as turf from "@turf/turf";

import type { BuildingProperties } from "~/utils/buildingDatabase";
import { buildingIndex } from "~/utils/buildingDatabase";

export function getReportAddress(boundaryGeojson: string | null | undefined): string | null {
  let polygon;
  try {
    polygon = JSON.parse(boundaryGeojson ?? "");
  } catch {
    return null;
  }

  const [lng, lat] = turf.centroid(polygon).geometry.coordinates;

  let closest: BuildingProperties | null = null;
  let closestDistance = Infinity;

  for (const building of buildingIndex.values()) {
    // buildings with no outline get a made-up default center, so skip them
    if (!building.Address_Full || building.polygonRing.length === 0) continue;

    const distance = turf.distance([lng, lat], [building.centroid.lng, building.centroid.lat]);
    if (distance < closestDistance) {
      closest = building;
      closestDistance = distance;
    }
  }

  if (!closest) return null;

  const stateAndZip = [closest.State, closest.Zip].filter(Boolean).join(" ");
  return [closest.Address_Full, closest.City, stateAndZip].filter(Boolean).join(", ");
}
