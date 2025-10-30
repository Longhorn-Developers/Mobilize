// providers/AuthProvider.tsx
import {
  useState,
  useEffect,
  createContext,
  useContext,
  PropsWithChildren,
} from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { cloudflare, CloudflareAuthUser, CloudflareAuthSession } from "~/utils/cloudflare";

type AuthProps = {
  user: CloudflareAuthUser | null;
  session: CloudflareAuthSession | null;
  initialized: boolean;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<Partial<AuthProps>>({});

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<CloudflareAuthUser | null>(null);
  const [session, setSession] = useState<CloudflareAuthSession | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('=== AUTH PROVIDER: Starting initialization ===');
        await cloudflare.initialize();
        console.log('AUTH PROVIDER: Cloudflare client initialized');
        
        // Check if user is already authenticated
        console.log('AUTH PROVIDER: Checking for existing user...');
        const { data } = await cloudflare.auth.getUser();
        console.log('AUTH PROVIDER: getUser result:', data);
        
        if (data?.user) {
          console.log('AUTH PROVIDER: User found:', data.user);
          setUser(data.user);
          setSession({ user: data.user, token: '' }); // Token is handled internally
        } else {
          console.log('AUTH PROVIDER: No user found');
        }
      } catch (error) {
        console.error('AUTH PROVIDER: Error during initialization:', error);
      } finally {
        console.log('AUTH PROVIDER: Initialization complete, setting initialized=true');
        setInitialized(true);
      }
    };

    initializeAuth();
  }, []);

  const signOut = async () => {
    await cloudflare.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const value = {
    user,
    session,
    initialized,
    signOut,
  };

  // Show loading screen while initializing
  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#bf5700" />
        <Text style={{ marginTop: 20, fontSize: 16, color: '#666' }}>
          Initializing authentication...
        </Text>
      </View>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook for convenience
export const useAuth = () => {
  return useContext(AuthContext);
};
