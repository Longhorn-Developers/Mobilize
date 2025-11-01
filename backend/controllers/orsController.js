import { getRouteFromORS } from "../services/orsService.js";

export const getRoute = async (req, res) => {
  try {
    const { start, end, mode, options } = req.body;

    if (!start || !end || !Array.isArray(start) || !Array.isArray(end)) {
      return res.status(400).json({
        error:
          "Start and end must be coordinate arrays in form of [longitude, latitude]",
      });
    }

    // ensuring that these nums r coordinates
    const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
    if (
      start.length !== 2 ||
      end.length !== 2 ||
      !isNumber(start[0]) ||
      !isNumber(start[1]) ||
      !isNumber(end[0]) ||
      !isNumber(end[1])
    ) {
      return res.status(400).json({
        error:
          "Coordinates must be arrays of [longitude, latitude] with numeric values",
      });
    }

    // these are the allowed profiles of ORS (no crutches option)
    const allowedProfiles = new Set([
      "wheelchair",
      "driving-car",
      "foot-walking",
      "cycling-regular",
    ]);
    const profile = (mode || "wheelchair").toString();
    if (!allowedProfiles.has(profile)) {
      return res.status(400).json({ error: `Unsupported profile: ${profile}` });
    }

    const routeData = await getRouteFromORS(start, end, profile, options || {});
    res.json(routeData);
  } catch (err) {
    console.error("Error fetching ORS route:", err.message);
    res.status(500).json({ error: err.message });
  }
};
