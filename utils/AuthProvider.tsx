// providers/AuthProvider.tsx
import { useState, useEffect, createContext, useContext, PropsWithChildren } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '~/utils/supabase';

type AuthProps = {
  user: User | null;
  session: Session | null;
  initialized: boolean;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<Partial<AuthProps>>({});

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session ? session.user : null);
      setInitialized(true);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
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
