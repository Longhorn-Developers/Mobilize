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
  useState,
} from "react";

WebBrowser.maybeCompleteAuthSession();

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:54321").replace(/\/$/, "");
const SESSION_TOKEN_KEY = "auth_session_token";
const USER_KEY = "auth_user";

async function safeJson(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const body = await response.text().catch(() => "(unreadable body)");
    throw new Error(
      `API returned non-JSON (${response.status} ${response.statusText}): ${body.slice(0, 200)}`,
    );
  }
  return response.json();
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

type AuthContextType = AuthState & {
  signInWithGoogle: () => Promise<{ success: boolean; error?: string; isNewUser?: boolean }>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchMe(sessionToken: string) {
  const response = await fetch(`${API_URL}/api/me`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  if (!response.ok) {
    return null;
  }

  const data = await safeJson(response);
  if (!data?.user) {
    return null;
  }

  return {
    user: data.user as User,
    profile: data.profile ?? null,
    onboardingComplete: Boolean(data.onboardingComplete),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    onboardingComplete: false,
    isLoading: true,
    isAuthenticated: false,
  });

  const clearSession = useCallback(async () => {
    await AsyncStorage.multiRemove([SESSION_TOKEN_KEY, USER_KEY]);
    setAuthState({
      user: null,
      profile: null,
      onboardingComplete: false,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const refreshSession = useCallback(async () => {
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

      await AsyncStorage.setItem(USER_KEY, JSON.stringify(me.user));
      setAuthState({
        user: me.user,
        profile: me.profile,
        onboardingComplete: me.onboardingComplete,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error("Error refreshing session:", error);
      await clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const redirectUrl = Linking.createURL("auth/callback");
      const redirectUri = `${API_URL}/api/auth/callback/google`;
      const authUrl = `${API_URL}/api/auth/signin/google?callbackURL=${encodeURIComponent(redirectUrl)}&redirectUri=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type !== "success" || !result.url) {
        const cancelled = result.type === "cancel" || result.type === "dismiss";
        return {
          success: false,
          error: cancelled ? "Authentication cancelled" : "Authentication failed",
        };
      }

      const callbackUrl = new URL(result.url);
      const token = callbackUrl.searchParams.get("session_token") || callbackUrl.searchParams.get("token");
      const error = callbackUrl.searchParams.get("error");

      if (error) {
        return { success: false, error };
      }
      if (!token) {
        return { success: false, error: "No session token returned from OAuth callback" };
      }

      await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
      const me = await fetchMe(token);
      if (!me) {
        await clearSession();
        return { success: false, error: "Unable to load user after sign-in" };
      }

      await AsyncStorage.setItem(USER_KEY, JSON.stringify(me.user));
      setAuthState({
        user: me.user,
        profile: me.profile,
        onboardingComplete: me.onboardingComplete,
        isLoading: false,
        isAuthenticated: true,
      });

      return { success: true, isNewUser: !me.onboardingComplete };
    } catch (error) {
      console.error("Google sign-in error:", error);
      return { success: false, error: String(error) };
    }
  }, [clearSession]);

  const signOut = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
      if (token && API_URL) {
        await fetch(`${API_URL}/api/auth/signout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
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
      signOut,
      getAccessToken,
      refreshSession,
    }),
    [authState, signInWithGoogle, signOut, getAccessToken, refreshSession],
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
