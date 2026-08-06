// AuthContext — Supabase Auth session handling (plan §6.1, §11.2).
// No custom JWT decoding, no localStorage user authority, no manufactured
// default users. Session is owned by the Supabase client; profile/wallet
// state is fetched from RLS-scoped queries keyed by auth.uid().
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, coins } from '../lib/supabase';
import {
  signIn, signUp, signOut, bootstrapAccount,
} from '../services/authService';
import { mapRpcError, describeError, CoinsError, mapAuthError } from '../services/errorMapper';

export interface CoinsUser {
  id: string;          // Supabase Auth UUID — the only identity
  email: string;
  username: string;
  cashBalance: number; // authoritative value from coins.wallets (never localStorage)
}

export type AuthResult =
  | { ok: true; status: 'ready' }
  | { ok: true; status: 'needs_profile' }
  | { ok: true; status: 'confirm_email' }
  | { ok: false; status: 'error' };

interface AuthContextType {
  user: CoinsUser | null;
  session: Session | null;
  /** Auth session exists but Coins profile/wallet not bootstrapped yet. */
  needsProfile: boolean;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string, username: string) => Promise<AuthResult>;
  /** Finish Coins bootstrap when Auth succeeded without a profile row. */
  completeProfile: (username: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refreshAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function metaUsername(session: Session | null): string {
  const raw = session?.user?.user_metadata?.username;
  return typeof raw === 'string' ? raw.trim() : '';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<CoinsUser | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadGen = useRef(0);

  const loadAccount = useCallback(async (s: Session | null): Promise<'ready' | 'needs_profile' | 'none'> => {
    const gen = ++loadGen.current;
    if (!s?.user) {
      if (gen === loadGen.current) {
        setUser(null);
        setNeedsProfile(false);
      }
      return 'none';
    }

    // Own profile + wallet via RLS (no client-supplied user id).
    let { data: profile, error: profileErr } = await coins()
      .from('profiles')
      .select('id, username, created_at, disabled_at')
      .maybeSingle();

    if (profileErr) {
      // Do not silently appear logged-out on query failure.
      if (gen === loadGen.current) {
        setUser(null);
        setNeedsProfile(false);
        setError(profileErr.message || 'Could not load account profile.');
      }
      return 'none';
    }

    if (!profile) {
      const name = metaUsername(s);
      if (name) {
        try {
          await bootstrapAccount(name);
          ({ data: profile, error: profileErr } = await coins()
            .from('profiles')
            .select('id, username, created_at, disabled_at')
            .maybeSingle());
          if (profileErr) throw profileErr;
        } catch (err) {
          if (gen === loadGen.current) {
            const mapped = err instanceof CoinsError ? err : mapRpcError(err);
            // Username taken / invalid still needs a profile completion UI.
            if (mapped.code === 'USERNAME_TAKEN' || mapped.code === 'INVALID_USERNAME') {
              setUser(null);
              setNeedsProfile(true);
              setError(describeError(mapped.code));
              return 'needs_profile';
            }
            setUser(null);
            setNeedsProfile(false);
            setError(describeError(mapped.code));
          }
          return 'none';
        }
      }
    }

    if (!profile) {
      if (gen === loadGen.current) {
        setUser(null);
        setNeedsProfile(true);
      }
      return 'needs_profile';
    }

    const { data: wallet, error: walletErr } = await coins()
      .from('wallets')
      .select('cash_balance')
      .maybeSingle();

    if (walletErr) {
      if (gen === loadGen.current) {
        setUser(null);
        setNeedsProfile(false);
        setError(walletErr.message || 'Could not load wallet.');
      }
      return 'none';
    }

    if (gen === loadGen.current) {
      setNeedsProfile(false);
      setUser({
        id: s.user.id,
        email: s.user.email ?? '',
        username: profile.username,
        cashBalance: wallet ? Number(wallet.cash_balance) : 0,
      });
    }
    return 'ready';
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      await loadAccount(data.session);
      if (!cancelled) setLoading(false);
    });

    // Supabase warns: avoid awaiting heavy work directly inside the callback
    // (deadlocks / missing JWT on subsequent queries). Defer loadAccount.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setTimeout(() => {
        void loadAccount(next).finally(() => {
          if (!cancelled) setLoading(false);
        });
      }, 0);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadAccount]);

  const clearError = () => setError(null);

  const login = async (email: string, password: string): Promise<AuthResult> => {
    setLoading(true);
    setError(null);
    try {
      const data = await signIn(email, password);
      const s = data.session ?? (await supabase.auth.getSession()).data.session;
      setSession(s);
      const status = await loadAccount(s);
      if (status === 'ready') return { ok: true, status: 'ready' };
      if (status === 'needs_profile') return { ok: true, status: 'needs_profile' };
      setError('Signed in, but the account could not be loaded. Try again.');
      return { ok: false, status: 'error' };
    } catch (err) {
      setError(mapAuthError(err));
      return { ok: false, status: 'error' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    username: string,
  ): Promise<AuthResult> => {
    setLoading(true);
    setError(null);
    try {
      const trimmed = username.trim();
      if (!trimmed) {
        setError(describeError('INVALID_USERNAME'));
        return { ok: false, status: 'error' };
      }
      const data = await signUp(email, password, trimmed);
      // Prefer session from signUp when autoconfirm/session is available.
      const s = data.session ?? (await supabase.auth.getSession()).data.session;
      if (!s) {
        // Email confirmation required — Auth user exists, no JWT yet.
        return { ok: true, status: 'confirm_email' };
      }
      setSession(s);
      await bootstrapAccount(trimmed);
      const status = await loadAccount(s);
      if (status === 'ready') return { ok: true, status: 'ready' };
      if (status === 'needs_profile') return { ok: true, status: 'needs_profile' };
      setError('Account created, but setup did not finish. Try signing in.');
      return { ok: false, status: 'error' };
    } catch (err) {
      if (err instanceof CoinsError) {
        setError(describeError(err.code));
      } else {
        setError(mapAuthError(err));
      }
      return { ok: false, status: 'error' };
    } finally {
      setLoading(false);
    }
  };

  const completeProfile = async (username: string): Promise<AuthResult> => {
    setLoading(true);
    setError(null);
    try {
      const trimmed = username.trim();
      if (!trimmed) {
        setError(describeError('INVALID_USERNAME'));
        return { ok: false, status: 'error' };
      }
      const s = session ?? (await supabase.auth.getSession()).data.session;
      if (!s) {
        setError('Please sign in first.');
        return { ok: false, status: 'error' };
      }
      await bootstrapAccount(trimmed);
      // Persist username on Auth metadata for future logins.
      await supabase.auth.updateUser({ data: { username: trimmed, product: 'coins' } });
      const status = await loadAccount(s);
      if (status === 'ready') return { ok: true, status: 'ready' };
      setError('Could not finish account setup.');
      return { ok: false, status: 'error' };
    } catch (err) {
      const mapped = err instanceof CoinsError ? err : mapRpcError(err);
      setError(describeError(mapped.code));
      return { ok: false, status: 'error' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut();
    setUser(null);
    setSession(null);
    setNeedsProfile(false);
  };

  const refreshAccount = async () => {
    const s = session ?? (await supabase.auth.getSession()).data.session;
    await loadAccount(s);
  };

  return (
    <AuthContext.Provider value={{
      user, session, needsProfile, loading, error, clearError,
      login, register, completeProfile, logout, refreshAccount,
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
