import { useState, useEffect, useCallback, createContext, useContext } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";

WebBrowser.maybeCompleteAuthSession();

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Storage keys
const SESSION_TOKEN_KEY = "auth_session_token";
const USER_KEY = "auth_user";

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

export function useAuth(): AuthContextType {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Load stored session on mount
  useEffect(() => {
    loadStoredSession();
  }, []);

  const loadStoredSession = async () => {
    try {
      const userJson = await AsyncStorage.getItem(USER_KEY);
      const sessionToken = await AsyncStorage.getItem(SESSION_TOKEN_KEY);

      if (userJson && sessionToken) {
        // Verify session is still valid
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            Cookie: `better-auth.session_token=${sessionToken}`,
          },
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setAuthState({
              user: data.user,
              isLoading: false,
              isAuthenticated: true,
            });
            return;
          }
        }
      }

      // No valid session
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error("Error loading session:", error);
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  const signInWithGoogle = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
    isNewUser?: boolean;
  }> => {
    try {
      // Create a redirect URL for the app
      const redirectUrl = Linking.createURL("auth/callback");
      console.log("Redirect URL:", redirectUrl);

      // Build the auth URL pointing to your server
      const authUrl = `${API_URL}/api/auth/signin/google?callbackURL=${encodeURIComponent(redirectUrl)}`;
      console.log("Auth URL:", authUrl);

      // Open the OAuth flow in a browser
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      console.log("WebBrowser result:", result);

      if (result.type === "success" && result.url) {
        // Parse the callback URL
        const url = new URL(result.url);
        const token = url.searchParams.get("token") || url.searchParams.get("session_token");
        const error = url.searchParams.get("error");

        if (error) {
          console.error("OAuth error:", error);
          return { success: false, error };
        }

        if (token) {
          // Store the session token
          await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);

          // Fetch user data
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Cookie: `better-auth.session_token=${token}`,
            },
            credentials: "include",
          });

          if (response.ok) {
            const data = await response.json();
            
            if (data.user) {
              await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));

              setAuthState({
                user: data.user,
                isLoading: false,
                isAuthenticated: true,
              });

              // Check if this is a new user (no username set yet means they need profile setup)
              const isNewUser = !data.user.username;

              return { success: true, isNewUser };
            }
          }
        }

        // If we got here without a token, try to get session from cookies
        // This handles the case where Better Auth uses cookies instead of URL params
        const meResponse = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });

        if (meResponse.ok) {
          const data = await meResponse.json();
          if (data.user) {
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
            
            setAuthState({
              user: data.user,
              isLoading: false,
              isAuthenticated: true,
            });

            return { success: true, isNewUser: !data.user.username };
          }
        }
      }

      if (result.type === "cancel") {
        return { success: false, error: "Authentication cancelled" };
      }

      if (result.type === "dismiss") {
        return { success: false, error: "Authentication dismissed" };
      }

      return { success: false, error: "Authentication failed" };
    } catch (error) {
      console.error("Google sign in error:", error);
      return { success: false, error: String(error) };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const sessionToken = await AsyncStorage.getItem(SESSION_TOKEN_KEY);

      if (sessionToken) {
        // Call backend signout
        await fetch(`${API_URL}/api/auth/signout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            Cookie: `better-auth.session_token=${sessionToken}`,
          },
          credentials: "include",
        });
      }

      // Clear stored data
      await AsyncStorage.multiRemove([SESSION_TOKEN_KEY, USER_KEY]);

      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error("Sign out error:", error);
      // Clear local state even if server call fails
      await AsyncStorage.multiRemove([SESSION_TOKEN_KEY, USER_KEY]);
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return AsyncStorage.getItem(SESSION_TOKEN_KEY);
  }, []);

  const refreshSession = useCallback(async () => {
    await loadStoredSession();
  }, []);

  return {
    ...authState,
    signInWithGoogle,
    signOut,
    getAccessToken,
    refreshSession,
  };
}

// Export context for potential Provider usage
export { AuthContext };
