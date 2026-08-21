// Crypto Chaos Core 7: pure game-UI logic.
//
// Everything time-, lifecycle- and money-related that the interface needs,
// extracted as pure functions so behaviour is unit-testable without a DOM.
// The browser is NEVER the authoritative clock: countdowns are anchored to
// Core 1 server state at each sync and merely interpolated locally between
// polls, then re-anchored (drift correction) on every successful response.

import type {
  GameState,
  GameCycleStatus,
  LeaderboardEntry,
  RoundHolding,
  RoundParticipant
} from '../services/gameService.ts';
import { parsePrice } from '../services/transactionService.ts';

// --- Server-anchored countdown ------------------------------------------------

// A countdown anchor: what the server said remained, and when (local clock)
// that answer arrived. Display time is derived, never independently ticked.
export interface CountdownAnchor {
  remainingMsAtSync: number;
  syncedAtLocal: number;
  serverTime: string;
}

export function anchorFromState(
  state: Pick<GameState, 'remainingMs' | 'serverTime'>,
  receivedAtLocal: number
): CountdownAnchor {
  return {
    remainingMsAtSync: Math.max(0, state.remainingMs),
    syncedAtLocal: receivedAtLocal,
    serverTime: state.serverTime
  };
}

// Interpolated remaining time. Real elapsed local time is subtracted, so
// laptop sleep / tab suspension / phone backgrounding all count correctly;
// the next successful poll re-anchors and corrects any residual drift.
export function displayRemainingMs(anchor: CountdownAnchor | null, nowLocal: number): number {
  if (!anchor) return 0;
  return Math.max(0, anchor.remainingMsAtSync - (nowLocal - anchor.syncedAtLocal));
}

// mm:ss under an hour, h:mm:ss above. Always non-negative.
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${mm}:${ss}`;
}

// --- Connection freshness -------------------------------------------------------

export type ConnectionState = 'live' | 'stale' | 'offline';

// With a 5s poll cadence, three missed windows means the local picture can
// no longer be trusted.
export const STALE_AFTER_MS = 15000;

export function connectionState(
  lastSyncAt: number | null,
  nowLocal: number,
  staleAfterMs: number = STALE_AFTER_MS
): ConnectionState {
  if (lastSyncAt === null) return 'offline';
  return nowLocal - lastSyncAt > staleAfterMs ? 'stale' : 'live';
}

// --- Apocalypse meter phases ------------------------------------------------------

// The collapse window opens at 70% of a cycle — the fixed Core 3 game-design
// constant (COLLAPSE_WINDOW_START_PERCENT), deliberately not configurable on
// the backend, so 70 is a contract boundary rather than a UI guess. All
// phase input comes from the backend's apocalypsePercent, never local timing.
export type MeterPhase = 'CALM' | 'UNSTABLE' | 'DANGEROUS' | 'EXTREME';

export function meterPhase(apocalypsePercent: number): MeterPhase {
  const pct = Math.min(100, Math.max(0, apocalypsePercent));
  if (pct < 50) return 'CALM';
  if (pct < 70) return 'UNSTABLE';
  if (pct < 90) return 'DANGEROUS';
  return 'EXTREME';
}

export const METER_PHASE_LABEL: Record<MeterPhase, string> = {
  CALM: 'Market integrity: questionable',
  UNSTABLE: 'Market integrity: unstable',
  DANGEROUS: 'Collapse window open',
  EXTREME: 'Final reckoning imminent'
};

// --- Lifecycle ---------------------------------------------------------------------

// What the UI believes the game is doing right now. SETTLING is surfaced
// through the deliberate Core 6 leaderboard 409 (the state endpoint itself
// rolls forward); COMPLETED is a transient hand-off while results load.
export type LifecyclePhase = 'LOADING' | 'ACTIVE' | 'SETTLING' | 'COMPLETED';

export function lifecycleFromState(
  status: GameCycleStatus | null,
  settling: boolean,
  loading: boolean
): LifecyclePhase {
  if (loading && !status) return 'LOADING';
  if (settling) return 'SETTLING';
  if (status === 'ACTIVE') return 'ACTIVE';
  if (status === 'SETTLING') return 'SETTLING';
  return 'COMPLETED';
}

export const LIFECYCLE_LABEL: Record<LifecyclePhase, string> = {
  LOADING: 'Contacting the end of the world…',
  ACTIVE: 'Trading open',
  SETTLING: 'Market frozen · Calculating the damage…',
  COMPLETED: 'Round complete'
};

// --- Collapsed coins ------------------------------------------------------------------

// The public collapsed signal: a coin's live price is exactly £0 (Core 3
// executes collapses to exactly zero). Dead coins stay visible and sellable
// (a £0 sale credits nothing) but can never be bought.
export function isCoinCollapsed(price: string | number): boolean {
  return !(parsePrice(price) > 0);
}

// --- Trade eligibility --------------------------------------------------------------------

export interface TradeGate {
  lifecycle: LifecyclePhase;
  connection: ConnectionState;
  joined: boolean;
  coinCollapsed: boolean;
  authenticated: boolean;
}

export type TradeBlockReason =
  | 'not-authenticated'
  | 'not-joined'
  | 'settling'
  | 'completed'
  | 'loading'
  | 'stale'
  | 'coin-collapsed'
  | null;

// The single gate every BUY/SELL control in the UI must pass. Order matters:
// the first blocking reason is the one surfaced to the player.
export function tradeBlockReason(gate: TradeGate): TradeBlockReason {
  if (!gate.authenticated) return 'not-authenticated';
  if (!gate.joined) return 'not-joined';
  if (gate.lifecycle === 'SETTLING') return 'settling';
  if (gate.lifecycle === 'COMPLETED') return 'completed';
  if (gate.lifecycle === 'LOADING') return 'loading';
  if (gate.connection !== 'live') return 'stale';
  if (gate.coinCollapsed) return 'coin-collapsed';
  return null;
}

export const TRADE_BLOCK_LABEL: Record<Exclude<TradeBlockReason, null>, string> = {
  'not-authenticated': 'Sign in to trade the apocalypse',
  'not-joined': 'Join the apocalypse to trade this round',
  settling: 'Market frozen — calculating the damage',
  completed: 'This apocalypse has ended',
  loading: 'Syncing game state…',
  stale: 'Connection stale — refusing to trade on old data',
  'coin-collapsed': 'This coin has collapsed to £0 and cannot be bought'
};

// --- Leaderboard helpers ---------------------------------------------------------------------

export function findMyEntry(
  entries: LeaderboardEntry[] | undefined,
  userId: number | null | undefined
): LeaderboardEntry | null {
  if (!entries || userId === null || userId === undefined) return null;
  return entries.find((entry) => entry.userId === userId) ?? null;
}

// --- Round participation cache ------------------------------------------------------------

// Join/trade responses are the only per-participant reads the backend
// exposes; the UI caches the latest authoritative participant per cycle so a
// reload mid-round restores the dashboard without re-joining.
export function participantCacheKey(apocalypseId: string): string {
  return `cc_participant_${apocalypseId}`;
}

// Live holdings value: cached quantities re-priced against the live market
// list. Coins missing from the list are valued at £0 (dead).
export function revalueHoldings(
  holdings: RoundHolding[],
  livePriceByCoinId: ReadonlyMap<number, number>
): number {
  const total = holdings.reduce((sum, holding) => {
    const live = livePriceByCoinId.get(holding.coinId) ?? 0;
    return sum + holding.quantity * live;
  }, 0);
  return Math.round(total * 100) / 100;
}

export function livePriceMapFromCoins(
  coins: Array<{ coin_id: number; current_price: string | number }>
): Map<number, number> {
  const map = new Map<number, number>();
  for (const coin of coins) map.set(coin.coin_id, parsePrice(coin.current_price));
  return map;
}

// --- Cycle transitions ----------------------------------------------------------------------

// A cycle change means the previous apocalypse completed. Returns the
// completed cycle's public id (to fetch its immutable results) or null.
export function detectCompletedCycle(
  previousApocalypseId: string | null,
  nextApocalypseId: string | null
): string | null {
  if (!previousApocalypseId || !nextApocalypseId) return null;
  return previousApocalypseId !== nextApocalypseId ? previousApocalypseId : null;
}

// Did the cached participant belong to the cycle that is now live? Round
// cash/holdings never carry across apocalypses.
export function participantBelongsToCycle(
  participant: RoundParticipant | null,
  apocalypseId: string | null
): boolean {
  return !!participant && !!apocalypseId && participant.apocalypseId === apocalypseId;
}

// --- Presentation ---------------------------------------------------------------------------

export function formatSignedGbp(value: number): string {
  const abs = Math.abs(value).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${value < 0 ? '-' : '+'}${abs}`;
}

export function personalityLabel(personality: string | null): string | null {
  if (!personality) return null;
  return personality.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// How many coins are still alive, for header copy like "7 coins still breathing".
export function countLivingCoins(
  coins: Array<{ current_price: string | number }>
): number {
  return coins.filter((coin) => !isCoinCollapsed(coin.current_price)).length;
}
