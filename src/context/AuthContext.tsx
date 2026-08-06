// AuthContext — Supabase Auth session handling (plan §6.1, §11.2).
// No custom JWT decoding, no localStorage user authority, no manufactured
// default users. Session is owned by the Supabase client; profile/wallet
// state is fetched from RLS-scoped queries keyed by auth.uid().
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, coins } from '../lib/supabase';
import {
  signIn, signUp, signOut, bootstrapAccount,
} from '../services/authService';
import { mapRpcError, describeError, CoinsError } from '../services/errorMapper';

export interface CoinsUser {
  id: string;          // Supabase Auth UUID — the only identity
  email: string;
  username: string;
  cashBalance: number; // authoritative value from coins.wallets (never localStorage)
}

interface AuthContextType {
  user: CoinsUser | null;
  session: Session | null;
  loading: boolean;            // true while session/profile resolves
  error: string | null;
  clearError: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, username: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAccount: () => Promise<void>; // re-read profile + wallet after trades
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<CoinsUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccount = useCallback(async (s: Session | null) => {
    if (!s?.user) {
      setUser(null);
      return;
    }
    // Own profile + wallet via RLS (no client-supplied user id).
    const { data: profile } = await coins()
      .from('profiles')
      .select('id, username, created_at, disabled_at')
      .maybeSingle();
    if (!profile) {
      // Authenticated but never bootstrapped into Coins (or bootstrap pending).
      setUser(null);
      return;
    }
    const { data: wallet } = await coins()
      .from('wallets')
      .select('cash_balance')
      .maybeSingle();
    setUser({
      id: s.user.id,
      email: s.user.email ?? '',
      username: profile.username,
      cashBalance: wallet ? Number(wallet.cash_balance) : 0,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      await loadAccount(data.session);
      if (!cancelled) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      await loadAccount(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadAccount]);

  const clearError = () => setError(null);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      return true; // onAuthStateChange loads the account
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, username: string) => {
    setLoading(true);
    setError(null);
    try {
      await signUp(email, password, username);
      // If email confirmation is enabled there is no session yet; the user
      // confirms, signs in, and bootstrap runs on first authenticated render.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await bootstrapAccount(username); // idempotent
        await loadAccount(data.session);
      }
      return true;
    } catch (err) {
      const mapped = err instanceof CoinsError ? err : mapRpcError(err);
      setError(describeError(mapped.code));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut();
    setUser(null);
    setSession(null);
  };

  const refreshAccount = async () => {
    await loadAccount(session);
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, error, clearError,
      login, register, logout, refreshAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
