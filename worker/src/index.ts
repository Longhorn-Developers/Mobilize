// Cloudflare Worker API for Mobilize
// Replaces Supabase backend functionality

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { authRoutes } from './routes/auth';
import { profilesRoutes } from './routes/profiles';
import { avoidanceAreasRoutes } from './routes/avoidance-areas';
import { poisRoutes } from './routes/pois';
import { userRoutes } from './routes/user';
import { syncRoutes } from './routes/sync';

export interface Env {
  DB: any; // D1Database type not available in this context
  JWT_SECRET: string;
  ENVIRONMENT?: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', cors({
  origin: '*', // Allow all origins in development
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// JWT middleware for protected routes
const jwtMiddleware = jwt({
  secret: 'dev-secret-key-change-in-production',
});

// Health check endpoint
app.get('/', (c) => {
  return c.json({ 
    message: 'Mobilize API', 
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString()
  });
});

// Public routes
app.route('/auth', authRoutes);
app.route('/sync', syncRoutes);

// Public data routes (GET endpoints are public, others require auth)
// Apply JWT middleware only to POST/PUT/DELETE methods
app.use('/avoidance-areas', async (c, next) => {
  if (c.req.method !== 'GET') {
    return jwtMiddleware(c, next);
  }
  return next();
});
app.use('/pois', async (c, next) => {
  if (c.req.method !== 'GET') {
    return jwtMiddleware(c, next);
  }
  return next();
});
app.route('/avoidance-areas', avoidanceAreasRoutes);
app.route('/pois', poisRoutes);

// Protected routes (require JWT authentication for all methods)
app.use('/profiles/*', jwtMiddleware);
app.use('/user/*', jwtMiddleware);

app.route('/profiles', profilesRoutes);
app.route('/user', userRoutes);

// Error handling
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

export default app;
