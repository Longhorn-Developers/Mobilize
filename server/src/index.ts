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

type GoogleTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
};

type GoogleUserInfo = {
  email: string;
  name?: string;
  picture?: string;
};

type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

const jsonError = (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) => {
  return c.json(
    {
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    status as any,
  );
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown error");
};

const isMissingTableError = (error: unknown) => {
  const message = getErrorMessage(error);
  return /no such table/i.test(message);
};

const jsonInternalError = (
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  fallbackMessage: string,
  error: unknown,
) => {
  if (isMissingTableError(error)) {
    return jsonError(
      c,
      503,
      "INTERNAL_ERROR",
      "Database schema is missing required tables. Apply D1 migrations in this environment.",
      {
        hint:
          "Run `pnpm --dir server run migrate:local` for wrangler dev, or `pnpm --dir server run migrate:remote` for deployed environments.",
        cause: getErrorMessage(error),
      },
    );
  }

  return jsonError(c, 500, "INTERNAL_ERROR", fallbackMessage, getErrorMessage(error));
};

const REQUIRED_TABLES = [
  "user",
  "session",
  "profiles",
  "pois",
  "reviews",
  "votes",
  "avoidance_areas",
  "avoidance_area_reports",
] as const;

let hasLoggedTableDiagnostics = false;

const isGoogleTokenResponse = (value: unknown): value is GoogleTokenResponse => {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).access_token === "string"
  );
};

const isGoogleUserInfo = (value: unknown): value is GoogleUserInfo => {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).email === "string"
  );
};

const getProfile = async (c: Context<{ Bindings: Bindings, Variables: Variables }>) => {
  const db = c.get("db");
  const token = c.req.header("Authorization")?.replace("Bearer ", "").trim();
  const user = await getAuthUser(db, token);
  if (!user) return null;
  const normalizedUser = await ensureStudentRole(db, user);

  const profile = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.user_id, normalizedUser.id))
    .get();

  return profile ?? null;
};

const getMissingTables = async (d1: D1Database) => {
  const result = await d1
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all<{ name: string }>();

  const presentTables = new Set(
    (result.results ?? []).map((row) => String(row.name)),
  );

  return REQUIRED_TABLES.filter((tableName) => !presentTables.has(tableName));
};

const isProfileOnboardingComplete = (profile: any): boolean =>
  Boolean(profile?.onboarding_completed_at);

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

async function ensureStudentRole(db: any, user: any) {
  const email = String(user?.email ?? "").toLowerCase();
  if (email.endsWith("@utexas.edu") && user.role !== "student") {
    await db
      .update(schema.users)
      .set({ role: "student", updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));
    return { ...user, role: "student" };
  }
  return user;
}

/** Returns the user or responds 401 (returns Response). Caller must check. */
async function requireAuth(c: any, db: any) {
  const token = c.req.header("Authorization")?.replace("Bearer ", "").trim();
  const user = await getAuthUser(db, token);
  if (!user) {
    return jsonError(c, 401, "UNAUTHORIZED", "Unauthorized");
  }
  return ensureStudentRole(db, user);
}

/** Returns the user only if role === "student", otherwise responds 403. */
async function requireStudent(c: any, db: any) {
  const result = await requireAuth(c, db);
  if (result instanceof Response) return result;
  if (result.role !== "student") {
    return jsonError(c, 403, "FORBIDDEN", "Student account required");
  }
  return result;
}

async function requireCompletedProfile(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
) {
  const profile = await getProfile(c);
  if (!profile) {
    return jsonError(c, 404, "NOT_FOUND", "Profile not found");
  }
  if (!isProfileOnboardingComplete(profile)) {
    return jsonError(
      c,
      403,
      "FORBIDDEN",
      "Complete onboarding before posting reviews or votes",
    );
  }
  return profile;
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
  if (!hasLoggedTableDiagnostics) {
    hasLoggedTableDiagnostics = true;
    try {
      const missingTables = await getMissingTables(c.env.mobilize_db);
      if (missingTables.length > 0) {
        console.error("[startup] Missing required tables:", missingTables.join(", "));
      } else {
        console.log("[startup] Table diagnostics OK");
      }
    } catch (error) {
      console.error("[startup] Failed to run table diagnostics:", error);
    }
  }
  await next();
});

// stores mobile callback URLs (in production, use Cloudflare KV or database)
const pendingCallbacks = new Map<string, string>();

// ── Health ─────────────────────────────────────────────────────────────────────

app.get("/", (c) => c.json({ status: "ok" }));

app.get("/health", async (c) => {
  try {
    const missingTables = await getMissingTables(c.env.mobilize_db);
    if (missingTables.length > 0) {
      return c.json(
        {
          status: "degraded",
          missingTables,
        },
        500,
      );
    }

    return c.json({ status: "ok", missingTables: [] });
  } catch (error) {
    return jsonError(c, 500, "INTERNAL_ERROR", "Health check failed", String(error));
  }
});

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
    return jsonError(c, 400, "BAD_REQUEST", "Invalid Area ID");
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
    return jsonError(c, 404, "NOT_FOUND", "Area not found");
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
    return jsonError(c, 400, "BAD_REQUEST", "Invalid JSON body");
  }

  const { name, description, boundary_geojson } = body;

  if (!name || !boundary_geojson) {
    return jsonError(c, 400, "BAD_REQUEST", "Missing required fields");
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
    return jsonError(c, 400, "BAD_REQUEST", "Area ID is required");
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
  if (isNaN(id)) return jsonError(c, 400, "BAD_REQUEST", "Invalid id");

  const db = c.get("db");
  const user = await requireStudent(c, db);
  if (user instanceof Response) return user;

  let body: any;
  try {
    body = await c.req.json();
  } catch (error) {
    return jsonError(c, 400, "BAD_REQUEST", "Invalid JSON body");
  }
  if (!body.title) return jsonError(c, 400, "BAD_REQUEST", "title is required");

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
  const db = c.get("db");
  const user = await requireAuth(c, db);
  if (user instanceof Response) return user;

  const profile = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.user_id, user.id))
    .get();

  if (!profile) {
    return jsonError(c, 404, "NOT_FOUND", "Profile not found");
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

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, "BAD_REQUEST", "Invalid JSON body");
  }
  const { firstName, lastName, username, classYear, major, bio } = body;

  if (!firstName || !lastName || !username) {
    return jsonError(
      c,
      400,
      "BAD_REQUEST",
      "firstName, lastName, and username are required",
    );
  }

  const displayName = `${firstName.trim()} ${lastName.trim()}`;

  const existingUser = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .get();
  if (existingUser && existingUser.id !== user.id) {
    return jsonError(c, 409, "CONFLICT", "Username already taken");
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
        onboarding_completed_at: existing.onboarding_completed_at ?? null,
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
      onboarding_completed_at: null,
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

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, "BAD_REQUEST", "Invalid JSON body");
  }

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
  if (body.onboardingComplete === true) updates.onboarding_completed_at = new Date();
  if (body.onboardingComplete === false) updates.onboarding_completed_at = null;

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
      is_anonymous: body.isAnonymous ?? false,
      onboarding_completed_at: body.onboardingComplete === true ? new Date() : null,
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

  if (!user) return jsonError(c, 404, "NOT_FOUND", "User not found");

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

    if (!code) return jsonError(c, 400, "BAD_REQUEST", "No authorization code");

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
      // Retry once with the same redirect URI used in the original exchange.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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
    }
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return jsonError(c, 500, "INTERNAL_ERROR", "Token exchange failed", errorData);
    }

    const tokenPayload: unknown = await tokenResponse.json();
    if (!isGoogleTokenResponse(tokenPayload)) {
      return jsonError(c, 500, "INTERNAL_ERROR", "Invalid Google token response");
    }
    const tokens = tokenPayload;

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      return jsonError(c, 500, "INTERNAL_ERROR", "Failed to get user info");
    }

    const userPayload: unknown = await userInfoResponse.json();
    if (!isGoogleUserInfo(userPayload)) {
      return jsonError(c, 500, "INTERNAL_ERROR", "Invalid Google user response");
    }
    const googleUser = userPayload;
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

    if (!user) return jsonError(c, 500, "INTERNAL_ERROR", "Failed to create user");

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
    return jsonError(c, 500, "INTERNAL_ERROR", "OAuth callback failed", getErrorMessage(error));
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

// Better Auth catch-all intentionally disabled.
// Custom Google OAuth + bearer session routes are the canonical auth path.

// ── Construction Areas (ArcGIS proxy) ─────────────────────────────────────────

const ARCGIS_URL =
  "https://services9.arcgis.com/w9x0fkENXvuWZY26/arcgis/rest/services/Closed_Areas_view_new/FeatureServer/0/query";
const PAGE_SIZE = 1500;
const CONSTRUCTION_CACHE_TTL_MS = 60 * 1000;
const ARCGIS_TIMEOUT_MS = 12000;

let constructionCache:
  | {
      expiresAt: number;
      rows: { id: number; points: [number, number][]; description?: string }[];
    }
  | null = null;

function buildArcGISUrl(offset: number): string {
  const u = new URL(ARCGIS_URL);
  const p = u.searchParams;
  p.set("f", "json");
  p.set("where", "1=1");
  p.set("returnGeometry", "true");
  p.set("outFields", "*");
  p.set("orderByFields", "OBJECTID ASC");
  p.set("outSR", "4326");
  p.set("resultOffset", String(offset));
  p.set("resultRecordCount", String(PAGE_SIZE));
  p.set("cacheHint", "true");
  return u.toString();
}

async function fetchArcGISPage(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function convertArcGISFeature(
  f: any,
  idx: number,
): { id: number; points: [number, number][]; description?: string } | null {
  const attrs = f.attributes ?? {};
  const id = attrs.OBJECTID ?? f.objectId ?? idx;
  const description =
    attrs.Area_Description ??
    attrs.Description ??
    attrs.DESCRIPTION ??
    attrs.Name ??
    attrs.NAME ??
    null;
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
  return {
    id,
    points: pts,
    description: description ? String(description) : undefined,
  };
}

app.get("/construction_areas", async (c) => {
  if (constructionCache && constructionCache.expiresAt > Date.now()) {
    return c.json(constructionCache.rows);
  }

  try {
    const allFeatures: any[] = [];
    let offset = 0;
    for (;;) {
      const res = await fetchArcGISPage(buildArcGISUrl(offset), ARCGIS_TIMEOUT_MS);
      if (!res.ok) {
        return jsonError(c, 502, "INTERNAL_ERROR", `ArcGIS HTTP ${res.status}`);
      }
      const json: any = await res.json();
      if (json.error) {
        return jsonError(c, 502, "INTERNAL_ERROR", "ArcGIS error", json.error);
      }
      const feats: any[] = json.features ?? [];
      allFeatures.push(...feats);
      const more = json.exceededTransferLimit === true || feats.length === PAGE_SIZE;
      if (!more || feats.length === 0) break;
      offset += feats.length;
    }
    const rows = allFeatures
      .map((f, i) => convertArcGISFeature(f, i))
      .filter(Boolean);

    constructionCache = {
      expiresAt: Date.now() + CONSTRUCTION_CACHE_TTL_MS,
      rows: rows as { id: number; points: [number, number][]; description?: string }[],
    };

    return c.json(rows);
  } catch (err: any) {
    console.error("[construction_areas] proxy error:", err.message);
    if (constructionCache?.rows?.length) {
      return c.json(constructionCache.rows);
    }
    if (err?.name === "AbortError") {
      return jsonError(c, 504, "INTERNAL_ERROR", "ArcGIS request timed out");
    }
    return jsonError(c, 502, "INTERNAL_ERROR", err.message ?? "Construction proxy error");
  }
});

// ── /api/me ────────────────────────────────────────────────────────────────────

/** Returns the current user + their profile, or { user: null } if unauthenticated. */
app.get("/api/me", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "").trim();
  if (!token) {
    return c.json({ user: null, profile: null, onboardingComplete: false }, 401);
  }

  const db = c.get("db");
  const authUser = await getAuthUser(db, token);
  if (!authUser) {
    return c.json({ user: null, profile: null, onboardingComplete: false }, 401);
  }

  const user = await ensureStudentRole(db, authUser);

  const profile = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.user_id, user.id))
    .get();

  const onboardingComplete = isProfileOnboardingComplete(profile);
  return c.json({ user, profile: profile ?? null, onboardingComplete });
});

// ── Reviews ────────────────────────────────────────────────────────────────────

// GET non-deleted reviews by poi id
app.get("/reviews", async (c) => {
  try {
    const db = c.get("db");
    const poiIdParam = Number(c.req.query("poi_id"));
    if (!Number.isFinite(poiIdParam) || poiIdParam <= 0) {
      return jsonError(c, 400, "BAD_REQUEST", "poi_id must be a positive integer");
    }
    const poiId = Math.trunc(poiIdParam);

    // Optional profile context: authenticated users receive user_vote, anonymous users receive null.
    const profile = await getProfile(c);

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
      if (profile && vote.user_id === profile.id) {
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
    return jsonInternalError(c, "Failed to load reviews", error);
  }
});

// POST insert new review
app.post("/reviews", async (c) => {
  try {
    const db = c.get("db");

    const profile = await requireCompletedProfile(c);
    if (profile instanceof Response) return profile;

    let body;
    try {
      body = await c.req.json();
    } catch (e) {
      console.error("Error parsing JSON body:", e);
      return jsonError(c, 400, "BAD_REQUEST", "Invalid JSON body");
    }

    const { poi_id, rating, features, content } = body;
    const normalizedPoiId = Number(poi_id);
    const normalizedRating = Number(rating);
    const normalizedPoiIdInt = Math.trunc(normalizedPoiId);
    const normalizedRatingInt = Math.trunc(normalizedRating);

    const isRatingValid =
      Number.isFinite(normalizedRating) &&
      Number.isInteger(normalizedRating) &&
      normalizedRatingInt >= 1 &&
      normalizedRatingInt <= 5;

    if (
      !Number.isFinite(normalizedPoiId) ||
      normalizedPoiId <= 0 ||
      !isRatingValid
    ) {
      return jsonError(
        c,
        400,
        "BAD_REQUEST",
        "poi_id must be a positive integer and rating must be an integer from 1 to 5",
      );
    }

    if (features !== undefined && features !== null && typeof features !== "string") {
      return jsonError(c, 400, "BAD_REQUEST", "features must be a JSON string or null");
    }

    if (content !== undefined && content !== null && typeof content !== "string") {
      return jsonError(c, 400, "BAD_REQUEST", "content must be a string or null");
    }

    const poi = await db
      .select({ id: schema.pois.id })
      .from(schema.pois)
      .where(eq(schema.pois.id, normalizedPoiIdInt))
      .get();
    if (!poi) {
      return jsonError(c, 400, "BAD_REQUEST", "Invalid POI ID");
    }

    const existingReview = await db
      .select()
      .from(schema.reviews)
      .where(
        and(
          eq(schema.reviews.user_id, profile.id),
          eq(schema.reviews.poi_id, normalizedPoiIdInt),
          isNull(schema.reviews.deleted_at),
        ),
      )
      .orderBy(desc(schema.reviews.updated_at))
      .get();

    const result = existingReview
      ? await db
          .update(schema.reviews)
          .set({
            rating: normalizedRatingInt,
            features: features ?? null,
            content: content ?? null,
          })
          .where(eq(schema.reviews.id, existingReview.id))
          .returning()
      : await db
          .insert(schema.reviews)
          .values({
            user_id: profile.id,
            poi_id: normalizedPoiIdInt,
            rating: normalizedRatingInt,
            features: features ?? null,
            content: content ?? null,
          })
          .returning();

    return c.json(result);
  } catch (error) {
    console.error("Error creating review:", error);
    return jsonInternalError(c, "Failed to create review", error);
  }
});

// PUT update single existing review
app.put("/reviews/:id", async (c) => {
  try {
    const db = c.get("db");
    const reviewId = Number(c.req.param("id"));

    if (!Number.isFinite(reviewId) || reviewId <= 0) {
      return jsonError(c, 400, "BAD_REQUEST", "Invalid review ID");
    }

    const profile = await requireCompletedProfile(c);
    if (profile instanceof Response) return profile;

    const review = await db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.id, Math.trunc(reviewId)))
      .get();
    if (!review || review.user_id !== profile.id) {
      return jsonError(c, 403, "FORBIDDEN", "Forbidden");
    }

    let body;
    try {
      body = await c.req.json();
    } catch (e) {
      console.error("Error parsing JSON body:", e);
      return jsonError(c, 400, "BAD_REQUEST", "Invalid JSON body");
    }

    const normalizedRating = Number(body.rating);
    const normalizedRatingInt = Math.trunc(normalizedRating);
    const normalizedPoiId =
      body.poi_id !== undefined ? Number(body.poi_id) : review.poi_id;
    const normalizedPoiIdInt = Math.trunc(normalizedPoiId);
    const isRatingValid =
      Number.isFinite(normalizedRating) &&
      Number.isInteger(normalizedRating) &&
      normalizedRatingInt >= 1 &&
      normalizedRatingInt <= 5;

    if (!isRatingValid) {
      return jsonError(c, 400, "BAD_REQUEST", "rating must be an integer from 1 to 5");
    }

    if (
      !Number.isFinite(normalizedPoiId) ||
      !Number.isInteger(normalizedPoiId) ||
      normalizedPoiIdInt <= 0
    ) {
      return jsonError(c, 400, "BAD_REQUEST", "poi_id must be a positive integer");
    }

    const poiExists = await db
      .select({ id: schema.pois.id })
      .from(schema.pois)
      .where(eq(schema.pois.id, normalizedPoiIdInt))
      .get();
    if (!poiExists) {
      return jsonError(c, 400, "BAD_REQUEST", "Invalid POI ID");
    }

    if (body.features !== undefined && body.features !== null && typeof body.features !== "string") {
      return jsonError(c, 400, "BAD_REQUEST", "features must be a JSON string or null");
    }

    if (body.content !== undefined && body.content !== null && typeof body.content !== "string") {
      return jsonError(c, 400, "BAD_REQUEST", "content must be a string or null");
    }

    const result = await db
      .update(schema.reviews)
      .set({
        rating: normalizedRatingInt,
        poi_id: normalizedPoiIdInt,
        features: body.features ?? null,
        content: body.content ?? null,
      })
      .where(eq(schema.reviews.id, Math.trunc(reviewId)))
      .returning();

    return c.json(result);
  } catch (error) {
    console.error("Error updating review:", error);
    return jsonInternalError(c, "Failed to update review", error);
  }
});

// PUT soft delete review
app.put("/reviews/:id/delete", async (c) => {
  try {
    const db = c.get("db");
    const reviewId = Number(c.req.param("id"));

    if (!Number.isFinite(reviewId) || reviewId <= 0) {
      return jsonError(c, 400, "BAD_REQUEST", "Invalid review ID");
    }

    const profile = await requireCompletedProfile(c);
    if (profile instanceof Response) return profile;

    const review = await db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.id, Math.trunc(reviewId)))
      .get();
    if (!review || review.user_id !== profile.id) {
      return jsonError(c, 403, "FORBIDDEN", "Forbidden");
    }

    const result = await db
      .update(schema.reviews)
      .set({ deleted_at: sql`(unixepoch())` })
      .where(eq(schema.reviews.id, Math.trunc(reviewId)))
      .returning();

    return c.json(result);
  } catch (error) {
    console.error("Error deleting review:", error);
    return jsonInternalError(c, "Failed to delete review", error);
  }
});

// ── Votes ──────────────────────────────────────────────────────────────────────

// POST /votes - upsert a vote
app.post("/votes", async (c) => {
  try {
    const profile = await requireCompletedProfile(c);
    if (profile instanceof Response) return profile;

    const db = c.get("db");

    let body;
    try {
      body = await c.req.json();
    } catch (e) {
      console.error("Error parsing JSON body:", e);
      return jsonError(c, 400, "BAD_REQUEST", "Invalid JSON body");
    }

    const reviewId = Number(body.review_id);
    const vote = Number(body.vote);
    if (!Number.isFinite(reviewId) || reviewId <= 0 || !Number.isInteger(reviewId)) {
      return jsonError(c, 400, "BAD_REQUEST", "review_id must be a positive integer");
    }
    if (vote !== 1 && vote !== -1) {
      return jsonError(c, 400, "BAD_REQUEST", "vote must be 1 or -1");
    }

    const review = await db
      .select({ id: schema.reviews.id })
      .from(schema.reviews)
      .where(and(eq(schema.reviews.id, Math.trunc(reviewId)), isNull(schema.reviews.deleted_at)))
      .get();
    if (!review) {
      return jsonError(c, 404, "NOT_FOUND", "Review not found");
    }

    const result = await db
      .insert(schema.votes)
      .values({
        user_id: profile.id,
        review_id: Math.trunc(reviewId),
        vote: vote as 1 | -1,
      })
      .onConflictDoUpdate({
        target: [schema.votes.user_id, schema.votes.review_id],
        set: { vote: vote as 1 | -1 },
      })
      .returning();

    return c.json(result);
  } catch (error) {
    console.error("Error upserting vote:", error);
    return jsonInternalError(c, "Failed to save vote", error);
  }
});

// DELETE active user's vote on specified review
app.delete("/votes/:review_id", async (c) => {
  try {
    const db = c.get("db");
    const reviewId = Number(c.req.param("review_id"));

    if (!Number.isFinite(reviewId) || reviewId <= 0 || !Number.isInteger(reviewId)) {
      return jsonError(c, 400, "BAD_REQUEST", "Invalid review ID");
    }

    const profile = await requireCompletedProfile(c);
    if (profile instanceof Response) return profile;

    const result = await db
      .delete(schema.votes)
      .where(and(eq(schema.votes.user_id, profile.id), eq(schema.votes.review_id, Math.trunc(reviewId))))
      .returning();

    return c.json(result);
  } catch (error) {
    console.error("Error deleting vote:", error);
    return jsonInternalError(c, "Failed to delete vote", error);
  }
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
