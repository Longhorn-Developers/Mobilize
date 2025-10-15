// providers/AuthProvider.tsx
import {
  useState,
  useEffect,
  createContext,
  useContext,
  PropsWithChildren,
} from "react";
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
      await cloudflare.initialize();
      
      // Check if user is already authenticated
      const { data } = await cloudflare.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        setSession({ user: data.user, token: '' }); // Token is handled internally
        setInitialized(true);
      } else {
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook for convenience
export const useAuth = () => {
  return useContext(AuthContext);
};
