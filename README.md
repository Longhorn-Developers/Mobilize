# MobilizeUT 🤘

An Expo React Native mobile application that helps disabled students have more accessibility around UT Campus on an interactive map, powered by Expo and Cloudflare Workers.

## 🛠️ Setup

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
   EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiLi4uIn0...   # Mapbox public token (starts with pk.)
   EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIza...                # Google Places API (New) key
   EXPO_PUBLIC_OPENROUTE_KEY=...                            # OpenRouteService key (wheelchair routing)
   ```

   server/.env (you can find these in the Cloudflare dashboard)

   ```bash
   CLOUDFLARE_ACCOUNT_ID=
   CLOUDFLARE_DATABASE_ID=
   ```

5. **Mapbox native setup (first time or after adding @rnmapbox/maps)**

   Mapbox requires a **secret download token** (starts with `sk.`) during the native build step. This is different from the public access token above.

   Add it to `app.config.js` in the `@rnmapbox/maps` plugin config:
   ```js
   ["@rnmapbox/maps", { RNMAPBOX_MAPS_DOWNLOAD_TOKEN: "sk.eyJ1IjoiLi4uIn0..." }]
   ```
   Or add it to `~/.netrc` as described in the [Mapbox installation docs](https://docs.mapbox.com/android/maps/guides/install/).

   Then run a full native build (required after adding a native module):
   ```bash
   pnpm install --no-frozen-lockfile
   npx expo run:android   # or run:ios
   ```

5. **Google OAuth Configuration**

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
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation screens
│   ├── _layout.tsx        # Root layout
│   └── +not-found.tsx     # 404 page
├── components/            # Reusable React components
├── assets/                # Images, fonts, and other static assets
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions and custom hooks
├── server/                # Cloudflare Workers backend
│   ├── src/              # Server source code
│   ├── migrations/       # Database migrations
│   └── test/             # Server tests
├── android/               # Native Android project
├── ios/                   # Native iOS project
└── package.json          # Project dependencies
```

## 🚢 Deployment

### Deployment - Mobile App

**Build for iOS:**

```bash
expo build:ios
```

**Build for Android:**

```bash
expo build:android
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

- **Framework**: React Native with Expo SDK 54
- **Navigation**: Expo Router v6
- **Styling**: NativeWind (TailwindCSS for React Native)
- **Maps**: Mapbox (@rnmapbox/maps) — 3D terrain, dark/light styles, accessibility overlays
- **State Management**: TanStack Query (React Query)
- **UI Components**:
  - React Native Gesture Handler
  - React Native Reanimated
  - Gorhom Bottom Sheet
  - Phosphor React Native (Icons)
- **Geospatial**: Turf.js
- **Forms**: React Hook Form with Zod validation

### Backend

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Testing**: Vitest with Cloudflare Workers pool

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
