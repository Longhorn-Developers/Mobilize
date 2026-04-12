import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
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

app.use("/*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// ── Auth helpers ───────────────────────────────────────────────────────────────

/** Resolves a Bearer token to a user row, or null if missing/expired/invalid. */
async function getAuthUser(db: any, token: string | undefined) {
  if (!token) return null;
  const session = await db
    .select()
    .from(schema.session)
    .where(eq(schema.session.token, token))
    .get();
  if (!session || new Date(session.expiresAt) < new Date()) return null;
  return (await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .get()) ?? null;
}

/** Returns the user or responds 401 (returns Response). Caller must check. */
async function requireAuth(c: any, db: any) {
  const token = c.req.header("Authorization")?.replace("Bearer ", "").trim();
  const user = await getAuthUser(db, token);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return user;
}

/** Returns the user only if role === "student", otherwise responds 403. */
async function requireStudent(c: any, db: any) {
  const result = await requireAuth(c, db);
  if (result instanceof Response) return result;
  if (result.role !== "student") return c.json({ error: "Forbidden — student account required" }, 403);
  return result;
}

// ── OAuth helpers ──────────────────────────────────────────────────────────────

function encodeOAuthState(nonce: string, callbackURL: string, redirectUri: string): string {
  const payload = JSON.stringify({ n: nonce, cb: callbackURL, ru: redirectUri });
  return btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function decodeOAuthState(state: string): { nonce: string; callbackURL: string; redirectUri: string } | null {
  try {
    const padded = state.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? 0 : 4 - (padded.length % 4);
    const data = JSON.parse(atob(padded + "=".repeat(pad)));
    return { nonce: data.n, callbackURL: data.cb, redirectUri: data.ru };
  } catch {
    return null;
  }
}

// ── Health ─────────────────────────────────────────────────────────────────────

app.get("/", (c) => c.json({ status: "ok" }));

// ── POIs ───────────────────────────────────────────────────────────────────────

app.get("/pois", async (c) => {
  const db = drizzle(c.env.mobilize_db, { schema });
  const pois = await db.select().from(schema.pois);
  return c.json(pois);
});

// ── Avoidance Areas ────────────────────────────────────────────────────────────

app.get("/avoidance_areas", async (c) => {
  const db = drizzle(c.env.mobilize_db, { schema });
  const areas = await db.select().from(schema.avoidance_areas);
  return c.json(areas);
});

app.get("/avoidance_areas/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const db = drizzle(c.env.mobilize_db, { schema });
  const area = await db
    .select()
    .from(schema.avoidance_areas)
    .where(eq(schema.avoidance_areas.id, id))
    .get();
  if (!area) return c.json({ error: "Not found" }, 404);
  return c.json(area);
});

/** Create a new avoidance area. Requires student role. */
app.post("/avoidance_areas", async (c) => {
  const db = drizzle(c.env.mobilize_db, { schema });
  const user = await requireStudent(c, db);
  if (user instanceof Response) return user;

  const body = await c.req.json();
  if (!body.name || !body.boundary_geojson) {
    return c.json({ error: "name and boundary_geojson are required" }, 400);
  }

  const result = await db
    .insert(schema.avoidance_areas)
    .values({
      user_id: user.id,
      name: body.name,
      description: body.description ?? null,
      boundary_geojson: JSON.stringify(body.boundary_geojson),
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning();
  return c.json(result[0]);
});

// ── Avoidance Area Reports ─────────────────────────────────────────────────────

app.get("/avoidance_areas/:id/reports", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);
  const db = drizzle(c.env.mobilize_db, { schema });
  const reports = await db
    .select()
    .from(schema.avoidance_area_reports)
    .where(eq(schema.avoidance_area_reports.avoidance_area_id, id));
  return c.json(reports);
});

/** Post a report/comment on an avoidance area. Requires student role. */
app.post("/avoidance_areas/:id/reports", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const db = drizzle(c.env.mobilize_db, { schema });
  const user = await requireStudent(c, db);
  if (user instanceof Response) return user;

  const body = await c.req.json();
  if (!body.title) return c.json({ error: "title is required" }, 400);

  const result = await db
    .insert(schema.avoidance_area_reports)
    .values({
      user_id: user.id,
      avoidance_area_id: id,
      title: body.title,
      description: body.description ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning();
  return c.json(result);
});

// ── Profile ────────────────────────────────────────────────────────────────────

/**
 * Create / first-time setup of a user's profile.
 * Called from profile-setup.tsx after OAuth sign-in.
 * Also updates users.username and users.name with the chosen values.
 */
app.post("/api/profile", async (c) => {
  const db = drizzle(c.env.mobilize_db, { schema });
  const user = await requireAuth(c, db);
  if (user instanceof Response) return user;

  const body = await c.req.json();
  const { firstName, lastName, username, classYear, major, bio } = body;

  if (!firstName || !lastName || !username) {
    return c.json({ error: "firstName, lastName, and username are required" }, 400);
  }

  const displayName = `${firstName.trim()} ${lastName.trim()}`;

  // Check username uniqueness (allow the user to keep their own username)
  const existingUser = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .get();
  if (existingUser && existingUser.id !== user.id) {
    return c.json({ error: "Username already taken" }, 409);
  }

  // Update the users row with the chosen username and display name
  await db
    .update(schema.users)
    .set({ username: username.trim(), name: displayName, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));

  // Upsert the profile row
  const existing = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.user_id, user.id))
    .get();

  const isAnonymous = typeof body.isAnonymous === "boolean" ? body.isAnonymous : false;

  if (existing) {
    await db
      .update(schema.profiles)
      .set({
        display_name: displayName,
        class_year: classYear ?? existing.class_year,
        major: major ?? existing.major,
        bio: bio ?? existing.bio,
        is_anonymous: isAnonymous,
        updated_at: new Date(),
      })
      .where(eq(schema.profiles.user_id, user.id));
  } else {
    await db.insert(schema.profiles).values({
      user_id: user.id,
      display_name: displayName,
      class_year: classYear ?? null,
      major: major ?? null,
      bio: bio ?? null,
      is_anonymous: isAnonymous,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  const updatedProfile = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.user_id, user.id))
    .get();

  return c.json({ success: true, profile: updatedProfile });
});

/**
 * Update an existing profile. Accepts any subset of profile fields.
 * Called from profile.tsx (edit profile) and mobility-preferences.tsx.
 */
app.put("/api/profile", async (c) => {
  const db = drizzle(c.env.mobilize_db, { schema });
  const user = await requireAuth(c, db);
  if (user instanceof Response) return user;

  const body = await c.req.json();

  const existing = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.user_id, user.id))
    .get();

  // Build update set — only update fields that were provided
  const updates: Record<string, any> = { updated_at: new Date() };
  if (body.displayName !== undefined) updates.display_name = body.displayName;
  if (body.classYear !== undefined) updates.class_year = body.classYear;
  if (body.major !== undefined) updates.major = body.major;
  if (body.bio !== undefined) updates.bio = body.bio;
  if (body.mobilityPreference !== undefined) updates.mobility_preference = body.mobilityPreference;
  if (body.isAnonymous !== undefined) updates.is_anonymous = body.isAnonymous;

  if (existing) {
    await db
      .update(schema.profiles)
      .set(updates)
      .where(eq(schema.profiles.user_id, user.id));
  } else {
    // Profile doesn't exist yet — create it with a display_name fallback
    await db.insert(schema.profiles).values({
      user_id: user.id,
      display_name: body.displayName ?? user.name ?? user.username ?? "User",
      class_year: body.classYear ?? null,
      major: body.major ?? null,
      bio: body.bio ?? null,
      mobility_preference: body.mobilityPreference ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  const updatedProfile = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.user_id, user.id))
    .get();

  return c.json({ success: true, profile: updatedProfile });
});

// ── Public user profile ────────────────────────────────────────────────────────

/** Public profile by username — no auth required. Returns safe public fields only. */
app.get("/api/users/:username", async (c) => {
  const username = c.req.param("username");
  const db = drizzle(c.env.mobilize_db, { schema });

  const user = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      username: schema.users.username,
      image: schema.users.image,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .get();

  if (!user) return c.json({ error: "User not found" }, 404);

  const profile = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.user_id, user.id))
    .get();

  // Respect anonymity — strip identifying fields for public consumers
  if (profile?.is_anonymous) {
    return c.json({
      user: { role: user.role },
      profile: { is_anonymous: true },
    });
  }

  return c.json({ user, profile: profile ?? null });
});

// ── Google OAuth ───────────────────────────────────────────────────────────────

app.get("/api/auth/signin/google", async (c) => {
  const mobileCallbackURL = c.req.query("callbackURL") ?? "";
  const redirectUri = c.req.query("redirectUri") ?? "";

  const baseUrl = c.env.BETTER_AUTH_URL.replace(/\/$/, "");
  const callbackURL = redirectUri || `${baseUrl}/api/auth/callback/google`;

  const nonce = crypto.randomUUID();
  const state = encodeOAuthState(nonce, mobileCallbackURL, redirectUri);

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackURL,
    response_type: "code",
    scope: "openid profile email",
    state: state,
    access_type: "offline",
    prompt: "consent",
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
});

app.get("/api/auth/callback/google", async (c) => {
  try {
    const rawState = c.req.query("state");
    const code = c.req.query("code");
    const error = c.req.query("error");

    const stateData = rawState ? decodeOAuthState(rawState) : null;
    const mobileCallback = stateData?.callbackURL || null;

    if (error) {
      console.error("OAuth error:", error);
      if (mobileCallback) {
        return c.redirect(`${mobileCallback}?error=${encodeURIComponent(error)}`);
      }
      return c.json({ error }, 400);
    }

    if (!code) return c.json({ error: "No authorization code" }, 400);

    const baseUrl = c.env.BETTER_AUTH_URL.replace(/\/$/, "");
    const redirectUri = stateData?.redirectUri || `${baseUrl}/api/auth/callback/google`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return c.json({ error: "Token exchange failed" }, 500);
    }

    const tokens = await tokenResponse.json();

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      return c.json({ error: "Failed to get user info" }, 500);
    }

    const googleUser = await userInfoResponse.json();
    console.log("Google user:", googleUser.email);

    const auth = createAuth(c.env);
    const db = drizzle(c.env.mobilize_db, { schema });

    let user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, googleUser.email))
      .get();

    if (!user) {
      const role = googleUser.email?.endsWith("@utexas.edu") ? "student" : "public";
      const userId = crypto.randomUUID();
      await db.insert(schema.users).values({
        id: userId,
        email: googleUser.email,
        emailVerified: true,
        name: googleUser.name,
        image: googleUser.picture,
        username: null, // Set during profile-setup
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      user = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .get();
    }

    if (!user) return c.json({ error: "Failed to create user" }, 500);

    const sessionToken = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    await db.insert(schema.session).values({
      id: sessionId,
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("Created session for user:", user.email);

    if (mobileCallback) {
      return c.redirect(`${mobileCallback}?session_token=${sessionToken}`);
    }
    return c.redirect("/", 302);
  } catch (error) {
    console.error("Callback error:", error);
    return c.json({ error: String(error) }, 500);
  }
});

// ── Sign out ───────────────────────────────────────────────────────────────────

app.post("/api/auth/signout", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "").trim();
  if (token) {
    const db = drizzle(c.env.mobilize_db, { schema });
    await db.delete(schema.session).where(eq(schema.session.token, token)).run();
  }
  return c.json({ success: true });
});

// ── Better Auth catch-all ──────────────────────────────────────────────────────

app.on(["GET", "POST"], "/api/auth/**", async (c) => {
  console.log("🔴 Better Auth catch-all hit:", c.req.path, c.req.method);
  try {
    const auth = createAuth(c.env);
    const response = await auth.handler(c.req.raw);
    return response;
  } catch (error) {
    console.error("Auth error:", error);
    return c.json({ error: String(error) }, 500);
  }
});

// ── Construction Areas (ArcGIS proxy) ─────────────────────────────────────────

const ARCGIS_URL =
  "https://services9.arcgis.com/w9x0fkENXvuWZY26/arcgis/rest/services/Closed_Areas_view_new/FeatureServer/0/query";
const PAGE_SIZE = 8000;

function buildArcGISUrl(offset: number): string {
  const u = new URL(ARCGIS_URL);
  const p = u.searchParams;
  p.set("f", "json");
  p.set("where", "1=1");
  p.set("returnGeometry", "true");
  p.set("outFields", "OBJECTID");
  p.set("orderByFields", "OBJECTID ASC");
  p.set("outSR", "4326");
  p.set("resultOffset", String(offset));
  p.set("resultRecordCount", String(PAGE_SIZE));
  p.set("cacheHint", "true");
  return u.toString();
}

function convertArcGISFeature(f: any, idx: number): { id: number; points: [number, number][] } | null {
  const attrs = f.attributes ?? {};
  const id = attrs.OBJECTID ?? f.objectId ?? idx;
  const g = f.geometry ?? {};
  const rings: [number, number][][] = g.rings ?? [];
  const paths: [number, number][][] = g.paths ?? [];
  const source = rings.length ? rings[0] : paths.length ? paths[0] : null;
  if (!source) return null;
  const pts = source
    .map(([x, y]: [number, number]) => [Number(y), Number(x)] as [number, number])
    .filter(([lat, lon]: [number, number]) =>
      Number.isFinite(lat) && Number.isFinite(lon) &&
      lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180,
    );
  if (pts.length < 2) return null;
  return { id, points: pts };
}

app.get("/construction_areas", async (c) => {
  try {
    const allFeatures: any[] = [];
    let offset = 0;
    for (;;) {
      const res = await fetch(buildArcGISUrl(offset), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return c.json({ error: `ArcGIS HTTP ${res.status}` }, 502);
      const json: any = await res.json();
      if (json.error) return c.json({ error: `ArcGIS error: ${JSON.stringify(json.error)}` }, 502);
      const feats: any[] = json.features ?? [];
      allFeatures.push(...feats);
      const more = json.exceededTransferLimit === true || feats.length === PAGE_SIZE;
      if (!more || feats.length === 0) break;
      offset += feats.length;
    }
    const rows = allFeatures
      .map((f, i) => convertArcGISFeature(f, i))
      .filter(Boolean);
    return c.json(rows);
  } catch (err: any) {
    console.error("[construction_areas] proxy error:", err.message);
    return c.json({ error: err.message }, 502);
  }
});

// ── /api/me ────────────────────────────────────────────────────────────────────

/** Returns the current user + their profile, or { user: null } if unauthenticated. */
app.get("/api/me", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "").trim();
  if (!token) return c.json({ user: null }, 401);

  const db = drizzle(c.env.mobilize_db, { schema });
  const session = await db
    .select()
    .from(schema.session)
    .where(eq(schema.session.token, token))
    .get();

  if (!session || new Date(session.expiresAt) < new Date()) {
    return c.json({ user: null }, 401);
  }

  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .get();

  if (!user) return c.json({ user: null }, 401);

  const profile = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.user_id, user.id))
    .get();

  return c.json({ user, profile: profile ?? null });
});

export default app;
