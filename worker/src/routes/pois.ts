// Points of Interest (POIs) routes
// Handles CRUD operations for POI data

import { Hono } from 'hono';
import { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();

// Get all POIs
app.get('/', async (c) => {
  try {
    const pois = await c.env.DB.prepare(
      'SELECT id, poi_type, metadata, location_json, created_at, updated_at FROM pois ORDER BY created_at DESC'
    ).all();

    // Parse JSON fields for response
    const parsedPois = pois.results.map((poi: any) => ({
      ...poi,
      metadata: JSON.parse(poi.metadata),
      location_geojson: JSON.parse(poi.location_json)
    }));

    return c.json({ pois: parsedPois });
  } catch (error) {
    console.error('Get POIs error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get POIs by type
app.get('/type/:type', async (c) => {
  try {
    const poiType = c.req.param('type');
    
    if (!['accessible_entrance'].includes(poiType)) {
      return c.json({ error: 'Invalid POI type' }, 400);
    }

    const pois = await c.env.DB.prepare(
      'SELECT id, poi_type, metadata, location_json, created_at, updated_at FROM pois WHERE poi_type = ? ORDER BY created_at DESC'
    ).bind(poiType).all();

    // Parse JSON fields for response
    const parsedPois = pois.results.map((poi: any) => ({
      ...poi,
      metadata: JSON.parse(poi.metadata),
      location_geojson: JSON.parse(poi.location_json)
    }));

    return c.json({ pois: parsedPois });
  } catch (error) {
    console.error('Get POIs by type error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get POIs within a geographic area (bounding box)
app.get('/nearby', async (c) => {
  try {
    const { lat, lng, radius = '1000', type } = c.req.query();

    if (!lat || !lng) {
      return c.json({ error: 'Latitude and longitude are required' }, 400);
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusNum = parseFloat(radius);

    if (isNaN(latNum) || isNaN(lngNum) || isNaN(radiusNum)) {
      return c.json({ error: 'Invalid coordinates or radius' }, 400);
    }

    // Simple bounding box query (in production, use proper geospatial queries)
    // For now, we'll get all POIs and filter client-side
    // D1 doesn't have native geospatial functions like PostGIS
    let query = 'SELECT id, poi_type, metadata, location_json, created_at, updated_at FROM pois WHERE 1=1';
    const params: any[] = [];

    if (type) {
      query += ' AND poi_type = ?';
      params.push(type);
    }

    const pois = await c.env.DB.prepare(query).bind(...params).all();

    // Filter POIs by distance (simple Euclidean distance for demo)
    // In production, implement proper geospatial distance calculation
    const nearbyPois = pois.results.filter((poi: any) => {
      const location = JSON.parse(poi.location_json);
      const poiLat = location.coordinates[1];
      const poiLng = location.coordinates[0];
      
      // Simple distance calculation (not accurate for large distances)
      const distance = Math.sqrt(
        Math.pow(poiLat - latNum, 2) + Math.pow(poiLng - lngNum, 2)
      ) * 111000; // Rough conversion to meters
      
      return distance <= radiusNum;
    });

    // Parse JSON fields for response
    const parsedPois = nearbyPois.map((poi: any) => ({
      ...poi,
      metadata: JSON.parse(poi.metadata),
      location_geojson: JSON.parse(poi.location_json)
    }));

    return c.json({ pois: parsedPois });
  } catch (error) {
    console.error('Get nearby POIs error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create new POI (admin only - in production, add proper admin authentication)
app.post('/', async (c) => {
  try {
    const { poi_type, metadata, location_json } = await c.req.json();

    if (!poi_type || !metadata || !location_json) {
      return c.json({ error: 'POI type, metadata, and location are required' }, 400);
    }

    if (!['accessible_entrance'].includes(poi_type)) {
      return c.json({ error: 'Invalid POI type' }, 400);
    }

    // Validate metadata schema for accessible_entrance
    if (poi_type === 'accessible_entrance') {
      const requiredFields = ['name', 'bld_name', 'floor', 'auto_opene'];
      for (const field of requiredFields) {
        if (!(field in metadata)) {
          return c.json({ error: `Missing required metadata field: ${field}` }, 400);
        }
      }
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO pois (poi_type, metadata, location_json)
       VALUES (?, ?, ?)`
    ).bind(
      poi_type,
      JSON.stringify(metadata),
      JSON.stringify(location_json)
    ).run();

    if (!result.success) {
      return c.json({ error: 'Failed to create POI' }, 500);
    }

    const newPoi = await c.env.DB.prepare(
      'SELECT * FROM pois WHERE id = ?'
    ).bind(result.meta.last_row_id).first();

    // Parse JSON fields for response
    const parsedPoi = {
      ...newPoi,
      metadata: JSON.parse((newPoi as any).metadata),
      location_geojson: JSON.parse((newPoi as any).location_json)
    };

    return c.json({ poi: parsedPoi }, 201);
  } catch (error) {
    console.error('Create POI error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update POI (admin only)
app.put('/:id', async (c) => {
  try {
    const poiId = c.req.param('id');
    const { poi_type, metadata, location_json } = await c.req.json();

    // Check if POI exists
    const existingPoi = await c.env.DB.prepare(
      'SELECT id FROM pois WHERE id = ?'
    ).bind(poiId).first();

    if (!existingPoi) {
      return c.json({ error: 'POI not found' }, 404);
    }

    const result = await c.env.DB.prepare(
      'UPDATE pois SET poi_type = ?, metadata = ?, location_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(
      poi_type || null,
      metadata ? JSON.stringify(metadata) : null,
      location_json ? JSON.stringify(location_json) : null,
      poiId
    ).run();

    if (!result.success) {
      return c.json({ error: 'Failed to update POI' }, 500);
    }

    const updatedPoi = await c.env.DB.prepare(
      'SELECT * FROM pois WHERE id = ?'
    ).bind(poiId).first();

    // Parse JSON fields for response
    const parsedPoi = {
      ...updatedPoi,
      metadata: JSON.parse((updatedPoi as any).metadata),
      location_geojson: JSON.parse((updatedPoi as any).location_json)
    };

    return c.json({ poi: parsedPoi });
  } catch (error) {
    console.error('Update POI error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete POI (admin only)
app.delete('/:id', async (c) => {
  try {
    const poiId = c.req.param('id');

    // Check if POI exists
    const existingPoi = await c.env.DB.prepare(
      'SELECT id FROM pois WHERE id = ?'
    ).bind(poiId).first();

    if (!existingPoi) {
      return c.json({ error: 'POI not found' }, 404);
    }

    const result = await c.env.DB.prepare(
      'DELETE FROM pois WHERE id = ?'
    ).bind(poiId).run();

    if (!result.success) {
      return c.json({ error: 'Failed to delete POI' }, 500);
    }

    return c.json({ message: 'POI deleted successfully' });
  } catch (error) {
    console.error('Delete POI error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export const poisRoutes = app;
