# Shared components (`src/features/components/`)

All 15 components in this folder. Bottom sheets use `@gorhom/bottom-sheet`'s
`BottomSheetModal`, take a `ref: ForwardedRef<BottomSheetModal>` prop (note: these components
destructure `ref` from props rather than using `forwardRef`, since they're rendered under
React 19 where `ref` is an ordinary prop), and read their `data` via the `present(data)` /
render-prop pattern. Most are dark-mode aware via `useTheme()`.

## Bottom sheets

### `AvoidanceAreaBottomSheet`
Wraps `AvoidanceAreaDetails`. `present({ area })` where `area: AvoidanceArea`. Snap points
`["50%", "80%"]`, rounded (32px) sheet themed for dark/light.

### `AvoidanceAreaDetails`
The content rendered inside `AvoidanceAreaBottomSheet` — `{ area: AvoidanceArea }`.
- Header: warning icon, `area.name`, "Temporary Blockage" subheading.
- Area size in sqft, computed via `turf.area()` on `area.boundary_geojson` × `10.764`
  (m²→ft²).
- Author row: `area.profile_display_name` (falls back to "UT Community Member") and a
  relative timestamp (`formatTimeAgo`).
- "Is the blockage still present?" Yes/No `ActionButtonGroup` (local UI state only —
  `handleStatusUpdate` currently just `console.log`s, no mutation).
- `area.description` or an italic "No description provided" placeholder.
- **Comments** (collapsible): backed by `useAvoidanceAreaReports(areaId)` /
  `useInsertAvoidanceAreaReport()`. Lists existing reports (`profile_display_name`, relative
  time, `title`/`description`). The add-comment form (react-hook-form + zod, 1–280 chars) is
  only shown if `canComment` (`user.role === "student"` or a `@utexas.edu` email) — otherwise
  shows "Sign in with a UT Google account to leave a comment."
- Footer: the area's numeric `id`, for debugging.

### `BarrierBottomSheet`
`present({ barrier: BarrierProperties })` where `BarrierProperties = { BARRIER_TYPE?,
TRAVEL_PATH_WIDTH?, COLLECTED_AT?, jira_id? }` (from `assets/geojson/UTA_Access_Barriers.json`
feature properties). `enableDynamicSizing`. Looks up `BARRIER_TYPE` (lowercased) in a
`BARRIER_META` table (`sign`/`vehicle`/`construction`/`vegetation`/`furniture`/`utility`) for a
label/emoji-icon/description, falling back to a generic "⚠️ Unknown Barrier". Shows
`TRAVEL_PATH_WIDTH` in both inches and cm, `COLLECTED_AT` formatted as a date, and `jira_id` as
a small reference line.

### `BuildingBottomSheet`
`present({ building: BuildingProperties })` where `BuildingProperties = { Description?,
Address_Full?, Map_Classification?, Building_Details_URL? }` (campus-building GeoJSON
properties). Snap point `["50%"]`. Shows the building name/description, address (with
`LocationPin` icon), a "Type" row mapping `Map_Classification` through `CLASSIFICATION_LABELS`
(`GeneralPurpose`→"General Purpose", etc.), and — if present — a burnt-orange "View Building
Details" button that `Linking.openURL(Building_Details_URL)`.

### `ConstructionBottomSheet`
`present({ construction: { id, description? } })`. `enableDynamicSizing`. Shows a "🚧
Construction Zone — Active, Expect disruptions" header, the zone's `description` (or a default
warning) in an amber callout, a generic "♿ Check nearby sidewalk layers" tip, and `Zone {id}`
in the footer.

### `LocationDetailsBottomSheet`
The sheet for non-POI search results (arbitrary Google Places results). Unlike the others, it
exposes an **imperative ref** (`LocationDetailsBottomSheetRef = { present(placeDetails,
distance?, entrances?), dismiss() }`) via `forwardRef` + `useImperativeHandle`, because it's
driven by `useMapSearch` rather than a Mapbox `ShapeSource.onPress`. Snap points `["50%",
"85%"]`.
- While `placeData` is `null`, shows a loading spinner ("Loading location details...").
- Otherwise renders: name, bookmark/warning action icons (UI-only), `formatted_address`,
  star rating (`renderStars`, using `StarFill`/`StarBorder` SVGs), review count, opening hours
  (`formatOpeningHours` from `utils/googlePlaces`), and `distance` (or "Calculating...").
- If `entrances` were passed, renders one card per entrance with `renderAccessIcons` —
  colored circular icons for `hasPowerDoor` (⚡ yellow), `hasRamp` (♿ green),
  `hasAccessibleRestroom` (🚻 blue), `hasAccessibleDoor` (🚪 orange). In current usage
  `entrances` is always empty (callers don't pass it), so this renders "No accessible entrances
  found."
- A "Get Directions" button (currently `console.log` only — not wired to `RouteOverlaySheet`
  or `ApiClient.getRoute`).

### `POIBottomSheet`
The most complex bottom sheet — `present({ poi })`, plus `allPOIs: any[]` and
`handleReviews: (reviewData: POIReviewData) => void` props (wired to
`useMapScreenController().handleEnterReviewMode`). `React.memo`'d; snap point `["50%"]`,
`enableContentPanningGesture={false}`.

`POIContent` (the render-prop body) does substantial building/entrance resolution so it works
for entrance POIs, ramp POIs, and search-synthesized POIs alike:
- Derives a building abbreviation from `poi.metadata` (`bld_name`, `name`, `building_abbr`,
  `Area_Description`, or `building_name`, in that order via `extractBuildingAbbreviation`).
- Finds the building GeoJSON feature by abbreviation
  (`buildingsData.features.find(Building_Abbr === ...)`), or by point-in-polygon
  (`findBuildingContainingPoi`), or nearest-centroid within ~225m
  (`findNearestBuildingContainingPoi`).
- `isRampPoi(poi)` — true if `poi_type` includes `"ramp"` or `metadata.ramp` is set.
- Computes `buildingName` from the first non-empty of `metadata.bld_name`,
  `metadata.building_name`, the building feature's `Description`, or `metadata.name`
  (title-cased, abbreviation prefix stripped) — falling back to `"Unknown Building"`.
- Finds all other entrance POIs (`allPOIs`) belonging to the same building (`isEntrancePoi` +
  abbreviation/point-in-polygon/name match) to populate the horizontally-scrolling **entrance
  chips** row. Each chip shows a cardinal-direction label (`getCardinalLabel`/
  `getCardinalLabelFromNeighbors` from `utils/utils`) and the auto/manual door icon
  (`mapIcons.autoDoor`/`manualDoor`).
- For ramp POIs, the ramp itself is auto-selected with label "Ramp Access", but entrance chips
  for the same building remain selectable.
- "Reviews (0)" row → `openReviewsForCurrentEntrance()`: resolves the selected entrance (or the
  POI itself), validates it has a positive integer `id` and that a building was matched —
  showing an error `Toast` if not — then calls `handleReviews({ id, building, buildingName,
  entrance: <cardinal label>, entrances })`.
- Header also shows static `Favorite`/`Warning` icon buttons (UI-only) and a star rating row
  (hardcoded `rating = 0`).
- "Get Directions" button is a UI-only placeholder (`// TODO: Include searching logic here`).

`POIReviewData = { id: number; building: any; buildingName: string; entrance: string;
entrances: any[] }` — the shape passed to `ReviewModal` via `useMapScreenController`.

### `RouteOverlaySheet`
A stub: `present({ route })`, snap point `["50%"]`, but its content component (`RouteContent`)
renders nothing (`<></>`). Not currently wired up from the map screen — a placeholder for a
future turn-by-turn route display (the route-fetching API exists —
`ApiClient.getRoute`/OpenRouteService — but isn't connected to UI yet).

### `SidewalkBottomSheet`
`present({ segment: SidewalkSegment })` where `SidewalkSegment = { id, compliant: number |
null, score: number }` (from `useMapPressHandlers.handleSidewalkPress`). `enableDynamicSizing`.
Shows a status badge — "ADA Compliant" (green) / "Not Compliant" (red) / "Compliance Unknown"
(gray) based on `compliant === 1 / 0 / null` — and an "Accessibility Score" progress bar
(`score`, 0–100, same color as the status).

## Modals

### `ReportModal`
The 3-step wizard rendered by `ReportOverlay` while `isReportMode`. Props: `aaPoints`
(`{latitude, longitude}[]`), `currentStep`, `setAAPoints`, `setCurrentStep`, `onSubmit(data) =>
Promise<void> | void`, `onExit()`. Validated with `react-hook-form` + zod
(`reportFormSchema`):
- `aaPoints` — min 3 points (validated on step 0).
- `name` — 5–30 chars.
- `description` — 10–500 chars (with a live character counter and an `Add Photo` button —
  photo upload itself is not implemented, `images` is an optional unused field).

Step 0: instructs the user to mark points on the map (the count requirement is enforced by the
zod schema, surfaced via a `Toast` if `handleNext` is called too early). Step 1: name +
description form. Step 2: read-only review of the description before submit. A progress bar of
tappable step-dots lets the user jump back to completed steps. `handleNext`'s last step calls
`handleSubmit(handleFormSubmit)`, which calls `onSubmit(data)`; on success it resets the form,
clears `aaPoints`, and calls `onExit()`. On rejection, shows an error `Toast` with the thrown
error's `message`. While `aaPoints` is empty, a `PointInteractionHint` tooltip ("Drag to
navigate... Click to mark the area.") is shown instead of the Undo/Clear button group.

### `ReviewModal`
The full review flow for a POI/entrance, rendered in a `BottomSheetModal` with
`backgroundStyle: transparent` from `index.tsx`. Props: `poi_id`, `entrances`, `entranceName`,
`building`, `buildingName`, `onExit()`. Remounted (via the controller's `reviewKey`) every time
`handleEnterReviewMode` is called, so its internal state always starts fresh for the new POI.

Two `formState`s:
- **`0` (browse)** — shows a `MiniMap` (a small, interaction-limited `MapView` centered on the
  building, rendering the building polygon as a `ShapeSource`/`FillLayer`/`LineLayer` and a
  `PointAnnotation` per entrance using the auto/manual door icon; tapping an entrance pin calls
  `handleSelectEntrance`, which updates `selectedPoiId`/`selectedEntranceName` and re-queries
  `useReviews(selectedPoiId)`). Below the map: the reviews list (`ReviewsList`/`ReviewCard`),
  excluding the current user's own review (shown separately as `ListHeaderComponent` with an
  edit/delete menu via `useDeleteReview`). A "Leave a Review" button (disabled until
  `useMyProfile()` resolves) switches to `formState = 1`.
- **`1` (edit/create)** — a star-rating control (`TouchableRating`, uses `Wheelchair` icons,
  1–5), an `EntranceButtons` row (one button per entrance, labeled via
  `getEntranceLabel(entrance, entrances, building)` from `utils/utils`, selecting an entrance
  updates the `poi_id` field), a `FeatureButtons` multi-select (`"Power-assisted doors"`,
  `"Ramps"`, `"Others"`), and a free-text `ReviewContentInput` (max 280 chars). Submit
  (`onSubmit`) validates `myProfile.id` exists, `rating !== 0`, and `selectedPoiId` is a valid
  positive integer (each failure shows an error `Toast`), then calls `insertReview`/
  `updateReview` (and, if the entrance changed while editing, `insertReview` + `deleteReview`
  of the old one) via the TanStack mutation hooks from `utils/api-hooks`.

`ReviewCard` shows the reviewer's avatar/initial, `@displayName` (or "Me" for the active user),
a relative-time string, the review text, a `Wheelchair` rating display, and either a `⋯` menu
(for the active user's own review) or upvote/downvote controls (`useUpsertVote`/`useDeleteVote`,
toggling off if the same vote is pressed again) for others' reviews.

## Search UI

### `SearchBar`
A pill-shaped search field, theme-aware (`useTheme`). Two modes via `editable`:
- `editable=false` — a `TouchableOpacity` showing a magnifying-glass icon and placeholder text
  (`onPress` opens the search — used as the initial collapsed state).
- `editable=true` — a real `TextInput` (autofocus, `returnKeyType="search"`), with a clear (✕)
  button shown when `isActive` or `value` is non-empty.

### `SearchDropdown`
Renders the search results list below `SearchBar`. Props: `visible`, `searchQuery`,
`onSelectLocation(location)`, `onDismiss()`, `topOffset`.
- If `searchQuery` is empty, shows two hardcoded `recentSearches` (Texas Union, PCL).
- Otherwise, combines **local** results from `searchBuildings(searchQuery)` (campus building
  database — `id`/`place_id` prefixed `local_<Building_Abbr>`) with **remote** results from
  `searchPlaces()` (Google Places via the server proxy), de-duplicated by `place_id` and by
  matching `name`+`address` against the local results.
- Remote search is **debounced 300ms** and uses dual-scope fallback exactly like
  `useMapSearch`: `looksLikeCampusAbbreviation(query)` or a local-DB hit ⇒ try `scope: "campus"`
  first, else `scope: "global"` first — each branch falls back to the other scope if the first
  returns nothing. A `requestIdRef` counter discards results from superseded requests.
- Tapping the dim background or the ✕ calls `onDismiss`. Tapping a result calls
  `onSelectLocation(location)` (handled by `useMapSearch.handleSelectLocation`).

## Misc

### `ActionButtonGroup`
A row of pill `TouchableOpacity` buttons: `actions: { label, onPress, className?,
textClassName? }[]`. Used by `AvoidanceAreaDetails` (Yes/No status) and `ReportModal`
(Undo/Clear).

### `Button`
The shared button primitive (`forwardRef<View, ButtonProps>`). `variant`:
`"primary"` (UT burnt-orange fill), `"secondary"` (outlined), `"disabled"` (gray, also implied
by `disabled` prop), `"ghost"` (transparent), `"gray"` (dark gray fill). Accepts `title` or
arbitrary `children`, plus an optional leading `icon`. Spreads remaining
`TouchableOpacityProps`. Used throughout (`ReportOverlay`'s "Report" button, `ReviewModal`'s
submit/cancel, `ReportModal`'s step navigation/photo button, `LocationDetailsBottomSheet`'s
"Get Directions").
