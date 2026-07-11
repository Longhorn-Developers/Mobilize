/** Authentication context and provider. Manages session token lifecycle in AsyncStorage, Google OAuth flow via expo-web-browser, and exposes auth state to all screens. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  ReactNode,
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getApiBaseCandidates,
  promoteApiBaseUrl,
  resolveApiBaseUrl,
} from "~/utils/api-base";
import {
  ClientRequestError,
  DEFAULT_REQUEST_TIMEOUT_MS,
  fetchWithTimeout,
  isLikelyNetworkError,
  isRetriableCandidateError,
  parseJsonResponse,
} from "~/utils/request-utils";

WebBrowser.maybeCompleteAuthSession();

const CONFIGURED_API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");
export const SESSION_TOKEN_KEY = "auth_session_token";
export const USER_KEY = "auth_user";
export const ONBOARDING_KEY = "auth_onboarding_complete";

function getOAuthBaseUrl() {
  if (!CONFIGURED_API_URL) {
    throw new Error("EXPO_PUBLIC_API_URL must be set to your devtunnels URL for Google sign-in.");
  }
  const normalizedConfigured = CONFIGURED_API_URL.toLowerCase();
  if (normalizedConfigured.startsWith("http://localhost") || normalizedConfigured.startsWith("http://127.0.0.1")) {
    throw new Error("EXPO_PUBLIC_API_URL must be a devtunnels HTTPS URL for Google sign-in, not localhost.");
  }
  return CONFIGURED_API_URL;
}


function parseCachedUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function normalizeCallbackValue(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Extracts the session token and any error from a Google OAuth callback.
 *
 * Accepts two formats:
 *   1. A deep-link URL string (e.g. "mobilize://auth/callback?session_token=...")
 *   2. A plain object with `session_token`, `token`, and `error` fields
 *
 * The `signature` field is a stable string used to deduplicate re-renders.
 */
function parseOAuthCallbackInput(input: OAuthCallbackInput): {
  token: string | null;
  error: string | null;
  signature: string;
} {
  if (typeof input === "string") {
    const raw = input.trim();
    try {
      const url = new URL(raw);
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const token = normalizeCallbackValue(
        url.searchParams.get("session_token") ||
          url.searchParams.get("token") ||
          hashParams.get("session_token") ||
          hashParams.get("token"),
      );
      const error = normalizeCallbackValue(
        url.searchParams.get("error") || hashParams.get("error"),
      );
      return { token, error, signature: url.toString() };
    } catch {
      return {
        token: null,
        error: "Invalid OAuth callback URL.",
        signature: raw || "invalid-oauth-callback-url",
      };
    }
  }

  const token = normalizeCallbackValue(input.session_token || input.token);
  const error = normalizeCallbackValue(input.error);
  return {
    token,
    error,
    signature: `token:${token ?? ""}|error:${error ?? ""}`,
  };
}

export type User = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  username: string | null;
  role: string;
  emailVerified: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type AuthState = {
  user: User | null;
  profile: any | null;
  onboardingComplete: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
};

type GoogleSignInResult = {
  success: boolean;
  error?: string;
  callbackUrl?: string;
  cancelled?: boolean;
};

type OAuthCallbackInput =
  | string
  | {
      session_token?: string | null;
      token?: string | null;
      error?: string | null;
    };

type OAuthCallbackResult = {
  success: boolean;
  error?: string;
  onboardingComplete?: boolean;
};

type AuthContextType = AuthState & {
  signInWithGoogle: () => Promise<GoogleSignInResult>;
  completeGoogleOAuthCallback: (input: OAuthCallbackInput) => Promise<OAuthCallbackResult>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Fetches /api/me using the provided session token.
 * Tries each URL candidate in order (active URL first), promoting whichever responds.
 * Returns null if all candidates return 401 or fail with network errors.
 */
async function fetchMe(sessionToken: string) {
  let lastError: unknown = null;
  const candidates = getApiBaseCandidates();

  for (let index = 0; index < candidates.length; index += 1) {
    const baseUrl = candidates[index];
    const requestUrl = `${baseUrl}/api/me`;
    try {
      const response = await fetchWithTimeout(
        requestUrl,
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
        DEFAULT_REQUEST_TIMEOUT_MS,
      );

      const data = await parseJsonResponse<any>(response, requestUrl);
      const hasNextCandidate = index < candidates.length - 1;

      if (response.status === 401) {
        if (hasNextCandidate) {
          continue;
        }
        return null;
      }

      // Reachable JSON endpoint: promote candidate.
      promoteApiBaseUrl(baseUrl);
      if (!response.ok) {
        const message = data?.error?.message || data?.message || "Failed to refresh session";
        throw new ClientRequestError(
          "API_ERROR",
          `Failed to refresh session (${response.status}): ${message}`,
          { status: response.status, url: requestUrl, details: data },
        );
      }

      if (!data?.user) {
        return null;
      }

      return {
        user: data.user as User,
        profile: data.profile ?? null,
        onboardingComplete: Boolean(data.onboardingComplete),
      };
    } catch (error) {
      lastError = error;
      if (!isRetriableCandidateError(error)) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not reach a valid API endpoint for session refresh");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const refreshSessionInFlightRef = useRef<Promise<void> | null>(null);
  const oauthCompletionInFlightRef = useRef<{
    signature: string;
    promise: Promise<OAuthCallbackResult>;
  } | null>(null);
  const lastCompletedOAuthSignatureRef = useRef<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    onboardingComplete: false,
    isLoading: true,
    isAuthenticated: false,
  });

  const clearSession = useCallback(async () => {
    await AsyncStorage.multiRemove([SESSION_TOKEN_KEY, USER_KEY, ONBOARDING_KEY]);
    setAuthState({
      user: null,
      profile: null,
      onboardingComplete: false,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const applyAuthState = useCallback((me: { user: User; profile: any | null; onboardingComplete: boolean }) => {
    setAuthState({
      user: me.user,
      profile: me.profile,
      onboardingComplete: me.onboardingComplete,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const refreshSession = useCallback(async (opts?: { silent?: boolean }) => {
    if (refreshSessionInFlightRef.current) {
      return refreshSessionInFlightRef.current;
    }

    const run = (async () => {
      if (!opts?.silent) {
        setAuthState((prev) => ({ ...prev, isLoading: true }));
      }
      try {
        const sessionToken = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
        if (!sessionToken) {
          await clearSession();
          return;
        }

        const me = await fetchMe(sessionToken);
        if (!me) {
          await clearSession();
          return;
        }

        await Promise.all([
          AsyncStorage.setItem(USER_KEY, JSON.stringify(me.user)),
          AsyncStorage.setItem(ONBOARDING_KEY, me.onboardingComplete ? "1" : "0"),
        ]);
        applyAuthState(me);
      } catch (error) {
        console.error("Error refreshing session:", error);
        if (isLikelyNetworkError(error)) {
          const cachedUser = parseCachedUser(await AsyncStorage.getItem(USER_KEY));
          if (cachedUser) {
            setAuthState((prev) => ({
              ...prev,
              user: cachedUser,
              isAuthenticated: true,
              isLoading: false,
            }));
            return;
          }
        }
        await clearSession();
      } finally {
        refreshSessionInFlightRef.current = null;
      }
    })();

    refreshSessionInFlightRef.current = run;
    return run;
  }, [applyAuthState, clearSession]);

  useEffect(() => {
    const bootstrap = async () => {
      const [sessionToken, rawCachedUser, rawOnboarding] = await Promise.all([
        AsyncStorage.getItem(SESSION_TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
        AsyncStorage.getItem(ONBOARDING_KEY),
      ]);

      if (!sessionToken) {
        setAuthState({
          user: null,
          profile: null,
          onboardingComplete: false,
          isLoading: false,
          isAuthenticated: false,
        });
        return;
      }

      const cachedUser = parseCachedUser(rawCachedUser);
      if (cachedUser) {
        setAuthState({
          user: cachedUser,
          profile: null,
          onboardingComplete: rawOnboarding === "1",
          isLoading: false,
          isAuthenticated: true,
        });
        void refreshSession({ silent: true });
        return;
      }

      await refreshSession();
    };

    void bootstrap();
  }, [refreshSession]);

  const completeGoogleOAuthCallback = useCallback(
    async (input: OAuthCallbackInput): Promise<OAuthCallbackResult> => {
      const parsed = parseOAuthCallbackInput(input);

      if (
        lastCompletedOAuthSignatureRef.current === parsed.signature &&
        authState.isAuthenticated
      ) {
        return {
          success: true,
          onboardingComplete: authState.onboardingComplete,
        };
      }

      const existingInFlight = oauthCompletionInFlightRef.current;
      if (existingInFlight && existingInFlight.signature === parsed.signature) {
        return existingInFlight.promise;
      }

      const run = (async () => {
        setAuthState((prev) => ({ ...prev, isLoading: true }));

        if (parsed.error) {
          setAuthState((prev) => ({ ...prev, isLoading: false }));
          return { success: false, error: parsed.error };
        }

        // Guard against the server returning a literal "null" string as the token value.
        if (!parsed.token || parsed.token === "null") {
          setAuthState((prev) => ({ ...prev, isLoading: false }));
          return {
            success: false,
            error: "No session token returned from OAuth callback.",
          };
        }

        await AsyncStorage.setItem(SESSION_TOKEN_KEY, parsed.token);
        const me = await fetchMe(parsed.token);

        if (!me) {
          await clearSession();
          return { success: false, error: "Unable to load user after sign-in." };
        }

        await Promise.all([
          AsyncStorage.setItem(USER_KEY, JSON.stringify(me.user)),
          AsyncStorage.setItem(ONBOARDING_KEY, me.onboardingComplete ? "1" : "0"),
        ]);
        applyAuthState(me);
        lastCompletedOAuthSignatureRef.current = parsed.signature;

        return {
          success: true,
          onboardingComplete: me.onboardingComplete,
        };
      })()
        .catch((error) => {
          console.error("Error completing OAuth callback:", error);
          setAuthState((prev) => ({ ...prev, isLoading: false }));
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        })
        .finally(() => {
          if (
            oauthCompletionInFlightRef.current?.signature === parsed.signature
          ) {
            oauthCompletionInFlightRef.current = null;
          }
        });

      oauthCompletionInFlightRef.current = {
        signature: parsed.signature,
        promise: run,
      };

      return run;
    },
    [applyAuthState, authState.isAuthenticated, authState.onboardingComplete, clearSession],
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true }));
      const apiBaseUrl = getOAuthBaseUrl();
      promoteApiBaseUrl(apiBaseUrl);
      const redirectUrl = Linking.createURL("auth/callback");
      const redirectUri = `${apiBaseUrl}/api/auth/callback/google`;
      const authUrl = `${apiBaseUrl}/api/auth/signin/google?callbackURL=${encodeURIComponent(redirectUrl)}&redirectUri=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type !== "success" || !result.url) {
        const cancelled = result.type === "cancel" || result.type === "dismiss";
        setAuthState((prev) => ({ ...prev, isLoading: false }));
        return {
          success: false,
          cancelled,
          error: cancelled ? "Authentication cancelled" : "Authentication failed",
        };
      }

      setAuthState((prev) => ({ ...prev, isLoading: false }));
      return { success: true, callbackUrl: result.url };
    } catch (error) {
      console.error("Google sign-in error:", error);
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      return { success: false, error: String(error) };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
      if (token) {
        const apiBaseUrl = await resolveApiBaseUrl();
        await fetchWithTimeout(
          `${apiBaseUrl}/api/auth/signout`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
          DEFAULT_REQUEST_TIMEOUT_MS,
        ).catch(() => {});
      }
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const getAccessToken = useCallback(async () => {
    return AsyncStorage.getItem(SESSION_TOKEN_KEY);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      ...authState,
      signInWithGoogle,
      completeGoogleOAuthCallback,
      signOut,
      getAccessToken,
      refreshSession,
    }),
    [
      authState,
      signInWithGoogle,
      completeGoogleOAuthCallback,
      signOut,
      getAccessToken,
      refreshSession,
    ],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
