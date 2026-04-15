# Fixes on main

## commit hash: 3fa461d

- dependency hell (package-lock.json)
- index.tsx: l.136-137; polygonId -> poi
- the darn migrations are wrong (fix, but not very reliable: export from remote, del existing migrations, import to local)
  - ha figured it out: server/src/index.ts had many changes in this commit (one of which changed export default app and removed the async scheduled, which was required to run a syncPOIs function to pull pois from remote db)
- issue: can't login via google oauth:
  - index.ts MUST have a scheduled async function in its export default app
  - useAuth.ts: change /api/auth/me endpoint to /api/me
  - wrangler:info GET /api/me 401 Unauthorized: add betterAuth bearer plugin to auth.ts
  - If login still hangs, change wrangler.jsonc environment variable BETTER_AUTH_URL to your portfoward URL
