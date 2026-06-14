# Utility modules (`utils/`)

This covers the `utils/` modules not already documented elsewhere: not the API/server layer
(`api-client.ts`, `api-hooks.ts`, `api-base.ts`, `request-utils.ts`, `ApiQueryProvider.tsx` —
see [api-and-server.md](./api-and-server.md)), not auth (`useAuth.ts`, `routes.ts` — see
[auth.md](./auth.md)), and not the map-feature-specific code in `src/features/map/`
(see [map-feature.md](./map-feature.md)).

## `utils/buildingDatabase.ts` — local campus building database

A build-time database of known UT buildings, derived from the bundled
`assets/geojson/buildings_simple.json`. It's the "source of truth" the search flow checks
*before* falling back to Google Places.

- **`buildingIndex`** — a `Map<string, BuildingProperties>` keyed by uppercased
  `Building_Abbr`, built once at module load by iterating every feature in
  `buildings_simple.json`. `BuildingProperties` is:

  | Field | Type | Description |
  | --- | --- | --- |
  | `Building_Abbr` | `string` | Short code, e.g. `"GDC"`. |
  | `Description` | `string` | Human-readable name. |
  | `Address_Full` | `string` | |
  | `Building_Details_URL` | `string \| null` | Link to the official building page, if any. |
  | `Shape__Area` | `number` | Footprint area (used elsewhere for extrusion height). |
  | `OBJECTID` | `number` | |
  | `Building`, `City`, `State`, `Zip` | `string` | |
  | `centroid` | `{ lat: number; lng: number }` | Computed via `computeCentroid()` from the polygon's first ring (defaults to `UT_CENTER`-ish coordinates if no polygon). |
  | `polygonRing` | `[number, number][]` | Raw `[lng, lat]` ring — used by `getCardinalLabel`. |

- **`findBuilding(abbr)`** — case-insensitive lookup in `buildingIndex` by abbreviation; returns
  `BuildingProperties | null`.
- **`findBuildingByName(name)`** — fuzzy match against `Description`: exact abbreviation, then
  exact/prefix/substring match on the lowercased description.
- **`searchBuildings(query, limit = 8)`** — combines `findBuilding`/`findBuildingByName` with a
  scan over `buildingIndex` matching on abbreviation prefix, description prefix/substring, or
  address substring; de-duplicates by `Building_Abbr` and returns up to `limit` results. Used by
  `SearchDropdown` for the "local" half of search results (`id`/`place_id` prefixed
  `local_<Building_Abbr>`) and by `useMapSearch`'s "looks like campus intent" heuristic.
- **`buildingToPlaceDetails(b)`** — converts a `BuildingProperties` into a `PlaceDetails`
  (from `utils/googlePlaces.ts`) so `LocationDetailsBottomSheet` can render local-DB results
  with the same code path as Google Places results: `place_id: "local_<abbr>"`, `name:
  Description`, `formatted_address`, `geometry.location: centroid`, and a fixed `types` array
  (`["university", "point_of_interest", "establishment"]`).
- **`extractBuildingAbbreviation(value)`** — pulls a 2–8 char building code out of a string,
  either from `(ABBR)` parentheses or a leading code (`"GDC Main"` → `"GDC"`), returned
  uppercased.

  **Duplication note**: `src/features/pois/buildingUtils.ts` has its own copy of
  `extractBuildingAbbreviation` with the same regex logic
  (`/\(([A-Za-z0-9]{2,8})\)/` / `/^([A-Za-z0-9]{2,8})\b/`). This `utils/buildingDatabase.ts`
  copy is **not** imported by the map feature — the map's `findCampusBuildingFeature`,
  `buildPoiFromCampusBuilding`, and `POIBottomSheet` all use the
  `src/features/pois/buildingUtils.ts` copy. The two implementations are currently kept in sync
  by hand; if either regex changes, the other should be updated too (or one should be deleted in
  favor of importing the other).

## `utils/googlePlaces.ts` — Google Places client

A thin client for the server's Google Places proxy (the API key stays server-side; the app
never talks to Google directly for Places).

### Types

- **`PlaceAutocompletePrediction`** — `{ place_id: string; description: string;
  structured_formatting: { main_text: string; secondary_text: string } }`. One row of
  autocomplete results.
- **`PlacesAutocompleteScope`** — `"campus" | "global"`. See "scope" below.
- **`PlaceOpeningHours`** — `{ open_now?: boolean; weekday_text?: string[] }`.
- **`PlaceDetails`** — `{ place_id, name, formatted_address, geometry: { location: { lat, lng }
  }, opening_hours?, rating?, user_ratings_total?, types? }`. The shape consumed by
  `LocationDetailsBottomSheet` and produced either by `getPlaceDetails()` or by
  `buildingToPlaceDetails()` (for local-DB results).

### Functions

- **`searchPlaces(query, options?)`** → `Promise<PlaceAutocompletePrediction[]>`. Returns `[]`
  for queries under 2 chars. POSTs to the server's `/places/autocomplete` with `{ input, scope,
  sessionToken }`. `scope` defaults to `"campus"` if not given. Filters the response to entries
  with a string `place_id`; swallows errors and logs to console, returning `[]` on failure.
- **`getPlaceDetails(placeId, displayName?)`** → `Promise<PlaceDetails | null>`. POSTs to
  `/places/details` with `{ placeId, displayName, sessionToken }`. Returns `null` if the
  response has no `geometry.location`, or on any error.
- **`formatOpeningHours(_hours?)`** — currently a stub that always returns the literal string
  `"Hours not available"`, regardless of input (the `PlaceOpeningHours` parameter is unused).
  Called by `LocationDetailsBottomSheet` to render the opening-hours row.
- **`calculateDistance(lat1, lon1, lat2, lon2)`** — Haversine great-circle distance in miles
  (Earth radius `R = 3959`), rounded to 1 decimal place.
- **`resetPlacesSession()`** — clears the cached Places session token (see below). Exported but
  not currently called anywhere in the app.

### Session tokens

Google Places autocomplete/details billing is cheaper when grouped into a "session." This
module generates a session token (`places_<timestamp>_<random hex>`, via
`crypto.getRandomValues`, not `Math.random()`) and reuses it for `SESSION_TTL_MS` (3 minutes)
across calls via `getSessionToken()`; it's regenerated if more than 3 minutes pass between
calls. The token is sent as `sessionToken` in both `/places/autocomplete` and `/places/details`
requests.

### `scope` — campus vs. global

Every autocomplete/details request carries a `scope: "campus" | "global"`, which the server-side
proxy presumably uses to bias results toward the UT Austin campus (e.g. a location bias/region
restriction) vs. unrestricted global search. The client never picks a scope blindly — both
`useMapSearch.handleSelectLocation` and `SearchDropdown` use the same heuristic
(`looksLikeCampusAbbreviation(query)` or a hit in `searchBuildings()` ⇒ try `"campus"` first,
else try `"global"` first), falling back to the other scope if the first returns nothing. See
[map-feature.md](./map-feature.md) for the full search flow.

### Talking to the server

All requests go through `requestPlacesProxy()`, which:
- Iterates `getApiBaseCandidates()` (from `utils/api-base.ts`) the same way `ApiClient` does,
  trying each candidate base URL until one returns valid JSON.
- Uses `fetchWithTimeout`/`parseJsonResponse`/`isRetriableCandidateError` from
  `utils/request-utils.ts` — the same request plumbing as `ApiClient`.
- Calls `promoteApiBaseUrl(apiBase)` once a candidate proves reachable, so subsequent calls
  (from any module) prefer that base URL first.
- Throws a `ClientRequestError("API_ERROR", ...)` on non-OK responses, with the server's
  `error.message` if present.

No API keys or secrets live in this file — the actual Google Places API key is configured
server-side in the Worker.

## `utils/decode_polyline.ts` — polyline decoder

A standalone decoder for [Google's Encoded Polyline Algorithm Format v1]
(used by routing APIs including OpenRouteService, which `ApiClient.getRoute()` calls). Default
export `decode(value: string): [number, number][]` — decodes the string into `[lng, lat]`
coordinate pairs (note: longitude first), using fixed-point delta decoding (divides by `1e5`).
Helper statics `decode.sign` and `decode.integers` implement the bit-unpacking/zigzag decoding
steps.

Sourced from a Stack Overflow answer (CC BY-SA 3.0, see file header). **Currently unused** —
no other file imports it. It exists for a future turn-by-turn route display (paired with
`RouteOverlaySheet`, which is also a stub — see [components.md](./components.md)).

## `utils/ThemeContext.tsx` — `ThemeProvider` / `useTheme`

React Context for the app's color scheme, persisted to AsyncStorage and synced with
NativeWind's `dark:` variant via `Appearance.setColorScheme()`.

- **`ThemeMode`** — `"system" | "light" | "dark"`.
- **Context value** — `{ colorScheme: "light" | "dark"; themeMode: ThemeMode; setThemeMode:
  (mode: ThemeMode) => void }`.
  - `colorScheme` is the *resolved* scheme: if `themeMode === "system"`, it follows
    `useColorScheme()` (the OS setting); otherwise it's `themeMode` itself.
  - `themeMode` is the user's raw preference, including `"system"`.
- **`ThemeProvider`**:
  - On mount, reads `AsyncStorage["theme_mode"]`. If it's a valid `ThemeMode`, calls
    `setThemeModeState(v)` and `Appearance.setColorScheme(v === "system" ? null : v)` so
    NativeWind's `dark:` classes reflect the persisted choice immediately (before any user
    interaction).
  - **`setThemeMode(mode)`** — updates state, persists to `AsyncStorage["theme_mode"]`, and
    calls `Appearance.setColorScheme(mode === "system" ? null : mode)`. Passing `null` to
    `Appearance.setColorScheme` restores OS-driven behavior; passing `"light"`/`"dark"`
    overrides it app-wide so NativeWind `dark:` variants activate even if the OS is set
    differently.
- **`useTheme()`** — `useContext(ThemeContext)`. Used throughout components for both
  `colorScheme` (branching on `"dark"` for things NativeWind can't reach — Mapbox layer paint
  properties, SVG icon fills) and `setThemeMode` (a settings toggle, e.g. in
  `app/(tabs)/profile.tsx`).

`ThemeProvider` wraps the whole app from `app/_layout.tsx`, outermost among the providers (see
[architecture.md](./architecture.md)).

## `utils/typography.ts` — shared text styles

```ts
export const typography = {
  body: {
    medium:        { fontFamily: "Inter", fontWeight: 500, fontSize: 16, lineHeight: 24, letterSpacing: 0.2 },
    large:         { fontFamily: "Inter", fontWeight: 400, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
    medium_strong: { fontFamily: "Inter", fontWeight: 500 },
  },
};
```

A small registry of named text styles, grouped by category (currently only `body`). Each entry
is a plain object of `Text`/`StyleSheet`-compatible style props (`fontFamily`, `fontWeight`,
`fontSize`, `lineHeight`, `letterSpacing`) — note `medium_strong` is intentionally partial (just
family + weight), meant to be spread alongside other size/color styles rather than used alone.

Usage is currently sparse and ad-hoc — components pull individual fields rather than spreading
the whole object, e.g. `POIBottomSheet.tsx`:

```ts
<Text style={{ fontFamily: typography.body.medium_strong.fontFamily, fontWeight: "500", fontSize: 15.35, color: ... }}>
```

The intent is a single place to adjust font family/sizing app-wide, but most text styling
elsewhere is done via NativeWind `className` (Tailwind text utilities) rather than this object.

## `utils/mapPreferences.ts` — map detail-level preference

AsyncStorage-backed persistence for the "simple vs. detailed" map layer preference.

- **`MapDetailMode`** — `"simple" | "detailed"`.
- **`getStoredMapDetailMode()`** → `Promise<MapDetailMode>` — reads `AsyncStorage["map_detail_mode"]`;
  returns the stored value if it's `"simple"` or `"detailed"`, otherwise defaults to
  `"detailed"`.
- **`setStoredMapDetailMode(mode)`** → `Promise<void>` — writes `AsyncStorage["map_detail_mode"]`.

Consumers:
- `useMapScreenController` loads the stored mode inside a `useFocusEffect` (so it picks up
  changes made while the user was on another tab) and exposes `showDetailedLayers:
  mapDetailMode === "detailed"`. `MapLayers` uses `showDetailedLayers` to decide whether to
  render `<SidewalkLayer>` and the access-barrier `ShapeSource` (see
  [map-feature.md](./map-feature.md)).
- `app/(tabs)/profile.tsx` is the settings UI: it loads the current mode on mount, and a
  Simple/Detailed toggle calls `setStoredMapDetailMode(mode)` (via
  `handleMapDetailModeChange`) to persist the user's choice.

## `utils/useAppState.ts` — `useAppState`

```ts
function useAppState(onChange: (status: AppStateStatus) => void): void
```

A thin wrapper around React Native's `AppState.addEventListener("change", onChange)`, cleaning
up the subscription on unmount. Used once, in `app/_layout.tsx`:

```ts
useAppState(onAppStateChange);
```

where `onAppStateChange` (not shown here) integrates with TanStack Query's `focusManager` —
when the app returns to the foreground (`status === "active"`), it tells the Query client to
treat queries as "focused" again so `refetchOnWindowFocus`-style behavior and
`useRefreshOnFocus` work correctly on mobile (which has no native window-focus events).

## `utils/useRefreshByUser.ts` — `useRefreshByUser`

```ts
function useRefreshByUser(refetch: () => Promise<unknown>): {
  isRefetchingByUser: boolean;
  refetchByUser: () => Promise<void>;
}
```

Wraps a TanStack Query `refetch` function with a local `isRefetchingByUser` boolean, suitable
for driving a `RefreshControl`'s `refreshing` prop on a pull-to-refresh gesture. Sets the flag
`true` before calling `refetch()` and `false` in a `finally`, regardless of success/failure.

## `utils/useRefreshOnFocus.ts` — `useRefreshOnFocus`

```ts
function useRefreshOnFocus(refetch: () => void): void
```

Calls `refetch()` every time the screen regains focus (via `@react-navigation/native`'s
`useFocusEffect`) — **except** the very first focus (tracked with `enabledRef`), so it doesn't
duplicate the query's initial fetch on mount. Useful for screens that should show fresh data
when navigated back to (e.g. re-fetching POIs/avoidance areas after returning to the map tab).

## `utils/useMapIcons.ts` — `mapIcons`

```ts
export const mapIcons = {
  point: require("~/assets/map_icons/point.png"),
  autoDoor: require("~/assets/map_icons/auto_door.png"),
  manualDoor: require("~/assets/map_icons/manual_door.png"),
  ramp: require("~/assets/map_icons/ramp.png"),
  crosshair: require("~/assets/map_icons/crosshair.png"),
};
```

Not a hook despite the `use*` filename — a plain object of `require()`'d PNG image sources, no
state or effects. Five icons:

| Key | Used for |
| --- | --- |
| `point` | Each tapped vertex while drawing an avoidance-area polygon in report mode (`MapLayers`' `PointAnnotation`s for `aaPointsReport`). |
| `autoDoor` | Power-assisted/automatic door entrances — `POIBottomSheet`'s entrance chips, `ReviewModal`'s `MiniMap` entrance pins. |
| `manualDoor` | Manual-door entrances — same call sites as `autoDoor`, chosen based on `metadata.auto_opene`. |
| `ramp` | Ramp markers on the map (the `ramps` `SymbolLayer` in `MapLayers` — registered as `rampIcon` via `<Images>` in `index.tsx`). |
| `crosshair` | The most-recently-tapped point in report mode (`clickedPoint`), shown as a `PointAnnotation`. |

Registered with Mapbox's `<Images>` component (in `app/(tabs)/index.tsx`) so they can be
referenced by name (`iconImage: ["get", "icon"]` etc.) inside `SymbolLayer`s in `MapLayers`.

## `utils/utils.ts` — generic helpers

### `cn(...inputs)`

```ts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

The standard `clsx` + `tailwind-merge` className combinator: `clsx` handles conditional/array/
object class inputs, and `twMerge` resolves conflicting Tailwind utility classes (e.g. if both
a base `className` and an override both set `bg-*`, `twMerge` keeps only the last one) so
conditional Tailwind classes compose correctly. Currently used directly in
`ActionButtonGroup.tsx`; most other components build class strings via template literals/
ternaries directly rather than going through `cn()`, so it's the recommended helper for new
code doing conditional `className` composition but isn't yet adopted everywhere.

### `getCardinalLabel(entrance, buildingFeature)`

```ts
function getCardinalLabel(entrance: any, buildingFeature: any): string | null
```

Given an entrance POI (with `location_geojson.coordinates`) and a building GeoJSON feature
(with a `Polygon` `geometry.coordinates`), computes the building's centroid (simple average of
the first ring's points — *not* `turf.centerOfMass`), finds the angle from the centroid to the
entrance (`atan2(dLng, dLat)`, normalized to 0–360°), and buckets it into one of 8 compass
directions: `"North Entrance"`, `"Northeast Entrance"`, ..., `"Northwest Entrance"` (45° wide
buckets, centered on the cardinal/intercardinal directions). Returns `null` if either input is
missing geometry.

### `getCardinalLabelFromNeighbors(entrance, neighbors)`

```ts
function getCardinalLabelFromNeighbors(entrance: any, neighbors: any[]): string | null
```

Same bucketing logic as `getCardinalLabel`, but the reference point is the centroid of
`neighbors` (other entrance POIs for the same building) rather than the building polygon —
useful when no building polygon is available. Requires at least 2 neighbors with valid
coordinates; returns `null` if the entrance is within ~`1e-5` degrees of the neighbor centroid
(too close to determine a meaningful direction).

Both functions are used by `POIBottomSheet` and `ReviewModal` to label each entrance in the
horizontally-scrolling entrance-chip row / `EntranceButtons`: `getCardinalLabel(entrance,
buildingFeature) ?? getCardinalLabelFromNeighbors(entrance, entrances)` — prefer the
building-polygon-relative direction, fall back to the neighbor-relative one.

### `getEntranceLabel(entrance, entrances, building)`

```ts
function getEntranceLabel(entrance: any, entrances: any[], building: any): string
```

Picks the best human-readable label for an entrance:
1. If `entrance.metadata?.name` is "useful" — non-empty, and doesn't match `/^(Point |kml_)/i`
   (raw KML import names) or `/^\([A-Z]+\)\s+[A-Z\s]+$/` (e.g. `"(GDC) GATES DELL COMPLEX"`,
   which is just the building name) — use it as-is.
2. Otherwise fall back to `getCardinalLabel(entrance, building) ??
   getCardinalLabelFromNeighbors(entrance, entrances) ?? "Entrance"`.

Used by `ReviewModal`'s `EntranceButtons` to label each selectable entrance button, and to set
`selectedEntranceName` when the user picks an entrance.
