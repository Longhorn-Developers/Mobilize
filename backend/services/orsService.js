import fetch from "node-fetch";
import polyline from "polyline";

export const getRouteFromORS = async (start, end, mode) => {
  const apiKey = process.env.ORS_API_KEY;
  const baseUrl = "https://api.openrouteservice.org/v2/directions";
  const url = `${baseUrl}/${mode}?api_key=${apiKey}`;

  const body = {
    coordinates: [
      [start.lng, start.lat],
      [end.lng, end.lat],
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

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
  const decodedCoords = polyline.decode(route.geometry);

  // basically, the coordinates are all the points on the path (lat, lng)
  // note: distance is in meters and duration is in seconds
  return {
    mode,
    distance: summary?.distance,
    duration: summary?.duration,
    coordinates: decodedCoords.map(([lat, lng]) => ({
      lat,
      lng,
    })),
  };
};
