// UI-facing types. Database/contract types live in ./types/database — this
// file re-exports them and adds UI-only aliases. The legacy duplicate
// src/types/index.ts was removed during the Supabase migration (plan §11.4).
export * from './types/database';

export type TimeRange = '24H' | '7D' | '30D' | 'ALL';

/** Components historically say "Coin"; the Supabase contract is PublicAsset
 * with NUMERIC market fields (formatting happens in the UI only). */
import type { PublicAsset } from './types/database';
export type Coin = PublicAsset;
