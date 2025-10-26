import { getRouteFromORS } from "../services/orsService.js";

export const getRoute = async (req, res) => {
  try {
    const { start, end, mode } = req.body;

    if (!start || !end) {
      return res
        .status(400)
        .json({ error: "Start and end coordinates are required" });
    }

    const routeData = await getRouteFromORS(start, end, mode || "wheelchair");
    res.json(routeData);
  } catch (err) {
    console.error("Error fetching ORS route:", err.message);
    res.status(500).json({ error: err.message });
  }
};
