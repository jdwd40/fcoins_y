// Persistent-market Stage 6: pure gating helpers for the persistent trade
// surface. No Apocalypse/cycle lifecycle, no Power, no position cap — none
// of those exist in the persistent economy. Every gate is explicit text so
// a blocked control always says why.
//
// These helpers are pure and unit-tested (persistentTrading.test.ts); the
// components never invent their own gating.

export type PersistentTradeBlockReason =
  | 'not-authenticated'
  | 'account-syncing'
  | 'account-unavailable'
  | 'insufficient-cash'
  | null;

export interface PersistentTradeGate {
  authenticated: boolean;
  /** True once the persistent account endpoint answered for this identity. */
  synced: boolean;
  /** Last account-sync failure; an account may still exist (last good). */
  accountError: string | null;
  /** The server-owned persistent cash, or null when never synced. */
  cash: number | null;
  /** Notional (GBP) under consideration, for the affordability gate. */
  notional: number;
}

export function persistentTradeBlockReason(gate: PersistentTradeGate): PersistentTradeBlockReason {
  if (!gate.authenticated) return 'not-authenticated';
  // No account data yet and no failure either: still syncing. A synced read
  // failure with no last-good account is unavailable; WITH a last-good
  // account the stale balance remains trade-gating (the server revalidates
  // at commit time anyway).
  if (gate.cash === null) {
    return gate.accountError !== null ? 'account-unavailable' : 'account-syncing';
  }
  if (!gate.synced) return 'account-syncing';
  if (gate.notional > gate.cash) return 'insufficient-cash';
  return null;
}

export const PERSISTENT_TRADE_BLOCK_LABEL: Record<Exclude<PersistentTradeBlockReason, null>, string> = {
  'not-authenticated': 'Sign in to trade the persistent market',
  'account-syncing': 'Syncing your persistent account…',
  'account-unavailable': 'Your persistent account is unavailable — retry in a moment',
  'insufficient-cash': 'Not enough persistent Cash for this amount'
};

// Display-only quantity→notional estimate at the DISPLAYED price. The server
// owns the execution price and re-validates everything at commit time; this
// never becomes request input (requests carry quantity only).
export function estimateNotional(quantity: number, displayedPrice: number): number {
  return Math.round(quantity * displayedPrice * 100) / 100;
}
