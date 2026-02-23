# MobilizeUT 🤘

An Expo React Native mobile application that helps students with disabilities find accessible routes on UT Campus on an interactive map, powered by Expo and Cloudflare Workers.

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

3. **Install server dependencies**

   ```bash
   cd server
   pnpm install
   ```

4. **Setup environment variables**

   .env.local

   ```bash
   EXPO_PUBLIC_API_URL=http://localhost:54321
   ```

   server/.env (you can find these in cloudflare dashboard)

   ```bash
   CLOUDFLARE_ACCOUNT_ID=
   CLOUDFLARE_DATABASE_ID=
   ```

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

**Apply database migrations:**

```bash
cd server
pnpm migrate
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

- **App Configuration**: `app.json`
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
- **Maps**: Expo Maps (Apple Maps for iOS, Google Maps for Android)
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

- Node.js (v18 or higher recommended)
- pnpm (package manager)
- Expo CLI
- iOS Simulator (for iOS development) or Android Studio (for Android development)
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
