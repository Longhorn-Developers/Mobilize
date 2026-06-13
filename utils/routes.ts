/** Typed route constants. Use these instead of raw string literals to catch renames at compile time. */
export const APP_ROUTES = {
  ROOT: "/" as const,
  WELCOME: "/welcome" as const,
  TABS: "/(tabs)" as const,
  TABS_PROFILE: "/(tabs)/profile" as const,
  AUTH_GOOGLE_OAUTH: "/auth/google-oauth" as const,
  AUTH_CALLBACK: "/auth/callback" as const,
  AUTH_UT_EID_COMING_SOON: "/auth/ut-eid-coming-soon" as const,
  AUTH_PROFILE_SETUP: "/auth/profile-setup" as const,
  AUTH_MOBILITY_PREFERENCES: "/auth/mobility-preferences" as const,
  AUTH_LOGIN: "/auth/login" as const,
  AUTH_SIGNUP: "/auth/signup" as const,
} as const;

export type AppRoute = (typeof APP_ROUTES)[keyof typeof APP_ROUTES];

type RedirectDecisionInput = {
  isAuthenticated: boolean;
  onboardingComplete: boolean;
  segments: readonly string[];
};

const ONBOARDING_SCREENS = new Set(["profile-setup", "mobility-preferences"]);

/**
 * Determines whether the current route requires a redirect based on auth state.
 *
 * Returns the target route to navigate to, or `null` if no redirect is needed.
 *
 * Three-state machine:
 *  1. Not authenticated  → redirect to WELCOME (from root, tabs, or onboarding screens)
 *  2. Authenticated, onboarding incomplete → redirect to PROFILE_SETUP
 *  3. Authenticated + onboarding complete → redirect to TABS (from root, welcome, auth)
 *
 * The OAuth callback screen (`/auth/callback`) is always allowed through so it can
 * consume the token before any further navigation occurs.
 */
export function getAuthRedirectTarget({
  isAuthenticated,
  onboardingComplete,
  segments,
}: RedirectDecisionInput): AppRoute | null {
  const rootSegment = segments[0] ?? "";
  const childSegment = segments[1] ?? "";

  const isRootIndex = rootSegment === "" || rootSegment === "index";
  const isAuthGroup = rootSegment === "auth";
  const isTabsGroup = rootSegment === "(tabs)";
  const isWelcome = rootSegment === "welcome";
  const isCallback = isAuthGroup && childSegment === "callback";
  const isOnboardingScreen =
    isAuthGroup && ONBOARDING_SCREENS.has(childSegment);

  if (!isAuthenticated) {
    if (isRootIndex || isTabsGroup || isOnboardingScreen) {
      return APP_ROUTES.WELCOME;
    }
    return null;
  }

  // Let callback finish token/error consumption deterministically.
  if (isCallback) {
    return null;
  }

  if (!onboardingComplete) {
    if (isRootIndex || isTabsGroup || isWelcome || (isAuthGroup && !isOnboardingScreen)) {
      return APP_ROUTES.AUTH_PROFILE_SETUP;
    }
    return null;
  }

  if (isRootIndex || isWelcome || isAuthGroup) {
    return APP_ROUTES.TABS;
  }

  return null;
}

