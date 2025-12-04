import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import { createAuth } from "./auth";

type Bindings = {
  mobilize_db: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS
app.use("/*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Health check
app.get("/", (c) => c.json({ status: "ok" }));

// POIs endpoint
app.get("/pois", async (c) => {
  const db = drizzle(c.env.mobilize_db, { schema });
  const pois = await db.select().from(schema.pois);
  return c.json(pois);
});

// Avoidance areas endpoint
app.get("/avoidance_areas", async (c) => {
  const db = drizzle(c.env.mobilize_db, { schema });
  const areas = await db.select().from(schema.avoidance_areas);
  return c.json(areas);
});

// ============================================
// ADD THESE LINES - Better Auth routes
// ============================================
app.on(["GET", "POST"], "/api/auth/**", async (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});


app.get("/api/me", async (c) => {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  
  if (!session) {
    return c.json({ user: null }, 401);
  }
  
  return c.json({ user: session.user });
});

export default app;