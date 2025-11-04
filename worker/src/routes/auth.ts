// Authentication routes for Cloudflare Workers
// Replaces Supabase Auth functionality

import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { Env } from '../index';
import { hashPassword, verifyPassword } from '../utils/auth';

const app = new Hono<{ Bindings: Env }>();

// Register new user
app.post('/register', async (c) => {
  try {
    const { email, password, display_name } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Check if user already exists
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM profiles WHERE email = ?'
    ).bind(email).first();

    if (existingUser) {
      return c.json({ error: 'User already exists' }, 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate user ID
    const userId = crypto.randomUUID();

    // Insert new user
    const result = await c.env.DB.prepare(
      `INSERT INTO profiles (id, email, display_name, password_hash)
       VALUES (?, ?, ?, ?)`
    ).bind(userId, email, display_name || null, hashedPassword).run();

    if (!result.success) {
      return c.json({ error: 'Failed to create user' }, 500);
    }

    // Generate JWT token
    const token = await sign(
      { 
        userId, 
        email,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      },
      c.env.JWT_SECRET
    );

    return c.json({
      user: {
        id: userId,
        email,
        display_name: display_name || null,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Login user
app.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Get user from database
    const user = await c.env.DB.prepare(
      'SELECT id, email, display_name, password_hash FROM profiles WHERE email = ?'
    ).bind(email).first() as any;

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate JWT token
    const token = await sign(
      { 
        userId: user.id, 
        email: user.email,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      },
      c.env.JWT_SECRET
    );

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Verify token (for protected routes)
app.get('/verify', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = await verify(token, c.env.JWT_SECRET);

    // Get fresh user data
    const user = await c.env.DB.prepare(
      'SELECT id, email, display_name FROM profiles WHERE id = ?'
    ).bind(payload.userId).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user });
  } catch (error) {
    console.error('Token verification error:', error);
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Logout (client-side token removal, but we can blacklist tokens if needed)
app.post('/logout', (c) => {
  // For JWT, logout is typically handled client-side by removing the token
  // We could implement a token blacklist here if needed
  return c.json({ message: 'Logged out successfully' });
});

export const authRoutes = app;
