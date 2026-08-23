// Crypto Chaos Core 7: pure game-UI logic.
//
// Everything time-, lifecycle- and money-related that the interface needs,
// extracted as pure functions so behaviour is unit-testable without a DOM.
// The browser is NEVER the authoritative clock: countdowns are anchored to
// Core 1 server state at each sync and merely interpolated locally between
// polls, then re-anchored (drift correction) on every successful response.

import type {
  CashEvent,
  CashEventType,
  GameState,
  GameCycleStatus,
  LeaderboardEntry,
  RoundHolding,
  RoundParticipant
} from '../services/gameService.ts';
import { formatCurrency, parsePrice } from '../services/transactionService.ts';

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
//
// Issue #10: there is no manual join step any more — the backend owns
// participation for every authenticated player (back_coins_x#17). 'not-joined'
// therefore means "the server-owned participant for the current Apocalypse is
// still syncing", never "press JOIN".
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
  'not-joined': 'Syncing your position for this apocalypse — one moment',
  settling: 'Market frozen — calculating the damage',
  completed: 'This apocalypse has ended',
  loading: 'Syncing game state…',
  stale: 'Connection stale — refusing to trade on old data',
  'coin-collapsed': 'This coin has collapsed to £0 and cannot be bought'
};

// --- The one gameplay balance: Cash ---------------------------------------------

// Issue #10: Crypto Chaos has exactly ONE player-facing spendable balance —
// Cash — and it is sourced ONLY from the server-owned apocalypse participant
// (or the live leaderboard row derived from it). Legacy users.funds is classic
// exchange account data and NEVER enters this derivation; passing it anywhere
// near the game surface is the regression this helper exists to prevent.
export const GAME_STARTING_CASH_LABEL = '£10,000';

// The authoritative Cash figure for the current Apocalypse. The live
// leaderboard row (server truth, refreshed every poll) wins; the cached
// join/trade participant response is the fallback. 0 only when neither has
// synced yet — a loading state, never a fabricated balance.
export function displayRoundCash(
  myEntry: Pick<LeaderboardEntry, 'currentCash'> | null,
  myParticipant: Pick<RoundParticipant, 'currentCash'> | null
): number {
  return myEntry?.currentCash ?? myParticipant?.currentCash ?? 0;
}

// --- Passive drain activity (backend #18 / issue #11) -------------------------
//
// The activity feed EXPLAINS Cash; it never computes it. Everything here is a
// pure function over the authoritative server payload so polling, reconnects
// and offline-return can be unit-tested without a DOM.

// Player-facing source labels. Internal ledger types map to plain words; the
// internal eventKey never appears as primary UX.
export const CASH_EVENT_TYPE_LABEL: Record<CashEventType, string> = {
  FEE: 'Fee',
  TAX: 'Tax',
  EVENT: 'Event'
};

// Ledger rows are positive deduction amounts; the feed always renders them as
// money OUT (a leading minus), even if a malformed payload ever carried a
// negative — a drain is never displayed as a credit.
export function formatCashEventAmount(amount: number): string {
  return `-${formatCurrency(Math.abs(amount))}`;
}

// Absolute timestamp for tooltips/fallbacks, e.g. "23 Aug 2026, 14:32".
export function formatAbsoluteTimestamp(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  return new Date(time).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Compact relative age for feed rows: "just now", "5m ago", "3h ago",
// "2d ago", then the absolute date beyond a week. Future/skewed timestamps
// clamp to "just now" (the server clock is authoritative; a slightly-ahead
// row is not an error worth surfacing).
export function formatActivityTimestamp(createdAt: string, nowMs: number): string {
  const then = Date.parse(createdAt);
  if (!Number.isFinite(then)) return '';
  const diffMs = nowMs - then;
  if (diffMs < 45_000) return 'just now';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatAbsoluteTimestamp(createdAt);
}

// Canonical feed order: newest ledger row first (cashEventId is the server's
// own ordering — ORDER BY cash_event_id DESC). Duplicated rows (overlapping
// polls, reconnect replays) collapse to a single entry keyed by cashEventId,
// so re-syncing can never double-display a debit. Pure: the input array is
// neither mutated nor reordered.
export function normalizeCashEvents(events: CashEvent[]): CashEvent[] {
  const seen = new Set<number>();
  const normalized: CashEvent[] = [];
  for (const event of [...events].sort((a, b) => b.cashEventId - a.cashEventId)) {
    if (seen.has(event.cashEventId)) continue;
    seen.add(event.cashEventId);
    normalized.push(event);
  }
  return normalized;
}

// Rows whose ids are not yet in the seen set — i.e. debits that landed SINCE
// the previous successful sync. Callers baseline the seen set on the first
// sync so offline-applied drains are explained by the feed, not re-announced.
export function findNewCashEvents(events: CashEvent[], seenIds: ReadonlySet<number>): CashEvent[] {
  return events.filter((event) => !seenIds.has(event.cashEventId));
}

const CASH_EVENT_TYPE_PLURAL: Record<CashEventType, [string, string]> = {
  FEE: ['fee', 'fees'],
  TAX: ['tax', 'taxes'],
  EVENT: ['event', 'events']
};

// ONE restrained toast per sync, no matter how many debits arrived together.
// A single drain names its source; a batch summarises the total and the
// source breakdown — never a stack of per-fee notifications.
export function summariseDrainToast(events: CashEvent[]): string {
  if (events.length === 0) return '';
  const total = events.reduce((sum, event) => sum + Math.abs(event.amount), 0);
  const totalLabel = formatCurrency(total);
  if (events.length === 1) {
    return `${CASH_EVENT_TYPE_LABEL[events[0].type]} drained ${totalLabel} from your Cash`;
  }
  const breakdown = (Object.keys(CASH_EVENT_TYPE_PLURAL) as CashEventType[])
    .map((type) => {
      const count = events.filter((event) => event.type === type).length;
      if (count === 0) return null;
      const [singular, plural] = CASH_EVENT_TYPE_PLURAL[type];
      return `${count} ${count === 1 ? singular : plural}`;
    })
    .filter((part): part is string => part !== null)
    .join(', ');
  return `New drains: ${totalLabel} across ${events.length} charges (${breakdown})`;
}

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
//
// Milestone 1: the cache key carries BOTH the authenticated user identity and
// the apocalypse identity. On a shared browser, user A logging out and user B
// logging in must never surface A's round state — the key (and a defensive
// payload identity check on read) make that impossible, while rollover keeps
// its per-cycle isolation.
export function participantCacheKey(userId: number, apocalypseId: string): string {
  return `cc_participant_${userId}_${apocalypseId}`;
}

// Minimal Storage interface so the helpers are testable without a DOM.
export interface ParticipantCacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Read the cached participant for THIS user in THIS cycle. Returns null when
// logged out (no identity), when nothing is cached, on corrupt JSON, and on
// any identity/cycle mismatch between the key and the stored payload.
export function readCachedParticipant(
  storage: ParticipantCacheStorage,
  userId: number | null | undefined,
  apocalypseId: string
): RoundParticipant | null {
  if (typeof userId !== 'number' || !Number.isInteger(userId) || userId <= 0) return null;
  try {
    const raw = storage.getItem(participantCacheKey(userId, apocalypseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoundParticipant;
    if (!parsed || parsed.userId !== userId || parsed.apocalypseId !== apocalypseId) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Cache the latest authoritative participant under ITS OWN identity + cycle.
export function writeCachedParticipant(
  storage: ParticipantCacheStorage,
  participant: RoundParticipant
): void {
  try {
    storage.setItem(
      participantCacheKey(participant.userId, participant.apocalypseId),
      JSON.stringify(participant)
    );
  } catch {
    // Cache is a convenience only; the leaderboard is the live fallback.
  }
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

// --- Trade quantities ---------------------------------------------------------

// Crypto Chaos round-trade quantity contract. The authoritative precision is
// the backend ledger: apocalypse_holdings/apocalypse_transactions quantity
// DECIMAL(18,8) (backend migration 012) — crypto-style fractional coins, so
// 0.004 JDC is exact. Money stays 2-decimal; only the coin amount carries up
// to 8 decimal places. The backend re-validates every trade authoritatively;
// these helpers let the UI fail early under the SAME rule and never silently
// round a requested quantity into a materially different one.
export const TRADE_QUANTITY_MAX_DECIMALS = 8;

// Minimum trade consideration (backend gameConstants.GAME_MIN_TRADE_VALUE):
// money is 2-decimal, so a small fractional quantity can total £0.00 — free
// holdings on a BUY, destroyed holdings on a SELL, repeatably. The backend
// rejects these authoritatively; minTradeValueError mirrors the rule here
// for early feedback. Quantity precision is unaffected: 0.004 of a £2.50+
// coin is a valid £0.01+ trade.
export const TRADE_MIN_VALUE = 0.01;

export type TradeQuantityParse = { ok: true; value: number } | { ok: false; error: string };

// Plain decimal strings only: digits with at most one fractional part.
// Signs, exponents, thousands separators and blank/garbage are malformed.
const PLAIN_QUANTITY_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

// Exact significant-fractional-digit count of a plain decimal string,
// computed on the string so binary floating-point error can never miscount.
// Trailing zeros do not count: "0.5000" is value-identical to "0.5".
function significantDecimalPlaces(text: string): number {
  const fraction = text.includes('.') ? text.slice(text.indexOf('.') + 1) : '';
  const significant = fraction.replace(/0+$/, '');
  return significant.length;
}

// Parse and validate a user-entered trade quantity against the ledger
// contract: finite, > 0, and no more than TRADE_QUANTITY_MAX_DECIMALS
// significant fractional digits (excess precision is rejected, NEVER
// rounded). Returns the quantity as a number safe to submit verbatim.
export function parseTradeQuantity(raw: string): TradeQuantityParse {
  const text = raw.trim();
  if (text === '') return { ok: false, error: 'Enter a quantity greater than 0' };
  if (!PLAIN_QUANTITY_PATTERN.test(text)) {
    return { ok: false, error: 'Enter a valid decimal quantity (digits with at most one decimal point)' };
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: 'Enter a quantity greater than 0' };
  }
  if (significantDecimalPlaces(text) > TRADE_QUANTITY_MAX_DECIMALS) {
    return {
      ok: false,
      error: `Quantities support up to ${TRADE_QUANTITY_MAX_DECIMALS} decimal places — reduce the precision instead of rounding`
    };
  }
  return { ok: true, value };
}

// Client-side mirror of the backend minimum-notional rule, for early
// feedback before submission. `total` must be the 2-decimal ROUNDED
// consideration (the number the ledger would record) and `price` the live
// coin price. A £0-priced (collapsed) coin is exempt: exiting a dead
// holding for exactly £0 is legal. Returns the error message or null.
export function minTradeValueError(total: number, price: number): string | null {
  if (!(price > 0)) return null;
  if (!(total < TRADE_MIN_VALUE)) return null;
  return `Trade value must be at least £${TRADE_MIN_VALUE.toFixed(2)}. This trade totals £${total.toFixed(2)} at the current price.`;
}

// Display a coin quantity exactly as stored: up to 8 fractional digits with
// trailing zeros stripped, never exponent notation ("0.00000001", never
// "1e-8"), and never rounded to a whole coin. Safe for any ledger-valid
// quantity; a float carrying sub-8dp noise displays at 8dp (display only —
// this is never used to build a trade request).
export function formatQuantity(quantity: number): string {
  if (!Number.isFinite(quantity)) return '0';
  if (quantity === 0) return '0';
  const fixed = quantity.toFixed(TRADE_QUANTITY_MAX_DECIMALS);
  if (!fixed.includes('.')) return fixed; // integers render as-is
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed;
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

// --- Results overlay auto-dismiss (issue #8) ---------------------------------

// End-of-Apocalypse results appear briefly, then dismiss themselves: Crypto
// Chaos is a continuous loop and the player must never have to click to
// continue into the next round. 7s sits in the middle of the ticket's 5–8s
// "long enough to read" window. The manual close control stays available and
// always wins over the timer.
export const RESULTS_AUTO_DISMISS_MS = 7000;

export interface ResultsAutoDismissTimer {
  /** The specific completed cycle this timer is allowed to dismiss. */
  readonly cycleId: string;
  /** True while the dismissal may still fire; false once fired or cancelled. */
  pending(): boolean;
  /** Cancel the pending dismissal (unmount, result change, manual close). */
  cancel(): void;
}

// Schedule a one-shot auto-dismiss bound to ONE completed cycle id. The
// callback only ever fires for the cycle it was scheduled with, fires at
// most once, and cancel() is idempotent — so a stale timer can never dismiss
// a newer round's result, and duplicate/rerendered timers can never
// double-dismiss. No state is persisted: a fresh page simply arms a fresh
// timer for a freshly detected transition.
export function scheduleResultsAutoDismiss(
  cycleId: string,
  onDismiss: (completedCycleId: string) => void,
  delayMs: number = RESULTS_AUTO_DISMISS_MS
): ResultsAutoDismissTimer {
  let settled = false;
  const timeoutId = setTimeout(() => {
    if (settled) return;
    settled = true;
    onDismiss(cycleId);
  }, delayMs);
  return {
    cycleId,
    pending: () => !settled,
    cancel: () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
    }
  };
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

// --- How to play (first-time instructions) ----------------------------------
//
// The single source of truth for the HOW TO PLAY copy. The dialog component
// renders this verbatim, and the unit tests pin the accuracy rules:
//   - there is ALWAYS a current Apocalypse; signing in enters it automatically
//     (no lobby, no JOIN gate — back_coins_x#17 / fcoins_y#10)
//   - every Apocalypse starts the player at £10,000 Cash
//   - collapse is permanent for the round (dead coins never recover)
//   - collapse order/timing is never revealed
//   - passive fees/taxes/events drain Cash; trading is how you beat them
//   - bots have no hidden information
//   - Cash is separate from legacy exchange account funds
//   - final cash — not peak wealth — decides the winner, and only finishing
//     ABOVE £10,000 qualifies for the leaderboard (£10,000 exactly does not)
// Keep the tone apocalyptic crypto-bro, but never sacrifice clarity for a joke.

export const HOW_TO_PLAY_TITLE = 'HOW TO SURVIVE THE APOCALYPSE';
export const HOW_TO_PLAY_TAGLINE = 'CASH WINS. BAGS DIE.';
export const HOW_TO_PLAY_STARTING_CASH = GAME_STARTING_CASH_LABEL;

// The win-condition copy, single-sourced for the leaderboard, results overlay
// and history panels. Exactly £10,000 is break-even and does NOT qualify
// (backend #19: leaderboard_eligible = final_cash > starting_cash).
export const LEADERBOARD_RULE_COPY = `Finish above ${GAME_STARTING_CASH_LABEL} to make the leaderboard.`;
export const LEADERBOARD_BREAKEVEN_COPY = `Exactly ${GAME_STARTING_CASH_LABEL} is break-even and does not qualify.`;

export interface HowToPlayStep {
  id: string;
  title: string;
  body: string;
}

export const HOW_TO_PLAY_STEPS: HowToPlayStep[] = [
  {
    id: 'enter',
    title: "YOU'RE IN",
    body: `There is always an Apocalypse running. Sign in and you are entered into the current one automatically — no lobby, no entry button, nothing to press. Your Cash starts at ${HOW_TO_PLAY_STARTING_CASH}, owned and kept by the server. Cash lives and dies with the Apocalypse; it is completely separate from your exchange account funds.`
  },
  {
    id: 'trade',
    title: 'TRADE',
    body: 'Buy and sell the available coins with your Cash. Fractional quantities are supported — 0.004 of a coin is a real position. Trading is how you try to beat the drains.'
  },
  {
    id: 'clock',
    title: 'WATCH THE CLOCK',
    body: 'As Apocalypse % rises, the market becomes increasingly unstable. The calm at the start does not last.'
  },
  {
    id: 'bag',
    title: "DON'T HOLD THE BAG",
    body: 'Coins eventually collapse permanently to £0. Dead coins stay dead for the rest of the Apocalypse — no recovery, no resurrection — and nobody knows which coin goes next or when. DEAD COINS STAY DEAD.'
  },
  {
    id: 'drain',
    title: 'MIND THE DRAINS',
    body: 'Fees, taxes and market events drain your Cash even if you do nothing — doing nothing costs money. Every deduction lands in your round activity feed with its source, amount and time, so Cash never drops without an explanation. Trade well enough to beat the drain.'
  },
  {
    id: 'bots',
    title: 'BEAT THE BOTS',
    body: 'Rule-based bots trade alongside you and fight for places on the same leaderboard. They read the same market you do — no hidden information. THE BOTS WANT YOUR SPOT.'
  },
  {
    id: 'cash',
    title: 'CASH WINS',
    body: `When the Apocalypse ends, your score is the Cash you are still holding. Peak wealth mid-round means nothing — only final Cash decides the winner. ${LEADERBOARD_RULE_COPY} ${LEADERBOARD_BREAKEVEN_COPY}`
  },
  {
    id: 'again',
    title: 'DO IT AGAIN',
    body: `Results are recorded and the next Apocalypse begins automatically — fresh ${HOW_TO_PLAY_STARTING_CASH} Cash, no sign-up, no button. The world ends again right on schedule.`
  }
];
