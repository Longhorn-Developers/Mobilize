// Sync routes for POI data synchronization
// Replaces Supabase Edge Functions

import { Hono } from 'hono';
import { Env } from '../index';
import { syncAccessibleEntrances } from '../utils/sync';

const app = new Hono<{ Bindings: Env }>();

// Sync accessible entrances from KML data
app.post('/pois', async (c) => {
  try {
    // In production, add authentication/authorization for this endpoint
    // For now, we'll make it public but you should secure it
    
    const accessibleEntrancesKmlUrl = 
      "https://www.google.com/maps/d/kml?forcekml=1&mid=1B_X9WRe0kkTlPbfYpmOQz7pHSQs";

    await syncAccessibleEntrances(c.env.DB, accessibleEntrancesKmlUrl);

    return c.json({ 
      message: "Successfully synced POI data.",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error syncing POI data:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return c.json({ error: errorMessage }, 500);
  }
});

// Manual sync trigger (for development/testing)
app.post('/pois/manual', async (c) => {
  try {
    const { kml_url } = await c.req.json();

    if (!kml_url) {
      return c.json({ error: 'KML URL is required' }, 400);
    }

    await syncAccessibleEntrances(c.env.DB, kml_url);

    return c.json({ 
      message: "Successfully synced POI data from provided KML URL.",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error syncing POI data:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return c.json({ error: errorMessage }, 500);
  }
});

// Get sync status
app.get('/status', async (c) => {
  try {
    // Get latest sync information from database
    const latestPoi = await c.env.DB.prepare(
      'SELECT created_at, updated_at FROM pois ORDER BY created_at DESC LIMIT 1'
    ).first();

    const poiCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM pois'
    ).first();

    return c.json({
      last_sync: latestPoi?.created_at || null,
      total_pois: poiCount?.count || 0,
      status: 'active'
    });
  } catch (error) {
    console.error("Error getting sync status:", error);
    return c.json({ error: "Failed to get sync status" }, 500);
  }
});

export const syncRoutes = app;
