import { Coordinates } from "expo-maps";

export function coordinatesToWKT(coordinates: Coordinates[]): string {
  // Convert coordinates to "longitude latitude" format
  const points = coordinates
    .map((coord) => `${coord.longitude} ${coord.latitude}`)
    .join(", ");

  // Wrap in POLYGON format
  return `POLYGON((${points}))`;
}
