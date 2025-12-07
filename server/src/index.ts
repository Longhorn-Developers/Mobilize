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
// Custom OAuth endpoints
// ============================================

// Google sign-in endpoint - generates OAuth redirect
app.get("/api/auth/signin/google", async (c) => {
  try {
    const state = crypto.randomUUID();
    
    // Use localhost for Google's redirect URI (what's registered in Google Cloud Console)
    const callbackURL = `${c.env.BETTER_AUTH_URL}/api/auth/callback/google`;
    
    const params = new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID,
      redirect_uri: callbackURL,
      response_type: "code",
      scope: "openid profile email",
      state: state,
      access_type: "offline",
      prompt: "consent",
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    
    console.log("Redirecting to Google OAuth with callback:", callbackURL);
    return c.redirect(googleAuthUrl, 302);
  } catch (error) {
    console.error("OAuth signin error:", error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================
// Better Auth routes - catch-all for auth
// ============================================
app.on(["GET", "POST"], "/api/auth/**", async (c) => {
  console.log("Auth route hit:", c.req.path, c.req.method);
  try {
    const auth = createAuth(c.env);
    console.log("Auth created");
    const response = await auth.handler(c.req.raw);
    console.log("Auth response status:", response.status);
    return response;
  } catch (error) {
    console.error("Auth error:", error);
    return c.json({ error: String(error) }, 500);
  }
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