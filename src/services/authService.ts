// Auth service (plan §6.1, §11.2) — Supabase Auth only. No custom JWT,
// no manual token parsing, no localStorage user authority.
import { supabase, coins } from '../lib/supabase';
import { mapRpcError } from './errorMapper';
import type { BootstrapResult } from '../types/database';

/** Public app origin+base for recovery/confirm redirects (staging or /coins). */
function authRedirectTo(): string {
  if (typeof window === 'undefined') return 'https://jdwd40.com/coins/';
  const base = (import.meta.env.BASE_URL || '/coins/').replace(/\/?$/, '/');
  return `${window.location.origin}${base}`;
}

export async function signUp(email: string, password: string, username: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, product: 'coins' },
      emailRedirectTo: authRedirectTo(),
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectTo(),
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Idempotent first-session bootstrap: creates the caller's own
 * profiles + wallets rows (with the £1,000 opening balance) exactly once.
 * Safe to call on every login — replays return the existing account.
 */
export async function bootstrapAccount(username: string): Promise<BootstrapResult> {
  const { data, error } = await coins().rpc('bootstrap_account', { p_username: username });
  if (error) throw mapRpcError(error);
  return data as BootstrapResult;
}
