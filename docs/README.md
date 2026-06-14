# Mobilize — Documentation

Mobilize is an Expo / React Native app that gives disabled students an accessibility-aware
interactive map of the UT Austin campus (curb ramps, accessible entrances, sidewalk
conditions, avoidance areas, construction zones), backed by a Cloudflare Workers API.

For environment setup, running the app/server, and deployment, see the root
[`README.md`](../README.md). This `docs/` folder documents how the codebase is organized and
how the pieces fit together, for developers working on the code.

## Index

| Doc | Covers |
| --- | --- |
| [architecture.md](./architecture.md) | High-level system design: Expo Router structure, the `src/features/` convention, app-wide providers, state management, and client↔server data flow |
| [map-feature.md](./map-feature.md) | The map screen: `useMapScreenController` and every sub-hook, GeoJSON sources, clustering, rendering layers, and the report-mode overlay |
| [components.md](./components.md) | Catalog of every shared component in `src/features/components/` (bottom sheets, modals, search UI, buttons) |
| [auth.md](./auth.md) | Authentication & onboarding flow, `useAuth`/`AuthProvider`, Google OAuth, route-redirect logic, profile screens |
| [api-and-server.md](./api-and-server.md) | Client `ApiClient` + TanStack Query hooks, and the Cloudflare Worker (Hono routes, Better Auth, D1 schema, POI-sync cron) |
| [data-types.md](./data-types.md) | Shared types: `types/database.ts`, `types/geo.ts`, `types/colors.ts` |
| [utils.md](./utils.md) | Remaining utility modules: building database, Google Places client, theming, polyline decoding, preferences, misc helpers |

## Directory map

```text
app/                          Expo Router routes (file = route)
├── _layout.tsx                Root layout: Theme/Query/Auth providers, auth-redirect guard, toasts
├── index.tsx                   "/" — splash/redirect while auth state resolves
├── welcome.tsx                  Entry screen (sign in with Google / UT EID)
├── +not-found.tsx, +html.tsx    404 fallback, web HTML shell
├── (tabs)/                     Authenticated app shell (bottom tabs)
│   ├── _layout.tsx               Tab bar: Map, Profile
│   ├── index.tsx                  Map screen (thin shell over useMapScreenController)
│   └── profile.tsx                Own profile (view/edit)
├── auth/                        Onboarding & OAuth flow
│   ├── _layout.tsx
│   ├── signup.tsx, google-oauth.tsx, callback.tsx
│   ├── profile-setup.tsx, mobility-preferences.tsx
│   └── ut-eid-coming-soon.tsx
└── profile/
    ├── _layout.tsx
    └── [username].tsx           Public profile by username

src/features/
├── components/                 Shared UI: bottom sheets, modals, search, Button (see components.md)
├── map/                         Map screen feature (see map-feature.md)
│   ├── useMapScreenController.ts
│   ├── constants.ts, buildingStyles.ts
│   ├── hooks/                    useMapOverlay, useMapSearch, useMapPressHandlers,
│   │                              useMapBottomSheets, useMapGeoJSON, useReportMode
│   ├── geojsonSources/           useAvoidanceGeoJSON, useConstructionGeoJSON
│   ├── layers/                   avoidanceAreas, constructionZones, sidewalks (Mapbox layers)
│   ├── rendering/                MapLayers, ReportOverlay
│   └── POIs/                     usePOIFeatures
└── pois/                        POI/building helpers: buildingUtils, poiBuildingUtils,
                                   poiUtils, clustering

utils/                          Cross-cutting utilities (see utils.md and api-and-server.md)
├── api-client.ts, api-hooks.ts, api-base.ts, request-utils.ts, ApiQueryProvider.tsx
├── useAuth.ts, routes.ts
├── buildingDatabase.ts, googlePlaces.ts, decode_polyline.ts
├── ThemeContext.tsx, typography.ts, mapPreferences.ts
└── useAppState.ts, useRefreshByUser.ts, useRefreshOnFocus.ts, useMapIcons.ts, utils.ts

types/                          Shared types (see data-types.md)
├── database.ts, geo.ts, colors.ts

server/                         Cloudflare Worker backend (see api-and-server.md)
├── src/index.ts                  Hono route handlers
├── src/auth.ts                   Better Auth (Google OAuth) config
├── src/db/schema.ts               Drizzle ORM table definitions
├── src/scheduled/poi-sync.ts      Cron job: KML → POI upsert
├── migrations/                    SQL migrations
└── test/                          Vitest integration tests

assets/geojson/                 Static campus GeoJSON (buildings, sidewalks, ramps, barriers)
```
