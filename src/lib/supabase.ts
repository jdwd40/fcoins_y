// Supabase client singleton — Coins frontend (plan §11.1)
// Uses ONLY the public anon key; the service-role key must never appear here.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Fail loudly at startup rather than emitting confusing network errors.
  throw new Error(
    'Missing required public config: set VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY (see .env.example).',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // password-recovery links
  },
});

/** Schema-scoped access: all Coins tables/views/RPCs live in `coins`. */
export const coins = () => supabase.schema('coins');
