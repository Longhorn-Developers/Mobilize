# Navigation Mode — Implementation Plan

**Date:** 2026-06-19  
**Branch:** pr67-merge  
**Priority order:** CSS fixes first, then Navigation Mode feature

---

## 0. CSS / Styling Fixes (top priority)

### Root causes identified

| File | Issue |
|---|---|
| `tailwind.config.js` | `darkMode: "media"` makes `dark:` Tailwind classes respond to OS setting only, not to the app's custom `ThemeContext`. Any component that uses `dark:` prefix classes (e.g. `dark:text-gray-500` in `SearchBar`) is controlled by the OS, not the in-app toggle. |
| `SearchBar.tsx` | Concatenates `className` prop into `containerBase` at the call-site string (`\`flex-row items-center ... ${className}\``). NativeWind performs **static analysis** at build time — dynamic class names are stripped. The outer `className` prop passed from `index.tsx` (`"absolute left-4 right-4 z-20"`) is lost. |
| `app/(tabs)/index.tsx` | `SearchBar` receives `className="absolute left-4 right-4 z-20"` but that string is being composed dynamically inside `SearchBar`, so NativeWind never sees it. Position relies on the inline `style={{ top: insets.top + 10 }}` — but without the absolute/z classes it won't layer correctly. |
| `ReportModal.tsx` | `top-3/4`, `rotate-45`, and `pointer-events-none` are used in `PointInteractionHint` — NativeWind v4 requires these to be in the content glob and statically present; they are, so these should resolve. However `absolute top-[-8]` uses an arbitrary value which may require `safelist` or the JIT to be explicitly enabled. |
| `tailwind.config.js` | Missing explicit `safelist` for dynamic/arbitrary values used in the app. |

### Fixes

**1. Fix `tailwind.config.js` — switch dark mode to `class` and add safelist**

```js
module.exports = {
  content: ["./app/**/*.{js,ts,tsx}", "./src/**/*.{js,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",          // ← was "media"
  theme: { extend: { colors } },
  plugins: [],
};
```

NativeWind v4 with `darkMode: "class"` checks for a `dark` class on the root element. Wrap the root with `<View className={isDark ? "dark" : ""}>`  or use NativeWind's `useColorScheme` hook — but since the app already has a `ThemeContext` that manually gates every `isDark` branch with inline styles, the simplest fix is to **keep `darkMode: "media"`** and stop using `dark:` prefix classes entirely (the app already does this in most places — just clean up `SearchBar`).

**Chosen approach:** Remove the handful of `dark:` prefix classes and replace with the already-used `isDark` ternary inline style pattern. This is consistent with 95% of the rest of the codebase.

**2. Fix `SearchBar.tsx` — don't compose `className` dynamically; apply it as a wrapper**

```tsx
// Before (broken — NativeWind can't see dynamic className)
const containerBase = `flex-row items-center gap-3 rounded-full px-5 py-3 shadow-lg ${className}`;

// After — pass style/className to a wrapping View
<View className={className} style={style}>
  <TouchableOpacity className="flex-row items-center gap-3 rounded-full px-5 py-3 shadow-lg bg-white" ...>
```

Alternatively, keep inline styles for positioning and move all Tailwind classes to static strings.

**3. Fix z-layering in `index.tsx`**

SearchBar and SearchDropdown overlays must use `position: 'absolute'` via inline style (not Tailwind) so they always layer above MapView regardless of NativeWind compilation:

```tsx
<SearchBar
  style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, zIndex: 20 }}
  // no className for positioning
/>
```

---

## 1. Feature: Navigation Mode

### 1.1 Acceptance Criteria Summary

- Tapping **"Go"** (currently "Get Directions") in `POIBottomSheet` enters **Navigation Mode**
- Navigation Mode shows:
  - **Top banner** — immediate next direction (placeholder text, e.g. "Head north on Speedway")
  - **Dynamic map** — follows user position, camera pitched ~60° toward ground (near-ground POV), auto-rotates to heading
  - **Bottom bar** — ETA, travel time, distance (miles), destination building name, "Report Incident" button, "End" button
- Current location placeholder: **UT Tower** `[-97.7335, 30.2861]`
- Routing provider: **OpenRouteService** (wheelchair-accessible profile)
- Route rendered as a colored LineLayer on the map

---

### 1.2 Architecture

#### New files

| Path | Purpose |
|---|---|
| `utils/openRouteService.ts` | ORS API client — fetches wheelchair route, returns `[lng, lat][]` coords + steps |
| `src/features/navigation/useNavigationMode.ts` | Hook — owns navigation state, location simulation, step tracking |
| `src/features/components/NavigationBottomBar.tsx` | Bottom HUD: ETA, time, distance, building name, report, end |
| `src/features/components/DirectionsBanner.tsx` | Top banner: current step instruction |

#### Modified files

| Path | Change |
|---|---|
| `src/features/map/useMapScreenController.ts` | Add `navigation` slice from `useNavigationMode` |
| `src/features/components/POIBottomSheet.tsx` | "Get Directions" button triggers navigation mode |
| `app/(tabs)/index.tsx` | Render `DirectionsBanner`, `NavigationBottomBar`; pass route GeoJSON to MapLayers; update Camera settings |
| `src/features/map/rendering/MapLayers.tsx` | Accept optional `routeGeoJSON` prop and render LineLayer |
| `src/features/map/constants.ts` | Add `UT_TOWER` placeholder coordinate |

---

### 1.3 OpenRouteService Integration

**API:** `https://api.openrouteservice.org/v2/directions/wheelchair`  
**Method:** POST with GeoJSON body  
**Auth:** `Authorization: Bearer <ORS_API_KEY>` header  
**Env var:** `EXPO_PUBLIC_ORS_API_KEY`

```ts
// utils/openRouteService.ts

const ORS_BASE = "https://api.openrouteservice.org/v2/directions/wheelchair";

export interface ORSStep {
  instruction: string;   // e.g. "Turn right onto Speedway"
  distance: number;      // metres
  duration: number;      // seconds
}

export interface ORSRoute {
  coordinates: [number, number][];   // [lng, lat] pairs
  steps: ORSStep[];
  totalDistance: number;             // metres
  totalDuration: number;             // seconds
}

export async function fetchWheelchairRoute(
  origin: [number, number],
  destination: [number, number],
): Promise<ORSRoute> {
  const apiKey = process.env.EXPO_PUBLIC_ORS_API_KEY;
  if (!apiKey) throw new Error("Missing EXPO_PUBLIC_ORS_API_KEY");

  const res = await fetch(ORS_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({
      coordinates: [origin, destination],
      format: "geojson",
      instructions: true,
      units: "mi",
    }),
  });

  if (!res.ok) throw new Error(`ORS error ${res.status}`);
  const json = await res.json();

  const feature = json.features[0];
  const props = feature.properties.summary;
  const coords: [number, number][] = feature.geometry.coordinates;
  const steps: ORSStep[] = feature.properties.segments[0].steps.map((s: any) => ({
    instruction: s.instruction,
    distance: s.distance,
    duration: s.duration,
  }));

  return {
    coordinates: coords,
    steps,
    totalDistance: props.distance,
    totalDuration: props.duration,
  };
}
```

---

### 1.4 `useNavigationMode` Hook

```ts
// src/features/navigation/useNavigationMode.ts

export interface NavigationState {
  isNavigating: boolean;
  route: ORSRoute | null;
  currentStepIndex: number;
  destinationName: string;
  destinationCoords: [number, number] | null;
  userPosition: [number, number];    // placeholder: UT Tower
  isLoading: boolean;
  error: string | null;
}

export function useNavigationMode() {
  // state fields above
  // startNavigation(destination: [number,number], name: string) — calls fetchWheelchairRoute
  // endNavigation() — resets all state
  // returns { state, action: { startNavigation, endNavigation } }
}
```

User position is hardcoded to UT Tower `[-97.7335, 30.2861]` until real location is wired in.

---

### 1.5 Camera Behaviour in Navigation Mode

When `isNavigating === true`, the Mapbox `<Camera>` should:

```tsx
<Camera
  ref={map.cameraRef}
  defaultSettings={{ centerCoordinate: MapConstants.UT_CENTER, zoomLevel: 15, pitch: 45 }}
  // Override when navigating:
  {...(navigation.state.isNavigating && {
    centerCoordinate: navigation.state.userPosition,
    zoomLevel: 18,
    pitch: 60,          // near-ground POV
    animationDuration: 500,
  })}
/>
```

Add a `UserLocation` component from `@rnmapbox/maps` set to `UT_TOWER` when in navigation mode (via a `PointAnnotation` until real GPS is wired).

---

### 1.6 Route LineLayer in `MapLayers`

Add to `MapLayersProps`:
```ts
routeGeoJSON?: GeoJSON.FeatureCollection | null;
```

Inside the JSX, after existing layers:
```tsx
{routeGeoJSON && (
  <ShapeSource id="nav-route" shape={routeGeoJSON}>
    {/* Casing */}
    <LineLayer
      id="nav-route-casing"
      style={{ lineColor: "#FFFFFF", lineWidth: 10, lineJoin: "round", lineCap: "round" }}
    />
    {/* Fill */}
    <LineLayer
      id="nav-route-fill"
      style={{ lineColor: "#BF5700", lineWidth: 6, lineJoin: "round", lineCap: "round" }}
    />
  </ShapeSource>
)}
```

---

### 1.7 `DirectionsBanner` Component

Positioned absolutely at the top, below the safe area inset. Hidden when not navigating.

```
┌──────────────────────────────────────────┐
│  ↑  Head north on Speedway Ave           │
│     200 ft                               │
└──────────────────────────────────────────┘
```

- Dark background (`#1A2024` / white in light mode)
- Direction arrow icon (phosphor `ArrowUpIcon`, rotated per heading)
- Step instruction text
- Step distance in feet/miles
- Rounded bottom corners, no top corners (flush with status bar area)

---

### 1.8 `NavigationBottomBar` Component

Sits above the bottom tab bar (`bottomInset = bottomTabBarHeight`). Full-width, replaces bottom sheets while navigating.

```
┌───────────────────────────────────────────────────┐
│  PCL                                              │
│  Perry-Castañeda Library                          │
│  ─────────────────────────────────────────────── │
│  ETA 2:34 PM   •   4 min   •   0.2 mi            │
│  ─────────────────────────────────────────────── │
│  [ ⚠ Report Incident ]        [ ✕ End ]          │
└───────────────────────────────────────────────────┘
```

Props:
```ts
interface NavigationBottomBarProps {
  destinationName: string;
  totalDistanceMi: number;
  totalDurationSec: number;
  onReportIncident: () => void;
  onEnd: () => void;
  isDark: boolean;
  bottomInset: number;
}
```

ETA = `new Date(Date.now() + totalDurationSec * 1000)` formatted as `h:mm a`.

---

### 1.9 Wiring "Go" button in `POIBottomSheet`

The `POIBottomSheet` component needs to call back to the parent to start navigation. Add a new prop:

```ts
interface POIBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
  allPOIs: any[];
  handleReviews: (reviewData: POIReviewData) => void;
  onStartNavigation: (coords: [number, number], name: string) => void;  // NEW
}
```

The "Get Directions" button becomes the "Go" button:

```tsx
<Pressable
  style={{ backgroundColor: "#BF5700", height: 41.32, ... }}
  onPress={() => {
    const coords = poi?.location_geojson?.coordinates ?? [
      building?.Longitude ?? -97.7335,
      building?.Latitude ?? 30.2861,
    ];
    onStartNavigation([coords[0], coords[1]], buildingName);
  }}
>
  <Text style={{ color: "white" }}>Go</Text>
</Pressable>
```

---

### 1.10 Wiring in `index.tsx`

```tsx
// Add navigation to useMapScreenController (or call useNavigationMode directly)
const navigation = useNavigationMode();

// Route as GeoJSON for map
const navRouteGeoJSON = useMemo((): GeoJSON.FeatureCollection | null => {
  const coords = navigation.state.route?.coordinates;
  if (!coords || coords.length < 2) return null;
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }],
  };
}, [navigation.state.route]);

// DirectionsBanner — above MapView, below SearchBar
{navigation.state.isNavigating && (
  <DirectionsBanner
    step={navigation.state.route?.steps[navigation.state.currentStepIndex]}
    style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 }}
  />
)}

// NavigationBottomBar — rendered outside MapView
{navigation.state.isNavigating && (
  <NavigationBottomBar
    destinationName={navigation.state.destinationName}
    totalDistanceMi={navigation.state.route?.totalDistance ?? 0}
    totalDurationSec={navigation.state.route?.totalDuration ?? 0}
    onReportIncident={() => { /* wire to report mode */ }}
    onEnd={navigation.action.endNavigation}
    isDark={isDark}
    bottomInset={bottomTabBarHeight}
  />
)}

// Pass route to MapLayers
<MapLayers
  ...existingProps
  routeGeoJSON={navRouteGeoJSON}
/>
```

---

## 2. Constants to add (`constants.ts`)

```ts
export const UT_TOWER: [number, number] = [-97.7335, 30.2861];
```

---

## 3. Environment variable to add (`.env`)

```
EXPO_PUBLIC_ORS_API_KEY=your_openrouteservice_key_here
```

Sign up at https://openrouteservice.org/dev/#/signup — free tier includes 2,000 requests/day.

---

## 4. Implementation Order

1. **CSS Fixes**
   - Fix `tailwind.config.js` (`darkMode`)
   - Fix `SearchBar.tsx` (dynamic className → static + wrapper)
   - Fix `index.tsx` positioning (inline style for SearchBar/Dropdown)

2. **Infrastructure**
   - Add `EXPO_PUBLIC_ORS_API_KEY` to `.env`
   - Write `utils/openRouteService.ts`
   - Write `src/features/navigation/useNavigationMode.ts`
   - Add `UT_TOWER` to `constants.ts`

3. **UI Components**
   - Write `DirectionsBanner.tsx`
   - Write `NavigationBottomBar.tsx`

4. **Map integration**
   - Update `MapLayers.tsx` to accept and render `routeGeoJSON`

5. **Wiring**
   - Update `POIBottomSheet.tsx` — add `onStartNavigation` prop, wire "Go" button
   - Update `useMapScreenController.ts` — integrate `useNavigationMode`
   - Update `index.tsx` — render banners, pass route to map, update Camera

---

## 5. Voice Directions

### Library

Use `expo-speech` — ships with Expo, no API key, uses the device's native TTS engine (AVSpeechSynthesizer on iOS, Android TTS on Android).

Add to project:
```
npx expo install expo-speech
```

### When to speak

| Event | Utterance |
|---|---|
| Navigation starts | `"Starting navigation. {first step instruction}"` |
| Step index advances | `"{new step instruction}"` |
| Approaching end of step (< 30 m remaining) | `"In {distance}, {next step instruction}"` |
| Arrival | `"You have arrived at {destinationName}"` |
| Navigation ended by user | Stop any in-progress speech |

### Integration in `useNavigationMode`

```ts
import * as Speech from "expo-speech";

// Inside useNavigationMode, watch currentStepIndex:
useEffect(() => {
  const step = route?.steps[currentStepIndex];
  if (!step || !isNavigating) return;
  Speech.stop();
  Speech.speak(step.instruction, {
    language: "en-US",
    rate: 0.9,       // slightly slower than default for clarity
    pitch: 1.0,
  });
}, [currentStepIndex, isNavigating]);

// On navigation start, speak opening prompt:
function startNavigation(destination, name) {
  // ... fetch route ...
  Speech.speak(`Starting navigation to ${name}. ${firstStep.instruction}`);
}

// On end:
function endNavigation() {
  Speech.stop();
  // ... reset state ...
}

// On arrival:
useEffect(() => {
  if (hasArrived) {
    Speech.speak(`You have arrived at ${destinationName}`);
  }
}, [hasArrived]);
```

### Mute toggle

Add a mute button to `NavigationBottomBar` (speaker icon from phosphor-react-native):

```
[ ⚠ Report ]   [ 🔇 Mute ]   [ ✕ End ]
```

`isMuted` state lives in `useNavigationMode`. When `isMuted === true`, skip all `Speech.speak()` calls and call `Speech.stop()` immediately on toggle.

---

## 6. Implementation Order (updated)

1. **CSS Fixes**
   - Fix `tailwind.config.js` (`darkMode`)
   - Fix `SearchBar.tsx` (dynamic className → static + wrapper)
   - Fix `index.tsx` positioning (inline style for SearchBar/Dropdown)

2. **Infrastructure**
   - Add `EXPO_PUBLIC_ORS_API_KEY` to `.env`
   - `npx expo install expo-speech`
   - Write `utils/openRouteService.ts`
   - Write `src/features/navigation/useNavigationMode.ts` (includes speech logic)
   - Add `UT_TOWER` to `constants.ts`

3. **UI Components**
   - Write `DirectionsBanner.tsx`
   - Write `NavigationBottomBar.tsx` (includes mute button)

4. **Map integration**
   - Update `MapLayers.tsx` to accept and render `routeGeoJSON`

5. **Wiring**
   - Update `POIBottomSheet.tsx` — add `onStartNavigation` prop, wire "Go" button
   - Update `useMapScreenController.ts` — integrate `useNavigationMode`
   - Update `index.tsx` — render banners, pass route to map, update Camera

---

## 7. Out of Scope (future steps)

- Real GPS location (swap `UT_TOWER` placeholder for `expo-location`)
- Real-time step advancement as user moves
- Report Incident during navigation (next step per acceptance criteria)
- Rerouting if user goes off-path
