# Navigation UI Redesign

## Overview

This redesign replaces the direct "Go" navigation flow with a Google Maps-style route preview modal. Users first see route details before navigation begins.

## Changes

### Status Bar / Theme
- Android: `StatusBar` now sets `backgroundColor` to match dark/light theme (`#1A2024` dark, `#FFFFFF` light)
- iOS: A `View` overlay matches the status bar area to the theme background
- `DirectionsBanner` is now fully theme-aware — white background + dark text in light mode, dark background + light text in dark mode

### POI Bottom Sheet
- "Go" button renamed to **"Get Directions"**
- Transport mode selector (Accessible / Walking / Scooter) removed from POI sheet — moved to Route Preview Sheet
- Pressing "Get Directions" opens the Route Preview Sheet instead of starting navigation immediately

### Route Preview Sheet (`RoutePreviewSheet.tsx`)
Google Maps-style preview before navigation begins:

```
[♿ Accessible] [🚶 Walking] [🛴 Scooter]   ← switch anytime; re-fetches route
────────────────────────────────────────────
📍 My Location                    [↕ swap]   ← tap to change origin
📌 Destination Building Name               ← tap to change destination
[+ Add Stop]                               ← adds a waypoint AFTER destination
────────────────────────────────────────────
⏱ 12 min    ETA 2:45 PM    0.3 mi   [GO→]
[Accessible] [Quick Route]                 ← route tags from ORS data
```

- Tapping the route card body (not GO) → shows step-by-step directions list
- Tapping GO → starts navigation with the already-fetched route (no double ORS call)
- Origin/destination are both clickable; opens a campus building search modal
- Add Stop adds a waypoint after the destination (route: Origin → Destination → Stop)

### Navigation Active State
- **`DirectionsBanner`** (top): shows current maneuver icon + instruction + distance
- **`NavigationBottomBar`** (bottom): shows destination, ETA, time, distance, mute/report/end buttons
- **New step controls** in NavigationBottomBar: "Step X of Y" with Prev / Next buttons for testing

## Files Changed

| File | Change |
|------|--------|
| `src/features/navigation/navigationUtils.ts` | NEW — shared formatting helpers and direction icons |
| `src/features/navigation/useRoutePreview.ts` | NEW — route preview state hook |
| `src/features/components/RoutePreviewSheet.tsx` | NEW — full preview UI component |
| `utils/openRouteService.ts` | New `waypoints[]` signature; multi-segment step flattening |
| `src/features/navigation/useNavigationMode.ts` | `nextStep`/`prevStep` actions; optional `previewRoute` param |
| `src/features/components/POIBottomSheet.tsx` | "Get Directions", removed transport tabs, `onRequestPreview` |
| `src/features/components/DirectionsBanner.tsx` | Theme-aware colors |
| `src/features/components/NavigationBottomBar.tsx` | Next/Prev step buttons |
| `src/features/map/hooks/useMapBottomSheets.ts` | Added `routePreviewSheet` ref |
| `src/features/map/useMapScreenController.ts` | Integrated `useRoutePreview`, `handleRequestPreview` |
| `app/(tabs)/index.tsx` | Mounted `RoutePreviewSheet`, wired new props, iOS status bar overlay |
| `app/_layout.tsx` | `StatusBar backgroundColor` for Android |

## Architecture Notes

- ORS `fetchRoute` now accepts `waypoints: [number, number][]` (2+ points), enabling multi-stop routing
- Steps are flattened across all ORS route segments (fixes multi-waypoint silent data loss)
- `useRoutePreview` uses an `AbortController` pattern to cancel in-flight requests when profile/origin/destination changes
- The preview sheet passes its already-fetched `ORSRoute` to `startNavigation` to avoid a duplicate network call
- The POI sheet is dismissed directly (not via `closeAllSheets`) to avoid advancing the overlay epoch, with a 250ms delay before presenting the route preview sheet
