import { Hono, Context } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import { eq, getTableColumns, sql, and, isNull } from "drizzle-orm";
import * as schema from "./db/schema";
import { createAuth } from "./auth";
<<<<<<< HEAD
import { syncPOIs } from "./scheduled/poi-sync";
=======
import { syncPOIs } from './scheduled/poi-sync';
>>>>>>> f8797be6126544728afc887ead7c9e6f0fe7a84f

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

// Auth and db middleware (once per request)
app.use("/*", async (c, next) => {
  c.set("auth", createAuth(c.env));
  c.set("db", drizzle(c.env.mobilize_db, { schema }));
  await next();
});

// stores mobile callback URLs (in production, we should prob use Cloudflare KV or database)
const pendingCallbacks = new Map<string, string>();

// testing endpoint
app.get("/", (c) => c.json({ status: "ok" }));

// POIs endpoint
app.get("/pois", async (c) => {
  const db = c.get("db");
  const pois = await db.select().from(schema.pois);
  return c.json(pois);
});

// Avoidance areas endpoint
app.get("/avoidance_areas", async (c) => {
  const db = c.get("db");
  const areas = await db.select().from(schema.avoidance_areas);
  return c.json(areas);
});

// Google OAuth sign-in endpoint
app.get("/api/auth/signin/google", async (c) => {
  const mobileCallbackURL = c.req.query("callbackURL");
  const state = crypto.randomUUID();
  
  // Store mobile callback if provided
  if (mobileCallbackURL) {
    pendingCallbacks.set(state, mobileCallbackURL);
    // console.log("Stored mobile callback for state:", state, "->", mobileCallbackURL);
  }
  
  // builds Google OAuth URL
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
  
  // console.log("Redirecting to Google OAuth");
  return c.redirect(googleAuthUrl, 302);
});

// Custom callback handler - processes Google OAuth callback manually
app.get("/api/auth/callback/google", async (c) => {
  // console.log("custom callback handler hit");
  
  try {
    const state = c.req.query("state");
    const code = c.req.query("code");
    const error = c.req.query("error");

    // console.log("Callback received - state:", state, "code:", code ? "present" : "missing");

    // Check for OAuth errors
    if (error) {
      console.error("OAuth error:", error);
      const mobileCallback = state ? pendingCallbacks.get(state) : null;
      if (mobileCallback && state) {
        pendingCallbacks.delete(state);
        return c.redirect(`${mobileCallback}?error=${encodeURIComponent(error)}`);
      }
      return c.json({ error }, 400);
    }

    if (!code) {
      return c.json({ error: "No authorization code" }, 400);
    }

    // Exchange code for Google tokens
    let tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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

    if (!tokenResponse.ok) {
      // retry fetch one time
      console.log("Retrying fetch...")
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
    
    // Get user info from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error("Failed to get user info");
      return c.json({ error: "Failed to get user info" }, 500);
    }

    const googleUser = await userInfoResponse.json();
    console.log("Google user:", googleUser.email);

    // Use Better Auth to create/update user and session
    const db = c.get("db");
    
    // Find or create user
    let user = await db.select().from(schema.users).where(eq(schema.users.email, googleUser.email)).get();
    
    if (!user) {
      // Create new user
      const role = googleUser.email?.endsWith("@utexas.edu") ? "student" : "public";
      const username = googleUser.email?.split("@")[0] || crypto.randomUUID();
      
      const userId = crypto.randomUUID();
      await db.insert(schema.users).values({
        id: userId,
        email: googleUser.email,
        emailVerified: true,
        name: googleUser.name,
        image: googleUser.picture,
        username: username,
        role: role,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create profile for new user
      await db.insert(schema.profiles).values({
        user_id: userId,
        display_name: googleUser.name || username,
        avatar_url: googleUser.picture || null,
      }).onConflictDoNothing();
      
      user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    }

    if (!user) {
      return c.json({ error: "Failed to create user" }, 500);
    }

    // Create session manually
    const sessionToken = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    await db.insert(schema.session).values({
      id: sessionId,
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("Created session for user:", user.email);

    // Check if we have a mobile callback URL for this state
    const mobileCallback = state ? pendingCallbacks.get(state) : null;
    
    if (mobileCallback && state) {
      pendingCallbacks.delete(state);
      console.log("Redirecting to mobile app with session token");
      return c.redirect(`${mobileCallback}?session_token=${sessionToken}`);
    }

    // Web client: set cookie and redirect
    return c.redirect("/", 302);
  } catch (error) {
    console.error("Callback error:", error);
    return c.json({ error: String(error) }, 500);
  }
});

// GET all avoidance_areas
app.get('/avoidance_areas', async (c) => {
  const db = c.get("db");
	const areas = await db.select().from(schema.avoidance_areas).all();
	return c.json(areas);
});

// GET single avoidance_area by id with profile info
app.get('/avoidance_areas/:id', async (c) => {
  const db = c.get("db");
	const areaId = Number(c.req.param('id'));

	if (isNaN(areaId)) {
		return c.text('Invalid Area ID', 400);
	}

	const area = await db
		.select({
			...getTableColumns(schema.avoidance_areas),
			profile_display_name: schema.profiles.display_name,
			profile_avatar_url: schema.profiles.avatar_url,

		})
		.from(schema.avoidance_areas)
		.leftJoin(schema.profiles, eq(schema.avoidance_areas.user_id, schema.profiles.id))
		.where(eq(schema.avoidance_areas.id, areaId))
		.get();

	if (!area) {
		return c.text('Area not found', 404);
	}

	return c.json(area);
});

// GET reports for a specific avoidance area id
app.get('/avoidance_areas/:id/reports', async (c) => {
  const db = c.get("db");
	const areaId = c.req.param('id');

	if (!areaId) {
		return c.text('Area ID is required', 400);
	}

	const reports = await db
		.select({
			...getTableColumns(schema.avoidance_area_reports),
			profile_display_name: schema.profiles.display_name,
		})
		.from(schema.avoidance_area_reports)
		.leftJoin(schema.profiles, eq(schema.avoidance_area_reports.user_id, schema.profiles.id))
		.where(eq(schema.avoidance_area_reports.avoidance_area_id, Number(areaId)))
		.all();

	return c.json(reports);
});

// POST insert new avoidance area
app.post('/avoidance_areas', async (c) => {
  const db = c.get("db");

	let body;
	try {
		body = await c.req.json();
	} catch (e) {
		console.error('Error parsing JSON body:', e);
		return c.text('Invalid JSON body', 400);
	}

	const { user_id, name, description, boundary_geojson } = body;

	if (!user_id || !name || !boundary_geojson) {
		return c.text('Missing required fields', 400);
	}

	const result = await db
		.insert(schema.avoidance_areas)
		.values({
			user_id,
			name,
			description: description || null,
			boundary_geojson: JSON.stringify(boundary_geojson),
		})
		.returning();

	return c.json(result);
});

// Better Auth routes - catch-all for auth (excluding callback which is impl above)
app.on(["GET", "POST"], "/api/auth/**", async (c) => {
  console.log("🔴 Better Auth catch-all hit:", c.req.path, c.req.method);
  try {
    const auth = c.get("auth");
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
  const auth = c.get("auth");
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  
  if (!session) {
    return c.json({ user: null }, 401);
  }
  
  return c.json({ user: session.user });
});

<<<<<<< HEAD
export default {
    fetch: app.fetch,
    // Scheduled handler for cron triggers
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log(`Cron trigger fired at ${new Date(event.scheduledTime).toISOString()}`);

        // Run the POI sync
        ctx.waitUntil(syncPOIs(env));
    },
=======
// GET current active profile
app.get('/profiles/me', async (c) => {
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

// GET non-deleted reviews by poi id
app.get('/reviews', async (c) => {
  const db = c.get("db");
	const poiId = Number(c.req.query('poi_id'));

	if (!poiId) {
		return c.text('POI ID is required', 400);
	}

  const profile = await getProfile(c);
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404)
  }

	const reviewsList = await db
		.select({
			...getTableColumns(schema.reviews),
			profile_display_name: schema.profiles.display_name,
			profile_avatar_url: schema.profiles.avatar_url,
      vote_count: sql<number>`COALESCE(SUM(${schema.votes.vote}), 0)`,
      user_vote: sql<number | null>`(
        SELECT vote FROM votes
        WHERE votes.review_id = ${schema.reviews.id}
        AND votes.user_id = ${profile.id}
      )`,
		})
		.from(schema.reviews)
		.leftJoin(schema.profiles, eq(schema.reviews.user_id, schema.profiles.id))
    .leftJoin(schema.votes, eq(schema.reviews.id, schema.votes.review_id))
		.where(and(eq(schema.reviews.poi_id, poiId), isNull(schema.reviews.deleted_at)))
    .groupBy(schema.reviews.id)
    .orderBy(schema.votes.vote)  // Order by difference between upvotes and downvotes (vote count)
		.all();

	return c.json(reviewsList);
});

// POST insert new review
app.post('/reviews', async (c) => {
  const db = c.get("db");

  const profile = await getProfile(c);
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404)
  }
	
	let body;
	try {
		body = await c.req.json();
	} catch (e) {
		console.error('Error parsing JSON body:', e);
		return c.text('Invalid JSON body', 400);
	}

	const { user_id, poi_id, rating, features, content } = body;

  if (profile.id !== user_id) {
    return c.json({ error: "Forbidden" }, 403);
  }

	if ( !rating || !poi_id) {
		return c.text("Missing required fields", 400);
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
});

// PUT update single existing review
app.put('/reviews/:id', async (c) => {
  const db = c.get("db");
	const reviewId = Number(c.req.param('id'));

	if (isNaN(reviewId)) {
		return c.text('Invalid review ID', 400);
	}

  const profile = await getProfile(c);
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404)
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
		console.error('Error parsing JSON body:', e);
		return c.text('Invalid JSON body', 400);
	}

	const { rating, features, content } = body;

	if (!rating) {
		return c.text("Missing required fields", 400);
	}

	const result = await db
		.update(schema.reviews)
		.set({
			rating,
			features,
			content
		})
		.where(eq(schema.reviews.id, reviewId))
		.returning();

	return c.json(result);
});

// PUT soft delete review
app.put('/reviews/:id/delete', async (c) => {
  const db = c.get("db");
	const reviewId = Number(c.req.param('id'));

	if (isNaN(reviewId)) {
		return c.text('Invalid review ID', 400);
	}

  const profile = await getProfile(c);
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404)
  }

  const review = await db.select().from(schema.reviews)
    .where(eq(schema.reviews.id, reviewId)).get();
  if (!review || review.user_id !== profile.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

	const result = await db
		.update(schema.reviews)
		.set({
			deleted_at: sql`(unixepoch())`
		})
		.where(eq(schema.reviews.id, reviewId))
		.returning();

	return c.json(result);
});

// POST /votes - upsert a vote
app.post('/votes', async (c) => {

  // TODO verify profile in votes AND review endpoints (check ownership - should not be trusting profile id sent from client)

  const profile = await getProfile(c);
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const db = c.get("db");
  
  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    console.error('Error parsing JSON body:', e);
		return c.text('Invalid JSON body', 400);
  }

  const { review_id, vote } = body;

  const result = await db
  .insert(schema.votes)
  .values({
    user_id: profile.id,
    review_id,
    vote
  })
  .onConflictDoUpdate({
    target: [schema.votes.user_id, schema.votes.review_id],
    set: { vote },
  })
  .returning();

  return c.json(result);
});

// DELETE active user's vote on specified review
app.delete('/votes/:review_id', async (c) => {
  const db = c.get("db");
  const reviewId = Number(c.req.param('review_id'));

  if (isNaN(reviewId)) {
		return c.text('Invalid Review ID', 400);
	} 

  const profile = await getProfile(c);
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404)
  };

  const result = await db.delete(schema.votes)
    .where(and(eq(schema.votes.user_id, profile.id), eq(schema.votes.review_id, reviewId)))
    .returning();

  return c.json(result);
});

export default {
	fetch: app.fetch,
	// Scheduled handler for cron triggers
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`Cron trigger fired at ${new Date(event.scheduledTime).toISOString()}`);

		// Run the POI sync
		ctx.waitUntil(syncPOIs(env));
	},
>>>>>>> f8797be6126544728afc887ead7c9e6f0fe7a84f
};