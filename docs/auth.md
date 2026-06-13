# Authentication & onboarding

This document covers the client-side auth context (`AuthProvider`/`useAuth`), the route-redirect
machine that drives navigation based on auth state, every screen in the sign-up/onboarding flow,
the profile screens, and the server-side Better Auth configuration.

## Flow overview

```text
app/welcome.tsx
 |- "Continue with Google" --> app/auth/google-oauth.tsx
 |                                 | signInWithGoogle() opens a WebBrowser auth session
 |                                 | against the Worker's /api/auth/signin/google
 |                                 v
 |                              app/auth/callback.tsx  (deep link: mobilize://auth/callback)
 |                                 | completeGoogleOAuthCallback(url)
 |                                 |  - stores session token + user in AsyncStorage
 |                                 |  - fetches /api/me
 |                                 v
 |                  +-- onboardingComplete? --+
 |                 no                         yes
 |                  v                          v
 |   app/auth/profile-setup.tsx        app/(tabs)/  (main app)
 |      (display name, username,
 |       class year, major, bio)
 |                  |
 |                  v
 |   app/auth/mobility-preferences.tsx
 |      (walking / wheelchair / cane / other)
 |      -> apiClient.updateProfile({ onboardingComplete: true })
 |                  |
 |                  v
 |            app/(tabs)/  (main app)
 |
 +- "Continue with UT EID" --> app/auth/ut-eid-coming-soon.tsx
                                   (placeholder -- "Back to Sign In" -> welcome)
```

`app/index.tsx` (`/`) and the root auth-redirect guard in `app/_layout.tsx` sit above all of this
-- see [architecture.md](./architecture.md) for the guard itself, and
[Route-redirect logic](#route-redirect-logic) below for the decision function it calls.

## `AuthProvider` / `useAuth`

`utils/useAuth.ts:225` (`AuthProvider`) and `utils/useAuth.ts:476` (`useAuth`). `AuthProvider`
wraps the whole app (just inside `QueryClientProvider`, per `app/_layout.tsx:50`) and exposes a
React Context with the shape:

```ts
type AuthContextType = {
  user: User | null;
  profile: any | null;
  onboardingComplete: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<GoogleSignInResult>;
  completeGoogleOAuthCallback: (input: OAuthCallbackInput) => Promise<OAuthCallbackResult>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<void>;
};
```

`User` (`utils/useAuth.ts:110`) is `{ id, email, name, image, username, role, emailVerified,
createdAt, updatedAt }` -- the Better Auth user row plus the `username`/`role` fields added by
`server/src/auth.ts`'s `additionalFields`. `profile` is the app's own `profiles` table row
(display name, class year, major, bio, mobility preference, `onboarding_completed_at`), returned
as-is from `/api/me`.

### Persisted state

Two AsyncStorage keys, exported as constants:

| Key constant | AsyncStorage key | Contents |
| --- | --- | --- |
| `SESSION_TOKEN_KEY` | `"auth_session_token"` | The bearer session token returned by the Worker's Better Auth instance |
| `USER_KEY` | `"auth_user"` | A JSON-serialized `User` (cached for offline/optimistic display) |

`parseCachedUser()` (`utils/useAuth.ts:49`) safely `JSON.parse`s the cached user, returning `null`
on missing/invalid data.

### Bootstrap

On mount, a `useEffect` (`utils/useAuth.ts:307`) runs `bootstrap()`:
1. Reads `USER_KEY` and, if present, optimistically sets `user`/`isAuthenticated: true` so the UI
   can render something immediately (avoids a flash of the welcome screen for returning users).
2. Calls `refreshSession()` to validate against the server and fill in `profile`/
   `onboardingComplete`.

### `refreshSession()`

`utils/useAuth.ts:261`. De-duplicated via `refreshSessionInFlightRef` -- concurrent callers all
await the same in-flight promise.

1. Sets `isLoading: true`.
2. Reads `SESSION_TOKEN_KEY` from AsyncStorage. If missing, calls `clearSession()` and returns.
3. Calls `fetchMe(sessionToken)` (see below).
4. If `fetchMe` returns `null` (server says unauthenticated), calls `clearSession()`.
5. Otherwise, writes the fresh `user` to `USER_KEY` and calls `applyAuthState(me)`, which sets
   `user`, `profile`, `onboardingComplete`, `isAuthenticated: true`, `isLoading: false`.
6. On a thrown error: if `isLikelyNetworkError(error)` (from `utils/request-utils.ts`), falls back
   to the cached `USER_KEY` user -- sets `user`/`isAuthenticated: true` but leaves `profile`/
   `onboardingComplete` at their previous values, so a temporary network outage doesn't bounce an
   already-signed-in user back to onboarding/welcome. If there's no cached user, or the error
   wasn't network-related, calls `clearSession()`.

### `fetchMe(sessionToken)`

`utils/useAuth.ts:166`, module-private. Iterates `getApiBaseCandidates()` (from
`utils/api-base.ts`) and calls `GET {baseUrl}/api/me` with `Authorization: Bearer <token>` on
each, in order (active URL first):

- `401` on a non-last candidate -> try the next candidate (could be a stale/incorrect base URL).
- `401` on the last candidate -> return `null` (caller treats this as "not authenticated").
- Any other reachable JSON response -> `promoteApiBaseUrl(baseUrl)` (remember this candidate as
  the working one for future requests), then either throw a `ClientRequestError` (non-2xx,
  non-401) or return `{ user, profile, onboardingComplete }` (parsed from the `/api/me` response
  body, with `onboardingComplete` coerced via `Boolean(...)`).
- A retriable network error on a candidate -> try the next candidate; if all candidates fail,
  throw the last error.

### `clearSession()` / `applyAuthState()`

Internal helpers (`utils/useAuth.ts:240`, `:251`). `clearSession()` removes both AsyncStorage keys
(`AsyncStorage.multiRemove`) and resets `authState` to the signed-out shape (`user: null, profile:
null, onboardingComplete: false, isLoading: false, isAuthenticated: false`). `applyAuthState(me)`
sets `user`/`profile`/`onboardingComplete` from a `fetchMe` result and marks
`isAuthenticated: true, isLoading: false`.

### `signInWithGoogle()`

`utils/useAuth.ts:402`. Kicks off the OAuth browser flow:

1. `getOAuthBaseUrl()` (`utils/useAuth.ts:37`) resolves `EXPO_PUBLIC_API_URL`, throwing if it's
   unset or is a `localhost`/`127.0.0.1` URL -- Google's redirect must hit a publicly-reachable
   (devtunnels) HTTPS URL.
2. `promoteApiBaseUrl(apiBaseUrl)` -- make this the active API base for the rest of the session.
3. Builds:
   - `redirectUrl = Linking.createURL("auth/callback")` -- the app's deep link (e.g.
     `mobilize://auth/callback`), where Google/the Worker redirects back to after sign-in.
   - `redirectUri = "{apiBaseUrl}/api/auth/callback/google"` -- the Worker's own OAuth callback
     endpoint (registered with Google).
   - `authUrl = "{apiBaseUrl}/api/auth/signin/google?callbackURL=<redirectUrl>&redirectUri=<redirectUri>"`.
4. `WebBrowser.openAuthSessionAsync(authUrl, redirectUrl)` opens the system browser/in-app browser
   for the Google consent screen, and resolves once the browser redirects back to `redirectUrl`.
5. On `result.type !== "success"`, returns `{ success: false, cancelled, error }` (cancelled if
   the user dismissed/cancelled the browser).
6. On success, returns `{ success: true, callbackUrl: result.url }` -- the full deep-link URL
   (including the session token), which the caller (`app/auth/google-oauth.tsx`) hands off to
   `app/auth/callback.tsx`.

`WebBrowser.maybeCompleteAuthSession()` is called once at module load (`utils/useAuth.ts:31`) so
the auth session resolves correctly on web.

### `completeGoogleOAuthCallback(input)`

`utils/useAuth.ts:323`. Consumes the deep-link callback and finalizes sign-in.

- `input` is either the raw callback URL string, or an object `{ session_token?, token?, error? }`
  -- normalized by `parseOAuthCallbackInput()` (`utils/useAuth.ts:72`) into `{ token, error,
  signature }`. For a URL, `signature` is the full URL string; for an object, it's
  `"token:<token>|error:<error>"`. The token is read from `session_token` or `token`, in either
  query params or the URL hash fragment.
- **Idempotency / de-dupe**:
  - If this exact `signature` was already completed successfully
    (`lastCompletedOAuthSignatureRef`) and the user is still authenticated, returns the cached
    success result without re-fetching.
  - If a completion for the same `signature` is already in flight
    (`oauthCompletionInFlightRef`), returns that same promise (handles double-invocation, e.g.
    React effects firing twice).
- Otherwise runs the real flow:
  1. If `parsed.error` is set, sets `isLoading: false` and returns `{ success: false, error }`.
  2. If `parsed.token` is missing or the literal string `"null"` (guards against the server
     echoing a literal `"null"`), returns `{ success: false, error: "No session token returned
     from OAuth callback." }`.
  3. Writes the token to `SESSION_TOKEN_KEY`, then calls `fetchMe(token)`.
  4. If `fetchMe` returns `null`, calls `clearSession()` and returns `{ success: false, error:
     "Unable to load user after sign-in." }`.
  5. Otherwise writes `USER_KEY`, calls `applyAuthState(me)`, records
     `lastCompletedOAuthSignatureRef`, and returns `{ success: true, onboardingComplete:
     me.onboardingComplete }`.
  - Any thrown error is caught, logged, and converted to `{ success: false, error: message }`.

### `signOut()`

`utils/useAuth.ts:431`. Reads `SESSION_TOKEN_KEY`; if present, best-effort `POST
{apiBaseUrl}/api/auth/signout` with the bearer token (errors are swallowed --
`.catch(() => {})`). Always finishes by calling `clearSession()`, regardless of whether the
network call succeeded.

### `getAccessToken()`

`utils/useAuth.ts:450`. Returns `AsyncStorage.getItem(SESSION_TOKEN_KEY)` directly -- used by
`ApiClient` (`utils/api-client.ts`) to attach the `Authorization: Bearer <token>` header on
authenticated requests (`authRequest`).

## Route-redirect logic

`getAuthRedirectTarget()` -- `utils/routes.ts:38`. A pure function: given the current auth state
and the active route `segments` (from `useSegments()`), returns the `AppRoute` to redirect to, or
`null` if the current route is fine as-is.

It's called from a single `useEffect` in `app/_layout.tsx` (the root auth-redirect guard,
documented in [architecture.md](./architecture.md)), which `router.replace()`s to the returned
target, deduping repeated identical redirects within an 800ms window via `lastRedirectRef`.

### Route classification

From `segments`, the function derives:

| Variable | Meaning |
| --- | --- |
| `rootSegment` | `segments[0]`, e.g. `""`, `"welcome"`, `"(tabs)"`, `"auth"` |
| `childSegment` | `segments[1]`, e.g. `"callback"`, `"profile-setup"` |
| `isRootIndex` | `rootSegment` is `""` or `"index"` (the `/` splash screen) |
| `isAuthGroup` | `rootSegment === "auth"` |
| `isTabsGroup` | `rootSegment === "(tabs)"` |
| `isWelcome` | `rootSegment === "welcome"` |
| `isCallback` | `isAuthGroup && childSegment === "callback"` |
| `isOnboardingScreen` | `isAuthGroup && childSegment` is `"profile-setup"` or `"mobility-preferences"` (the `ONBOARDING_SCREENS` set) |

### Three-state machine

1. **`!isAuthenticated`** (not signed in):
   - If on the root index, the tabs group, or an onboarding screen -> redirect to `WELCOME`.
   - Otherwise (welcome, auth/signup, auth/google-oauth, auth/callback, auth/ut-eid-coming-soon,
     public profile, etc.) -> `null` (stay).
2. **`isAuthenticated && isCallback`** -- always `null` (stay). The callback screen must be
   allowed to run to completion (consume the token / surface an error) regardless of onboarding
   state, before any further redirect happens.
3. **`isAuthenticated && !onboardingComplete`**:
   - If on the root index, tabs group, welcome, or any `auth/*` screen *other than* the two
     onboarding screens -> redirect to `AUTH_PROFILE_SETUP`.
   - If already on `profile-setup` or `mobility-preferences` -> `null` (stay).
4. **`isAuthenticated && onboardingComplete`**:
   - If on the root index, welcome, or any `auth/*` screen (including `callback`, handled above,
     and the onboarding screens) -> redirect to `TABS`.
   - If already in `(tabs)` or a public profile route (`profile/[username]`) -> `null` (stay).

### Input -> output table

| `isAuthenticated` | `onboardingComplete` | Current route | Redirect target |
| --- | --- | --- | --- |
| `false` | -- | `/` (root index) | `WELCOME` |
| `false` | -- | `(tabs)/*` | `WELCOME` |
| `false` | -- | `auth/profile-setup` or `auth/mobility-preferences` | `WELCOME` |
| `false` | -- | `welcome`, `auth/signup`, `auth/google-oauth`, `auth/callback`, `auth/ut-eid-coming-soon`, `profile/[username]` | *(stay)* |
| `true` | any | `auth/callback` | *(stay -- let callback finish)* |
| `true` | `false` | `/`, `(tabs)/*`, `welcome` | `AUTH_PROFILE_SETUP` |
| `true` | `false` | `auth/signup`, `auth/google-oauth`, `auth/ut-eid-coming-soon` | `AUTH_PROFILE_SETUP` |
| `true` | `false` | `auth/profile-setup`, `auth/mobility-preferences` | *(stay)* |
| `true` | `false` | `profile/[username]` | *(stay -- not in any matched group)* |
| `true` | `true` | `/`, `welcome` | `TABS` |
| `true` | `true` | `auth/*` (any, including onboarding screens) | `TABS` |
| `true` | `true` | `(tabs)/*` | *(stay)* |
| `true` | `true` | `profile/[username]` | *(stay)* |

`APP_ROUTES` (`utils/routes.ts:2`) is the typed map of route-string constants used here and
throughout the app: `ROOT`, `WELCOME`, `TABS`, `TABS_PROFILE`, `AUTH_GOOGLE_OAUTH`,
`AUTH_CALLBACK`, `AUTH_UT_EID_COMING_SOON`, `AUTH_PROFILE_SETUP`, `AUTH_MOBILITY_PREFERENCES`,
`AUTH_SIGNUP`.

## Entry screens

### `app/index.tsx`

The `/` route. Pure loading shell -- renders a centered `ActivityIndicator` (burnt-orange,
`#BF5700`) on a white/dark background and nothing else. It has no logic of its own: while
`AuthProvider` is bootstrapping (`isLoading: true`), the root guard doesn't redirect yet, so this
spinner is what's visible; once `isLoading` becomes `false`, `getAuthRedirectTarget()` sends the
user to `WELCOME`, `AUTH_PROFILE_SETUP`, or `TABS` per the table above.

### `app/welcome.tsx`

`WelcomeScreen` -- the landing screen for unauthenticated users. No auth required. Renders the
Mobilize logo/header and two buttons:

- **"Continue with UT EID"** -> `router.push(APP_ROUTES.AUTH_UT_EID_COMING_SOON)`.
- **"Continue with Google"** (gray variant) -> `router.push(APP_ROUTES.AUTH_GOOGLE_OAUTH)`.

No local state beyond `useSafeAreaInsets()` for layout.

## Onboarding flow (`app/auth/`)

`app/auth/_layout.tsx` wraps these screens in a headerless `Stack`, with screens registered in
flow order: `signup`, `google-oauth`, `callback`, `ut-eid-coming-soon`, `profile-setup`,
`mobility-preferences`.

### `signup.tsx`

`SignupScreen` -- functionally near-identical to `welcome.tsx` (same logo/header layout), reached
via `/auth/signup`. No auth required. Two buttons:

- **"Continue with UT EID"** -> `AUTH_UT_EID_COMING_SOON`.
- **"Continue with Google"** (gray variant) -> `AUTH_GOOGLE_OAUTH`.

It isn't referenced by `getAuthRedirectTarget()`'s `ONBOARDING_SCREENS` set, and isn't linked from
`welcome.tsx` -- it's effectively an alternate/legacy entry point that lands in the same
`google-oauth`/`ut-eid-coming-soon` screens as `welcome.tsx`.

### `google-oauth.tsx`

`GoogleOAuthScreen` -- `/auth/google-oauth`. No auth required. Intermediate screen that kicks off
the browser-based Google sign-in.

- **State**: `error` (string | null), `isLoading` (bool, starts `true`), plus `hasStartedRef` /
  `hasConsumedRouteErrorRef` refs to ensure the sign-in flow and any route-supplied `error` param
  are each only handled once.
- On mount (`useEffect`):
  - If navigated here with an `error` query param (e.g. bounced back from `callback.tsx` after a
    failed completion), shows that error immediately instead of starting a new sign-in.
  - Otherwise calls `handleGoogleSignIn()`.
- **`handleGoogleSignIn()`** -- calls `useAuth().signInWithGoogle()`:
  - On success with a `callbackUrl`, URL-encodes it and `router.replace()`s to `AUTH_CALLBACK`
    with `params: { callbackUrl: encodedCallbackUrl }`.
  - On success without a `callbackUrl`, or on failure, sets `error` (from `result.error`, or "No
    OAuth callback URL returned." / "Authentication failed").
- **Error UI**: a back-caret button (`router.back()`), "Authentication Failed" heading, the error
  message, and "Try Again" (re-runs `handleGoogleSignIn`) / "Go Back" buttons.
- **Loading UI**: back-caret button, centered spinner, "Connecting to Google..." text.

### `callback.tsx`

`OAuthCallbackScreen` -- `/auth/callback`. No auth required (this *is* the screen that establishes
auth). This is also the path registered as the app's deep-link redirect target
(`Linking.createURL("auth/callback")`, e.g. `mobilize://auth/callback?session_token=...`).

- **State**: only a `hasHandledRef` guard so the effect body runs exactly once.
- Reads route params: `callbackUrl` (URL-encoded, set by `google-oauth.tsx`), or directly
  `session_token`/`token`/`error` (if the deep link itself carried them as route params).
- On mount, builds a `callbackInput` -- the decoded `callbackUrl` string if present, otherwise an
  object `{ session_token, token, error }` -- and calls
  `useAuth().completeGoogleOAuthCallback(callbackInput)`.
- On `result.success`:
  - `result.onboardingComplete` -> `router.replace(APP_ROUTES.TABS)`.
  - otherwise -> `router.replace(APP_ROUTES.AUTH_PROFILE_SETUP)`.
- On failure -> `router.replace({ pathname: AUTH_GOOGLE_OAUTH, params: { error: result.error ??
  "Authentication failed" } })` -- sending the user back to `google-oauth.tsx`'s error UI.
- Renders only a centered spinner + "Finishing Google sign-in..." while this resolves.

Note `getAuthRedirectTarget()` always lets `auth/callback` through (`isCallback` short-circuit) so
this screen's own `router.replace()` calls above are what actually move the user on -- the root
guard won't race it.

### `profile-setup.tsx`

`ProfileSetupScreen` -- `/auth/profile-setup`, step 1 of onboarding. Requires an authenticated
session (the root guard sends unauthenticated users to `WELCOME` if they land here).

- **Form state**: `firstName`, `lastName`, `username`, `classYear`, `major`, `bio` (all
  `useState<string>`), plus `isSaving`.
- `normalizeUsername(value)` -- lowercases, trims, replaces whitespace with `_`, strips characters
  outside `[a-z0-9_.-]`.
- `canProceed` -- `true` once `firstName`, `lastName`, and a non-empty normalized `username` are
  all present; gates the "Next" button's `variant`/`disabled`.
- **`handleNext()`**:
  1. Validates required fields (`Alert.alert` on failure).
  2. Calls `apiClient.createProfile({ firstName, lastName, username, classYear?, major?, bio? })`
     -- `POST /api/profile`.
  3. Updates the cached `USER_KEY` user's `name` (to `"{firstName} {lastName}"`) and `username` in
     AsyncStorage directly (best-effort, wrapped in `try/catch`), so the UI reflects the new name
     before the next `refreshSession()` round-trips.
  4. Calls `refreshSession()`.
  5. Re-checks `SESSION_TOKEN_KEY` is still present; if not, alerts "Session expired" and
     `router.replace(WELCOME)`.
  6. On success, `router.replace(APP_ROUTES.AUTH_MOBILITY_PREFERENCES)`.
  - Error handling: `401` -> sign out and go to `WELCOME`; network error
    (`isLikelyNetworkError`) -> "Cannot reach server" alert (stays on screen); `409`/"username" in
    the message -> "Username taken" alert; anything else -> generic "Could not save your profile"
    alert.
- UI: profile-picture placeholder (initial letter of `firstName`, with a non-functional edit-pencil
  badge), then text inputs for each field (required ones marked `*`), then the "Next" button
  (replaced by a spinner while `isSaving`).

### `mobility-preferences.tsx`

`MobilityPreferencesScreen` -- `/auth/mobility-preferences`, step 2 of onboarding. Requires an
authenticated session.

- **State**: `selectedOption` (one of `"walking" | "wheelchair" | "cane" | "others"`, or `""`),
  `userName` (first name, for the greeting), `isSaving`.
- On mount, reads `auth_user` from AsyncStorage directly (not via `useAuth().user`) and sets
  `userName` to `user.name?.split(" ")[0]` -- greets "Hi {userName}, let us get to know more about
  you!".
- `mobilityOptions` -- a static list of four radio-style options rendered as `TouchableOpacity`
  rows with a custom radio indicator, highlighted (burnt-orange border/background) when selected.
- **`handleNext()`**:
  1. If `!isAuthenticated`, alerts "Session expired" and goes to `WELCOME`.
  2. If `selectedOption` is set, `apiClient.updateProfile({ mobilityPreference: selectedOption,
     onboardingComplete: true })`; otherwise just `apiClient.updateProfile({ onboardingComplete:
     true })` -- i.e. the user can skip selecting a mobility preference but onboarding still
     completes (`PUT /api/profile`).
  3. `refreshSession()`, then re-checks `auth_session_token` is present (else "Session expired" ->
     `WELCOME`).
  4. Calls `apiClient.getMe()` and verifies `refreshedMe.onboardingComplete` is truthy -- if not,
     alerts "Profile not finished" and stays (does **not** navigate), so the user can retry.
  5. On success, `router.replace(APP_ROUTES.TABS)`.
  - Error handling mirrors `profile-setup.tsx`: `401` -> sign out + `WELCOME`; network error ->
    "Cannot reach server" alert; other errors -> generic "Could not save preference" alert.
- The submit button's label is dynamic: `"Save & Continue"` if an option is selected, `"Skip for
  now"` if not -- both call the same `handleNext()`. A caption below explains "You can change this
  anytime in Profile".

Once `onboardingComplete: true` is persisted and `refreshSession()` picks it up,
`getAuthRedirectTarget()`'s state-3 rule (`isAuthenticated && onboardingComplete`, on an `auth/*`
screen -> `TABS`) would also redirect here -- `mobility-preferences.tsx`'s own
`router.replace(TABS)` just gets there first.

### `ut-eid-coming-soon.tsx`

`UTEidComingSoonScreen` -- `/auth/ut-eid-coming-soon`. No auth required. A static placeholder shown
when the user taps "Continue with UT EID" from `welcome.tsx` or `signup.tsx` -- UT EID login is
not yet implemented. Shows a back-caret (`router.back()`), a "UT EID Sign-in" heading, body text
("This flow is coming soon. For now, use Continue with Google."), and a "Back to Sign In" button
that `router.replace(APP_ROUTES.WELCOME)`.

## Profile screens

### `app/(tabs)/profile.tsx`

`ProfileTab` -- the authenticated user's own profile, one of the two bottom tabs (see
[architecture.md](./architecture.md)). Requires an authenticated + onboarded user, but also
renders a usable (mostly empty) "not signed in" state if reached while signed out.

- Pulls `user`, `profile` (cast to a local `ProfileData` type: `display_name`, `class_year`,
  `major`, `bio`, `mobility_preference`), `isAuthenticated`, `isLoading`, `signOut`,
  `refreshSession` from `useAuth()`.
- **Local form state**: `displayName`, `classYear`, `major`, `bio` (editable copies of `profile`
  fields), `isEditing`, `isSaving`, and `saved` (a snapshot of the four fields used to restore on
  cancel). A `useEffect` re-syncs the editable fields from `profile`/`user` whenever `!isEditing`.
- `useEffect(() => { void refreshSession(); }, [refreshSession])` -- refreshes auth/profile state
  on mount.
- `useFocusEffect` loads the persisted map-detail preference (`getStoredMapDetailMode()` /
  `setStoredMapDetailMode()` from `utils/mapPreferences`) into `mapDetailMode`
  (`"simple" | "detailed"`).
- **`handleSave()`** -- `apiClient.updateProfile({ displayName, classYear?, major?, bio? })` (`PUT
  /api/profile`), then `refreshSession()`, updates the `saved` snapshot, exits edit mode, and shows
  a "Saved" alert. On `401`, signs out and redirects to `WELCOME`; on network error, shows a
  "Cannot reach server" alert and stays in edit mode; otherwise a generic error alert.
- **`handleCancelEdit()`** -- restores the four fields from `saved` and exits edit mode.
- **`handleSignOut()`** -- confirmation `Alert` -> `signOut()` (clears local session; the root
  guard then redirects to `WELCOME`).
- **`handleMapDetailModeChange(mode)`** -- persists the chosen map mode via
  `setStoredMapDetailMode`.
- **Sections rendered**:
  - Header: "Profile" title + edit-pencil button (only when signed in and not already editing).
  - Avatar (from `user.image`, or an initial-letter placeholder), `displayName`/`user.name`,
    `@username`, email, or "Not signed in" if signed out.
  - **Information** (signed-in only) -- Display Name, Class Year, Major, Biography -- text fields
    in edit mode, plain text otherwise.
  - **Mobility Preferences** (signed-in only) -- shows `mobility_preference` (title-cased via
    `mobilityLabel`, defaulting to "Not set"), with an edit-pencil that
    `router.push(APP_ROUTES.AUTH_MOBILITY_PREFERENCES)` to re-run that onboarding step.
  - **Appearance** -- three buttons (System/Light/Dark) calling `useTheme().setThemeMode`.
  - **Map View** -- two buttons (Simple/Detailed) calling `handleMapDetailModeChange`.
  - Footer: "Save Changes"/"Cancel" while editing; "Sign Out" if signed in; "Sign In" (->
    `router.push(WELCOME)`) if signed out.
- `shouldShowLoading` (`isAuthLoading && !user && !profile`) shows a full-screen spinner instead of
  the above while the very first `/api/me` call is still pending.

### `app/profile/_layout.tsx` + `app/profile/[username].tsx`

`app/profile/_layout.tsx` is a headerless `Stack` with a single `[username]` screen -- the public
profile route, `/profile/<username>`. Accessible without auth (not gated by
`getAuthRedirectTarget()`, and `apiClient.getPublicProfile()` hits an unauthenticated endpoint).

`PublicProfileScreen` (`app/profile/[username].tsx`):

- Reads `username` from `useLocalSearchParams()`.
- **State**: `data` (`{ user, profile } | null`), `loading`, `loadError` (`"not_found" | "network"
  | null`).
- On mount/`username` change, calls `apiClient.getPublicProfile(username)` -- `GET
  /api/users/:username` (no auth header). On error, distinguishes a `404` (message contains
  `"404"`) -> `loadError = "not_found"` ("User not found.") from any other failure -> `"network"`
  ("Could not load this profile right now."), both with a "Go back" link.
- On success, renders:
  - Back button (`router.back()`).
  - Avatar (from `user.image` or an initial), `display_name`/`user.name`/`user.username`,
    `@username`.
  - A "UT Student" badge if `user.role === "student"`.
  - **Information** section (only if `profile` exists): Class Year, Major, Bio, and Mobility
    (mapped through `MOBILITY_LABELS`: `walking` -> "Walking", `wheelchair` -> "Wheelchair /
    mobility aid", `cane` -> "Using a cane", `others` -> "Other") -- each field shown only if
    present.
  - If `profile` is `null`, a "This user has not set up their profile yet." callout.

This screen is entirely read-only -- there's no edit affordance, even for the current user
(editing your own profile happens on `app/(tabs)/profile.tsx`).

## Server-side auth config

`server/src/auth.ts` -- `createAuth(env)` constructs a [Better Auth](https://better-auth.com)
instance (`betterAuth({...})`) used by the Worker's `/api/auth/*` routes
(`server/src/index.ts`).

- **Database adapter** -- `drizzleAdapter(db, { provider: "sqlite", schema: {...} })`, mapping
  Better Auth's internal `user`/`session`/`account`/`verification` tables onto the project's
  Drizzle schema (`schema.users`, `schema.session`, `schema.account`, `schema.verification`) on
  Cloudflare D1.
- **Email/password** -- explicitly disabled (`emailAndPassword: { enabled: false }`); the app is
  OAuth-only.
- **Social providers** -- a single Google OAuth provider (`socialProviders.google`), configured
  from environment bindings:
  - `GOOGLE_CLIENT_ID` -- Google OAuth client ID, read from environment.
  - `GOOGLE_CLIENT_SECRET` -- Google OAuth client secret, read from environment.
  - `redirectURL` -- built as `"{BETTER_AUTH_URL}/api/auth/callback/google"`, i.e. the Worker's own
    callback endpoint (must match what's registered in the Google Cloud console).
- **Secret/base URL**:
  - `BETTER_AUTH_SECRET` -- symmetric secret Better Auth uses to sign sessions/tokens, read from
    environment.
  - `BETTER_AUTH_URL` -- the Worker's public base URL, read from environment; used both for the
    Google redirect above and as Better Auth's own `baseURL`.
  - `basePath: "/api/auth"` -- all Better Auth routes are mounted under `/api/auth/*`.
- **Trusted origins** -- a fixed allowlist of origins permitted to initiate/complete auth flows:
  local dev servers (`http://localhost:54321`, `http://127.0.0.1:54321`, `http://localhost:8081`,
  `http://10.0.2.2:8081` -- the last being the Android emulator's host loopback), Expo's auth proxy
  (`https://auth.expo.io`), the app's custom URL scheme (`mobilizeut://`), and the Expo Go scheme
  (`exp://`).
- **Session settings** (`session`):
  - `expiresIn: 60 * 60 * 24 * 7` -- sessions last 7 days.
  - `updateAge: 60 * 60 * 24` -- a session's expiry is refreshed at most once per 24 hours of
    activity.
- **Additional user fields** (`user.additionalFields`):
  - `username` (`string`, optional) -- set by the `databaseHooks` below and by
    `createProfile`/onboarding.
  - `role` (`string`, optional, default `"public"`) -- `"student"` vs `"public"`, used throughout
    the app (e.g. comment/review permissions, the "UT Student" badge, `canReport` in
    `map-feature.md`).
- **`databaseHooks.user.create.after`** -- runs immediately after a new user row is inserted (i.e.
  on first Google sign-in):
  - Sets `role` to `"student"` if the user's email ends with `@utexas.edu`, else `"public"`.
  - Derives a default `username` from the local part of the email (or the user's `id` if no
    email), retrying with a numeric suffix (e.g. `john`, then `john_2`, `john_3`, up to
    `john_5`) if a `UNIQUE constraint failed` error occurs, giving up (and re-throwing) after 5
    attempts.
  - This is why a freshly-signed-up user already has a `username` and `role` before they ever hit
    `profile-setup.tsx` -- that screen's `createProfile` call can still overwrite `username` with
    the user's chosen value.
- **Plugins** -- `bearer()` (`better-auth/plugins`), which lets the mobile app authenticate via an
  `Authorization: Bearer <session_token>` header (as opposed to cookies), since React Native has
  no shared cookie jar with the Worker.

`createAuth` returns the configured `betterAuth(...)` instance; `Auth = ReturnType<typeof
createAuth>` is exported for typing the Worker's `c.get("auth")`/route handlers elsewhere in
`server/src/index.ts`.
