# App Startup Troubleshoot Plan

**Date diagnosed:** 2026-06-26  
**Branch:** `pr67-merge`  
**Triage result:** Bundle completes (exit 0, 5231 modules, ~73s). The failures are in the dependency install layer and the NativeWind CSS interop version, not in application code.

---

## What works

| Check | Result |
|---|---|
| `expo export --platform android` | Exit 0 — bundle is valid |
| `tsc --noEmit` | Exit 0 — no type errors |
| `pnpm list` | All packages declared |
| `global.css` | Correct `@tailwind` directives |
| `babel.config.js` | Correct NativeWind v4 preset order |
| `metro.config.js` | `withNativeWind` wired to `global.css` |
| `tailwind.config.js` | Uses `nativewind/preset` correctly |

---

## Root Causes (ordered by severity)

### 1. CRITICAL — `pnpm install` fails on every run

**Error seen:**
```
ERR_PNPM_ENOENT  ENOENT: no such file or directory,
  scandir 'C:\Mobilize - Copy\node_modules\nativewind_tmp_45640\node_modules'
Packages: +5 -153
```

**Why this happens:**  
pnpm on Windows creates a short-lived temp directory (e.g. `nativewind_tmp_45640`) when linking packages that require a staging area. If a prior install was interrupted (Ctrl+C, crash, antivirus block), the temp name is recorded internally but the directory is gone. Every subsequent install attempts to scan it and dies. The `+5 -153` package delta proves the installed state is out of sync with the lock file — meaning `node_modules` is in an inconsistent state.

**Impact:** Node_modules is partially broken. Some packages present in the lock file may not be correctly installed or symlinked.

---

### 2. CRITICAL — `react-native-css-interop` version mismatch

| | Version |
|---|---|
| Installed (root `package.json`) | `^0.2.3` → resolves to `0.2.3` |
| Required by `nativewind@4.2.5` | `0.2.5` (exact) |

**Evidence:** `node_modules/nativewind/package.json` declares `"react-native-css-interop": "0.2.5"` as its own dependency, but the root project pins `^0.2.3`, so pnpm installs the older one and nativewind's own copy may be shadowed or absent.

**Impact:** NativeWind's runtime CSS transformer (`react-native-css-interop`) processes `className` props into React Native style objects. With a mismatched version, this transform can fail silently (styles disappear) or throw at startup. This is the most likely cause of a white/broken screen even though the bundle succeeds.

---

### 3. HIGH — `expo-speech@56.0.3` is a nonexistent/corrupted install

**Evidence:**
- `node_modules/expo-speech/` contains only native build artifacts (`android/`, `ios/`, `build/`, `local-maven-repo/`, `src/`) with **no `package.json`** and no JavaScript source.
- Version `56.0.3` does not exist on npm for `expo-speech`. Expo SDK 54 compatible version is `~13.x`.

**Why this doesn't crash the app:** `useNavigationMode.ts` wraps the require in a try/catch and falls back to no-op stubs, so voice navigation silently disables itself.

**Why it's still a problem:** The corrupted directory confuses pnpm's module resolution and contributes to the install failure loop. It should be treated as a blocked dependency.

---

### 4. HIGH — `nativewind: "latest"` is unpinned

**Location:** `package.json`

Using `latest` means every fresh `pnpm install` (CI, new dev machine, after cache clear) can pull a new major/minor version of nativewind. If nativewind releases a breaking version, the app breaks silently on next install — with no diff in `package.json` to blame.

---

### 5. MEDIUM — Port 8081 conflict (intermittent)

**Evidence:** Earlier `expo start` output: `Port 8081 is being used by another process`. In non-interactive mode, expo silently skips starting the server. This resolved itself (port is now free), but a previous zombie Metro or Node process will reproduce it.

---

### 6. LOW — `@typescript-eslint/parser` peer dep mismatch

| | Version |
|---|---|
| Installed | `8.46.3` |
| Required by `eslint-config-expo@10.0.0` | `^8.58.0` |

**Impact:** ESLint may not enforce all rules correctly. Doesn't affect bundling or runtime.

---

## Fix Steps

### Step 1 — Fix `package.json` version declarations

Change these three lines:

```diff
- "nativewind": "latest",
+ "nativewind": "^4.2.5",

- "react-native-css-interop": "^0.2.3",
+ "react-native-css-interop": "^0.2.5",

- "expo-speech": "^56.0.3",
+ "expo-speech": "~13.0.1",
```

> **Note on expo-speech version:** Run `npx expo install expo-speech` after the clean reinstall — Expo's install command auto-selects the SDK-compatible version and may correct this to a different patch.

Fix the TypeScript eslint peer dep while here:

```diff
- "@typescript-eslint/parser": "8.46.3",
+ "@typescript-eslint/parser": "^8.58.0",
```

---

### Step 2 — Clean node_modules and caches

```powershell
# Kill any Metro/Node processes on port 8081/8082 first
netstat -ano | findstr ":808" # note the PIDs
# taskkill /F /PID <pid>

# Remove inconsistent node_modules and Expo cache
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force .expo

# Prune the pnpm store of any stale entries (clears the tmp dir reference)
pnpm store prune
```

---

### Step 3 — Fresh install

```powershell
pnpm install
```

Expected output: `Packages: +NNN` with **no `-` removals** and **exit 0**.  
If it still fails with the `nativewind_tmp_*` error, run:

```powershell
# Nuclear option: delete the entire pnpm store and reinstall
pnpm store path          # note the path
Remove-Item -Recurse -Force <store-path>
pnpm install
```

---

### Step 4 — Install correct expo-speech

```powershell
npx expo install expo-speech
```

This uses Expo's version resolver, which checks the SDK version in `app.config.js` and selects a compatible version.

---

### Step 5 — Start the app

```powershell
pnpm start
# or if 8081 is still occupied:
pnpm start -- --port 8082
```

Watch the Metro output carefully. NativeWind CSS processing issues will appear as warnings like:
```
warn  Could not process CSS: ...
```

---

## Verification Checklist

- [ ] `pnpm install` exits 0 with no error lines
- [ ] `node_modules/expo-speech/package.json` exists and has a valid version
- [ ] `node_modules/react-native-css-interop/package.json` shows `0.2.5`
- [ ] `expo start` claims a port without hanging on user input
- [ ] App loads on device/simulator (no red error overlay, no white screen)
- [ ] Tailwind `className` props render correctly (check `SearchBar` in map view)
- [ ] Tapping a POI and pressing **Go** doesn't crash the app
- [ ] `tsc --noEmit` still exits 0

---

## If the app still fails after the above

Check these secondary suspects in order:

1. **`.env.local` missing keys** — `index.tsx:50` throws if `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` is empty:
   ```ts
   if (!mapboxToken) throw new Error("Missing EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in .env");
   ```
   Verify `.env.local` has all keys listed in the `env: export ...` line from the Metro startup log.

2. **`types/colors.ts` in tailwind.config.js** — `tailwind.config.js` does a Node.js `require("./types/colors")` on a TypeScript file. NativeWind v4 processes CSS inside Metro's transform pipeline (so Babel/TS transforms apply), but if tailwind runs outside Metro for any reason (e.g. PostCSS standalone), it can't read `.ts` without `ts-node`. Fix: add a `types/colors.js` CJS re-export, or move colors to a `.js` file.

3. **React 19 + React Native 0.81 compatibility** — this is a very new pairing. If native modules haven't been updated for React 19 peer deps, there can be runtime issues. Check the Expo SDK 54 + React 19 compatibility notes.

4. **`@rnmapbox/maps` native build** — Mapbox requires a native build (`expo run:android` / `expo run:ios`), not just Expo Go. If the app is being tested in Expo Go, it will crash on the Mapbox import. This project must be run via the dev client or a full native build.

---

## Files changed in this session that are relevant

| File | Status | Concern |
|---|---|---|
| `package.json` | Modified | Contains the three bad version pins above |
| `pnpm-lock.yaml` | Modified | Out of sync with node_modules due to failed install |
| `src/features/components/POIBottomSheet.tsx` | Modified | Imports `openRouteService` — new dep, should bundle fine |
| `src/features/components/SearchBar.tsx` | Modified | Now uses StyleSheet instead of className — safe |
| `src/features/map/rendering/ReportOverlay.tsx` | Modified | Uses `className` on `ReportModal` — depends on NativeWind working |
| `src/features/navigation/useNavigationMode.ts` | New | Dynamic `require('expo-speech')` with fallback — safe |
| `src/features/components/DirectionsBanner.tsx` | New | Pure StyleSheet — no NativeWind dependency |
| `src/features/components/NavigationBottomBar.tsx` | New | Pure StyleSheet — no NativeWind dependency |
| `utils/openRouteService.ts` | New | Runtime-only (network calls) — won't affect bundling |
