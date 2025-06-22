# Mobilize 🚀

A student-built mobile app that uses crowdsourced data to guide users through the most accessible paths, entrances, bathrooms, and more at the University of Texas at Austin.

## Description

Students with mobility disabilities at UT face daily challenges with blocked paths, unsafe ramps, and inaccessible routes. Existing tools like Google Maps fall short, forcing students to leave 30+ minutes early for a 10-minute route.

Mobilize solves this problem by providing real-time, crowdsourced accessibility data to help students navigate campus through the most accessible routes possible.

## Tech Stack

- **Frontend**: React Native with Expo
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Navigation**: Expo Router
- **State Management**: Zustand
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
   git clone https://github.com/your-org/mobilize.git
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

4. **Start the development server**

   ```bash
   pnpm start
   ```

5. **Run on your preferred platform**
   - **iOS**: `npm run ios` or press `i` in the terminal
   - **Android**: `pnpm run android` or press `a` in the terminal

---

#### Optional: Set Up Local Supabase Development

> **Note:** You only need this if you want to run Supabase locally instead of using the hosted project. Make sure to install [Docker Desktop](https://docs.docker.com/desktop/) before doing the steps below.

1. **Install Supabase CLI**

   ```bash
   npm install -g supabase
   ```

2. **Initialize Supabase in your project**

   ```bash
   supabase init
   ```

3. **Start local Supabase services**

   ```bash
   supabase start
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


5. **Update your `.env.local` for local development**

   ```env
   EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
   ```
   
6. **Access local services**

   - **Studio**: <http://localhost:54323>
   - **API**: <http://localhost:54321>
   - **Auth**: <http://localhost:54321/auth/v1>



> Make sure to revert your .env.local file if switching back to the hosted Supabase project.

## Project Structure

```
mobilize/
├── app/                    # App screens (Expo Router)
│   ├── _layout.tsx        # Root layout
│   ├── index.tsx          # Home screen
├── components/            # Reusable UI components
├── store/                 # State management (Zustand)
│   └── store.ts          # Global state store
├── utils/                 # Utility functions
│   └── supabase.ts       # Supabase client configuration
├── assets/               # Static assets (images, icons)
├── global.css           # Global styles
├── tailwind.config.js   # Tailwind CSS configuration
├── tsconfig.json        # TypeScript configuration
├── package.json         # Dependencies and scripts
└── app.json            # Expo configuration
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
   pnpm run lint    # Check for issues
   pnpm run format  # Auto-fix formatting issues
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
