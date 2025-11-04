// Profile management routes
// Handles user profile CRUD operations

import { Hono } from 'hono';
import { Env } from '../index';
import { getUserIdFromPayload } from '../utils/auth';

const app = new Hono<{ Bindings: Env }>();

// Get current user profile
app.get('/', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = getUserIdFromPayload(payload);
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const profile = await c.env.DB.prepare(
      'SELECT id, email, display_name, avatar_url, created_at, updated_at FROM profiles WHERE id = ?'
    ).bind(userId).first();

    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    return c.json({ profile });
  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update current user profile
app.put('/', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = getUserIdFromPayload(payload);
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { display_name, avatar_url } = await c.req.json();

    const result = await c.env.DB.prepare(
      'UPDATE profiles SET display_name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(display_name || null, avatar_url || null, userId).run();

    if (!result.success) {
      return c.json({ error: 'Failed to update profile' }, 500);
    }

    // Get updated profile
    const updatedProfile = await c.env.DB.prepare(
      'SELECT id, email, display_name, avatar_url, created_at, updated_at FROM profiles WHERE id = ?'
    ).bind(userId).first();

    return c.json({ profile: updatedProfile });
  } catch (error) {
    console.error('Update profile error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get profile by ID (public information only)
app.get('/:id', async (c) => {
  try {
    const profileId = c.req.param('id');

    const profile = await c.env.DB.prepare(
      'SELECT id, display_name, avatar_url FROM profiles WHERE id = ?'
    ).bind(profileId).first();

    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    return c.json({ profile });
  } catch (error) {
    console.error('Get profile by ID error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export const profilesRoutes = app;
