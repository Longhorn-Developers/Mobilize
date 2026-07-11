const ORS_BASE = "https://api.openrouteservice.org/v2/directions";

export type RoutingProfile = "wheelchair" | "foot-walking" | "cycling-electric";

export const ROUTING_PROFILES: { id: RoutingProfile; label: string }[] = [
  { id: "wheelchair",       label: "Accessible" },
  { id: "foot-walking",     label: "Walking" },
  { id: "cycling-electric", label: "Scooter" },
];

export interface ORSStep {
  instruction: string;
  distance: number; // metres
  duration: number; // seconds
  type: number;     // ORS maneuver type (0=left, 1=right, 6=straight, etc.)
  coordinate?: [number, number]; // [lng, lat] start position of this step
}

export interface ORSRoute {
  coordinates: [number, number][]; // [lng, lat] pairs
  steps: ORSStep[];
  totalDistanceMi: number;
  totalDurationSec: number;
}

export async function fetchRoute(
  waypoints: [number, number][],
  profile: RoutingProfile = "wheelchair",
  avoidPolygons?: GeoJSON.Polygon[],
): Promise<ORSRoute> {
  if (waypoints.length < 2) throw new Error("fetchRoute requires at least 2 waypoints");
  const apiKey = process.env.EXPO_PUBLIC_OPENROUTE_KEY;
  if (!apiKey) throw new Error("Missing EXPO_PUBLIC_OPENROUTE_KEY");

  // Snap tolerance per waypoint (metres). ORS's default is tight enough that points off
  // the mapped path (building interiors, sparse-OSM areas) fail to snap and return no route.
  const SNAP_RADIUS_METERS = 750;

  const body: Record<string, unknown> = {
    coordinates: waypoints,
    instructions: true,
    radiuses: waypoints.map(() => SNAP_RADIUS_METERS),
  };
  if (avoidPolygons && avoidPolygons.length > 0) {
    body.options = {
      avoid_polygons: {
        type: "MultiPolygon",
        coordinates: avoidPolygons.map((p) => p.coordinates),
      },
    };
  }

  const res = await fetch(`${ORS_BASE}/${profile}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ORS ${res.status}: ${body.slice(0, 120)}`);
  }

  const json = await res.json();

  // ORS returns GeoJSON-like structure when `format` is omitted (JSON by default)
  const route = json.routes?.[0];
  if (!route) throw new Error("ORS returned no routes");

  const summary = route.summary;

  // Decode the encoded polyline geometry
  const decodePolyline = (encoded: string): [number, number][] => {
    const coords: [number, number][] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
      let shift = 0, result = 0, byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lat += result & 1 ? ~(result >> 1) : result >> 1;

      shift = 0; result = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lng += result & 1 ? ~(result >> 1) : result >> 1;

      // ORS encodes as [lat, lng] / 1e5
      coords.push([lng / 1e5, lat / 1e5]);
    }
    return coords;
  };

  const coordinates = decodePolyline(route.geometry);

  // Flatten steps across all segments; attach start coordinate via way_points index
  const steps: ORSStep[] = (route.segments ?? []).flatMap((seg: any) =>
    (seg.steps ?? []).map((s: any) => ({
      instruction: s.instruction ?? "",
      distance: s.distance ?? 0,
      duration: s.duration ?? 0,
      type: s.type ?? 6,
      coordinate: Array.isArray(s.way_points) && s.way_points.length > 0
        ? coordinates[s.way_points[0]]
        : undefined,
    }))
  );

  return {
    coordinates,
    steps,
    totalDistanceMi: (summary?.distance ?? 0) * 0.000621371,
    totalDurationSec: summary?.duration ?? 0,
  };
}
