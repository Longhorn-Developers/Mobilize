# MobilizeUT 🤘

An Expo React Native mobile application that helps disabled students have more accessibility around UT Campus on an interactive map, powered by Expo and Cloudflare Workers.

## Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/Longhorn-Developers/Mobilize.git
   cd Mobilize
   ```

2. **Install mobile app dependencies**

   ```bash
   pnpm install
   ```

   2.1 **Setup subdependency for gradle (android)**
      ```javascript
      // in ./android/build.gradle
      ...
      allprojects {
         repositories {
            /* Add these 3 lines below \/\/\/ */
            maven {
               url "$rootDir/../node_modules/expo-camera/android/maven"
            }
            
         }
      }
      ...
      ```

3. **Install server dependencies**

   ```bash
   cd server
   pnpm install
   ```

4. **Setup environment variables**

   Create a `.env` file at the repo root:

   ```bash
   EXPO_PUBLIC_API_URL=http://localhost:54321
   EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=...   # Mapbox public token (starts with pk.)
   EXPO_PUBLIC_OPENROUTE_KEY=...         # OpenRouteService key (wheelchair routing)
   ```

   > **Note:** Google Places API requests are proxied through the backend Worker — no client-side key is needed. Configure `GOOGLE_PLACES_API_KEY` as a Cloudflare Worker secret instead (see Cloudflare dashboard > Workers > your worker > Settings > Variables).

   server/.env (you can find these in the Cloudflare dashboard)

   ```bash
   CLOUDFLARE_ACCOUNT_ID=
   CLOUDFLARE_DATABASE_ID=
   ```

6. **Mapbox native setup (first time or after adding @rnmapbox/maps)**

   Mapbox requires a **secret download token** (starts with `sk.`) during the native build step. This is different from the public access token above.

   Add it to `app.config.js` in the `@rnmapbox/maps` plugin config:
   ```js
   ["@rnmapbox/maps", { RNMAPBOX_MAPS_DOWNLOAD_TOKEN: "sk..." }]
   ```
   Or add it to `~/.netrc` as described in the [Mapbox installation docs](https://docs.mapbox.com/android/maps/guides/install/).

   Then run a full native build (required after adding a native module):
   ```bash
   pnpm install --no-frozen-lockfile
   npx expo run:android   # or run:ios
   ```

7. **Google OAuth Configuration**

   Google OAuth requires configuration in **two places**: the mobile app (`.env`) and the backend server (`server/.env`).

   ### Files to Configure

   **`.env` (root directory - Mobile App)**
   ```bash
   # Web Client ID - used by the mobile app for Google Sign-In
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   ```

   **`server/.env` (Backend Server)**
   ```bash
   # Same Web Client ID as above - used to verify ID tokens
   GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com

   # Client Secret from Google Cloud Console (Web Client)
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

   # Secret for signing sessions (generate a random 64-char hex string)
   BETTER_AUTH_SECRET=your-random-64-character-hex-secret

   # Your backend URL
   BETTER_AUTH_URL=http://localhost:54321
   ```

   ### Getting Google OAuth Credentials

   1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   2. Create a new project or select an existing one
   3. Navigate to **APIs & Services > Credentials**
   4. Click **Create Credentials > OAuth 2.0 Client ID**
   5. Select **Web application** as the application type
   6. Add authorized redirect URIs (e.g., `http://localhost:54321/api/auth/callback/google`)
   7. Copy the **Client ID** and **Client Secret**

   ### Android Emulator with VS Code Port Tunneling
   (Prevent Google OAuth error on Android Emulator)
   Android Emulator runs in an isolated network. While `10.0.2.2` maps to your host's localhost, Google OAuth callbacks need a publicly accessible URL. VS Code's built-in port forwarding creates a secure tunnel to your local server.

   **How to Set Up VS Code Port Forwarding:**

   1. Start your backend server locally:
      ```bash
      cd server
      pnpm dev
      ```

   2. In VS Code, open the **Ports** panel (View > Terminal, then click the "Ports" tab next to Terminal)

   3. Click **Forward a Port** and enter `54321` (your backend server port)

   4. VS Code will create a tunnel URL like `https://w5w3c6hf-54321.usw3.devtunnels.ms`

   5. Right-click the forwarded port and set **Port Visibility** to **Public** (required for OAuth callbacks)

   6. Copy the tunnel URL for the next steps

   **Configure Google Cloud Console:**

   1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), edit your Web OAuth Client
   2. Add to **Authorized JavaScript origins**:
      ```
      https://w5w3c6hf-54321.usw3.devtunnels.ms
      ```
   3. Add to **Authorized redirect URIs**:
      ```
      https://w5w3c6hf-54321.usw3.devtunnels.ms/api/auth/callback/google
      ```

   **Update Environment Files:**

   **`.env` (Mobile App)**
   ```bash
   EXPO_PUBLIC_API_URL=https://w5w3c6hf-54321.usw3.devtunnels.ms
   ```

   **`server/.env` (Backend)**
   ```bash
   BETTER_AUTH_URL=https://w5w3c6hf-54321.usw3.devtunnels.ms
   ```

   **Note:** The tunnel URL changes sometimes, so if it changes, you'll need to update Google Cloud Console and your env files. 

## 🏃‍♂️ Running the App

### Development - Mobile App

**Run on iOS:**

```bash
pnpm ios
```

**Run on Android:**

```bash
pnpm android
```

### Development - Backend Server

**Start local development server:**

```bash
cd server
pnpm dev
```

**Generate database migrations (from updated server/src/db/schema.ts):**

```bash
cd server
pnpm gen
```

**Apply database migrations (remote D1):**

```bash
cd server
pnpm migrate
```

**Apply database migrations (local D1 used by `wrangler dev`):**

```bash
cd server
pnpm migrate:local
```

> Shortcut from the repo root (no `cd` needed): `pnpm migrate:server:local` / `pnpm migrate:server:remote`

**Regenerate types:**

```bash
cd server
pnpm types
```

**Seed the database with test profiles, avoidance_areas, and POIs:**

```bash
cd server
pnpm seed
```

## 🔧 Development

### Code Quality

**Lint code:**

```bash
pnpm lint
```

**Format code:**

```bash
pnpm format
```

### Building

**Prebuild native projects:**

```bash
pnpm prebuild
```

This generates native iOS and Android projects from your Expo configuration.

## 📁 Project Structure

```text
.
├── app/                         # Expo Router screens (file = route)
│   ├── (tabs)/                 # Bottom-tab screens: map, profile
│   │   └── index.tsx           # Main map screen (~1 400 lines)
│   ├── auth/                   # Auth flow: signup, OAuth callback, profile setup, mobility prefs
│   ├── profile/                # Public profile screen (/profile/[username])
│   ├── _layout.tsx             # Root layout with AuthProvider + QueryProvider
│   └── +not-found.tsx          # 404 fallback
├── components/                  # Reusable React Native components
│   └── *BottomSheet.tsx        # Map detail sheets (POI, building, avoidance area, etc.)
├── assets/
│   └── geojson/                # Campus GeoJSON layers (buildings, curb ramps, crosswalks)
├── types/
│   ├── database.ts             # Drizzle-inferred + UI-ready types for all DB models
│   └── geo.ts                  # Shared GeoJSON / coordinate interfaces
├── utils/
│   ├── api-client.ts           # ApiClient class — all HTTP calls to the backend
│   ├── api-hooks.ts            # TanStack Query hooks wrapping ApiClient
│   ├── api-base.ts             # Shared API base URL resolution + active URL promotion
│   ├── useAuth.ts              # AuthProvider context + Google OAuth flow
│   ├── buildingDatabase.ts     # In-memory building lookup from buildings_simple.json
│   ├── googlePlaces.ts         # Google Places autocomplete/details proxy client
│   ├── request-utils.ts        # fetchWithTimeout, parseJsonResponse, ClientRequestError
│   ├── routes.ts               # APP_ROUTES constants + auth redirect logic
│   ├── ThemeContext.tsx         # Dark/light mode context
│   └── useMapIcons.ts          # Map icon asset registry (not a hook)
├── server/
│   ├── src/
│   │   ├── index.ts            # All 26 Hono route handlers
│   │   ├── auth.ts             # Better Auth configuration
│   │   ├── db/schema.ts        # Drizzle ORM table definitions
│   │   └── scheduled/poi-sync.ts  # Cron job: KML → POI upsert
│   ├── migrations/             # SQL migration files (apply with pnpm migrate)
│   └── test/                   # Vitest integration tests
├── android/                     # Native Android project (generated by Expo prebuild)
├── ios/                         # Native iOS project (generated by Expo prebuild)
└── package.json
```

## 🚢 Deployment

### Deployment - Mobile App

Expo Classic Build (`expo build:*`) is deprecated. Use [EAS Build](https://docs.expo.dev/build/introduction/) instead:

**Build for iOS:**

```bash
eas build --platform ios
```

**Build for Android:**

```bash
eas build --platform android
```

### Deployment - Backend

**Deploy to Cloudflare:**

```bash
cd server
pnpm deploy
```

## 🔑 Configuration

- **App Configuration**: `app.config.js`
- **TypeScript**: `tsconfig.json`
- **Tailwind**: `tailwind.config.js`
- **ESLint**: `eslint.config.js`
- **Prettier**: `prettier.config.js`
- **Server**: `server/wrangler.jsonc`
- **Database**: `server/drizzle.config.ts`

## 🚀 Tech Stack

### Mobile App

- **Framework**: React Native with Expo SDK 54 — managed workflow, EAS Build for CI
- **Navigation**: Expo Router v6 — file-based routing, deep linking, tab groups
- **Styling**: NativeWind (TailwindCSS for React Native), dark mode via `ThemeContext`
- **Maps**: Mapbox (`@rnmapbox/maps`) — 3D terrain, dark/light styles, campus GeoJSON accessibility overlays (POIs, avoidance areas, construction zones)
- **Server state**: TanStack Query v5 — query keys in `utils/api-hooks.ts`, client in `utils/api-client.ts`
- **Local state**: Zustand for lightweight ephemeral UI state
- **Auth**: Google OAuth via `expo-web-browser`; session tokens stored in AsyncStorage; provider in `utils/useAuth.ts`; backend token validation via Better Auth
- **Forms**: React Hook Form + Zod validation
- **UI Components**:
  - Gorhom Bottom Sheet — all map detail sheets
  - React Native Gesture Handler + Reanimated — animation infrastructure
  - Phosphor React Native — icon library
- **Geospatial**: Turf.js for point-in-polygon and distance calculations
- **Local building data**: `utils/buildingDatabase.ts` — in-memory index from `assets/geojson/buildings_simple.json`, zero runtime cost

### Backend

- **Runtime**: Cloudflare Workers (edge, V8 isolates)
- **Framework**: Hono — lightweight, typed router; all routes in `server/src/index.ts`
- **Database**: Cloudflare D1 (SQLite at the edge)
- **ORM**: Drizzle ORM — schema in `server/src/db/schema.ts`, migrations in `server/migrations/`
- **Auth**: Better Auth (`server/src/auth.ts`) — Google OAuth only; session tokens validated per-request via Bearer header
- **Scheduled jobs**: Cloudflare Cron Triggers — `syncPOIs()` in `server/src/scheduled/poi-sync.ts` upserts accessible entrance POIs from a KML source on a schedule
- **Proxies**: Google Places autocomplete + details proxied through the worker (keeps API key server-side); ArcGIS construction zones fetched and cached 1 min
- **Testing**: Vitest with Cloudflare Workers pool (`server/test/`)

## 📋 Prerequisites

- Node.js v20+ (required by Expo SDK 54)
- pnpm 10+ (`npm install -g pnpm`)
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android) or Xcode (for iOS)
- A **Mapbox account** with a public token (`pk.`) and a secret download token (`sk.`)
- A **Google Places API (New)** key with Places API enabled
- An **OpenRouteService** key for wheelchair routing
- Cloudflare account (for backend deployment)

## 🤝 Contributing

1. Create a feature branch i.e. `astrol99/feat-thing`
2. Make your changes
3. Run linting and formatting: `pnpm format`
4. Submit a pull request

## 👥 Authors

Longhorn Developers

---

Built with ❤️ using Expo and Cloudflare Workers
