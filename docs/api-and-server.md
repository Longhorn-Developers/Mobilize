# API & Server (`utils/api-*`, `server/`)

This doc covers the full client↔server data layer: the typed `ApiClient` and its TanStack
Query wrappers on the mobile side, and the Hono/Drizzle/D1 Cloudflare Worker on the server
side.

## Client: `ApiClient` (`utils/api-client.ts`)

`apiClient` is a singleton instance of the `ApiClient` class, constructed with
`process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:54321"`. Every TanStack Query hook in
`utils/api-hooks.ts` calls through this client — components should not call `fetch` directly
(except `getRoute`, see below, which talks to OpenRouteService).

### Base URL handling

- `configuredBaseUrl` — `EXPO_PUBLIC_API_URL` (trimmed of trailing slashes), or
  `http://localhost:54321` if unset.
- `fallbackBaseUrl` — always `http://localhost:54321`.
- `baseUrl` (instance state) — starts equal to `fallbackBaseUrl` ("local-first by default for
  emulator/dev stability"), and is updated to whichever candidate last responded with valid
  JSON.
- `getBaseCandidates()` returns a de-duplicated array `[this.baseUrl, this.fallbackBaseUrl,
  this.configuredBaseUrl]` (trailing slashes stripped) — i.e. "try the last-known-good URL
  first, then localhost, then the configured env URL."

### `request<T>(endpoint, options)` — the core method

Almost every public method funnels through `private request<T>()`:

1. Reads the session token from AsyncStorage (`SESSION_TOKEN_KEY`, from `utils/useAuth`).
2. Iterates `getBaseCandidates()`. For each candidate:
   - Calls `fetchWithTimeout(url, { ...options, headers: { "Content-Type": "application/json",
     Authorization: Bearer <token> if present, ...options.headers } }, DEFAULT_REQUEST_TIMEOUT_MS)`
     (`utils/request-utils.ts`).
   - Reads the body as text, computes a 120-char `responsePreview`.
   - In `__DEV__`, logs the URL, status, and preview.
   - Calls `parseJsonBody<T>(response, text, url, responsePreview)` (see below).
   - **On any valid JSON response** (even an error status), promotes this candidate:
     `this.baseUrl = baseUrlCandidate` and `promoteApiBaseUrl(baseUrlCandidate)` (from
     `utils/api-base.ts`) — so subsequent requests (and other clients like `useAuth`) try this
     URL first.
   - If `!response.ok`, throws `ClientRequestError("API_ERROR", ...)` with a message built from
     `parsedBody.error.message` / `parsedBody.error` / `parsedBody.message` / the response
     preview, plus an optional `hint` from `parsedBody.error.details.hint` /
     `parsedBody.details.hint`.
   - On success, returns the parsed body (`{}` if empty).
3. **Retry policy** (`catch` block): if `isRetriableCandidateError(error)` is `true` (see
   `request-utils.ts`), the loop continues to the next base-URL candidate. Otherwise the error
   is re-thrown immediately — i.e. **`API_ERROR` (4xx/5xx from a server that responded) is never
   retried across candidates**; only network-level failures (`TIMEOUT`, `NETWORK`,
   `HTML_RESPONSE`, `NON_JSON`, `MALFORMED_JSON`) trigger a fallback.
4. If every candidate fails, throws the last error (or a generic `Error("API request failed")`).

### `parseJsonBody<T>(response, text, url, responsePreview)`

Private helper used by `request()`. Throws `ClientRequestError` with one of:
- `"HTML_RESPONSE"` — content-type isn't JSON and the body looks like an HTML page (wrong
  `EXPO_PUBLIC_API_URL` / proxy error).
- `"NON_JSON"` — content-type isn't JSON and it's not HTML either.
- `"MALFORMED_JSON"` — content-type is JSON but `safeJsonParse` returned `null`.

An empty trimmed body returns `{}` rather than throwing.

### `authRequest<T>(endpoint, options)`

Thin wrapper around `request()` that explicitly re-attaches the stored Bearer token to
`options.headers` before delegating. (In practice `request()` already attaches the token, so
`authRequest` mainly documents "this endpoint requires auth" at call sites.)

### `safeJsonParse<T>(value)`

Module-level helper (not on the class): `JSON.parse`s a string, returning `null` on empty
input or parse failure. Used to parse the JSON-string columns (`location_geojson`,
`metadata`, `boundary_geojson`, `features`) that D1/Drizzle returns as raw `text`.

### Methods, by resource

#### Auth / profile

| Method | Endpoint | Notes |
| --- | --- | --- |
| `getMe()` | `GET /api/me` (auth) | Returns `{ user, profile, onboardingComplete? }`. Used by `useAuth`'s `fetchMe` indirectly is **not** this — `useAuth` has its own `fetchMe`; this is the `ApiClient` equivalent for query hooks. |
| `getMyProfile()` | via `getMe()` | Convenience wrapper: returns `me.profile as Profile \| null`, or `null` on **any** error (swallows exceptions). |
| `getProfile(id)` | `GET /profiles?id=<id>` | **`@deprecated`** — "kept for the legacy `useProfile` hook." Note: the server has no `GET /profiles` route registered (see server routes table) — this method appears stale. |
| `createProfile(data)` | `POST /api/profile` (auth) | First-time profile setup. `data: { firstName, lastName, username, classYear?, major?, bio? }`. Returns `{ success, profile }`. |
| `updateProfile(data)` | `PUT /api/profile` (auth) | `data: { displayName?, classYear?, major?, bio?, mobilityPreference?, onboardingComplete? }`. Returns `{ success, profile }`. |
| `getPublicProfile(username)` | `GET /api/users/:username` | No auth. Returns `{ user, profile }`. |

#### POIs

| Method | Endpoint | Notes |
| --- | --- | --- |
| `getPOIs()` | `GET /pois` | No auth. Maps each `POIRaw` row, replacing the `location_geojson` string with parsed JSON (falling back to `{ type: "Point", coordinates: [0,0] }`) and `metadata` string with parsed JSON via `safeJsonParse`. |
| `resolveRampPOI(data)` | `POST /pois/ramp/resolve` | No auth. `data: { externalKey, latitude, longitude, buildingAbbr?, buildingName? }` — remapped to snake_case (`external_key`, `building_abbr`, `building_name`) for the request body. Idempotent get-or-create for a ramp POI, called from `useMapPressHandlers.handleRampPress`. |

#### Avoidance areas

| Method | Endpoint | Notes |
| --- | --- | --- |
| `getAvoidanceAreas()` | `GET /avoidance_areas` | No auth. Parses `boundary_geojson` per area; areas with unparseable geometry are filtered out of the result entirely. |
| `getAvoidanceArea(id)` | `GET /avoidance_areas/:id` | No auth. Parses `boundary_geojson`; **throws** `Error("Avoidance area geometry could not be parsed")` if parsing fails (unlike `getAvoidanceAreas`, which silently drops bad rows). |
| `insertAvoidanceArea(data)` | `POST /avoidance_areas` (auth, student role) | `data: { name, description?, boundary_geojson: Polygon }`. Uses `authRequest`. |

#### Avoidance area reports

| Method | Endpoint | Notes |
| --- | --- | --- |
| `getAvoidanceAreaReports(id)` | `GET /avoidance_areas/:id/reports` | No auth. Returns `AvoidanceAreaReport[]`. |
| `insertAvoidanceAreaReport(data)` | `POST /avoidance_areas/:avoidance_area_id/reports` (auth, student role) | `data: { avoidance_area_id, title, description? }`. Body sent is `{ title, description }` (the area id moves into the URL path). |

#### Reviews

| Method | Endpoint | Notes |
| --- | --- | --- |
| `getReviews(poi_id)` | `GET /reviews?poi_id=<id>` | No auth required, but if a Bearer token is present the server includes `user_vote`. Maps each `ReviewEntryRaw.features` JSON string to `string[]` (via `safeJsonParse`, default `[]`), returning `ReviewEntry[]`. |
| `insertReview(data)` | `POST /reviews` (auth, completed profile) | `data: { user_id, poi_id, rating, features?, content? }`. Server creates **or updates** an existing non-deleted review for the same `(profile, poi)` pair. |
| `updateReview(id, data)` | `PUT /reviews/:id` (auth, must be author) | `data: { rating, poi_id?, features?, content? }`. |
| `deleteReview(id)` | `PUT /reviews/:id/delete` (auth, must be author) | Soft delete (`deleted_at`). |

#### Votes

| Method | Endpoint | Notes |
| --- | --- | --- |
| `upsertVote(data)` | `POST /votes` (auth, completed profile) | `data: { review_id, vote: 1 \| -1 }`. Upserts on `(user_id, review_id)`. |
| `deleteVote(review_id)` | `DELETE /votes/:review_id` (auth, completed profile) | Removes the caller's vote on that review. |

#### Construction areas

| Method | Endpoint | Notes |
| --- | --- | --- |
| `getConstructionAreas()` | `GET /construction_areas` | No auth. Returns `{ id, points: [number, number][], description? }[]` — proxied/cached from UT's ArcGIS "Closed Areas" service. |

#### Route / directions

| Method | Endpoint | Notes |
| --- | --- | --- |
| `getRoute(waypoints, avoiding)` | `POST https://api.openrouteservice.org/v2/directions/wheelchair` (external, **not** the Worker) | The only `ApiClient` method that bypasses `request()`/base-URL fallback entirely — calls OpenRouteService directly using `process.env.EXPO_PUBLIC_OPENROUTE_KEY` as the `Authorization` header. `avoiding` (an array of polygon coordinate rings) is wrapped into a `MultiPolygon` and sent as `options.avoid_polygons`. Throws a plain `Error("HTTP <status> <statusText>")` on non-2xx — does **not** use `ClientRequestError`. Not currently wired to any UI (see `components.md` — `RouteOverlaySheet` is a stub). |

#### Misc

| Method | Endpoint | Notes |
| --- | --- | --- |
| `healthCheck()` | `GET /health` | Returns `JSON.stringify({ status, missingTables? })` as a string (not the parsed object) — "useful for devtools/debugging." |

Google Places autocomplete/details are **not** on `ApiClient` — they're called from
`utils/googlePlaces.ts` (see `utils.md`), which hits the same Worker (`POST /places/autocomplete`,
`POST /places/details`) but has its own small HTTP client.

## Client: `utils/api-base.ts`

Single source of truth for "which backend URL should we hit", shared by `ApiClient`,
`useAuth`, and `googlePlaces` (previously each had separate `activeApiUrl` state).

- `LOCAL_API_URL = "http://localhost:54321"`.
- `CONFIGURED_API_URL` = `EXPO_PUBLIC_API_URL` (trimmed, trailing slash stripped), or `""`.
- `API_URL` = `CONFIGURED_API_URL || LOCAL_API_URL`.
- **`API_BASE_CANDIDATES`** — `Array.from(new Set([API_URL, LOCAL_API_URL]))` (deduped,
  trailing slashes stripped, falsy entries filtered) — i.e. configured URL first (if set and
  different from localhost), then localhost.
- **`activeApiUrl`** (module-level mutable state) — initialized to
  `API_BASE_CANDIDATES[0] ?? LOCAL_API_URL`; this is the "most recently confirmed working" URL.

### `getApiBaseCandidates()`

Returns `[activeApiUrl, ...API_BASE_CANDIDATES.filter(c => c !== activeApiUrl)]` — i.e. the
active URL first, followed by the remaining candidates in their original order. Callers
iterate this list and call `promoteApiBaseUrl()` on whichever one succeeds.

### `promoteApiBaseUrl(url)`

Sets `activeApiUrl = url`. Called by `ApiClient.request()` (on any valid JSON response,
success or error), `useAuth.fetchMe`, and `useAuth.signInWithGoogle` (forces the devtunnel URL
to the front before starting the OAuth flow).

### `resolveApiBaseUrl()`

Async probe used by flows that need a confirmed base URL *before* making a single request
(e.g. `useAuth.signOut`):
1. Iterates `getApiBaseCandidates()`.
2. For each candidate, `fetchWithTimeout(`${candidate}/health`, ..., DEFAULT_REQUEST_TIMEOUT_MS)`
   then `parseJsonResponse()` — any reachable JSON response (regardless of HTTP status) is
   treated as confirmation.
3. On success, `promoteApiBaseUrl(candidate)` and returns it immediately.
4. On a retriable error (`isRetriableCandidateError`), tries the next candidate; on a
   non-retriable error, stops iterating.
5. If every candidate fails, logs a warning and returns the current `activeApiUrl` unchanged
   (silent fallback — callers always get *some* URL back).

## Client: `utils/request-utils.ts`

Low-level HTTP primitives shared by `ApiClient`, `api-base.ts`, and `useAuth.ts`.

- **`DEFAULT_REQUEST_TIMEOUT_MS = 8000`**.
- **`ClientRequestErrorCode`** — `"TIMEOUT" | "NETWORK" | "NON_JSON" | "HTML_RESPONSE" |
  "MALFORMED_JSON" | "API_ERROR"`.
- **`ClientRequestError`** — `extends Error`, adds `code`, `status?`, `url?`,
  `responsePreview?`, `details?`, and (if provided) `cause`. `name = "ClientRequestError"`.
- **`isLikelyNetworkError(error)`** — `true` for `ClientRequestError` with code `TIMEOUT` or
  `NETWORK`, or (for arbitrary errors) a message matching
  `/network request failed|failed to fetch|networkerror|timed out/i`. Used by `useAuth` to
  decide whether to fall back to the cached user on a failed session refresh.
- **`isRetriableCandidateError(error)`** — `true` for `ClientRequestError` with code
  `TIMEOUT`, `NETWORK`, `HTML_RESPONSE`, `NON_JSON`, or `MALFORMED_JSON`. **`API_ERROR` is
  explicitly excluded** — "the server responded, so switching candidates would not help."
- **`parseJsonResponse<T>(response, urlForError?)`** — the canonical JSON-parsing helper
  (`ApiClient.parseJsonBody` is a near-duplicate kept private to that class). Reads the body as
  text, computes a 200-char preview, and throws `ClientRequestError` for non-JSON content-type
  (`HTML_RESPONSE` if it looks like an HTML page, else `NON_JSON`) or malformed JSON
  (`MALFORMED_JSON`). Empty bodies return `{}`.
- **`fetchWithTimeout(input, init, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS)`** — wraps `fetch`
  with an `AbortController` that fires after `timeoutMs`. Converts `AbortError` →
  `ClientRequestError("TIMEOUT", ...)`, and any other thrown error →
  `ClientRequestError("NETWORK", "Network request failed", { cause })`.

## Client: TanStack Query hooks (`utils/api-hooks.ts`)

All hooks call through the shared `apiClient` singleton. `queryKeys` centralizes query-key
shapes:

```ts
queryKeys = {
  pois, avoidanceAreas, constructionAreas,
  avoidanceArea: (id) => ["avoidanceArea", id],
  avoidanceAreaReports: (id) => ["avoidanceAreaReports", id],
  profile: (id) => ["profile", id],
  myProfile,
  review: (poi_id) => ["review", poi_id],
  reviewById: (id) => ["reviewById", id],   // defined but not currently used by any hook
  votes: (review_id) => ["votes", review_id], // defined but not currently used by any hook
}
```

### POIs

| Hook | Calls | Query key | Notes |
| --- | --- | --- | --- |
| `usePOIs()` | `apiClient.getPOIs()` | `queryKeys.pois` (`["pois"]`) | `staleTime: 24h`. |

### Avoidance areas

| Hook | Calls | Query key | Notes |
| --- | --- | --- | --- |
| `useAvoidanceAreas()` | `apiClient.getAvoidanceAreas()` | `queryKeys.avoidanceAreas` (`["avoidanceAreas"]`) | Default `staleTime`/`gcTime` from `ApiQueryProvider`. |
| `useAvoidanceArea(id)` | `apiClient.getAvoidanceArea(id)` | `queryKeys.avoidanceArea(id)` | `enabled: !!id`. |
| `useInsertAvoidanceArea()` | `apiClient.insertAvoidanceArea(data)` | mutation | `data: { name, description?, boundary_geojson: Polygon }`. On success: `invalidateQueries(queryKeys.avoidanceAreas)` + success `Toast` (`TOAST_MESSAGES.avoidanceAreaSubmitted`, `topOffset: insets.top + 35`). On error: error `Toast` at the bottom of the screen with `error.message`. |

### Avoidance area reports

| Hook | Calls | Query key | Notes |
| --- | --- | --- | --- |
| `useAvoidanceAreaReports(id)` | `apiClient.getAvoidanceAreaReports(id)` | `queryKeys.avoidanceAreaReports(id)` | `enabled: !!id`. |
| `useInsertAvoidanceAreaReport()` | `apiClient.insertAvoidanceAreaReport(data)` | mutation | On success, **does not invalidate** — instead calls `queryClient.setQueryData(queryKeys.avoidanceAreaReports(data[0].avoidance_area_id.toString()), (old) => [...(old||[]), data[0]])` to append the new report locally. Logs to console on success/error (no toast). |

### Reviews

| Hook | Calls | Query key | Notes |
| --- | --- | --- | --- |
| `useReviews(poi_id)` | `apiClient.getReviews(poi_id)` | `queryKeys.review(poi_id)` | `enabled: !!poi_id`, `retry: false`. |
| `useInsertReview()` | `apiClient.insertReview(data)` | mutation | `data: { user_id, poi_id, rating, features?, content? }`. On success: `invalidateQueries(queryKeys.review(variables.poi_id))` + success `Toast` (`TOAST_MESSAGES.reviewSubmitted`, bottom position). On error: error `Toast` with `error.message`. |
| `useUpdateReview()` | `apiClient.updateReview(id, payload)` | mutation | `data: { id, poi_id, rating, features?, content? }` — `id` is destructured out before calling `updateReview`. Same invalidation/toast pattern as `useInsertReview` (reuses `TOAST_MESSAGES.reviewSubmitted`). |
| `useDeleteReview()` | `apiClient.deleteReview(data.id)` | mutation | `data: { id, poi_id }`. On success: `invalidateQueries(queryKeys.review(variables.poi_id))` + success `Toast` (`TOAST_MESSAGES.reviewDeleted`). |

### Votes

| Hook | Calls | Query key | Notes |
| --- | --- | --- | --- |
| `useUpsertVote()` | `apiClient.upsertVote(data)` | mutation | `data: { review_id, vote: 1 \| -1 }`. On success: `invalidateQueries({ queryKey: ["review"] })` (invalidates **all** `["review", poi_id]` query keys, since TanStack matches by key prefix) so vote counts refresh. Console-only logging, no toast. |
| `useDeleteVote()` | `apiClient.deleteVote(review_id)` | mutation | `data: review_id` (a bare number, not an object). Same `["review"]` invalidation. Console-only logging. |

### Profile

| Hook | Calls | Query key | Notes |
| --- | --- | --- | --- |
| `useProfile(id)` | `apiClient.getProfile(id)` | `queryKeys.profile(id)` | `enabled: !!id`. Calls the `@deprecated` `getProfile` (`GET /profiles?id=`), which has no matching server route — likely dead/legacy. |
| `useMyProfile()` | `apiClient.getMyProfile()` | `queryKeys.myProfile` (`["myProfile"]`) | Returns `null` on error (per `getMyProfile`'s try/catch) rather than throwing. |

### Construction areas

| Hook | Calls | Query key | Notes |
| --- | --- | --- | --- |
| `useConstructionAreas()` | `apiClient.getConstructionAreas()` | `queryKeys.constructionAreas` (`["constructionAreas"]`) | Comment: "just fetch every time for now, not caching" — but no explicit `staleTime: 0` is set, so it actually uses the provider's 5-minute default. |

### Route

| Export | Calls | Notes |
| --- | --- | --- |
| `getRoute(waypoints, avoiding)` | `apiClient.getRoute(waypoints, avoiding)` | A plain **async function**, not a hook — `// TODO implement caching later`. Not wrapped in `useQuery`/`useMutation`. |

### Other

| Hook | Calls | Query key | Notes |
| --- | --- | --- | --- |
| `useHealthCheck()` | `apiClient.healthCheck()` | `["health"]` | `retry: 3`, `retryDelay: 1000`. |

`TOAST_MESSAGES` (module constant): `reviewSubmitted`, `reviewDeleted`,
`avoidanceAreaSubmitted` — `avoidanceAreaSubmitted` currently has the **same text** as
`reviewSubmitted` ("Thank you for your review!...") despite being shown after submitting an
avoidance area, not a review.

## Client: `utils/ApiQueryProvider.tsx`

Creates and exports a single `queryClient = new QueryClient({...})` plus `ApiQueryProvider`,
a thin wrapper around `QueryClientProvider`. Default options (apply to every query unless a
hook overrides them):

| Option | Value |
| --- | --- |
| `retry` | `2` |
| `staleTime` | `1000 * 60 * 5` (5 minutes) |
| `gcTime` | `1000 * 60 * 60` (1 hour) — formerly `cacheTime` in older TanStack Query versions |

`ApiQueryProvider` is mounted in `app/_layout.tsx`, wrapping the app below `ThemeProvider` and
above `AuthProvider` (see `architecture.md`). The exported `queryClient` can be imported
directly for imperative cache access outside of components.

---

## Server: routes (`server/src/index.ts`)

The Worker is a single Hono app (`new Hono<{ Bindings; Variables }>()`). A global middleware
(`app.use("/*", ...)`) applies permissive CORS (`origin: "*"`, methods `GET/POST/PUT/DELETE/
OPTIONS`, headers `Content-Type`/`Authorization`, `credentials: true`) and, on every request,
sets `c.set("auth", createAuth(c.env))` and `c.set("db", drizzle(c.env.mobilize_db, { schema
}))`. On the first request after a cold start it also runs a one-time table-diagnostics check
(`getMissingTables`) and logs the result.

Auth levels referenced below:
- **none** — no `Authorization` header required.
- **auth** — valid Bearer session token required (`requireAuth` → 401 if missing/invalid).
- **student** — auth **and** `user.role === "student"` (`requireStudent` → 403 otherwise).
  Role is auto-promoted to `"student"` for `@utexas.edu` emails via `ensureStudentRole`.
- **completed profile** — auth, profile exists, and `onboarding_completed_at` is set
  (`requireCompletedProfile` → 404 if no profile, 403 if onboarding incomplete).

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | none | Liveness check — `{ status: "ok" }`. |
| `GET` | `/health` | none | Runs `getMissingTables()`; returns `{ status: "ok", missingTables: [] }` or `{ status: "degraded", missingTables: [...] }` (HTTP 500 if degraded). |
| `GET` | `/pois` | none | Returns all rows from `pois` (raw, JSON-string columns un-parsed — client parses via `getPOIs()`). |
| `POST` | `/pois/ramp/resolve` | none | Idempotent get-or-create for a "ramp" POI. Body: `{ external_key, latitude, longitude, building_abbr?, building_name? }`. Looks for an existing `pois` row with `poi_type = "ramp"` whose `metadata.external_key` matches; if found, returns it as-is. Otherwise inserts a new row (`poi_type: "ramp"`, `location_geojson` = `Point` at `[longitude, latitude]`, `metadata` includes `external_key`, `name: "Ramp Access"`, `bld_name`, `building_name`, `source: "local_ramps_geojson"`) and returns the created row. |
| `GET` | `/avoidance_areas` | none | All `avoidance_areas` rows, left-joined to `profiles` for `profile_display_name`/`profile_avatar_url`. |
| `GET` | `/avoidance_areas/:id` | none | Single area (same join). 400 if `:id` isn't numeric, 404 if not found. |
| `POST` | `/avoidance_areas` | student | Body: `{ name, description?, boundary_geojson }`. Validates `boundary_geojson` is an object with `type === "Polygon"` and an array `coordinates`. Inserts a row owned by `user.id`, returns the inserted row(s). |
| `GET` | `/avoidance_areas/:id/reports` | none | All `avoidance_area_reports` for the area, left-joined to `profiles`. 400 if `:id` missing. |
| `POST` | `/avoidance_areas/:id/reports` | student | Body: `{ title, description? }` — `title` required. Inserts a report owned by `user.id` for `avoidance_area_id = :id`. |
| `GET` | `/profiles/me` | auth | Legacy endpoint — returns the caller's raw `profiles` row, or 404 if none. |
| `POST` | `/api/profile` | auth | First-time profile setup. Body: `{ firstName, lastName, username, classYear?, major?, bio? }` (all of `firstName`/`lastName`/`username` required). Sets `users.username`/`users.name`, 409 if `username` is taken by another user. Upserts the `profiles` row (`onConflictDoUpdate` on `user_id`, using `COALESCE` so unspecified optional fields keep their existing values; `is_anonymous` reset to `false`). Returns `{ success: true, profile }`. |
| `PUT` | `/api/profile` | auth | Update any subset of `{ displayName, classYear, major, bio, mobilityPreference, onboardingComplete }`. Updates the existing `profiles` row, or inserts one if none exists (defaulting `display_name` to `user.name ?? user.username ?? "User"`). `onboardingComplete: true/false` sets/clears `onboarding_completed_at`. Always sets `is_anonymous = false`. Returns `{ success: true, profile }`. |
| `GET` | `/api/users/:username` | none | Public profile lookup. Returns `{ user: { id, name, username, image, role, createdAt }, profile }` (safe public fields only), or 404. |
| `GET` | `/api/auth/signin/google` | none | Starts the Google OAuth flow. Optional `?callbackURL=` (mobile deep link) and `?redirectUri=` (validated against the canonical `BETTER_AUTH_URL`-derived redirect URI — 400 if mismatched). Encodes `{ nonce, callbackURL, redirectUri }` into a base64 `state` param, stashes `state → callbackURL` in the in-memory `pendingCallbacks` map, and 302-redirects to `accounts.google.com/o/oauth2/v2/auth`. |
| `GET` | `/api/auth/callback/google` | none | Google OAuth callback. Decodes `state`, exchanges the `code` for tokens (`POST oauth2.googleapis.com/token`, with one retry after a 1s delay on failure), fetches the user's Google profile (`googleapis.com/oauth2/v2/userinfo`), creates a `users` row if the email is new (role = `"student"` for `@utexas.edu`, else `"public"`; `username: null` until profile-setup), creates a `session` row (7-day expiry, random UUID token), and redirects to `${mobileCallback}?session_token=<token>` (or `/` if no mobile callback). |
| `POST` | `/api/auth/signout` | none (token optional) | If an `Authorization: Bearer <token>` header is present, deletes the matching `session` row. Always returns `{ success: true }` — idempotent. |
| `GET` | `/construction_areas` | none | Proxies UT's ArcGIS "Closed Areas" `FeatureServer` (paginated, 1500 records/page, 12s timeout per page), converts each feature's first ring/path from `[lng, lat]` to `[lat, lng]` pairs (dropping rings with <2 valid points), and returns `{ id, points, description? }[]`. Results cached in-memory for 60s (`constructionCache`); on upstream error, serves stale cache if available, else a `502`/`504` error. |
| `GET` | `/api/me` | none (token optional) | If no/invalid Bearer token: `{ user: null, profile: null, onboardingComplete: false }` (401 if a token was supplied but invalid). Otherwise: `ensureStudentRole`-normalizes the user, fetches their `profiles` row, and returns `{ user, profile, onboardingComplete }`. |
| `POST` | `/places/autocomplete` | none | Server-side proxy to Google Places **Autocomplete (New)** API — keeps `GOOGLE_PLACES_API_KEY` server-side. Body: `{ input, sessionToken?, scope? }`. `input` <2 chars returns `[]` immediately. `scope: "campus"` (default) restricts to `UT_CAMPUS_BOUNDS`; `scope: "global"` does not. Returns `{ place_id, description, structured_formatting: { main_text, secondary_text } }[]`. 503 if the API key isn't configured. |
| `POST` | `/places/details` | none | Proxy to Google Places **Details (New)** API. Body: `{ placeId, sessionToken?, displayName? }`. Returns `{ place_id, name, formatted_address, geometry: { location: { lat, lng } } }`. `name` prefers `displayName` (client-supplied hint) over the API's `formattedAddress`. 502 if Google returns invalid/missing coordinates. |
| `GET` | `/reviews?poi_id=` | none (auth optional) | `poi_id` must be a positive integer. Returns non-deleted reviews for the POI (left-joined to `profiles` for display name/avatar), each annotated with `vote_count` (sum of `votes.vote`) and `user_vote` (the caller's own vote, `null` if unauthenticated or no vote). Ordered by `updated_at desc`. |
| `POST` | `/reviews` | completed profile | Body: `{ poi_id, rating (1-5 int), features? (JSON string), content? }`. Validates `poi_id` references an existing POI. If the caller already has a non-deleted review for this POI, **updates** it; otherwise inserts a new row. Returns the resulting row(s). |
| `PUT` | `/reviews/:id` | completed profile, author only | Body: `{ rating (1-5 int), poi_id?, features?, content? }`. 403 if the review doesn't exist or isn't owned by the caller. Validates `poi_id` (defaults to the existing review's `poi_id`) references an existing POI. |
| `PUT` | `/reviews/:id/delete` | completed profile, author only | Soft-delete: sets `deleted_at = unixepoch()`. 403 if not the author. |
| `POST` | `/votes` | completed profile | Body: `{ review_id, vote: 1 \| -1 }`. 404 if the review doesn't exist or is deleted. Upserts on `(user_id, review_id)` — `onConflictDoUpdate` sets `vote`. |
| `DELETE` | `/votes/:review_id` | completed profile | Deletes the caller's vote row for that review (`(user_id, review_id)`). |

### Scheduled handler

The default export's `scheduled(event, env, ctx)` handler runs on the cron trigger configured
in `server/wrangler.jsonc` (`"crons": ["0 0 * * *"]` — daily at midnight UTC), calling
`ctx.waitUntil(syncPOIs(env))` (see below).

### Notes on the route list

- **Better Auth's own route handlers are intentionally not mounted** — a comment at line 1032
  reads "Better Auth catch-all intentionally disabled. Custom Google OAuth + bearer session
  routes are the canonical auth path." `createAuth(c.env)` is still constructed and stored in
  context on every request (and used by `auth.ts`'s `databaseHooks` when Better Auth itself
  creates a user — though in practice the custom `/api/auth/callback/google` handler creates
  users directly via Drizzle, bypassing Better Auth's user-creation flow and its
  `databaseHooks.user.create.after` hook).
- `GET /profiles?id=` (called by `ApiClient.getProfile`, the `@deprecated` method behind
  `useProfile`) has **no corresponding route** in `index.ts` — only `/profiles/me` exists. This
  endpoint would currently 404.

## Server: auth config (`server/src/auth.ts`)

`createAuth(env)` configures a [Better Auth](https://www.better-auth.com/) instance via
`betterAuth({...})`:

- **Database adapter** — `drizzleAdapter(db, { provider: "sqlite", schema: { user: users,
  session, account, verification } })`, where `db = drizzle(env.mobilize_db, { schema })`
  (the D1 binding).
- **Email/password auth** — explicitly disabled (`emailAndPassword: { enabled: false }`):
  "We only want OAuth."
- **Social providers** — `google: { clientId, clientSecret, redirectURL }`, all three sourced
  from `env` (see env vars table below). `redirectURL` is built as
  `${BETTER_AUTH_URL}/api/auth/callback/google`.
- **`secret`** — `env.BETTER_AUTH_SECRET`, Better Auth's signing/encryption secret.
- **`baseURL`** / **`basePath`** — `env.BETTER_AUTH_URL` / `"/api/auth"`.
- **`trustedOrigins`** — a fixed allowlist: `http://localhost:54321`, `http://127.0.0.1:54321`,
  `http://localhost:8081`, `http://10.0.2.2:8081` (Android emulator host), `https://auth.expo.io`,
  `mobilizeut://`, `exp://`.
- **`session`** — `expiresIn: 60 * 60 * 24 * 7` (7 days), `updateAge: 60 * 60 * 24` (sessions are
  refreshed at most once per 24h).
- **`user.additionalFields`** — `username: { type: "string", required: false }` and
  `role: { type: "string", required: false, defaultValue: "public" }` — extends Better Auth's
  user schema with the two custom columns defined in `db/schema.ts`.
- **`databaseHooks.user.create.after`** — when Better Auth creates a user, derives `role`
  (`"student"` for `@utexas.edu` emails, else `"public"`) and a default `username` from the
  email's local part (`user.email.split("@")[0]`), retrying with a numeric suffix
  (`<base>_2`, `<base>_3`, ... up to `<base>_5`) on a `UNIQUE constraint failed` error. As noted
  above, the app's actual sign-in path (`/api/auth/callback/google`) creates users directly via
  Drizzle and does **not** go through this hook — it duplicates the same role-derivation logic
  inline.
- **`plugins`** — `[bearer()]` (the Better Auth bearer-token plugin, enabling
  `Authorization: Bearer <token>` session lookups — though the app's custom `getAuthUser`/
  `requireAuth` helpers in `index.ts` implement this independently against the `session` table
  rather than calling into Better Auth).

### Environment variables

These are read from the Worker's `env` (Cloudflare secrets/vars — see `server/wrangler.jsonc`'s
`vars` block for non-secret values, and Wrangler secrets for the rest). **Never log or
transcribe actual values.**

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID — sent to Google during the authorize redirect and the token exchange. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret — used only in the server-side token exchange (`/api/auth/callback/google`). Never sent to the client. |
| `GOOGLE_PLACES_API_KEY` | Optional. Google Places API key used by `/places/autocomplete` and `/places/details`. If unset, those routes return a 503. |
| `BETTER_AUTH_SECRET` | Better Auth's signing/encryption secret. |
| `BETTER_AUTH_URL` | The canonical public base URL of the Worker (e.g. a devtunnel HTTPS URL in dev). Used to build the Google OAuth `redirect_uri` and as Better Auth's `baseURL`. Set in `wrangler.jsonc`'s `vars` for this repo's dev tunnel. |
| `mobilize_db` | D1 database binding (not a string env var — a Cloudflare D1 binding configured in `wrangler.jsonc`'s `d1_databases`). |

## Server: database schema (`server/src/db/schema.ts`)

Drizzle ORM (`sqlite-core`) schema for the D1 database. All timestamp columns use
`integer(..., { mode: "timestamp" })` with `default(sql\`(unixepoch())\`)` unless noted.

### `user` (`users` export)

Auth users managed by Better Auth.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` PK | |
| `name` | `text` | |
| `email` | `text` NOT NULL, unique | |
| `email_verified` | `integer` (boolean) | |
| `image` | `text` | |
| `username` | `text`, unique | Set during profile-setup onboarding; `null` until then. |
| `role` | `text`, default `"public"` | `"public"` \| `"student"` (`"student"` for `@utexas.edu` emails). |
| `created_at` / `updated_at` | `integer` (timestamp), default `unixepoch()` | |

### `session`

Bearer-token sessions — the `token` column is what the mobile client stores in AsyncStorage
(`SESSION_TOKEN_KEY`) and sends as `Authorization: Bearer <token>`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` PK | |
| `user_id` | `text` NOT NULL | FK → `user.id`, `ON DELETE CASCADE` |
| `expires_at` | `integer` (timestamp) NOT NULL | |
| `token` | `text` NOT NULL, unique | |
| `ip_address` / `user_agent` | `text` | |
| `created_at` / `updated_at` | `integer` (timestamp), default `unixepoch()` | |

### `account`

OAuth provider link table required by Better Auth — stores Google access/refresh tokens per
user (not actively read by the custom OAuth flow, which manages its own `session` rows).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` PK | |
| `user_id` | `text` NOT NULL | FK → `user.id`, `ON DELETE CASCADE` |
| `account_id` / `provider_id` | `text` NOT NULL | |
| `access_token` / `refresh_token` / `id_token` / `password` | `text` | |
| `access_token_expires_at` / `refresh_token_expires_at` | `integer` (timestamp) | |
| `scope` | `text` | |
| `created_at` / `updated_at` | `integer` (timestamp), default `unixepoch()` | |

### `verification`

Email verification tokens required by Better Auth's schema; not actively used since Google
OAuth is the only auth path.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` PK | |
| `identifier` | `text` NOT NULL | |
| `value` | `text` NOT NULL | |
| `expires_at` | `integer` (timestamp) NOT NULL | |
| `created_at` / `updated_at` | `integer` (timestamp), default `unixepoch()` | |

### `profiles`

Campus-facing profile created during onboarding. Uses a separate auto-increment integer PK so
`reviews`/`votes` can reference it without embedding the auth user's UUID.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `integer` PK, autoincrement | |
| `user_id` | `text` NOT NULL, unique | FK → `user.id` |
| `display_name` | `text` NOT NULL | |
| `avatar_url` | `text` | |
| `class_year` | `text` | |
| `major` | `text` | |
| `bio` | `text` | |
| `mobility_preference` | `text` | `"walking" \| "wheelchair" \| "cane" \| "other"` |
| `is_anonymous` | `integer` (boolean) NOT NULL, default `false` | |
| `onboarding_completed_at` | `integer` (timestamp) | `null` until onboarding finishes; presence drives `requireCompletedProfile`. |
| `created_at` / `updated_at` | `integer` (timestamp), default `unixepoch()` | |

### `pois`

Points of Interest — accessibility features on campus.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `integer` PK, autoincrement | |
| `poi_type` | `text` NOT NULL | `"ramp" \| "accessible_entrance" \| "auto_door" \| "manual_door"`, etc. — drives map icon/filter logic. |
| `metadata` | `text` | JSON blob (source-specific: `external_key`, `bld_name`, `floor`, `auto_opene`, ...). |
| `location_geojson` | `text` NOT NULL, unique | GeoJSON `Point` as a JSON string. The unique constraint doubles as the **upsert key** for `poi-sync` and `/pois/ramp/resolve`. |
| `created_at` / `updated_at` | `integer` (timestamp), default `unixepoch()` | |

A schema comment warns that the `location_geojson` unique constraint assumes
`JSON.stringify(geometry)` is stable across fetches for the same coordinates — if precision or
key order ever varies, duplicate POIs could be created; a dedicated `external_key` would be
more robust.

### `reviews`

Accessibility reviews submitted by campus profiles. Soft-deleted via `deleted_at` (hard
deletes are not used).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `integer` PK, autoincrement | |
| `user_id` | `integer` NOT NULL | FK → `profiles.id` (note: references the **profile**, not the auth user). |
| `rating` | `integer` NOT NULL | 1-5. |
| `features` | `text` | JSON string, `string[]` of feature tag IDs. |
| `content` | `text` | Free-text review body. |
| `poi_id` | `integer` NOT NULL | FK → `pois.id`, `ON DELETE CASCADE` (added in migration `0008`). |
| `created_at` / `updated_at` | `integer` (timestamp), default `unixepoch()` | `updated_at` has `.$onUpdate(() => new Date())`. |
| `deleted_at` | `integer` (timestamp), nullable | Soft-delete marker. |

Indexes: `poi_deleted_idx` on `(poi_id, deleted_at)`; `reviews_user_poi_deleted_idx` on
`(user_id, poi_id, deleted_at)`.

### `votes`

Upvotes/downvotes (+1/-1) on reviews.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `integer` PK, autoincrement | |
| `user_id` | `integer` NOT NULL | FK → `profiles.id`. |
| `review_id` | `integer` NOT NULL | FK → `reviews.id`, `ON DELETE CASCADE`. |
| `vote` | `integer` NOT NULL | `1` or `-1`. |

Unique constraint on `(user_id, review_id)` — one vote per user per review; `/votes`
upserts against this constraint.

### `avoidance_areas`

User-reported zones to avoid (construction, broken elevators, etc.).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `integer` PK, autoincrement | |
| `user_id` | `text` NOT NULL | FK → `user.id` (the **auth user**, not `profiles.id` — area ownership is tied to the auth identity). |
| `name` | `text` NOT NULL | |
| `description` | `text` | |
| `boundary_geojson` | `text` NOT NULL | GeoJSON `Polygon` as a JSON string. |
| `created_at` / `updated_at` | `integer` (timestamp), default `unixepoch()` | |

### `avoidance_area_reports`

Follow-up reports/comments on an avoidance area (e.g. "still blocked as of today").

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `integer` PK, autoincrement | |
| `user_id` | `text` NOT NULL | FK → `user.id` (same reasoning as `avoidance_areas`). |
| `avoidance_area_id` | `integer` NOT NULL | FK → `avoidance_areas.id`. |
| `title` | `text` NOT NULL | |
| `description` | `text` | |
| `created_at` / `updated_at` | `integer` (timestamp), default `unixepoch()` | |

### Cross-table relationship summary

- `session.user_id`, `account.user_id` → `user.id` (cascade delete)
- `profiles.user_id` → `user.id` (unique — one profile per auth user)
- `reviews.user_id` → `profiles.id`; `reviews.poi_id` → `pois.id` (cascade delete)
- `votes.user_id` → `profiles.id`; `votes.review_id` → `reviews.id` (cascade delete)
- `avoidance_areas.user_id` → `user.id`
- `avoidance_area_reports.user_id` → `user.id`; `avoidance_area_reports.avoidance_area_id` →
  `avoidance_areas.id`

Because `avoidance_areas`/`avoidance_area_reports` reference `user.id` while `reviews`/`votes`
reference `profiles.id`, the avoidance-area routes (`GET /avoidance_areas`,
`GET /avoidance_areas/:id/reports`) bridge the two by `leftJoin`ing `profiles` on
`profiles.user_id = avoidance_areas.user_id` to surface `profile_display_name`/
`profile_avatar_url`.

## Server: POI-sync cron (`server/src/scheduled/poi-sync.ts`)

`syncPOIs(env)` — invoked by the Worker's `scheduled()` handler on the cron trigger
(`"0 0 * * *"` — daily at midnight UTC, per `server/wrangler.jsonc`).

1. **Fetch** the KML export of a Google "My Maps" layer of accessible-entrance points:
   `ACCESSIBLE_ENTRANCES_KML_URL = "https://www.google.com/maps/d/kml?forcekml=1&mid=1B_X9WRe0kkTlPbfYpmOQz7pHSQs"`.
   Throws if the response isn't OK. A code comment suggests moving this URL to a
   `wrangler.toml [vars]` entry to allow changing the source without a redeploy.
2. **Convert** the KML text to GeoJSON via `@tmcw/togeojson`'s `kml()`, parsing the XML with
   `@xmldom/xmldom`'s `DOMParser`.
3. **Map** each `Point`-geometry feature to a POI row:
   - `properties.description` is regex-parsed for `BldName <value>` → `metadata.bld_name`,
     `Auto_Opene <0|1>` → `metadata.auto_opene` (boolean), `Floor <value>` → `metadata.floor`
     (parsed as int, `null` if non-numeric).
   - `metadata.name` = `properties.name`.
   - `poi_type: "accessible_entrance"`, `metadata` and `location_geojson` are
     `JSON.stringify`'d.
   - Features without `properties`/`geometry`/non-`Point` geometry are filtered out
     (`null` → dropped).
4. **Upsert** in batches of 25 (`BATCH_SIZE`) via
   `db.insert(pois).values(batch).onConflictDoUpdate({ target: pois.location_geojson, set: {
   poi_type, metadata, updated_at: CURRENT_TIMESTAMP } })`.
   - This is **upsert-only** — existing POIs are updated, but POIs removed from the KML source
     are never deleted from the table.
5. Logs `Successfully upserted <n> POIs at <ISO timestamp>` on completion; re-throws on error
   (caught by the Worker's `ctx.waitUntil`, which logs unhandled rejections per Cloudflare's
   runtime behavior).

## Migrations (`server/migrations/`)

Drizzle-generated SQL migrations applied to the D1 database, in order:

| File | Summary |
| --- | --- |
| `0000_wakeful_gambit.sql` | Initial schema: creates `account`, `avoidance_area_reports`, `avoidance_areas`, `pois` (+ unique index on `location_geojson`), `profiles` (+ unique index on `user_id`), `reviews` (+ `poi_deleted_idx`), `session` (+ unique index on `token`), `user` (+ unique indexes on `email`/`username`), `verification`, `votes` (+ unique index on `(user_id, review_id)`). |
| `0003_add_is_anonymous.sql` | `ALTER TABLE profiles ADD COLUMN is_anonymous INTEGER NOT NULL DEFAULT 0`. |
| `0004_add_onboarding_completed_at.sql` | `ALTER TABLE profiles ADD COLUMN onboarding_completed_at INTEGER`. |
| `0005_repair_reviews_votes.sql` | Re-creates `reviews` (+ `poi_deleted_idx`) and `votes` (+ unique index on `(user_id, review_id)`) with `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` — a defensive "repair" migration for environments where these tables/indexes were missing. |
| `0006_stabilize_reviews_votes.sql` | Similar defensive re-creation of `reviews`/`votes`, additionally adding `reviews_user_poi_deleted_idx` on `(user_id, poi_id, deleted_at)`. |
| `0007_local_schema_guard.sql` | Full defensive guard: `CREATE TABLE IF NOT EXISTS` for **every** table (`user`, `session`, `profiles`, `pois`, `reviews`, `votes`, `avoidance_areas`, `avoidance_area_reports`) plus all unique/non-unique indexes — ensures a from-scratch local D1 instance ends up with the complete current schema even if earlier migrations were skipped. |
| `0008_reviews_poi_cascade.sql` | Adds `ON DELETE CASCADE` to `reviews.poi_id → pois.id`. Since SQLite can't `ALTER ... DROP CONSTRAINT`, this recreates `reviews` as `reviews_new` with the cascade FK, copies all rows (`INSERT INTO reviews_new SELECT * FROM reviews`), drops the old table/indexes, renames `reviews_new` → `reviews`, and recreates `poi_deleted_idx`/`reviews_user_poi_deleted_idx`. Wrapped in `PRAGMA foreign_keys=OFF/ON`. |

`server/migrations/meta/_journal.json` lists these (plus an `0007_striped_matthew_murdock`
entry — an auto-generated Drizzle migration name, applied after `0007_local_schema_guard`)
in application order; `server/migrations/meta/*_snapshot.json` files are Drizzle's
point-in-time schema snapshots used to compute future diffs.

## Tests (`server/test/`)

`server/test/index.spec.ts` — Vitest + `cloudflare:test` (Wrangler's Workers test pool)
smoke tests against the exported `worker` object from `src/index.ts`:

- **Root route** — `GET /` returns `200`, `content-type: application/json`, and
  `{ status: "ok" }`, tested via the "unit style" `worker.fetch(request, env, ctx)` +
  `createExecutionContext()`/`waitOnExecutionContext()` pattern.
- **Health route** — `GET /health` (via the "integration style" `SELF.fetch(...)`) returns
  JSON with `status` of `"ok"` or `"degraded"` (with `missingTables: string[]` if degraded), or
  a structured `{ error: { code, message } }` if the health probe itself throws.

`server/test/env.d.ts` / `server/test/tsconfig.json` provide the Cloudflare Workers test-pool
type definitions and TS config for these tests. The suite is intentionally a minimal smoke
test — it does not exercise the data-mutating routes (auth, reviews, votes, avoidance areas,
etc.).
