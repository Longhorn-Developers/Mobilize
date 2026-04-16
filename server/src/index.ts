import { eq, getTableColumns, sql, and, isNull, inArray, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Context, Hono } from "hono";
import { cors } from "hono/cors";

import { createAuth } from "./auth";
import * as schema from "./db/schema";
import { syncPOIs } from "./scheduled/poi-sync";

type Bindings = {
  mobilize_db: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
};

type Variables = {
  auth: ReturnType<typeof createAuth>;
  db: ReturnType<typeof drizzle>;
};

const getProfile = async (c: Context<{ Bindings: Bindings, Variables: Variables }>) => {
  const auth = c.get("auth");
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return null;

  const db = c.get("db");
  const profile = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.user_id, session.user.id))
    .get();

  return profile ?? null;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

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

// ── Auth and db middleware (once per request) ──────────────────────────────────
app.use("/*", async (c, next) => {
  c.set("auth", createAuth(c.env));
  c.set("db", drizzle(c.env.mobilize_db, { schema }));
  await next();
});

// stores mobile callback URLs (in production, use Cloudflare KV or database)
const pendingCallbacks = new Map<string, string>();

// ── Health ─────────────────────────────────────────────────────────────────────

app.get("/", (c) => c.json({ status: "ok" }));

// ── POIs ───────────────────────────────────────────────────────────────────────

app.get("/pois", async (c) => {
  const db = c.get("db");
  const pois = await db.select().from(schema.pois);
  return c.json(pois);
});

// ── Avoidance Areas ────────────────────────────────────────────────────────────

app.get("/avoidance_areas", async (c) => {
  const db = c.get("db");
  const areas = await db.select().from(schema.avoidance_areas).all();
  return c.json(areas);
});

app.get("/avoidance_areas/:id", async (c) => {
  const db = c.get("db");
  const areaId = Number(c.req.param("id"));

  if (isNaN(areaId)) {
    return c.text("Invalid Area ID", 400);
  }

  const area = await db
    .select({
      ...getTableColumns(schema.avoidance_areas),
      profile_display_name: schema.profiles.display_name,
      profile_avatar_url: schema.profiles.avatar_url,
    })
    .from(schema.avoidance_areas)
    .leftJoin(schema.profiles, eq(schema.avoidance_areas.user_id, schema.profiles.user_id))
    .where(eq(schema.avoidance_areas.id, areaId))
    .get();

  if (!area) {
    return c.text("Area not found", 404);
  }

  return c.json(area);
});

/** Create a new avoidance area. Requires student role. */
app.post("/avoidance_areas", async (c) => {
  const db = c.get("db");
  const user = await requireStudent(c, db);
  if (user instanceof Response) return user;

  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    console.error("Error parsing JSON body:", e);
    return c.text("Invalid JSON body", 400);
  }

  const { name, description, boundary_geojson } = body;

  if (!name || !boundary_geojson) {
    return c.text("Missing required fields", 400);
  }

  const result = await db
    .insert(schema.avoidance_areas)
    .values({
      user_id: user.id,
      name,
      description: description || null,
      boundary_geojson: JSON.stringify(boundary_geojson),
    })
    .returning();

  return c.json(result);
});

// ── Avoidance Area Reports ─────────────────────────────────────────────────────

app.get("/avoidance_areas/:id/reports", async (c) => {
  const db = c.get("db");
  const areaId = c.req.param("id");

  if (!areaId) {
    return c.text("Area ID is required", 400);
  }

  const reports = await db
    .select({
      ...getTableColumns(schema.avoidance_area_reports),
      profile_display_name: schema.profiles.display_name,
      profile_avatar_url: schema.profiles.avatar_url,
    })
    .from(schema.avoidance_area_reports)
    .leftJoin(schema.profiles, eq(schema.avoidance_area_reports.user_id, schema.profiles.user_id))
    .where(eq(schema.avoidance_area_reports.avoidance_area_id, Number(areaId)))
    .all();

  return c.json(reports);
});

/** Post a report/comment on an avoidance area. Requires student role. */
app.post("/avoidance_areas/:id/reports", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const db = c.get("db");
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

// GET current active profile (legacy)
app.get("/profiles/me", async (c) => {
  const auth = c.get("auth");
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = c.get("db");
  const profile = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.user_id, session.user.id))
    .get();

  if (!profile) {
    return c.json({ error: "Profile Not Found -> prompt login/signup" }, 404);
  }
  return c.json(profile);
});

/**
 * Create / first-time setup of a user's profile.
 * Called from profile-setup.tsx after OAuth sign-in.
 * Also updates users.username and users.name with the chosen values.
 */
app.post("/api/profile", async (c) => {
  const db = c.get("db");
  const user = await requireAuth(c, db);
  if (user instanceof Response) return user;

  const body = await c.req.json();
  const { firstName, lastName, username, classYear, major, bio } = body;

  if (!firstName || !lastName || !username) {
    return c.json({ error: "firstName, lastName, and username are required" }, 400);
  }

  const displayName = `${firstName.trim()} ${lastName.trim()}`;

  const existingUser = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .get();
  if (existingUser && existingUser.id !== user.id) {
    return c.json({ error: "Username already taken" }, 409);
  }

  await db
    .update(schema.users)
    .set({ username: username.trim(), name: displayName, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));

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
  const db = c.get("db");
  const user = await requireAuth(c, db);
  if (user instanceof Response) return user;

  const body = await c.req.json();

  const existing = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.user_id, user.id))
    .get();

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
  const db = c.get("db");

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

  if (mobileCallbackURL) {
    pendingCallbacks.set(state, mobileCallbackURL);
  }

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
    const mobileCallback = stateData?.callbackURL || pendingCallbacks.get(rawState ?? "") || null;

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

    // Exchange code for Google tokens
    let tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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
      // retry fetch one time
      console.log("Retrying fetch...");
      await new Promise(r => setTimeout(r, 1000));
      tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code,
          client_id: c.env.GOOGLE_CLIENT_ID,
          client_secret: c.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: `${c.env.BETTER_AUTH_URL}/api/auth/callback/google`,
          grant_type: "authorization_code",
        }),
      });

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

      // Create a placeholder profile for the new user
      await db.insert(schema.profiles).values({
        user_id: userId,
        display_name: googleUser.name || "",
        avatar_url: googleUser.picture || null,
      }).onConflictDoNothing();

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

  const db = c.get("db");
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

// ── Reviews ────────────────────────────────────────────────────────────────────

// GET non-deleted reviews by poi id
app.get("/reviews", async (c) => {
  try {
    const db = c.get("db");
    const poiId = Number(c.req.query("poi_id"));

    if (!poiId) {
      return c.json({ error: "POI ID is required" }, 400);
    }

    const profile = await getProfile(c);
    if (!profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    const reviewsList = await db
      .select({
        ...getTableColumns(schema.reviews),
        profile_display_name: schema.profiles.display_name,
        profile_avatar_url: schema.profiles.avatar_url,
      })
      .from(schema.reviews)
      .leftJoin(schema.profiles, eq(schema.reviews.user_id, schema.profiles.id))
      .where(and(eq(schema.reviews.poi_id, poiId), isNull(schema.reviews.deleted_at)))
      .orderBy(desc(schema.reviews.updated_at))
      .all();

    if (reviewsList.length === 0) {
      return c.json([]);
    }

    const reviewIds = reviewsList.map((review) => review.id);
    const voteRows = await db
      .select({
        review_id: schema.votes.review_id,
        user_id: schema.votes.user_id,
        vote: schema.votes.vote,
      })
      .from(schema.votes)
      .where(inArray(schema.votes.review_id, reviewIds))
      .all();

    const voteSummaryByReviewId = new Map<number, { vote_count: number; user_vote: number | null }>();

    for (const vote of voteRows) {
      const summary = voteSummaryByReviewId.get(vote.review_id) ?? {
        vote_count: 0,
        user_vote: null,
      };

      summary.vote_count += vote.vote;
      if (vote.user_id === profile.id) {
        summary.user_vote = vote.vote;
      }

      voteSummaryByReviewId.set(vote.review_id, summary);
    }

    return c.json(
      reviewsList.map((review) => {
        const summary = voteSummaryByReviewId.get(review.id);
        return {
          ...review,
          vote_count: summary?.vote_count ?? 0,
          user_vote: summary?.user_vote ?? null,
        };
      }),
    );
  } catch (error) {
    console.error("Error loading reviews:", error);
    return c.json({ error: "Failed to load reviews" }, 500);
  }
});

// POST insert new review
app.post("/reviews", async (c) => {
  try {
    const db = c.get("db");

    const profile = await getProfile(c);
    if (!profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    let body;
    try {
      body = await c.req.json();
    } catch (e) {
      console.error("Error parsing JSON body:", e);
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const { poi_id, rating, features, content } = body;

    if (!rating || !poi_id) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const result = await db
      .insert(schema.reviews)
      .values({
        user_id: profile.id,
        poi_id,
        rating,
        features,
        content,
      })
      .returning();

    return c.json(result);
  } catch (error) {
    console.error("Error creating review:", error);
    return c.json({ error: "Failed to create review" }, 500);
  }
});

// PUT update single existing review
app.put("/reviews/:id", async (c) => {
  const db = c.get("db");
  const reviewId = Number(c.req.param("id"));

  if (isNaN(reviewId)) {
    return c.json({ error: "Invalid review ID" }, 400);
  }

  const profile = await getProfile(c);
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const review = await db.select().from(schema.reviews)
    .where(eq(schema.reviews.id, reviewId)).get();
  if (!review || review.user_id !== profile.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    console.error("Error parsing JSON body:", e);
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { rating, features, content } = body;

  if (!rating) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const result = await db
    .update(schema.reviews)
    .set({ rating, features, content })
    .where(eq(schema.reviews.id, reviewId))
    .returning();

  return c.json(result);
});

// PUT soft delete review
app.put("/reviews/:id/delete", async (c) => {
  const db = c.get("db");
  const reviewId = Number(c.req.param("id"));

  if (isNaN(reviewId)) {
    return c.json({ error: "Invalid review ID" }, 400);
  }

  const profile = await getProfile(c);
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const review = await db.select().from(schema.reviews)
    .where(eq(schema.reviews.id, reviewId)).get();
  if (!review || review.user_id !== profile.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const result = await db
    .update(schema.reviews)
    .set({ deleted_at: sql`(unixepoch())` })
    .where(eq(schema.reviews.id, reviewId))
    .returning();

  return c.json(result);
});

// ── Votes ──────────────────────────────────────────────────────────────────────

// POST /votes - upsert a vote
app.post("/votes", async (c) => {
  const profile = await getProfile(c);
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const db = c.get("db");

  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    console.error("Error parsing JSON body:", e);
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { review_id, vote } = body;

  const result = await db
    .insert(schema.votes)
    .values({
      user_id: profile.id,
      review_id,
      vote,
    })
    .onConflictDoUpdate({
      target: [schema.votes.user_id, schema.votes.review_id],
      set: { vote },
    })
    .returning();

  return c.json(result);
});

// DELETE active user's vote on specified review
app.delete("/votes/:review_id", async (c) => {
  const db = c.get("db");
  const reviewId = Number(c.req.param("review_id"));

  if (isNaN(reviewId)) {
    return c.json({ error: "Invalid review ID" }, 400);
  }

  const profile = await getProfile(c);
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const result = await db.delete(schema.votes)
    .where(and(eq(schema.votes.user_id, profile.id), eq(schema.votes.review_id, reviewId)))
    .returning();

  return c.json(result);
});

// ── Default export ─────────────────────────────────────────────────────────────

export default {
  fetch: app.fetch,
  // Scheduled handler for cron triggers
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`Cron trigger fired at ${new Date(event.scheduledTime).toISOString()}`);
    ctx.waitUntil(syncPOIs(env));
  },
};
