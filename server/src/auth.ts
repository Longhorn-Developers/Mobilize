import { betterAuth } from "better-auth";
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
      provider: "sqlite"
    }),
    emailAndPassword: {
      enabled: false // We only want OAuth
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/google`
      }
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [
      "http://localhost:8081", // Expo dev
      "https://auth.expo.io", // Expo AuthSession
      "mobilizeut://", // Your custom scheme
    ],
    callbacks: {
      async signIn({ user, account }: { user: any; account: any }) {
        console.log("Sign in callback:", { user, account });
        
        // Determine role based on email domain
        let role = "public";
        if (user.email?.endsWith("@utexas.edu")) {
          role = "student";
        }

        // Generate username from email
        const username = user.email?.split("@")[0] || user.id;

        // Update user with our custom fields
        await db.update(schema.users)
          .set({
            role,
            username,
            auth_provider: account?.providerId || "google",
            updated_at: new Date()
          })
          .where(eq(schema.users.id, user.id));

        return true;
      },
      
      async signUp({ user, account }: { user: any; account: any }) {
        console.log("Sign up callback:", { user, account });
        
        // This runs after user creation but before profile setup
        // The role and username should already be set in signIn callback
        return true;
      }
    }
  });
}

export type Auth = ReturnType<typeof createAuth>;