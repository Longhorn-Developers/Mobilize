# Mobilize 🚀

A student-built mobile app that uses crowdsourced data to guide users through the most accessible paths, entrances, bathrooms, and more at the University of Texas at Austin.

## Description

Students with mobility disabilities at UT face daily challenges with blocked paths, unsafe ramps, and inaccessible routes. Existing tools like Google Maps fall short, forcing students to leave 30+ minutes early for a 10-minute route.

Mobilize solves this problem by providing real-time, crowdsourced accessibility data to help students navigate campus through the most accessible routes possible.

## Tech Stack

- **Frontend**: React Native with Expo
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Navigation**: Expo Router
- **Queries**: TanStack Query
- **Backend**: Supabase
- **Language**: TypeScript
- **Development**: Node.js, Expo CLI

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **pnpm**: `npm install -g pnpm`
- **Expo CLI**: `npm install -g @expo/cli`
- **iOS Simulator** (for Mac users) or **Android Studio** (for Android development)
- [**Docker Desktop**](https://docs.docker.com/desktop/) (for local Supabase development)

### Recommended VS Code Extensions

- **ES7+ React/Redux/React-Native snippets**
- **Tailwind CSS IntelliSense**
- **TypeScript Importer**
- **Prettier - Code formatter**
- **ESLint**
- **Auto Rename Tag**
- **Bracket Pair Colorizer**

### Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Local Development Documentation](https://supabase.com/docs/guides/local-development)
- [Nativewind Documentation](https://www.nativewind.dev/)

### Installation & Setting Up Dev Environment

1. **Clone the repository**

   ```bash
   git clone https://github.com/Longhorn-Developers/Mobilize.git
   cd mobilize
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   Should usually be these by default if local supabase development:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
   ```

4. **Run on your preferred platform**
   > **Note:** Expo Go is no longer supported for this project due to the use of native modules (expo-maps). You must use a development build to run the app on a physical device or simulator.
   - **iOS**: `pnpm ios` or press `i` in the terminal after running `pnpm start`
   - **Android**: `pnpm android` or press `a` in the terminal after running `pnpm start`

---

#### Set Up Local Supabase Development

> **Note:** Make sure to install [Docker Desktop](https://docs.docker.com/desktop/) before doing the steps below.

1. **Install Supabase CLI**

   ```bash
   pnpm install -g supabase
   ```

2. **Initialize Supabase in your project**

   ```bash
   pnpm supabase init
   ```

3. **Start local Supabase services**

   ```bash
   pnpm supabase start
   ```

   You will see a message like this in the terminal:

   ```sh
   Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
        anon key: eyJh......
   service_role key: eyJh......
   ```

   The `API URL` and `anon key` are the environment variables you need to configure in the next step.

4. **Update your `.env.local` for local development**

   ```env
   EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
   ```

5. **Access local services**
   - **Studio**: <http://localhost:54323>
   - **API**: <http://localhost:54321>
   - **Auth**: <http://localhost:54321/auth/v1>

> Make sure to revert your .env.local file if switching back to the hosted Supabase project.

## Project Structure

```txt
mobilize/
├── app/                    # App screens and routing (Expo Router)
│   ├── (tabs)/            # Layout for tab navigation
│   │   ├── _layout.tsx    # Defines the tab navigator
│   │   └── index.tsx      # Main map screen
│   ├── _layout.tsx        # Root layout for the app
│   ├── +html.tsx          # Custom HTML for web builds
│   └── +not-found.tsx     # Fallback for unmatched routes
├── assets/                 # Static assets (images, fonts, etc.)
├── components/             # Reusable UI components
├── docs/                   # Project documentation and guides
├── hooks/                  # Custom React hooks
├── supabase/               # Supabase configuration, migrations, and functions
├── types/                  # TypeScript type definitions
├── utils/                  # Utility functions (e.g., Supabase client)
├── .env.local              # Local environment variables (untracked)
├── app.json                # Expo configuration file
├── babel.config.js         # Babel compiler configuration
├── package.json            # Project dependencies and scripts
├── tailwind.config.js      # Tailwind CSS configuration
└── tsconfig.json           # TypeScript configuration
```

## Contributing

We welcome contributions from developers, designers, and anyone passionate about accessibility! Here's how you can help:

### Getting Started as a Contributor

1. **Fork the repository** and create your feature branch

   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Follow the coding standards**
   - Use TypeScript for all new code
   - Follow the existing code style and conventions
   - Use meaningful component and function names
   - Add proper comments for complex logic

3. **Run linting and formatting**

   ```bash
   pnpm lint    # Check for issues
   pnpm format  # Auto-fix formatting issues
   ```

4. **Test your changes**
   - Test on both iOS and Android if possible
   - Ensure accessibility features work correctly
   - Test with different screen sizes

5. **Commit your changes**

   ```bash
   git commit -m 'Add some amazing feature'
   ```

6. **Push to your branch and create a Pull Request**

### Code Style Guidelines

- Use **functional components** with hooks
- Implement **TypeScript interfaces** for all props and data structures
- Follow **NativeWind/Tailwind** conventions for styling
- Keep components **small and focused** on single responsibilities
- Use **descriptive variable names** and add comments for complex logic

### Reporting Issues

If you find a bug or have a feature request, please create an issue on GitHub with:

- Clear description of the problem or feature
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Screenshots or screen recordings if applicable

---

**Join us in making UT campus more accessible for everyone!** 🤝

For questions or to get involved, reach out to the Longhorn Developers team or create an issue on this repository.
