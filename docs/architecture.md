# Architecture

## System overview

Mobilize has two deployable halves:

- **Mobile app** — Expo / React Native (SDK 54), file-based routing via Expo Router v6. Runs
  on iOS, Android, and (partially) web.
- **Backend** — a Cloudflare Worker (Hono framework) backed by Cloudflare D1 (SQLite) via
  Drizzle ORM. See [api-and-server.md](./api-and-server.md).

The app talks to:
- The **Mobilize Worker** for all app data (POIs, avoidance areas, reviews, votes, profiles,
  auth) and as a **proxy** for Google Places (keeps the API key server-side) and ArcGIS
  construction-zone data.
- **Mapbox** directly (`@rnmapbox/maps`) for map tiles/terrain/styles.
- **OpenRouteService** directly for wheelchair routing (`ApiClient.getRoute`).
- **Google OAuth** via `expo-web-browser` for sign-in (token exchange happens through the
  Worker).

## Expo Router structure (`app/`)

Every file under `app/` is a route; `_layout.tsx` files wrap their directory in shared UI/logic.

- **`app/_layout.tsx`** — the root layout. Wraps everything in, from outside in:
  `ThemeProvider` → `QueryClientProvider` (TanStack Query) → `AuthProvider` → the actual app
  (`GestureHandlerRootView` → `BottomSheetModalProvider` → `Stack` + global `Toast`).
  It also runs a single `useEffect` **auth-redirect guard**: on every change to
  `isAuthenticated` / `onboardingComplete` / route `segments`, it calls
  `getAuthRedirectTarget()` (see [auth.md](./auth.md)) and `router.replace()`s if a redirect
  is needed, with a small dedupe window (800ms) to avoid redirect loops.
- **`app/index.tsx`** — `/`, a splash/redirect screen shown while auth state resolves.
- **`app/welcome.tsx`** — entry screen for unauthenticated users (sign in with Google / UT EID).
- **`app/(tabs)/`** — a route *group* (parens don't appear in the URL) for the authenticated
  app shell. `_layout.tsx` renders a bottom `Tabs` navigator with **Map** (`index.tsx`) and
  **Profile** (`profile.tsx`) tabs, themed via `useTheme()`.
- **`app/auth/`** — onboarding & OAuth screens (`signup`, `google-oauth`, `callback`,
  `profile-setup`, `mobility-preferences`, `ut-eid-coming-soon`), each its own route under
  `/auth/...`.
- **`app/profile/[username].tsx`** — a dynamic route for public profiles by username, wrapped
  by `app/profile/_layout.tsx`.
- **`app/+not-found.tsx`** / **`app/+html.tsx`** — Expo Router's special files for a 404
  fallback and the web HTML document shell.

## The `src/features/` convention

New/refactored feature code lives under `src/features/<feature>/`, separate from the route
files in `app/`. Route files (`app/(tabs)/index.tsx`) are kept as **thin shells**: they wire
up data hooks and a feature controller, then render presentational components.

- **`src/features/components/`** — shared UI components used by the map screen and elsewhere
  (bottom sheets, modals, search bar/dropdown, buttons). See
  [components.md](./components.md).
- **`src/features/map/`** — everything specific to the map screen: the screen controller, its
  sub-hooks, GeoJSON sources, Mapbox layer components, and rendering. See
  [map-feature.md](./map-feature.md).
- **`src/features/pois/`** — POI/building helper logic shared between the map's search,
  press-handling, and rendering code (`buildingUtils`, `poiBuildingUtils`, `poiUtils`,
  `clustering`).

Older shared utilities that haven't moved into `src/features/` yet remain in top-level
`utils/` and `types/` — see [utils.md](./utils.md) and [data-types.md](./data-types.md).

## The "controller hook" pattern

The map screen (`app/(tabs)/index.tsx`) is the most complex screen in the app, so its logic is
organized as a **controller hook**: `useMapScreenController()` (in
`src/features/map/useMapScreenController.ts`) composes several focused sub-hooks and returns a
single object namespaced by concern:

```ts
const map = useMapScreenController({ isTabFocused, bottomTabBarHeight, avoidanceAreas, entrances });
// map.bottomSheet.{ref,action}, map.report.{state,action}, map.search.{state,action},
// map.mapPress.action, map.poi, map.reviewKey, map.handleEnterReviewMode, ...
```

Each sub-hook returns `{ state, action }` (or `{ ref, action }` for refs), and the screen reads
`map.<hook>.state.x` / calls `map.<hook>.action.y(...)`. This keeps `index.tsx` declarative —
it has almost no business logic of its own. Full details of every sub-hook are in
[map-feature.md](./map-feature.md).

A cross-cutting concern — preventing stale async work (network responses, animations) from
presenting UI after the user has navigated away or dismissed something — is handled by a single
shared **overlay epoch/guard system** (`useMapOverlay`), which the search and press-handler
hooks are threaded through. This is also documented in [map-feature.md](./map-feature.md).

## State management

- **Server state** — TanStack Query v5. `utils/api-hooks.ts` wraps `ApiClient`
  (`utils/api-client.ts`) in query/mutation hooks with project-wide query keys, cache times,
  and toast-on-error/success behavior. See [api-and-server.md](./api-and-server.md).
- **Auth state** — React Context (`AuthProvider`/`useAuth` in `utils/useAuth.ts`), backed by
  AsyncStorage for the session token and cached user. See [auth.md](./auth.md).
- **Theme state** — React Context (`ThemeProvider`/`useTheme` in `utils/ThemeContext.tsx`),
  persisted to AsyncStorage, syncing NativeWind's `dark:` variants via
  `Appearance.setColorScheme()`.
- **Screen-local state** — plain `useState`/`useRef` inside the controller sub-hooks (search
  query, report-mode drawing state, bottom-sheet refs, overlay epoch counter). There is no
  global client-state store (Zustand is listed in `package.json` but not currently used by any
  code).

## Data flow

**App data** (POIs, avoidance areas, reviews, votes, profiles):
```
Component → api-hooks.ts (TanStack Query) → ApiClient (api-client.ts)
          → Cloudflare Worker (server/src/index.ts) → Drizzle/D1
```
`api-base.ts` resolves which base URL to call (handles local dev vs. tunnel URLs), and
`request-utils.ts` provides the shared `fetchWithTimeout`/JSON-parsing/error-typing used by
`ApiClient`.

**Map geometry**:
- *Static campus layers* (sidewalks, buildings, barriers, ramps) are bundled GeoJSON assets,
  loaded asynchronously by `useMapGeoJSON()` and handed to `MapLayers`.
- *Dynamic layers* (avoidance areas, construction zones) come from the API via
  `useAvoidanceAreas`/`useConstructionAreas`, then converted to GeoJSON by
  `useAvoidanceGeoJSON`/`useConstructionGeoJSON`.
- *POIs* come from `usePOIs()`, are filtered/clustered by `usePOIFeatures()` +
  `clustering.ts`, and rendered as a `SymbolLayer` by `MapLayers`.

**Search**: `useMapSearch` queries the local `buildingDatabase` and, via the Worker's Google
Places proxy (`utils/googlePlaces.ts`), remote places — with a campus/global scope fallback —
then resolves the result to either a building POI (`buildPoiFromCampusBuilding`) or a generic
location (`LocationDetailsBottomSheet`).

## Styling

NativeWind (Tailwind for React Native) is used throughout via `className` props, with shared
brand/semantic colors in `types/colors.ts` and shared text styles in `utils/typography.ts`.
Dark mode is driven by `ThemeContext` — most components branch on `useTheme().colorScheme` for
colors that NativeWind's `dark:` variant can't express cleanly (e.g. Mapbox layer paint
properties, which aren't React Native styles).
