// Avoidance areas routes
// Handles CRUD operations for user-defined avoidance areas

import { Hono } from 'hono';
import { Env } from '../index';
import { getUserIdFromPayload } from '../utils/auth';

const app = new Hono<{ Bindings: Env }>();

// Get all avoidance areas (public data)
app.get('/', async (c) => {
  try {
    const avoidanceAreas = await c.env.DB.prepare(
      'SELECT id, name, boundary_json, description, user_id, created_at, updated_at FROM avoidance_areas ORDER BY created_at DESC'
    ).all();

    return c.json({ avoidance_areas: avoidanceAreas.results });
  } catch (error) {
    console.error('Get avoidance areas error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user's avoidance areas
app.get('/my', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = getUserIdFromPayload(payload);
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const avoidanceAreas = await c.env.DB.prepare(
      'SELECT id, name, boundary_json, description, created_at, updated_at FROM avoidance_areas WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();

    return c.json({ avoidance_areas: avoidanceAreas.results });
  } catch (error) {
    console.error('Get user avoidance areas error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create new avoidance area
app.post('/', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = getUserIdFromPayload(payload);
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { name, boundary_json, description } = await c.req.json();

    if (!boundary_json) {
      return c.json({ error: 'Boundary data is required' }, 400);
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO avoidance_areas (user_id, name, boundary_json, description)
       VALUES (?, ?, ?, ?)`
    ).bind(
      userId, 
      name || null, 
      JSON.stringify(boundary_json), 
      description || null
    ).run();

    if (!result.success) {
      return c.json({ error: 'Failed to create avoidance area' }, 500);
    }

    const newArea = await c.env.DB.prepare(
      'SELECT * FROM avoidance_areas WHERE id = ?'
    ).bind(result.meta.last_row_id).first();

    return c.json({ avoidance_area: newArea }, 201);
  } catch (error) {
    console.error('Create avoidance area error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update avoidance area
app.put('/:id', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = getUserIdFromPayload(payload);
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const areaId = c.req.param('id');
    const { name, boundary_json, description } = await c.req.json();

    // Check if user owns this area
    const existingArea = await c.env.DB.prepare(
      'SELECT user_id FROM avoidance_areas WHERE id = ?'
    ).bind(areaId).first();

    if (!existingArea) {
      return c.json({ error: 'Avoidance area not found' }, 404);
    }

    if (existingArea.user_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await c.env.DB.prepare(
      'UPDATE avoidance_areas SET name = ?, boundary_json = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(
      name || null,
      boundary_json ? JSON.stringify(boundary_json) : null,
      description || null,
      areaId
    ).run();

    if (!result.success) {
      return c.json({ error: 'Failed to update avoidance area' }, 500);
    }

    const updatedArea = await c.env.DB.prepare(
      'SELECT * FROM avoidance_areas WHERE id = ?'
    ).bind(areaId).first();

    return c.json({ avoidance_area: updatedArea });
  } catch (error) {
    console.error('Update avoidance area error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete avoidance area
app.delete('/:id', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = getUserIdFromPayload(payload);
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const areaId = c.req.param('id');

    // Check if user owns this area
    const existingArea = await c.env.DB.prepare(
      'SELECT user_id FROM avoidance_areas WHERE id = ?'
    ).bind(areaId).first();

    if (!existingArea) {
      return c.json({ error: 'Avoidance area not found' }, 404);
    }

    if (existingArea.user_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await c.env.DB.prepare(
      'DELETE FROM avoidance_areas WHERE id = ?'
    ).bind(areaId).run();

    if (!result.success) {
      return c.json({ error: 'Failed to delete avoidance area' }, 500);
    }

    return c.json({ message: 'Avoidance area deleted successfully' });
  } catch (error) {
    console.error('Delete avoidance area error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get avoidance area reports
app.get('/:id/reports', async (c) => {
  try {
    const areaId = c.req.param('id');

    const reports = await c.env.DB.prepare(
      `SELECT aar.*, p.display_name as user_display_name
       FROM avoidance_area_reports aar
       LEFT JOIN profiles p ON aar.user_id = p.id
       WHERE aar.avoidance_area_id = ?
       ORDER BY aar.created_at DESC`
    ).bind(areaId).all();

    return c.json({ reports: reports.results });
  } catch (error) {
    console.error('Get avoidance area reports error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create avoidance area report
app.post('/:id/reports', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = getUserIdFromPayload(payload);
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const areaId = c.req.param('id');
    const { title, description } = await c.req.json();

    // Verify the avoidance area exists
    const area = await c.env.DB.prepare(
      'SELECT id FROM avoidance_areas WHERE id = ?'
    ).bind(areaId).first();

    if (!area) {
      return c.json({ error: 'Avoidance area not found' }, 404);
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO avoidance_area_reports (avoidance_area_id, user_id, title, description)
       VALUES (?, ?, ?, ?)`
    ).bind(
      areaId,
      userId,
      title || null,
      description || null
    ).run();

    if (!result.success) {
      return c.json({ error: 'Failed to create report' }, 500);
    }

    const newReport = await c.env.DB.prepare(
      'SELECT * FROM avoidance_area_reports WHERE id = ?'
    ).bind(result.meta.last_row_id).first();

    return c.json({ report: newReport }, 201);
  } catch (error) {
    console.error('Create avoidance area report error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export const avoidanceAreasRoutes = app;
