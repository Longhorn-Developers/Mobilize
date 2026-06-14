# Shared types (`types/`)

This covers the three shared type modules used across the app: `types/database.ts` (server
data shapes), `types/geo.ts` (small GeoJSON helpers for the map feature), and `types/colors.ts`
(the brand/semantic color palette shared with NativeWind).

## `types/database.ts`

Types for data that flows between the Cloudflare Worker (`server/src/db/schema.ts`, Drizzle
ORM) and the client. Two "layers":

- **Raw DB types** — direct `typeof table.$inferSelect` inference. GeoJSON/JSON columns are
  still raw strings (as stored in SQLite).
- **UI-ready types** — the same shape but with JSON-string columns (`location_geojson`,
  `boundary_geojson`, `features`) parsed into real objects/arrays, and sometimes joined with
  extra profile-display fields. These are what `ApiClient` methods actually return and what
  components consume.

A couple of "legacy alias" types exist where the codebase has two names for the same shape;
new code should prefer the non-"legacy" name noted below.

### `Profile`

```ts
type Profile = typeof profiles.$inferSelect;
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | `number` | Auto-increment integer PK. |
| `user_id` | `string` | FK to `users.id` (Better Auth user), unique. |
| `display_name` | `string` | |
| `avatar_url` | `string \| null` | |
| `class_year` | `string \| null` | |
| `major` | `string \| null` | |
| `bio` | `string \| null` | |
| `mobility_preference` | `string \| null` | `"walking"` \| `"wheelchair"` \| `"cane"` \| `"other"`. |
| `is_anonymous` | `boolean` | |
| `onboarding_completed_at` | `Date \| null` | |
| `created_at` / `updated_at` | `Date` | |

The campus-facing profile created during onboarding (`app/auth/profile-setup.tsx`). Returned by
`ApiClient.getProfile()` (deprecated, used by the legacy `useProfile()` hook) and as the
`profile` field of `getMe()` / `ProfileWithUser`. `ApiClient.getMyProfile()` returns this type
(or `null`), backing `useMyProfile()` — used by `ReviewModal` to check whether the user has a
profile before allowing a review.

### `ReviewFromDb` (alias: `ReviewRaw`)

```ts
type ReviewFromDb = typeof reviews.$inferSelect;
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | `number` | Auto-increment integer PK. |
| `user_id` | `number` | FK to `profiles.id` (the reviewer). |
| `rating` | `number` | 1–5 star rating. |
| `features` | `string \| null` | **JSON string** — array of feature tag IDs (e.g. `"Power-assisted doors"`, `"Ramps"`, `"Others"`). |
| `content` | `string \| null` | Free-text review body. |
| `poi_id` | `number` | FK to `pois.id`, cascades on POI delete. |
| `created_at` / `updated_at` | `Date` | `updated_at` auto-bumps via `$onUpdate`. |
| `deleted_at` | `Date \| null` | Soft-delete marker; non-null rows are excluded from `getReviews()`. |

Row exactly as stored in the `reviews` table — `features` is still a raw JSON string. Prefer
`ReviewForUI`/`ReviewEntry` (below) for anything rendered in the UI. `ReviewRaw` is a legacy
alias for this type.

### `POIRaw`

```ts
type POIRaw = typeof pois.$inferSelect;
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | `number` | Auto-increment integer PK. |
| `poi_type` | `string` | `"ramp"` \| `"auto_door"` \| `"manual_door"` (drives map icon/filter logic). |
| `metadata` | `string \| null` | **JSON string** — source-specific fields (`external_key`, `bld_name`, `floor`, `auto_opene`, etc.). |
| `location_geojson` | `string` | **JSON string** — GeoJSON `Point`. Unique constraint; used as the upsert key by the POI-sync cron. |
| `created_at` / `updated_at` | `Date` | |

Row exactly as stored in the `pois` table, with `metadata`/`location_geojson` still JSON
strings. Used internally by `ApiClient.getPOIs()` before it parses both fields into `POI`
(below).

### `AvoidanceAreaRaw`

```ts
type AvoidanceAreaRaw = typeof avoidance_areas.$inferSelect;
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | `number` | Auto-increment integer PK. |
| `user_id` | `string` | FK to `users.id` (area ownership tied to the auth identity, not the campus profile). |
| `name` | `string` | |
| `description` | `string \| null` | |
| `boundary_geojson` | `string` | **JSON string** — GeoJSON `Polygon`. |
| `created_at` / `updated_at` | `Date` | |

Raw row for a user-reported "avoid this area" zone (construction, broken elevator, etc.).
`ApiClient.getAvoidanceAreas()` parses `boundary_geojson` into `AvoidanceArea` (below); rows
with unparseable geometry are dropped.

### `AvoidanceAreaReportRaw`

```ts
type AvoidanceAreaReportRaw = typeof avoidance_area_reports.$inferSelect;
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | `number` | Auto-increment integer PK. |
| `user_id` | `string` | FK to `users.id` (report author). |
| `avoidance_area_id` | `number` | FK to `avoidance_areas.id`. |
| `title` | `string` | |
| `description` | `string \| null` | |
| `created_at` / `updated_at` | `Date` | |

Raw row for a follow-up comment/report on an avoidance area (e.g. "still blocked as of
today"). See `AvoidanceAreaReport` below for the UI-facing version with profile fields joined
in.

### `ReviewForUI` (alias: `Review`)

```ts
interface ReviewForUI extends Omit<ReviewFromDb, "features"> {
  features: string[];
}
```

`ReviewFromDb` with `features` parsed from a JSON string into `string[]`. `Review` is a legacy
alias for this type — `ReviewModal.tsx` uses `Control<Review>` for its `react-hook-form` form
state when creating/editing a review (rating, features, content).

### `AvoidanceAreaWithProfile` (alias: `AvoidanceAreaDetailRaw`)

```ts
type AvoidanceAreaWithProfile = AvoidanceAreaRaw & {
  profile_display_name: string | null;
  profile_avatar_url: string | null;
};
```

An `AvoidanceAreaRaw` joined (LEFT JOIN through `profiles.user_id`) with the creator's display
name/avatar. `AvoidanceAreaDetailRaw` is a legacy alias used as the return type of
`ApiClient.getAvoidanceArea(id)` (still with `boundary_geojson` as a string at this point —
`getAvoidanceArea` parses it before returning, producing an object shaped like
`AvoidanceArea & { profile_display_name, profile_avatar_url }`).

### `AvoidanceAreaReport`

```ts
type AvoidanceAreaReport = AvoidanceAreaReportRaw & {
  profile_display_name?: string | null;
  profile_avatar_url?: string | null;
};
```

`AvoidanceAreaReportRaw` with optional joined profile display fields. Returned by
`ApiClient.getAvoidanceAreaReports(id)`, backing `useAvoidanceAreaReports(areaId)` — used by
`AvoidanceAreaDetails` to render the comments list (`profile_display_name`, relative timestamp,
`title`/`description`) and by `useInsertAvoidanceAreaReport()`'s optimistic cache update.

### `ReviewEntryRaw`

```ts
type ReviewEntryRaw = ReviewFromDb & {
  profile_display_name: string;
  profile_avatar_url: string;
  vote_count: number;
  user_vote: number | null;
};
```

A review row joined with the author's profile display fields plus aggregated vote data
(`vote_count` = sum of `+1`/`-1` votes, `user_vote` = the current user's own vote on this
review, or `null`). Internal — `ApiClient.getReviews()` fetches this shape from `/reviews` and
immediately converts it to `ReviewEntry`.

### `ReviewEntry`

```ts
interface ReviewEntry extends Omit<ReviewEntryRaw, "features"> {
  features: string[];
}
```

`ReviewEntryRaw` with `features` parsed to `string[]`. This is the type returned by
`ApiClient.getReviews(poi_id)` / `useReviews(poi_id)`, and is what `ReviewModal`'s
`ReviewsList`/`ReviewCard` render — each card shows the reviewer's avatar/name, rating,
free-text content, feature tags, and vote controls (`useUpsertVote`/`useDeleteVote` keyed by
`review_id`, using `user_vote`/`vote_count`).

### `ProfileWithUser`

```ts
interface ProfileWithUser {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    username: string | null;
    role: string;
  };
  profile: Profile | null;
  onboardingComplete: boolean;
}
```

The shape returned by the `/api/me` endpoint (`ApiClient.getMe()`): the Better-Auth user record,
the linked campus `Profile` (or `null` if onboarding hasn't created one yet), and a computed
`onboardingComplete` flag. Drives the root-layout auth-redirect guard (see
[auth.md](./auth.md)) and the profile screens (`app/(tabs)/profile.tsx`,
`app/auth/profile-setup.tsx`, `app/auth/mobility-preferences.tsx`).

### `POI`

```ts
interface POI extends Omit<POIRaw, "location_geojson" | "metadata"> {
  location_geojson: Point;       // from "geojson"
  metadata: Record<string, any> | null;
}
```

`POIRaw` with `location_geojson` parsed to a GeoJSON `Point` and `metadata` parsed to an object.
This is the shape returned by `ApiClient.getPOIs()` / `usePOIs()` — the root data source for the
map's accessibility markers. Consumed throughout `src/features/map/` and `src/features/pois/`
(`usePOIFeatures`, `clusterPOIs`, `isEntrancePoi`, `getPOISubtype`,
`buildPoiFromCampusBuilding`), and by `POIBottomSheet`/`ReviewModal` for entrance/ramp details
and reviews.

### `AvoidanceArea`

```ts
interface AvoidanceArea extends Omit<AvoidanceAreaRaw, "boundary_geojson"> {
  boundary_geojson: Polygon;     // from "geojson"
}
```

`AvoidanceAreaRaw` with `boundary_geojson` parsed to a GeoJSON `Polygon`. Returned by
`ApiClient.getAvoidanceAreas()` / `useAvoidanceAreas()`, the source for
`useAvoidanceGeoJSON()` (map layer) and `useMapPressHandlers.handleAvoidanceAreaPress`. Also the
prop type for `AvoidanceAreaBottomSheet`/`AvoidanceAreaDetails` (`present({ area:
AvoidanceArea })`), which computes area size via `turf.area(area.boundary_geojson)`.

### Construction areas (not a named export)

There is currently **no exported `ConstructionArea` type** in `types/database.ts`. Construction
zones are typed inline where used:

```ts
// ApiClient.getConstructionAreas() return type
{ id: number; points: [number, number][]; description?: string }[]
```

`points` are `[lat, lng]` pairs from the UT ArcGIS proxy (`/construction_areas`). Backed by
`useConstructionAreas()`, and converted to GeoJSON `Polygon` features (flipping to `[lng, lat]`,
closing the ring) by `useConstructionGeoJSON()` for `MapLayers`'
`<ConstructionZones>` layer and `useMapPressHandlers.handleConstructionPress`.

## `types/geo.ts`

Small GeoJSON-flavored helper types used across the map feature so coordinates and campus
building features don't get typed as `any`.

### `Coordinate`

```ts
interface Coordinate {
  lng: number;
  lat: number;
}
```

A plain longitude/latitude pair (note the `lng`-then-`lat` field order, matching GeoJSON's
`[lng, lat]` axis order rather than the more common "lat, lng" reading order).

### `BuildingFeature`

```ts
interface BuildingFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    Building_Abbr?: string | null;  // e.g. "GDC", "WEL"
    Building?: string | null;       // full name, e.g. "Gates Dell Complex"
    BldNme?: string | null;
    [key: string]: unknown;
  };
}
```

A GeoJSON `Point` feature representing a campus building centroid or entrance — the shape of
features pulled from the bundled campus GeoJSON assets (`assets/geojson/*.json`) when working
with individual point locations (e.g. ramp/entrance features).

### `BuildingPolygonFeature`

```ts
interface BuildingPolygonFeature {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
  properties: BuildingFeature["properties"];
}
```

The polygon counterpart of `BuildingFeature` — the shape of features in
`assets/geojson/buildings_simple.json` (campus building footprints). Reuses
`BuildingFeature["properties"]` so both point and polygon features share the same property
shape (`Building_Abbr`, `Building`, `BldNme`, plus arbitrary extra properties via the index
signature). Used by building-resolution helpers in `src/features/pois/buildingUtils.ts`
(`findCampusBuildingFeature`, `isPoiInsideBuilding`) and by `MapLayers`' `campus-buildings`
`ShapeSource`.

## `types/colors.ts`

```ts
const colors = {
  ut: { burntorange, black, orange, yellow, lightgreen, green, teal, blue, gray, offwhite },
  theme: { red, black, offwhite, black1, black2, staticwhite, staticblack, majorgridline, minorgridline },
} as const satisfies Record<string, Record<string, string>>;

export default colors;
```

A single default-exported object with two top-level groups, typed with `satisfies
Record<string, Record<string, string>>` so every entry is a hex string while still preserving
literal types for autocomplete.

### `colors.ut.*` — UT Austin brand palette

| Key | Hex | Notes |
| --- | --- | --- |
| `burntorange` | `#BF5700` | UT's primary brand color — primary buttons, active states, headers. |
| `black` | `#333F48` | UT "black" (actually dark slate) — used for primary text in places. |
| `orange` | `#F8971F` | Secondary accent orange. |
| `yellow` | `#FFD600` | |
| `lightgreen` | `#A6CD57` | |
| `green` | `#579D42` | |
| `teal` | `#00A9B7` | |
| `blue` | `#005F86` | Used for the report-mode map overlay (`bg-ut-blue/15`) and other UT-blue accents. |
| `gray` | `#9CADB7` | |
| `offwhite` | `#D6D2C4` | Same value as `theme.offwhite`. |

These map directly to the official UT Austin brand color set and are used for anything that
should read as "UT-branded" (the `Button` component's `"primary"` variant, headers, the
floating "Report" button, etc.).

### `colors.theme.*` — semantic/app theme colors

| Key | Hex | Notes |
| --- | --- | --- |
| `red` | `#D10000` | Warnings, avoidance-area fills/outlines, destructive actions. |
| `black` | `#1A2024` | App's near-black, used for dark text/backgrounds (distinct from `ut.black`). |
| `offwhite` | `#D6D2C4` | |
| `black1` | `#333F4850` | `ut.black` at ~31% alpha (8-digit hex) — subtle overlay/border tint. |
| `black2` | `#333F4820` | `ut.black` at ~12% alpha — even subtler tint. |
| `staticwhite` | `#FFFFFF` | A white that doesn't flip in dark mode (for content meant to stay white). |
| `staticblack` | `#1A2024` | Same value as `theme.black` — a black that doesn't flip in dark mode. |
| `majorgridline` | `#D1D5DB` | Grid/divider lines (major). |
| `minorgridline` | `#F3F4F6` | Grid/divider lines (minor). |

These are app-level "semantic" colors layered on top of the brand palette — for status colors,
overlays, and dark-mode-stable values that shouldn't be affected by NativeWind's `dark:`
variant.

### Relationship to NativeWind / Tailwind

`tailwind.config.js` does:

```js
const colors = require("./types/colors");
module.exports = {
  theme: { extend: { colors } },
  // ...
};
```

i.e. it `require()`s this file directly and merges it into Tailwind's color theme under
`extend.colors`. Because `colors.ts` is the actual source consumed by Tailwind (not a separate
copy that's manually kept in sync), `colors.ut.burntorange` and the NativeWind class
`bg-ut-burntorange` / `text-ut-burntorange` always refer to the same value — same for every
`colors.theme.*` entry (`bg-theme-red`, `border-theme-majorgridline`, etc.). There is no
drift risk between the TS object and the Tailwind tokens; editing one key in `types/colors.ts`
changes both the TS-importable `colors` object (used directly in, e.g., Mapbox layer `style`
props that can't take `className`) and every matching `className` token across the app in one
place.
