import fetch from "node-fetch";
import polyline from "polyline";

export const getRouteFromORS = async (start, end, mode, options = {}) => {
  const apiKey = process.env.ORS_API_KEY;
  const baseUrl = "https://api.openrouteservice.org/v2/directions";
  const url = `${baseUrl}/${mode}`;

  // helps parse numeric env vars safely
  const parseNumEnv = (key) => {
    const v = process.env[key];
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  // default options, but can be overridden by client options
  const defaultIncludeSteps = true; // always include steps unless client disables
  const defaultWheelchair =
    mode === "wheelchair"
      ? {
          avoidSteps: true,
          maximum_gradient: parseNumEnv("ORS_WHEELCHAIR_MAX_GRADIENT"), // no api key yet
          maximum_sloped_kerb: parseNumEnv("ORS_WHEELCHAIR_MAX_SLOPED_KERB"), // no api key yet
        }
      : undefined;

  // Merges server defaults and client options
  const mergedOptions = {
    includeSteps: options.includeSteps ?? defaultIncludeSteps,
    wheelchair: defaultWheelchair
      ? {
          avoidSteps:
            options?.wheelchair?.avoidSteps ?? defaultWheelchair.avoidSteps,
          maximum_gradient:
            options?.wheelchair?.maximum_gradient ??
            defaultWheelchair.maximum_gradient,
          maximum_sloped_kerb:
            options?.wheelchair?.maximum_sloped_kerb ??
            defaultWheelchair.maximum_sloped_kerb,
        }
      : options?.wheelchair,
  };

  const body = {
    coordinates: [start, end],
    // When true, ORS returns segments[].steps[] with turn-by-turn instructions
    instructions: Boolean(mergedOptions.includeSteps),
    instructions_format: "text",
  };

  // kinda like ORS advanced settings
  const orsOptions = {};

  // Avoid steps via generic avoid_features
  if (mergedOptions?.wheelchair?.avoidSteps) {
    orsOptions.avoid_features = ["steps"];
  }

  // Wheelchair-specific restrictions (pass-through only if provided)
  if (mode === "wheelchair") {
    const restrictions = {};
    const wc = mergedOptions.wheelchair || {};
    if (wc.maximum_gradient !== undefined) {
      restrictions.maximum_gradient = wc.maximum_gradient;
    }
    if (wc.maximum_sloped_kerb !== undefined) {
      restrictions.maximum_sloped_kerb = wc.maximum_sloped_kerb;
    }

    if (Object.keys(restrictions).length > 0) {
      orsOptions.profile_params = { restrictions };
    }
  }

  if (Object.keys(orsOptions).length > 0) {
    body.options = orsOptions;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errMsg = `ORS request failed (${response.status})`;
    try {
      const errJson = await response.json();
      errMsg += `: ${errJson.error || errJson.message || JSON.stringify(errJson)}`;
    } catch (_) {
      console.warn("Failed to parse ORS error response:", err);
    }
    throw new Error(errMsg);
  }

  const data = await response.json();

  const route = data.routes?.[0] || data.features?.[0];

  if (!route) {
    console.error(
      "Unexpected ORS response format:",
      JSON.stringify(data, null, 2),
    );
    throw new Error("Invalid ORS response structure — no route found");
  }
  // console.log(route);
  const summary = route.summary || route.properties?.summary;
  // console.log(summary);
  // Pull steps if present and requested (segments[0].steps)
  const segments = route.segments || route.properties?.segments;
  const steps = Array.isArray(segments?.[0]?.steps)
    ? segments[0].steps.map((s) => ({
        distance: s.distance,
        duration: s.duration,
        type: s.type,
        instruction: s.instruction,
        name: s.name,
        way_points: s.way_points,
      }))
    : undefined;

  // Normalize geometry to an array of { lat, lng }
  let coordinates = [];
  if (typeof route.geometry === "string") {
    // Encoded polyline string (default JSON response)
    const decoded = polyline.decode(route.geometry);
    coordinates = decoded.map(([lat, lng]) => ({ lat, lng }));
  } else if (
    route.geometry &&
    typeof route.geometry === "object" &&
    route.geometry.type === "LineString" &&
    Array.isArray(route.geometry.coordinates)
  ) {
    // GeoJSON LineString (FeatureCollection response)
    // Convert [lon, lat] -> { lat, lng }
    coordinates = route.geometry.coordinates.map(([lng, lat]) => ({
      lat,
      lng,
    }));
  } else {
    console.error("Unknown geometry format in ORS response:", route.geometry);
    throw new Error("Unknown geometry format in ORS response");
  }

  // Convert to GeoJSON FeatureCollection format
  const routeCoordinates = coordinates.map((coord) => [coord.lng, coord.lat]);
  const bbox = [
    Math.min(...routeCoordinates.map((c) => c[0])),
    Math.min(...routeCoordinates.map((c) => c[1])),
    Math.max(...routeCoordinates.map((c) => c[0])),
    Math.max(...routeCoordinates.map((c) => c[1])),
  ];

  return {
    type: "FeatureCollection",
    bbox,
    features: [
      {
        bbox,
        type: "Feature",
        properties: {
          segments: [
            {
              distance: summary?.distance,
              duration: summary?.duration,
              steps: steps || [],
            },
          ],
          way_points: [0, coordinates.length - 1],
          summary: {
            distance: summary?.distance,
            duration: summary?.duration,
          },
        },
        geometry: {
          coordinates: routeCoordinates,
          type: "LineString",
        },
      },
    ],
    metadata: {
      attribution: "openrouteservice.org | OpenStreetMap contributors",
      service: "routing",
      timestamp: Date.now(),
      query: {
        coordinates: [start, end],
        profile: mode,
        profileName: mode,
        format: "json",
      },
      engine: {
        version: "9.3.0",
        build_date: new Date().toISOString().split("T")[0] + "T15:39:25Z",
        graph_date: new Date().toISOString().split("T")[0] + "T11:22:22Z",
        osm_date: new Date().toISOString().split("T")[0] + "T23:59:57Z",
      },
    },
  };
};
