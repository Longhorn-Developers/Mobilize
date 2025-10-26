import fetch from "node-fetch";

export const getRouteFromORS = async (start, end, mode = "foot-walking") => {
  const baseUrl = "https://api.openrouteservice.org/v2/directions";
  const url = `${baseUrl}/${mode}?api_key=${process.env.ORS_API_KEY}`;

  const body = {
    coordinates: [
      [start.lng, start.lat],
      [end.lng, end.lat],
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`ORS API error: ${response.statusText}`);
  return await response.json();
};
