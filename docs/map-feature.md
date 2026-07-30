# Map feature (`src/features/map/`, `src/features/pois/`)

The map tab (`app/(tabs)/index.tsx`) is a thin shell: it loads data (GeoJSON + API hooks),
passes it to `useMapScreenController()`, and renders `<MapView>` + `<MapLayers>` +
`<ReportOverlay>` plus the search bar/dropdown and bottom sheets. This document covers the
controller and every sub-hook, the data/rendering pipeline, and clustering.

## `constants.ts`

Shared tunables imported as `* as MapConstants`:

| Constant | Value | Purpose |
| --- | --- | --- |
| `UT_CENTER` | `[-97.733, 30.282]` | Default map camera center (lng/lat) |
| `UT_CAMPUS_BOUNDS` | bounding box | Cheap "is this near campus" pre-filter |
| `CAMPUS_MATCH_RADIUS_KM` | `2.5` | Max distance from `UT_CENTER` to count as "on campus" |
| `MIN_ZOOM_FOR_POIS` | `16` | POI/ramp symbols hidden below this zoom |
| `MIN_ZOOM_FOR_SIDEWALKS` | `17` | Sidewalk fill/line layers hidden below this zoom |
| `MIN_ZOOM_FOR_BUILDINGS` | `14` | Building 3D extrusion minimum zoom |
| `MIN_ZOOM_FOR_BARRIERS` | `16` | Access-barrier circles minimum zoom |
| `MIN_ZOOM_FOR_LABELS` / `MAX_ZOOM_FOR_LABELS` | `15` / `17` | Zoom range where building-abbreviation labels show |
| `EMPTY_FC` | empty `FeatureCollection` | Safe default before GeoJSON assets load |
| `CLUSTER_RADIUS` | `10` (meters) | Distance within which same-subtype entrance POIs merge into one marker |

## `buildingStyles.ts`

`getBuildingStyles(isDark: boolean)` returns the Mapbox paint expressions for the campus
buildings layer, switched for dark/light mode:
- `buildingExtrusionColor` — an `interpolate` expression on `Shape__Area` (small buildings get
  one color, large buildings another), with separate light/dark palettes.
- `labelTextColor` / `labelHaloColor` — colors for the building-abbreviation `SymbolLayer`
  text and its halo.

## The overlay epoch/guard system — `hooks/useMapOverlay.ts`

A cross-cutting hook used by the controller and threaded into `useMapSearch` and
`useMapPressHandlers`. It exists to stop **stale async work** (a slow Google Places lookup, a
ramp-POI API call) from presenting a bottom sheet after the user has already dismissed it,
switched tabs, or tapped something else.

Core concepts:
- **Epoch counter** (`overlayEpochRef`) — incremented every time `closeAllSheets()` runs.
  `beginOverlayAction()` snapshots the current epoch at the start of an action;
  `canPresent(epoch)` returns `true` only if the epoch hasn't advanced since, the screen is
  still focused, and nothing is mid-close.
- **`guardedPresent(epoch, presentFn, actionName)`** — calls `presentFn()` only if
  `canPresent(epoch)`; otherwise drops it silently (logs `open_blocked_stale` in `__DEV__`).
- **Abort-controller registry** (`registerAbortController`/`releaseAbortController`) — every
  in-flight async action registers an `AbortController`; `closeAllSheets()` aborts all of them
  via `abortAllPendingActions()`.
- **`closeAllSheets()`** — bumps the epoch, sets `isClosingRef` for
  `OVERLAY_CLOSE_ANIMATION_MS` (220ms, matching the bottom-sheet dismiss animation), aborts
  pending work, and calls the controller-supplied `onDismissSheets` (dismiss every sheet ref)
  and `onResetUiState` (clear search query, reset report mode, clear selected POI).
- **`featureTappedRef`** — set to `true` by a `ShapeSource.onPress` handler (via
  `onFeatureTapped`) so the parent `MapView.onPress` can detect "a feature already handled this
  tap" and skip its own logic (closing sheets / report-mode point placement) — a double-tap
  guard.
- Wired to `useFocusEffect`/`isTabFocused`: losing focus calls `closeAllSheets()` and marks the
  screen inactive so any in-flight `canPresent` checks fail.

## `useMapScreenController.ts` — the composition root

```ts
const map = useMapScreenController({ isTabFocused, bottomTabBarHeight, avoidanceAreas, entrances });
```

Composes, in order:
1. `cameraRef` — a `Camera` ref shared with `useMapSearch` (for fly-to-result animations).
2. `bottomSheet = useMapBottomSheets()` — refs + `closeAllSheets` for all bottom sheets.
3. `report = useReportMode(bottomTabBarHeight)` — avoidance-area drawing flow.
4. `poi` / `setPoi` / `reviewKey` — the POI currently open in the review modal, and a key that
   increments each time review mode is entered (forces `ReviewModal` to remount/reset).
5. **Stable-callback indirection**: `onDismissSheetsRef` / `onResetUiStateRef` are refs holding
   the *real* callbacks (`bottomSheet.action.closeAllSheets`, and a closure that clears search/
   report/poi state). `useMapOverlay` is constructed with stable wrapper functions
   (`stableDismissSheets`/`stableResetUiState`) that read through these refs — this breaks the
   circular dependency where `useMapOverlay` needs callbacks that depend on `search`/`report`,
   which themselves need values returned by `useMapOverlay`. After `search`/`report` are
   created, the refs are reassigned to point at the real implementations.
6. `useMapOverlay({...})` → `{ featureTappedRef, beginOverlayAction, canPresent, guardedPresent,
   registerAbortController, releaseAbortController, closeAllSheets }`.
7. `search = useMapSearch({ cameraRef, entrances, locationBottomSheet, poiBottomSheet,
   ...overlay })`.
8. `mapPress = useMapPressHandlers({ isReportMode, entrances, avoidanceAreas,
   bottomTabBarHeight, ...sheet refs, ...overlay })`.
9. `mapDetailMode` — loaded via `getStoredMapDetailMode()` (from `utils/mapPreferences`) inside
   a `useFocusEffect`, exposed as `showDetailedLayers: mapDetailMode === "detailed"` (controls
   whether sidewalks/barriers render — see [utils.md](./utils.md)).
10. `handleEnterReviewMode(reviewData)` — overlay-guarded: sets `poi`, bumps `reviewKey`, and
    presents the review `BottomSheetModal`.
11. `handleExitReviewMode()` — closes all sheets and clears `poi`.

Returns a flat object: `{ cameraRef, featureTappedRef, bottomSheet, report, search, poi,
reviewKey, setReviewKey, handleEnterReviewMode, handleExitReviewMode, closeAllSheets, mapPress,
showDetailedLayers }`.

## `hooks/useMapBottomSheets.ts`

Holds `useRef`s for every bottom sheet (`avoidanceAreaBottomSheet`, `poiBottomSheet`,
`reviewSheet`, `locationBottomSheet`, `sidewalkBottomSheet`, `barrierBottomSheet`,
`constructionBottomSheet`) and a `closeAllSheets()` that calls `.dismiss()` on each. No state —
pure ref container, returned as `{ ref: {...}, action: { closeAllSheets } }`.

## `hooks/useReportMode.ts`

Drives the "report an avoidance area" drawing flow:
- **State**: `isReportMode`, `aaPointsReport` (array of `{latitude, longitude}` vertices),
  `clickedPoint` (most recently tapped point, shown with a crosshair icon), `reportStep`
  (which step of `ReportModal`'s wizard is active).
- **`handleMapTap(coordinate)`** — only active while `isReportMode && reportStep === 0`.
  Validates the new point with `isPointValid` (uses `turf.kinks` to reject points that would
  make the in-progress polygon self-intersect once ≥3 points exist), then appends it or shows
  an error toast.
- **`reportGeoJSON`** (memoized) — `null` if fewer than 2 points; a `LineString` for 2 points,
  or a closed `Polygon` (first point repeated at the end) for ≥3 points — fed to `MapLayers`
  for live preview.
- **`resetReport()`** — clears all report state, called by `useMapOverlay`'s
  `onResetUiState` and by `ReportOverlay`'s `onExit`.

## `hooks/useMapSearch.ts`

Implements the search bar / dropdown selection flow with dual-scope Google-Places lookup and
local-database short-circuiting.

- **State**: `isSearchActive`, `searchQuery`.
- **`handleSearchChange(text)`** — updates the query and activates the dropdown once non-empty.
- **`handleSelectLocation(location)`** — the core flow, fully wrapped in the overlay guard
  (`beginOverlayAction`/`canPresent`/`registerAbortController`):
  1. **Resolve a `place_id`.** If the dropdown item didn't already carry one (e.g. it came from
     the local building DB without a Google place), build a query from
     `[name, address]`/`name` and call `resolvePlaceIdWithScopeFallback`:
     - `looksLikeCampusAbbreviation(query)` (a bare 2–6 char alphanumeric token, e.g. `"GDC"`)
       or a hit in the local `searchBuildings()` index marks the query as "likely campus
       intent" → search `scope: "campus"` first, fall back to `scope: "global"`.
       Otherwise search `"global"` first, fall back to `"campus"`.
     - Every step checks `controller.signal.aborted || !canPresent(epoch)` and bails early if
       the search was superseded.
  2. **Resolve place details.** `place_id` prefixed `local_` → look up in
     `buildingDatabase.findBuilding()` and convert with `buildingToPlaceDetails()`; the matching
     GeoJSON building feature is found by `Building_Abbr`. Otherwise call
     `getPlaceDetails(place_id, name)` (Google Places via the server proxy); if the coordinates
     are `isLikelyCampusCoordinate()`, also resolve the campus building feature via
     `findCampusBuildingFeature()`.
  3. **Fly the camera** to the result (`zoomLevel: 18`, 800ms animation).
  4. **Resolve to a POI or generic location** via `buildPoiFromCampusBuilding(entrances,
     placeDetails, matchingBuilding)` (see below). If it returns a POI, dismiss the location
     sheet and `guardedPresent` the POI bottom sheet (`"search_to_poi"`); otherwise
     `guardedPresent` the `LocationDetailsBottomSheet` (`"search_to_location"`).
  5. `finally` releases the abort controller.
- **`clear()`** / **`open()`** — reset/activate the search UI.

## `hooks/useMapPressHandlers.ts`

One handler per tappable map layer, all overlay-guarded:

- **`handleRampPress(feature)`** — tapping a ramp marker. Skipped in report mode. Reads the
  ramp's `Area_Description` property to find a matching building by abbreviation (falling back
  to `findCampusBuildingFeature` by coordinates). If no building is found, shows an error toast
  ("Ramp is not linked to a known building yet..."). Otherwise, asynchronously calls
  `apiClient.resolveRampPOI({ externalKey, latitude, longitude, buildingAbbr, buildingName })`
  to get/create a ramp POI row server-side (`externalKey` derived from the ramp feature's
  `ObjectId`/`OBJECTID`/`GlobalID`/feature id). While waiting (or on failure), it still has a
  fallback "ramp POI" object (`poi_type: "ramp"`, `metadata.ramp: true`) it can present if the
  server lookup yields nothing usable, or it presents the building's existing entrance POI via
  `buildPoiFromCampusBuilding`. The result is presented in `poiBottomSheet` with action name
  `"ramp_to_building_poi"` or `"ramp_to_ramp_poi"`.
- **`handleBuildingTap(feature)`** — tapping a building polygon. Skipped in report mode. Tries
  `buildPoiFromCampusBuilding(entrances, null, feature)` first (presents `poiBottomSheet`,
  `"building_to_poi"`); if that returns nothing, falls back to the local building database
  (`findBuilding(Building_Abbr)` → `buildingToPlaceDetails` → `locationBottomSheet.present`,
  `"building_to_location"`).
- **`handleAvoidanceAreaPress(polygonId)`** — looks up the area in `avoidanceAreas` by `id` and
  presents `avoidanceAreaBottomSheet` (`"avoidance_area"`).
- **`handleSidewalkPress(segment)`** — presents `sidewalkBottomSheet` with the tapped
  `SidewalkSegment` (`"sidewalk"`).
- **`handlePOIPress(poi)`** — presents `poiBottomSheet` (`"poi"`).
- **`handleBarrierPress(properties)`** — presents `barrierBottomSheet` (`"barrier"`).
- **`handleConstructionPress(id, description)`** — presents `constructionBottomSheet`
  (`"construction"`).

All except `handleRampPress`/`handleBuildingTap` are simple (no async work) but still go
through `guardedPresent` for consistency and to participate in the epoch system.

## POI/building helpers — `src/features/pois/`

These are shared between search, press-handling, and rendering:

- **`buildingUtils.ts`**
  - `extractBuildingAbbreviation(value)` — pulls a 2–8 char building code out of a string,
    either from `(ABBR)` parentheses or a leading code (`"GDC Building"` → `"GDC"`).
  - `normalizeCampusText(value)` — lowercases, strips non-alphanumerics, trims — used for fuzzy
    name matching.
  - `findCampusBuildingFeature(lat, lng, placeName?, placeAddress?)` — resolves a campus
    building GeoJSON feature (from `assets/geojson/buildings_simple.json`) by, in order:
    (1) abbreviation match against `Building_Abbr`, (2) point-in-polygon (`turf.booleanPointInPolygon`),
    (3) fuzzy name/description match, (4) nearest-centroid within ~225m
    (`MAX_SNAP_DISTANCE_SQ = 0.002²`).
  - `isLikelyCampusCoordinate(lat, lng)` — bounding-box check (`UT_CAMPUS_BOUNDS`) plus
    distance-from-`UT_CENTER` ≤ `CAMPUS_MATCH_RADIUS_KM`.
  - `isPoiInsideBuilding(poi, buildingFeature)` — `turf.booleanPointInPolygon` on the POI's
    `location_geojson`.

- **`poiBuildingUtils.ts`**
  - `findEntrancePoiForBuilding(entrances, buildingFeature)` — finds an existing entrance POI
    for a building, first by matching `Building_Abbr` against
    `extractBuildingAbbreviation(entry.metadata.bld_name ?? entry.metadata.name)`, then by
    `isPoiInsideBuilding`.
  - `buildPoiFromCampusBuilding(entrances, placeDetails, buildingFeature)` — the central
    "resolve a building to something presentable" function. Returns an existing entrance POI if
    `findEntrancePoiForBuilding` finds one; otherwise synthesizes a placeholder POI object
    (`poi_type: "accessible_entrance"`, `id: "search-<place_id|abbr|name>"`,
    `location_geojson` from `placeDetails` or the building's `turf.centerOfMass`,
    `metadata.bld_name`) — or `null` if there's no building feature or name at all.

- **`poiUtils.ts`**
  - `getPOISubtype(poi)` — for `accessible_entrance` POIs, splits into
    `accessible_entrance__auto` / `accessible_entrance__manual` based on
    `metadata.auto_opene`; otherwise returns `poi.poi_type` as-is. Used as the clustering key.
  - `isEntrancePoi(poi)` — `true` if `poi_type` contains `"entrance"` but not `"ramp"` (i.e.
    accessible entrances, not ramps).

- **`clustering.ts`** — `clusterPOIs(pois)`: greedy, centroid-based clustering. For each
  unvisited POI, grows a group by repeatedly recomputing the group centroid
  (`turf.centroid`/`turf.multiPoint`) and absorbing any unvisited POI of the **same
  `getPOISubtype`** within `CLUSTER_RADIUS` (10m) of that centroid, until no more POIs are
  absorbed. Single-member groups pass through unchanged; multi-member groups produce a
  synthetic POI at the final centroid with a `clusteredPOIs` array attached (used for the
  marker's `clusterCount`).

## Data sources

- **`hooks/useMapGeoJSON.ts`** — loads four static GeoJSON assets
  (`assets/geojson/sidewalks_slim.json`, `buildings_simple.json`, `UTA_Access_Barriers.json`,
  `Ramps.json`) via `require()`, deferred inside `InteractionManager.runAfterInteractions` so
  the initial screen render isn't blocked. Starts each as `MapConstants.EMPTY_FC` until loaded.
- **`geojsonSources/useAvoidanceGeoJSON.ts`** — maps `avoidanceAreas` (from
  `useAvoidanceAreas()`) to a `FeatureCollection` where each feature's geometry is the area's
  `boundary_geojson` and `properties.id = String(area.id)`.
- **`geojsonSources/useConstructionGeoJSON.ts`** — maps `constructionAreas` (from
  `useConstructionAreas()`) to polygon features. Each area's `points` are `[lat, lng]` pairs
  that get flipped to `[lng, lat]`; rings shorter than 3 points are dropped, and the ring is
  closed (first point repeated) if not already closed. Feature `id`/`properties.id` are
  `"C<area.id>"`, with `properties.description` carried through.
- **`POIs/usePOIFeatures.ts`** — given raw `POIs`, filters to `entrances = POIs.filter(isEntrancePoi)`,
  clusters them (`clusteredEntrancePOIs = clusterPOIs(entrances)`), and builds `poiGeoJSON`: one
  `Point` feature per cluster with `properties.icon` = `"autoDoor"`/`"manualDoor"` (based on
  `metadata.auto_opene`) and `properties.clusterCount` = number of merged POIs. Returns
  `{ entrances, clusteredEntrancePOIs, poiGeoJSON }` — `entrances` is also passed down to
  `useMapSearch`/`useMapPressHandlers` for `buildPoiFromCampusBuilding`.

## Rendering — `rendering/MapLayers.tsx`

The single component that declares every Mapbox source/layer inside `<MapView>`. In order:

1. **Terrain** — `RasterDemSource` (Mapbox terrain-DEM) + `Terrain` (1.5x exaggeration) +
   `SkyLayer` (atmosphere).
2. **`campus-buildings`** `ShapeSource` (from `buildingsGeoJSON`) — tap → `onFeatureTapped()` +
   `onBuildingPress(feature)` (skipped in report mode). Contains:
   - `campus-buildings-3d` `FillExtrusionLayer` — extrusion height interpolated from
     `Shape__Area` (5 at area 0 up to 40 at area 150000), color/opacity from
     `buildingStyles`, visible from `MIN_ZOOM_FOR_BUILDINGS`.
   - `campus-building-labels` `SymbolLayer` — `Building_Abbr` text, visible only between
     `MIN_ZOOM_FOR_LABELS` and `MAX_ZOOM_FOR_LABELS`.
3. **`<SidewalkLayer>`** (`layers/sidewalks.tsx`) — rendered only if `showDetailedLayers`.
4. **`<AvoidanceAreas>`** (`layers/avoidanceAreas.tsx`).
5. **`<ConstructionZones>`** (`layers/constructionZones.tsx`).
6. **`barriers`** `ShapeSource` (from `barriersGeoJSON`, only if `showDetailedLayers`) — a
   `CircleLayer` (red circles, radius interpolated 4→8 px between zoom 16–19), tap →
   `onBarrierPress(properties)`.
7. **Report-mode overlay geometry** — if `reportGeoJSON` is set, a `ShapeSource` with a
   `FillLayer` (red, 25% opacity, filtered to `Polygon` geometries) and a `LineLayer` (red,
   2px). Each point in `aaPointsReport` is rendered as a `PointAnnotation` with
   `mapIcons.point`; `clickedPoint` (if set) gets a `PointAnnotation` with `mapIcons.crosshair`.
8. **`pois`** `ShapeSource` (from `poiGeoJSON`, hidden in report mode) — a `SymbolLayer` whose
   `iconImage` is `["get", "icon"]` (`autoDoor`/`manualDoor`, registered via `<Images>` in
   `index.tsx`), `iconSize` interpolated `[14→0.15, 16→0.25, 18→0.40, 20→0.60]` by zoom, visible
   from `MIN_ZOOM_FOR_POIS`. Tap looks up the clicked feature's `id` in `clusteredEntrancePOIs`
   and calls `onPOIPress(poi)`.
9. **`ramps`** `ShapeSource` (from `rampsGeoJSON`, hidden in report mode) — a `SymbolLayer`
   using the `rampIcon` image, same size interpolation as POIs, visible from
   `MIN_ZOOM_FOR_POIS`. Tap → `onRampPress(feature)`.

### `layers/sidewalks.tsx`

Renders nothing if `!visible`. Otherwise a `ShapeSource` ("sidewalks") with:
- `sidewalk-fill` `FillLayer` — color via a `match` on `properties.compliant`
  (`1` → green `rgba(34,197,94,0.35)`, `0` → red `rgba(239,68,68,0.35)`, else gray), visible
  from `MIN_ZOOM_FOR_SIDEWALKS`.
- `sidewalk-line` `LineLayer` — same color scheme at higher opacity, 1px width.

Tap (skipped in report mode) builds a `SidewalkSegment` (`{ id, compliant, score }`) from
`feature.id ?? properties.OBJECTID` and calls `onPress(segment)`.

### `layers/avoidanceAreas.tsx`

`ShapeSource` ("avoidance-areas") with a `FillLayer` (`rgba(209,0,0,0.2)`) and `LineLayer`
(`rgba(209,0,0,0.6)`, 1.5px). Tap (skipped in report mode) calls `onFeatureTap?.()` then
`onPress(String(properties.id))`.

### `layers/constructionZones.tsx`

`ShapeSource` ("construction") with a `FillLayer` (amber, `rgba(245,158,11,0.25)`) and
`LineLayer` (`rgba(217,119,6,0.8)`, 2px). Tap (skipped in report mode) calls `onFeatureTap?.()`
then `onPress(String(properties.id), properties.description)`.

## `rendering/ReportOverlay.tsx`

Renders the UI for `useReportMode`:
- If `report.state.isReportMode` — a semi-transparent blue overlay (`bg-ut-blue/15`,
  `pointer-events-none`) over the whole screen, plus `<ReportModal>` (the step wizard for
  naming/describing/confirming the avoidance-area polygon). `ReportModal`'s `onSubmit` closes
  the polygon ring (appends the first point again) and calls
  `insertAvoidanceArea({ name, description, boundary_geojson: { type: "Polygon", coordinates:
  [...] } })`. `onExit` calls `report.action.resetReport()`.
- Otherwise, if `canReport` is `false` — renders nothing.
- Otherwise — a floating "Report" `<Button>` (bottom-right) that calls `onEnterReport` (which,
  in `index.tsx`, closes all sheets, clears search, and sets report mode on).

`canReport` is computed in `index.tsx` from the authenticated user:
`user.role === "student" || user.email` ends with `@utexas.edu`.
