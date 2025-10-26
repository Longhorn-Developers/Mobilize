import { getRouteFromORS } from "../services/orsService.js";

export const getRoute = async (req, res) => {
  try {
    const { start, end, mode } = req.body; // {latitude, longitude}
    const routeData = await getRouteFromORS(start, end, mode);
    res.json(routeData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
