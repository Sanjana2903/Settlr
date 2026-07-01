import { createContext, PropsWithChildren, use, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  sendOtp: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Some failures (e.g. a Cloudflare 504 in front of Supabase) surface as a raw,
// stringified network response rather than a clean AuthError message.
function toFriendlyError(error: { message?: string } | null): string | null {
  if (!error?.message) return null;
  const looksRaw = error.message.trim().startsWith('{') || error.message.length > 200;
  if (looksRaw) {
    console.warn('Auth request failed:', error.message);
    return 'Something went wrong reaching the server. Please try again in a moment.';
  }
  return error.message;
}

export function useAuth() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return value;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function sendOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: toFriendlyError(error) };
  }

  async function verifyOtp(email: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    return { error: toFriendlyError(error) };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext value={{ session, isLoading, sendOtp, verifyOtp, signOut }}>
      {children}
    </AuthContext>
  );
}
