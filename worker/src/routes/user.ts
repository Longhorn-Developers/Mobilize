// User-specific routes
// Handles user preferences, common locations, etc.

import { Hono } from 'hono';
import { Env } from '../index';
import { getUserIdFromPayload } from '../utils/auth';

const app = new Hono<{ Bindings: Env }>();

// Get user navigation preferences
app.get('/preferences', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = getUserIdFromPayload(payload);
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const preferences = await c.env.DB.prepare(
      'SELECT * FROM user_navigation_preferences WHERE user_id = ?'
    ).bind(userId).first();

    // If no preferences exist, create default ones
    if (!preferences) {
      const result = await c.env.DB.prepare(
        `INSERT INTO user_navigation_preferences (user_id, avoid_areas, gradient_tolerance)
         VALUES (?, ?, ?)`
      ).bind(userId, true, 0.05).run();

      if (result.success) {
        const newPreferences = await c.env.DB.prepare(
          'SELECT * FROM user_navigation_preferences WHERE id = ?'
        ).bind(result.meta.last_row_id).first();
        
        return c.json({ preferences: newPreferences });
      }
    }

    return c.json({ preferences });
  } catch (error) {
    console.error('Get user preferences error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update user navigation preferences
app.put('/preferences', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = getUserIdFromPayload(payload);
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { avoid_areas, gradient_tolerance } = await c.req.json();

    // Check if preferences exist
    const existingPreferences = await c.env.DB.prepare(
      'SELECT id FROM user_navigation_preferences WHERE user_id = ?'
    ).bind(userId).first();

    let result;
    if (existingPreferences) {
      // Update existing preferences
      result = await c.env.DB.prepare(
        'UPDATE user_navigation_preferences SET avoid_areas = ?, gradient_tolerance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
      ).bind(
        avoid_areas !== undefined ? avoid_areas : null,
        gradient_tolerance !== undefined ? gradient_tolerance : null,
        userId
      ).run();
    } else {
      // Create new preferences
      result = await c.env.DB.prepare(
        `INSERT INTO user_navigation_preferences (user_id, avoid_areas, gradient_tolerance)
         VALUES (?, ?, ?)`
      ).bind(
        userId,
        avoid_areas !== undefined ? avoid_areas : true,
        gradient_tolerance !== undefined ? gradient_tolerance : 0.05
      ).run();
    }

    if (!result.success) {
      return c.json({ error: 'Failed to update preferences' }, 500);
    }

    // Get updated preferences
    const updatedPreferences = await c.env.DB.prepare(
      'SELECT * FROM user_navigation_preferences WHERE user_id = ?'
    ).bind(userId).first();

    return c.json({ preferences: updatedPreferences });
  } catch (error) {
    console.error('Update user preferences error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user's common locations
app.get('/locations', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = getUserIdFromPayload(payload);
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const locations = await c.env.DB.prepare(
      'SELECT * FROM user_common_locations WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();

    // Parse location JSON
    const parsedLocations = locations.results.map((location: any) => ({
      ...location,
      location: JSON.parse(location.location_json)
    }));

    return c.json({ locations: parsedLocations });
  } catch (error) {
    console.error('Get user locations error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Add common location
app.post('/locations', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = getUserIdFromPayload(payload);
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { label, location } = await c.req.json();

    if (!label || !location) {
      return c.json({ error: 'Label and location are required' }, 400);
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO user_common_locations (user_id, label, location_json)
       VALUES (?, ?, ?)`
    ).bind(userId, label, JSON.stringify(location)).run();

    if (!result.success) {
      return c.json({ error: 'Failed to add location' }, 500);
    }

    const newLocation = await c.env.DB.prepare(
      'SELECT * FROM user_common_locations WHERE id = ?'
    ).bind(result.meta.last_row_id).first();

    // Parse location JSON for response
    const parsedLocation = {
      ...newLocation,
      location: JSON.parse((newLocation as any).location_json)
    };

    return c.json({ location: parsedLocation }, 201);
  } catch (error) {
    console.error('Add user location error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update common location
app.put('/locations/:id', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = getUserIdFromPayload(payload);
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const locationId = c.req.param('id');
    const { label, location } = await c.req.json();

    // Check if user owns this location
    const existingLocation = await c.env.DB.prepare(
      'SELECT user_id FROM user_common_locations WHERE id = ?'
    ).bind(locationId).first();

    if (!existingLocation) {
      return c.json({ error: 'Location not found' }, 404);
    }

    if (existingLocation.user_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await c.env.DB.prepare(
      'UPDATE user_common_locations SET label = ?, location_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(
      label || null,
      location ? JSON.stringify(location) : null,
      locationId
    ).run();

    if (!result.success) {
      return c.json({ error: 'Failed to update location' }, 500);
    }

    const updatedLocation = await c.env.DB.prepare(
      'SELECT * FROM user_common_locations WHERE id = ?'
    ).bind(locationId).first();

    // Parse location JSON for response
    const parsedLocation = {
      ...updatedLocation,
      location: JSON.parse((updatedLocation as any).location_json)
    };

    return c.json({ location: parsedLocation });
  } catch (error) {
    console.error('Update user location error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete common location
app.delete('/locations/:id', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = getUserIdFromPayload(payload);
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const locationId = c.req.param('id');

    // Check if user owns this location
    const existingLocation = await c.env.DB.prepare(
      'SELECT user_id FROM user_common_locations WHERE id = ?'
    ).bind(locationId).first();

    if (!existingLocation) {
      return c.json({ error: 'Location not found' }, 404);
    }

    if (existingLocation.user_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await c.env.DB.prepare(
      'DELETE FROM user_common_locations WHERE id = ?'
    ).bind(locationId).run();

    if (!result.success) {
      return c.json({ error: 'Failed to delete location' }, 500);
    }

    return c.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Delete user location error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export const userRoutes = app;
