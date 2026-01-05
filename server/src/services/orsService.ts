export const getRouteFromORS = async (
  start: number[],
  end: number[],
  mode: string,
  options: any = {},
  apiKey: string
) => {
  const baseUrl = "https://api.openrouteservice.org/v2/directions";
  const url = `${baseUrl}/${mode}`;

  // Default options
  const defaultIncludeSteps = true;
  const defaultWheelchair =
    mode === "wheelchair"
      ? {
          avoidSteps: true,
          maximum_gradient: undefined,
          maximum_sloped_curb: undefined,
        }
      : undefined;

  // Merge server defaults and client options
  const mergedOptions = {
    includeSteps: options.includeSteps ?? defaultIncludeSteps,
    wheelchair: defaultWheelchair
      ? {
          avoidSteps:
            options?.wheelchair?.avoidSteps ?? defaultWheelchair.avoidSteps,
          maximum_gradient:
            options?.wheelchair?.maximum_gradient ??
            defaultWheelchair.maximum_gradient,
          maximum_sloped_curb:
            options?.wheelchair?.maximum_sloped_curb ??
            defaultWheelchair.maximum_sloped_curb,
        }
      : options?.wheelchair,
  };

  const body: any = {
    coordinates: [start, end],
    instructions: Boolean(mergedOptions.includeSteps),
    instructions_format: "text",
  };

  // Advanced settings
  const orsOptions: any = {};

  // Avoid steps via generic avoid_features
  if (mergedOptions?.wheelchair?.avoidSteps) {
    orsOptions.avoid_features = ["steps"];
  }

  // Wheelchair-specific restrictions
  if (mode === "wheelchair") {
  const profileParams: any = {};
  const wc = mergedOptions.wheelchair || {};

  if (wc.maximum_gradient !== undefined) {
    profileParams.maximum_incline = wc.maximum_gradient;
  }

  if (wc.maximum_sloped_curb !== undefined) {
    profileParams.maximum_curb = wc.maximum_sloped_curb;
  }

  if (Object.keys(profileParams).length > 0) {
    orsOptions.profile_params = profileParams;
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
      errMsg += `: ${(errJson as any).error || (errJson as any).message || JSON.stringify(errJson)}`;
    } catch (err) {
      console.warn("Failed to parse ORS error response:", err);
    }
    throw new Error(errMsg);
  }

  const data = await response.json();

  // Decode polyline geometry if present
  if (data.routes && Array.isArray(data.routes)) {
    for (const route of data.routes) {
      if (route.geometry && typeof route.geometry === "string") {
        // Decode polyline to coordinates array
        route.geometry_decoded = decodePolyline(route.geometry);
      }
    }
  }

  return data;
};

// polyline decoder
// Followed this documentation https://developers.google.com/maps/documentation/utilities/polylinealgorithm

function decodePolyline(str: string, precision = 5): number[][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: number[][] = [];
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
}
