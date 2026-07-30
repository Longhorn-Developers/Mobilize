import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins"
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "./db/schema";

export function createAuth(env: { 
  mobilize_db: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}) {
  const db = drizzle(env.mobilize_db, { schema });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.users,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: false // We only want OAuth
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectURL: `${env.BETTER_AUTH_URL}/api/auth/callback/google`,
      }
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    trustedOrigins: [
      "http://localhost:54321",
      "http://127.0.0.1:54321",
      "http://localhost:8081",
      "http://10.0.2.2:8081",
      "https://auth.expo.io",
      "mobilizeut://",
      "exp://",
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update session every 24 hours
    },
    user: {
      additionalFields: {
        username: {
          type: "string",
          required: false,
        },
        role: {
          type: "string", 
          required: false,
          defaultValue: "public",
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const role = user.email?.endsWith("@utexas.edu") ? "student" : "public";
            const base = user.email?.split("@")[0] || user.id;

            // Retry with suffix on unique constraint collision (e.g. "john" → "john_2").
            for (let attempt = 0; attempt <= 4; attempt++) {
              const username = attempt === 0 ? base : `${base}_${attempt + 1}`;
              try {
                await db.update(schema.users)
                  .set({ role, username, updatedAt: new Date() })
                  .where(eq(schema.users.id, user.id));
                return; // success
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                const isUnique = /UNIQUE constraint failed/i.test(msg);
                if (!isUnique || attempt === 4) {
                  console.error(`[auth] Failed to set username for user ${user.id} after ${attempt + 1} attempts:`, err);
                  throw err;
                }
              }
            }
          },
        },
      },
    },
    plugins: [
      bearer(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;