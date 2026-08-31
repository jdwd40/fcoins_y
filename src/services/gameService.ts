import { API_BASE_URL } from './apiConfig.ts';
import { SessionExpiredError } from './transactionService.ts';

// Crypto Chaos typed REST client: Core 1 game state, Core 4 round
// join/trades, and Core 6 leaderboard/results. The server/database is
// authoritative; this client validates every wire contract before handing it
// to callers, so a malformed or non-conforming payload fails loudly at the
// boundary instead of corrupting downstream UI state.

export type GameCycleStatus = 'ACTIVE' | 'SETTLING' | 'COMPLETED';

export interface GameState {
  /** Public sequential apocalypse identifier, e.g. "APOC-0001". */
  apocalypseId: string;
  status: GameCycleStatus;
  /** ISO 8601 cycle start timestamp. */
  startTime: string;
  /** ISO 8601 cycle end timestamp. */
  endTime: string;
  /** Configured cycle length in milliseconds. */
  durationMs: number;
  /** Milliseconds until endTime; clamped to >= 0. */
  remainingMs: number;
  /** Elapsed portion of the cycle; clamped to 0..100. */
  apocalypsePercent: number;
  /** ISO 8601 server timestamp captured when the state was derived. */
  serverTime: string;
}

// --- Core 4 round-state contracts ------------------------------------------

// V2-2 persistent Power view (backend gameRoundService.getParticipantRoundState
// — the single participant builder behind join, trade and participant reads).
// `current` is the lazily reconciled effective Power at `asOf`; `nextPointAt`
// is the server-computed instant the next regeneration point lands (null when
// Power is full). The UI previews costs and regen from these fields but the
// server remains authoritative for every spend.
export interface PowerState {
  current: number;
  max: number;
  regenMsPerPoint: number;
  secondsPerPoint: number;
  /** ISO 8601 instant the next +1 lands, or null when Power is full. */
  nextPointAt: string | null;
  storedPower: number;
  powerUpdatedAt: string;
  asOf: string;
}

export interface RoundHolding {
  coinId: number;
  symbol: string;
  quantity: number;
  /** V2-2: total remaining cost basis (GBP) for the open quantity. */
  costBasis: number;
  /** V2-2: weighted average entry price; null for a zero-quantity row. */
  averageEntryPrice: number | null;
  currentPrice: number;
  currentValue: number;
  /** V2-2: currentValue - costBasis, server-rounded to 2dp. */
  unrealizedPnl: number;
  /** V2-2: P&L as a percentage of cost basis; null when basis is £0. */
  unrealizedPnlPct: number | null;
}

export interface RoundParticipant {
  participantId: number;
  cycleId: number;
  apocalypseId: string;
  userId: number;
  isBot: boolean;
  joinedAt: string;
  startingCash: number;
  currentCash: number;
  holdingsValue: number;
  wealth: number;
  peakWealth: number;
  status: 'ACTIVE' | 'FINALIZED';
  finalCash: number | null;
  /** V2-2 persistent Power, reconciled by the server at read time. */
  power: PowerState;
  holdings: RoundHolding[];
}

export interface RoundTransaction {
  roundTransactionId: number;
  type: 'BUY' | 'SELL';
  coinId: number;
  quantity: number;
  price: number;
  totalAmount: number;
}

export interface RoundTradeResult {
  transaction: RoundTransaction;
  participant: RoundParticipant;
  peakWealth: number;
}

// --- Core 6 leaderboard / results contracts --------------------------------

export interface LeaderboardEntry {
  rank: number;
  participantId: number;
  userId: number;
  username: string;
  isBot: boolean;
  personality: string | null;
  joinedAt: string;
  currentCash: number;
  currentWealth: number;
  peakWealth: number;
}

export interface LiveLeaderboard {
  cycleId: string;
  status: GameCycleStatus;
  startTime: string;
  endTime: string;
  apocalypsePercent: number;
  remainingMs: number;
  serverTime: string;
  entries: LeaderboardEntry[];
}

export interface ResultRow {
  rank: number;
  participantId: number;
  cycleId: string;
  userId: number;
  username: string;
  isBot: boolean;
  personality: string | null;
  finalCash: number;
  peakWealth: number;
  startingCash: number;
  netProfit: number;
  /** Backend #19: finalCash > that round's startingCash. Only eligible rows
   *  are leaderboard entries; exactly break-even does not qualify. */
  leaderboardEligible: boolean;
  joinedAt: string;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  settledAt: string;
}

export interface CycleResults {
  cycleId: string;
  status: 'COMPLETED';
  startTime: string;
  endTime: string;
  settledAt: string | null;
  /** Rows in THIS payload (eligible-only on the recent-leaderboards
   *  endpoint; all results on the per-cycle results endpoint). */
  resultCount: number;
  /** Backend #19, recent-leaderboards only: total results recorded for the
   *  cycle, including non-qualifying finishes. Absent from GET
   *  /game/results/:cycleId. */
  totalResultCount?: number;
  results: ResultRow[];
}

export interface RecentLeaderboards {
  limit: number;
  count: number;
  leaderboards: CycleResults[];
}

// --- Backend #18 / fcoins_y #11: player round economy ------------------------
//
// Authenticated GET /game/participant returns the caller's authoritative
// current-round participant (currentCash always wins — the UI never derives
// Cash from the feed) plus their recent EXECUTED FEE/TAX/EVENT ledger rows.
// Only executed debits are exposed: no future schedule, no seed, and the
// operator diagnostics API (#21) is never consumed by this client.

export type CashEventType = 'FEE' | 'TAX' | 'EVENT';

export interface CashEvent {
  cashEventId: number;
  type: CashEventType;
  /** Positive debit amount in GBP — the ledger only records deductions. */
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  /** Human-readable public explanation supplied by the backend. */
  description: string;
  /** Internal idempotency key — validated at the boundary but never primary UX. */
  eventKey: string;
  /** ISO 8601 execution timestamp. */
  createdAt: string;
}

export interface PlayerRoundEconomy {
  participant: RoundParticipant;
  cashEvents: CashEvent[];
}

// --- V2-1/V2-3: public market signals ----------------------------------------
//
// Public GET /game/market-signals (backend marketSignalsService): the coarse,
// imperfect signal set for every active catalogue coin — the exact same shape
// the bots and the simulator's legal strategies act on. No seed, no anchors,
// no future phase/peak/collapse information can be present; the backend builds
// this payload from the redacted public-signal allowlist.
//
// Dead (collapsed) coins carry a reduced payload: currentPrice 0, phase DEAD,
// recentChangePct/typical ranges null and collapseRisk DEAD.

export type MarketPhase = 'DIP' | 'RISE' | 'BOOM' | 'FALL' | 'DEAD';
export type MarketMomentum = 'UP' | 'DOWN' | 'FLAT';
export type CollapseRiskLevel = 'STABLE' | 'SHAKY' | 'DANGER' | 'CRITICAL' | 'DEAD';

// SIM-15/16/17: the public market-phase + coin-event vocabulary. These are
// coarse player-facing signals only — the hidden lifecycle state, phase
// sequence/chain position, modifier magnitudes, event ids/strength and any
// future timing never survive the backend DTO or this parser.
export type PublicMarketPhaseId = 'GOLDEN_AGE' | 'BOOM' | 'BULL' | 'BEAR' | 'BUST' | 'RECESSION';

export interface MarketPhaseInfo {
  id: PublicMarketPhaseId;
  /** Public display name supplied by the backend (e.g. "Golden Age"). */
  name: string;
  /** ISO 8601 instant the current phase ends. */
  endsAt: string;
}

export type CoinEventDirection = 'POSITIVE' | 'NEGATIVE';

export interface CoinSignalEvent {
  /** Public event name supplied by the backend. */
  name: string;
  direction: CoinEventDirection;
  /** ISO 8601 instant the event expires; it disappears on the next poll. */
  endsAt: string;
}

export interface MarketSignalCoin {
  coinId: number;
  name: string;
  symbol: string;
  /** Gameplay archetype id: ZIP | MOON | BULL | HODL | DEGEN | RUG. */
  archetype: string;
  currentPrice: number;
  /** Percentage move over the backend's public 60s lookback; null when DEAD. */
  recentChangePct: number | null;
  phase: MarketPhase;
  momentum: MarketMomentum;
  /** Approximate [min, max] minutes per cycle for this archetype; null when DEAD. */
  typicalCycleMinutes: [number, number] | null;
  /** Approximate [min, max] typical swing percent; null when DEAD. */
  typicalSwingPct: [number, number] | null;
  /** V2-3 coarse, imperfect collapse-risk level. */
  collapseRisk: CollapseRiskLevel;
  dead: boolean;
  /** SIM-15: up to five currently active public events, chronological order.
   *  Always present — a dead coin's list is empty by contract. */
  events: CoinSignalEvent[];
}

export interface MarketSignals {
  apocalypseId: string;
  apocalypsePercent: number;
  serverTime: string;
  /** SIM-15: the current public market phase, or null when no persisted
   *  phase covers the server instant (a legitimate between-phases gap). */
  marketPhase: MarketPhaseInfo | null;
  coins: MarketSignalCoin[];
}

// --- Errors -----------------------------------------------------------------

// Domain/API error carrying the backend's HTTP status and user-facing
// message (the backend sends { status: 'error', message } for game domain
// rejections and { msg } for legacy/auth failures).
export class GameApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GameApiError';
    this.status = status;
  }
}

// True when the failure is the deliberate Core 6 "settlement in progress"
// 409 — a known lifecycle state, never a catastrophic UI error.
export function isSettlementBusyError(err: unknown): boolean {
  return err instanceof GameApiError && err.status === 409;
}

// --- Validation helpers ------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireString(payload: Record<string, unknown>, field: string, contract: string): void {
  if (typeof payload[field] !== 'string' || (payload[field] as string).length === 0) {
    throw new Error(`Invalid ${contract} response: ${field} must be a non-empty string`);
  }
}

function requireFiniteNumber(payload: Record<string, unknown>, field: string, contract: string): void {
  if (typeof payload[field] !== 'number' || !Number.isFinite(payload[field] as number)) {
    throw new Error(`Invalid ${contract} response: ${field} must be a finite number`);
  }
}

function requireBoolean(payload: Record<string, unknown>, field: string, contract: string): void {
  if (typeof payload[field] !== 'boolean') {
    throw new Error(`Invalid ${contract} response: ${field} must be a boolean`);
  }
}

function requireStatus(payload: Record<string, unknown>, contract: string): GameCycleStatus {
  const status = payload.status;
  if (status !== 'ACTIVE' && status !== 'SETTLING' && status !== 'COMPLETED') {
    throw new Error(`Invalid ${contract} response: unknown status ${JSON.stringify(status)}`);
  }
  return status;
}

// Validate the wire contract before handing it to callers: a malformed or
// snake_case/non-conforming payload fails loudly here instead of corrupting
// downstream state. Exported for focused contract tests.
//
// Milestone 1: the cycle seed is no longer part of the public contract (it
// deterministically drives future collapses and bot moves, so it must never
// reach the client). The parser neither requires nor retains it: the result
// is built from contract fields only, so any legacy/extra keys — seed
// included — are stripped at the boundary.
export function parseGameState(payload: unknown): GameState {
  if (!isRecord(payload)) {
    throw new Error('Invalid game state response: expected a JSON object');
  }
  const stringFields = ['apocalypseId', 'status', 'startTime', 'endTime', 'serverTime'] as const;
  for (const field of stringFields) {
    if (typeof payload[field] !== 'string' || (payload[field] as string).length === 0) {
      throw new Error(`Invalid game state response: ${field} must be a non-empty string`);
    }
  }
  const numberFields = ['durationMs', 'remainingMs', 'apocalypsePercent'] as const;
  for (const field of numberFields) {
    if (typeof payload[field] !== 'number' || !Number.isFinite(payload[field] as number)) {
      throw new Error(`Invalid game state response: ${field} must be a finite number`);
    }
  }
  const status = requireStatus(payload, 'game state');
  // The wire contract is clamped at the boundary (the interface documents
  // remainingMs >= 0 and apocalypsePercent in 0..100): a transiently
  // out-of-range server value can never drive the countdown negative or blow
  // the meter width / aria-valuenow past 100%.
  return {
    apocalypseId: payload.apocalypseId as string,
    status,
    startTime: payload.startTime as string,
    endTime: payload.endTime as string,
    durationMs: payload.durationMs as number,
    remainingMs: Math.max(0, payload.remainingMs as number),
    apocalypsePercent: Math.min(100, Math.max(0, payload.apocalypsePercent as number)),
    serverTime: payload.serverTime as string
  };
}

function requireNullableFiniteNumber(payload: Record<string, unknown>, field: string, contract: string): void {
  if (payload[field] !== null && (typeof payload[field] !== 'number' || !Number.isFinite(payload[field] as number))) {
    throw new Error(`Invalid ${contract} response: ${field} must be null or a finite number`);
  }
}

// V2-2 Power view: every participant payload (join, trade, economy read) is
// built by the same backend getParticipantRoundState, so the power block is a
// hard contract — a payload without it is not a V2 participant.
function parsePowerState(payload: unknown, contract: string): PowerState {
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: power must be an object`);
  for (const field of ['current', 'max', 'regenMsPerPoint', 'secondsPerPoint', 'storedPower'] as const) {
    requireFiniteNumber(payload, field, contract);
  }
  if (payload.nextPointAt !== null && typeof payload.nextPointAt !== 'string') {
    throw new Error(`Invalid ${contract} response: power.nextPointAt must be null or a string`);
  }
  requireString(payload, 'powerUpdatedAt', contract);
  requireString(payload, 'asOf', contract);
  return payload as unknown as PowerState;
}

export function parseRoundParticipant(payload: unknown): RoundParticipant {
  const contract = 'participant';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  requireFiniteNumber(payload, 'participantId', contract);
  requireFiniteNumber(payload, 'cycleId', contract);
  requireString(payload, 'apocalypseId', contract);
  requireFiniteNumber(payload, 'userId', contract);
  requireBoolean(payload, 'isBot', contract);
  requireString(payload, 'joinedAt', contract);
  for (const field of ['startingCash', 'currentCash', 'holdingsValue', 'wealth', 'peakWealth'] as const) {
    requireFiniteNumber(payload, field, contract);
  }
  if (payload.status !== 'ACTIVE' && payload.status !== 'FINALIZED') {
    throw new Error(`Invalid ${contract} response: unknown status ${JSON.stringify(payload.status)}`);
  }
  if (payload.finalCash !== null && typeof payload.finalCash !== 'number') {
    throw new Error(`Invalid ${contract} response: finalCash must be null or a number`);
  }
  parsePowerState(payload.power, contract);
  if (!Array.isArray(payload.holdings)) {
    throw new Error(`Invalid ${contract} response: holdings must be an array`);
  }
  for (const holding of payload.holdings as unknown[]) {
    if (!isRecord(holding)) throw new Error(`Invalid ${contract} response: holding must be an object`);
    requireFiniteNumber(holding, 'coinId', contract);
    requireString(holding, 'symbol', contract);
    for (const field of ['quantity', 'costBasis', 'currentPrice', 'currentValue', 'unrealizedPnl'] as const) {
      requireFiniteNumber(holding, field, contract);
    }
    requireNullableFiniteNumber(holding, 'averageEntryPrice', contract);
    requireNullableFiniteNumber(holding, 'unrealizedPnlPct', contract);
  }
  return payload as unknown as RoundParticipant;
}

export function parseRoundTradeResult(payload: unknown): RoundTradeResult {
  const contract = 'trade';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  if (!isRecord(payload.transaction)) throw new Error(`Invalid ${contract} response: transaction must be an object`);
  requireFiniteNumber(payload.transaction, 'roundTransactionId', contract);
  if (payload.transaction.type !== 'BUY' && payload.transaction.type !== 'SELL') {
    throw new Error(`Invalid ${contract} response: unknown transaction type`);
  }
  for (const field of ['coinId', 'quantity', 'price', 'totalAmount'] as const) {
    requireFiniteNumber(payload.transaction, field, contract);
  }
  requireFiniteNumber(payload, 'peakWealth', contract);
  const participant = parseRoundParticipant(payload.participant);
  return { ...(payload as unknown as RoundTradeResult), participant };
}

function parseLeaderboardEntry(payload: unknown, contract: string): LeaderboardEntry {
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: entry must be an object`);
  requireFiniteNumber(payload, 'rank', contract);
  requireFiniteNumber(payload, 'participantId', contract);
  requireFiniteNumber(payload, 'userId', contract);
  requireString(payload, 'username', contract);
  requireBoolean(payload, 'isBot', contract);
  if (payload.personality !== null && typeof payload.personality !== 'string') {
    throw new Error(`Invalid ${contract} response: personality must be null or a string`);
  }
  requireString(payload, 'joinedAt', contract);
  for (const field of ['currentCash', 'currentWealth', 'peakWealth'] as const) {
    requireFiniteNumber(payload, field, contract);
  }
  return payload as unknown as LeaderboardEntry;
}

export function parseLiveLeaderboard(payload: unknown): LiveLeaderboard {
  const contract = 'leaderboard';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  requireString(payload, 'cycleId', contract);
  requireStatus(payload, contract);
  requireString(payload, 'startTime', contract);
  requireString(payload, 'endTime', contract);
  requireFiniteNumber(payload, 'apocalypsePercent', contract);
  requireFiniteNumber(payload, 'remainingMs', contract);
  requireString(payload, 'serverTime', contract);
  if (!Array.isArray(payload.entries)) {
    throw new Error(`Invalid ${contract} response: entries must be an array`);
  }
  (payload.entries as unknown[]).forEach((entry) => parseLeaderboardEntry(entry, contract));
  return payload as unknown as LiveLeaderboard;
}

function parseResultRow(payload: unknown, contract: string): ResultRow {
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: result row must be an object`);
  requireFiniteNumber(payload, 'rank', contract);
  requireFiniteNumber(payload, 'participantId', contract);
  requireString(payload, 'cycleId', contract);
  requireFiniteNumber(payload, 'userId', contract);
  requireString(payload, 'username', contract);
  requireBoolean(payload, 'isBot', contract);
  if (payload.personality !== null && typeof payload.personality !== 'string') {
    throw new Error(`Invalid ${contract} response: personality must be null or a string`);
  }
  for (const field of ['finalCash', 'peakWealth', 'startingCash', 'netProfit'] as const) {
    requireFiniteNumber(payload, field, contract);
  }
  requireBoolean(payload, 'leaderboardEligible', contract);
  requireString(payload, 'joinedAt', contract);
  for (const field of ['tradeCount', 'buyCount', 'sellCount'] as const) {
    requireFiniteNumber(payload, field, contract);
  }
  requireString(payload, 'settledAt', contract);
  return payload as unknown as ResultRow;
}

export function parseCycleResults(payload: unknown): CycleResults {
  const contract = 'results';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  requireString(payload, 'cycleId', contract);
  if (payload.status !== 'COMPLETED') {
    throw new Error(`Invalid ${contract} response: status must be COMPLETED`);
  }
  requireString(payload, 'startTime', contract);
  requireString(payload, 'endTime', contract);
  if (payload.settledAt !== null && typeof payload.settledAt !== 'string') {
    throw new Error(`Invalid ${contract} response: settledAt must be null or a string`);
  }
  requireFiniteNumber(payload, 'resultCount', contract);
  if (payload.totalResultCount !== undefined) {
    requireFiniteNumber(payload, 'totalResultCount', contract);
  }
  if (!Array.isArray(payload.results)) {
    throw new Error(`Invalid ${contract} response: results must be an array`);
  }
  (payload.results as unknown[]).forEach((row) => parseResultRow(row, contract));
  return payload as unknown as CycleResults;
}

export function parseRecentLeaderboards(payload: unknown): RecentLeaderboards {
  const contract = 'recent leaderboards';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  requireFiniteNumber(payload, 'limit', contract);
  requireFiniteNumber(payload, 'count', contract);
  if (!Array.isArray(payload.leaderboards)) {
    throw new Error(`Invalid ${contract} response: leaderboards must be an array`);
  }
  (payload.leaderboards as unknown[]).forEach((board) => parseCycleResults(board));
  return payload as unknown as RecentLeaderboards;
}

// Validate one FEE/TAX/EVENT ledger row at the boundary. The row keeps its
// full contract (balance before/after, internal eventKey) for completeness,
// but the activity UI renders only type/description/amount/time.
export function parseCashEvent(payload: unknown): CashEvent {
  const contract = 'cash event';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  requireFiniteNumber(payload, 'cashEventId', contract);
  if (payload.type !== 'FEE' && payload.type !== 'TAX' && payload.type !== 'EVENT') {
    throw new Error(`Invalid ${contract} response: unknown type ${JSON.stringify(payload.type)}`);
  }
  for (const field of ['amount', 'balanceBefore', 'balanceAfter'] as const) {
    requireFiniteNumber(payload, field, contract);
  }
  requireString(payload, 'description', contract);
  requireString(payload, 'eventKey', contract);
  requireString(payload, 'createdAt', contract);
  return payload as unknown as CashEvent;
}

export function parsePlayerRoundEconomy(payload: unknown): PlayerRoundEconomy {
  const contract = 'player round economy';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  if (!Array.isArray(payload.cashEvents)) {
    throw new Error(`Invalid ${contract} response: cashEvents must be an array`);
  }
  const participant = parseRoundParticipant(payload.participant);
  const cashEvents = (payload.cashEvents as unknown[]).map((row) => parseCashEvent(row));
  return { participant, cashEvents };
}

// --- V2-1/V2-3 market signals parser -------------------------------------------

const MARKET_PHASES: readonly MarketPhase[] = ['DIP', 'RISE', 'BOOM', 'FALL', 'DEAD'];
const MARKET_MOMENTA: readonly MarketMomentum[] = ['UP', 'DOWN', 'FLAT'];
const COLLAPSE_RISK_LEVELS: readonly CollapseRiskLevel[] = ['STABLE', 'SHAKY', 'DANGER', 'CRITICAL', 'DEAD'];

// SIM-15/16/17 public vocabularies (mirrors the backend redaction contract).
const PUBLIC_MARKET_PHASE_IDS: readonly PublicMarketPhaseId[] = [
  'GOLDEN_AGE', 'BOOM', 'BULL', 'BEAR', 'BUST', 'RECESSION'
];
const COIN_EVENT_DIRECTIONS: readonly CoinEventDirection[] = ['POSITIVE', 'NEGATIVE'];
// Matches the engine's simultaneous-activity cap: the backend never publishes
// more than five active events per coin, so a longer list is not the contract.
export const PUBLIC_MAX_EVENTS_PER_COIN = 5;

// Strict ISO 8601 with an explicit offset — the backend serialises with
// Date.toISOString(), and a timestamp that does not parse can never anchor a
// client countdown.
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function requireIsoTimestamp(payload: Record<string, unknown>, field: string, contract: string): void {
  const value = payload[field];
  if (typeof value !== 'string' || !ISO_8601_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ${contract} response: ${field} must be an ISO 8601 timestamp`);
  }
}

// The public market-phase block. Built field-by-field: id, display name and
// expiry ONLY — any leaked lifecycle state, sequence, modifier or start time
// is stripped at the boundary.
function parseMarketPhaseInfo(payload: unknown, contract: string): MarketPhaseInfo | null {
  if (payload === null) return null;
  if (!isRecord(payload)) {
    throw new Error(`Invalid ${contract} response: marketPhase must be null or an object`);
  }
  if (!PUBLIC_MARKET_PHASE_IDS.includes(payload.id as PublicMarketPhaseId)) {
    throw new Error(`Invalid ${contract} response: unknown market phase id ${JSON.stringify(payload.id)}`);
  }
  requireString(payload, 'name', contract);
  requireIsoTimestamp(payload, 'endsAt', contract);
  return {
    id: payload.id as PublicMarketPhaseId,
    name: payload.name as string,
    endsAt: payload.endsAt as string
  };
}

// One active coin event. Built field-by-field: name, direction, expiry ONLY —
// event ids, sequences, strength categories, signed modifiers and start times
// never survive.
function parseCoinSignalEvent(payload: unknown, contract: string): CoinSignalEvent {
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: event must be an object`);
  requireString(payload, 'name', contract);
  if (!COIN_EVENT_DIRECTIONS.includes(payload.direction as CoinEventDirection)) {
    throw new Error(`Invalid ${contract} response: unknown event direction ${JSON.stringify(payload.direction)}`);
  }
  requireIsoTimestamp(payload, 'endsAt', contract);
  return {
    name: payload.name as string,
    direction: payload.direction as CoinEventDirection,
    endsAt: payload.endsAt as string
  };
}

function parseTypicalRange(value: unknown, field: string, contract: string): void {
  if (value === null) return;
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`Invalid ${contract} response: ${field} must be null or a [min, max] pair`);
  }
  for (const bound of value) {
    if (typeof bound !== 'number' || !Number.isFinite(bound)) {
      throw new Error(`Invalid ${contract} response: ${field} bounds must be finite numbers`);
    }
  }
}

function parseMarketSignalCoin(payload: unknown, contract: string): MarketSignalCoin {
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: coin must be an object`);
  requireFiniteNumber(payload, 'coinId', contract);
  requireString(payload, 'name', contract);
  requireString(payload, 'symbol', contract);
  requireString(payload, 'archetype', contract);
  requireFiniteNumber(payload, 'currentPrice', contract);
  requireNullableFiniteNumber(payload, 'recentChangePct', contract);
  if (!MARKET_PHASES.includes(payload.phase as MarketPhase)) {
    throw new Error(`Invalid ${contract} response: unknown phase ${JSON.stringify(payload.phase)}`);
  }
  if (!MARKET_MOMENTA.includes(payload.momentum as MarketMomentum)) {
    throw new Error(`Invalid ${contract} response: unknown momentum ${JSON.stringify(payload.momentum)}`);
  }
  parseTypicalRange(payload.typicalCycleMinutes, 'typicalCycleMinutes', contract);
  parseTypicalRange(payload.typicalSwingPct, 'typicalSwingPct', contract);
  if (!COLLAPSE_RISK_LEVELS.includes(payload.collapseRisk as CollapseRiskLevel)) {
    throw new Error(`Invalid ${contract} response: unknown collapseRisk ${JSON.stringify(payload.collapseRisk)}`);
  }
  requireBoolean(payload, 'dead', contract);
  // Dead-coin reduced-payload consistency (backend marketSignalsService): a
  // collapsed coin is exactly £0 with the DEAD phase/risk markers; a live
  // coin never carries them.
  if (payload.dead === true && (payload.phase !== 'DEAD' || payload.collapseRisk !== 'DEAD')) {
    throw new Error(`Invalid ${contract} response: a dead coin must carry the DEAD phase and risk markers`);
  }
  if (payload.dead === false && (payload.phase === 'DEAD' || payload.collapseRisk === 'DEAD')) {
    throw new Error(`Invalid ${contract} response: a live coin cannot carry the DEAD phase or risk markers`);
  }
  // SIM-15: the active public events list is a hard contract (always present,
  // at most five entries); a dead coin's list is empty by contract.
  if (!Array.isArray(payload.events)) {
    throw new Error(`Invalid ${contract} response: events must be an array`);
  }
  if (payload.events.length > PUBLIC_MAX_EVENTS_PER_COIN) {
    throw new Error(`Invalid ${contract} response: events cannot exceed ${PUBLIC_MAX_EVENTS_PER_COIN} per coin`);
  }
  const events = (payload.events as unknown[]).map((event) => parseCoinSignalEvent(event, contract));
  // Build the result from contract fields only: any legacy/extra keys — a
  // seed, future phase timing, collapse schedule hints — are stripped at the
  // boundary and can never reach the UI.
  return {
    coinId: payload.coinId as number,
    name: payload.name as string,
    symbol: payload.symbol as string,
    archetype: payload.archetype as string,
    currentPrice: payload.currentPrice as number,
    recentChangePct: payload.recentChangePct as number | null,
    phase: payload.phase as MarketPhase,
    momentum: payload.momentum as MarketMomentum,
    typicalCycleMinutes: payload.typicalCycleMinutes as [number, number] | null,
    typicalSwingPct: payload.typicalSwingPct as [number, number] | null,
    collapseRisk: payload.collapseRisk as CollapseRiskLevel,
    dead: payload.dead as boolean,
    events
  };
}

export function parseMarketSignals(payload: unknown): MarketSignals {
  const contract = 'market signals';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  requireString(payload, 'apocalypseId', contract);
  requireFiniteNumber(payload, 'apocalypsePercent', contract);
  requireString(payload, 'serverTime', contract);
  // SIM-15: null is the legitimate between-phases state; anything else that
  // is not a conforming phase object fails closed.
  const marketPhase = parseMarketPhaseInfo(payload.marketPhase, contract);
  if (!Array.isArray(payload.coins)) {
    throw new Error(`Invalid ${contract} response: coins must be an array`);
  }
  const coins = (payload.coins as unknown[]).map((coin) => parseMarketSignalCoin(coin, contract));
  return {
    apocalypseId: payload.apocalypseId as string,
    apocalypsePercent: Math.min(100, Math.max(0, payload.apocalypsePercent as number)),
    serverTime: payload.serverTime as string,
    marketPhase,
    coins
  };
}

// --- HTTP plumbing ------------------------------------------------------------

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned a malformed response (HTTP ${response.status})`);
  }
}

// Extract the backend's user-facing message from either error envelope:
// game domain rejections use { status:'error', message }; legacy/auth use
// { msg }.
function errorMessageFrom(body: unknown, fallback: string): string {
  if (isRecord(body)) {
    if (typeof body.message === 'string' && body.message.length > 0) return body.message;
    if (typeof body.msg === 'string' && body.msg.length > 0) return body.msg;
  }
  return fallback;
}

async function gameFetch<T>(
  path: string,
  { token, method = 'GET', body, signal }: { token?: string; method?: string; body?: unknown; signal?: AbortSignal } = {},
  parse: (payload: unknown) => T
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const init: RequestInit = { method, headers, signal };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new Error('Network failure — the game server could not be reached');
  }
  const payload = await parseJsonSafe(response);

  if (response.status === 401) {
    throw new SessionExpiredError();
  }
  if (!response.ok) {
    throw new GameApiError(errorMessageFrom(payload, `Request failed (HTTP ${response.status})`), response.status);
  }
  // The game read/write APIs wrap payloads in { status:'success', data };
  // Core 1 /game/state is the bare object.
  const unwrapped = isRecord(payload) && payload.status === 'success' && 'data' in payload
    ? payload.data
    : payload;
  return parse(unwrapped);
}

// --- Core 1: game state --------------------------------------------------------

export async function getGameState(signal?: AbortSignal): Promise<GameState> {
  return gameFetch('/game/state', { signal }, parseGameState);
}

// --- Core 4: participation ensure + round trades -------------------------------

// Backend #17: participation is server-owned and automatic — every registered
// user is swept into each new Apocalypse at £10,000 Cash. POST /game/join
// survives as the idempotent ensure+read endpoint: the client calls it ONCE
// per (user, cycle) from GameContext to fetch the authoritative participant
// immediately rather than waiting for the next reconcile sweep. There is no
// player-facing join control.
export async function joinGame(token: string, signal?: AbortSignal): Promise<RoundParticipant> {
  return gameFetch('/game/join', { token, method: 'POST', signal }, (payload) => {
    if (!isRecord(payload)) throw new Error('Invalid join response: expected a JSON object');
    return parseRoundParticipant(payload.participant);
  });
}

export async function buyGameTrade(
  token: string,
  { cycleId, coinId, amount }: { cycleId: string; coinId: number; amount: number },
  signal?: AbortSignal
): Promise<RoundTradeResult> {
  return gameFetch(
    '/game/trades/buy',
    { token, method: 'POST', body: { cycleId, coin_id: coinId, amount }, signal },
    parseRoundTradeResult
  );
}

export async function sellGameTrade(
  token: string,
  { cycleId, coinId, amount }: { cycleId: string; coinId: number; amount: number },
  signal?: AbortSignal
): Promise<RoundTradeResult> {
  return gameFetch(
    '/game/trades/sell',
    { token, method: 'POST', body: { cycleId, coin_id: coinId, amount }, signal },
    parseRoundTradeResult
  );
}

// --- Core 6: leaderboard + results ----------------------------------------------

export async function getLiveLeaderboard(signal?: AbortSignal): Promise<LiveLeaderboard> {
  return gameFetch('/game/leaderboard', { signal }, parseLiveLeaderboard);
}

export async function getCycleResults(cycleId: string, signal?: AbortSignal): Promise<CycleResults> {
  return gameFetch(`/game/results/${encodeURIComponent(cycleId)}`, { signal }, parseCycleResults);
}

export async function getRecentLeaderboards(limit?: number, signal?: AbortSignal): Promise<RecentLeaderboards> {
  const query = typeof limit === 'number' ? `?limit=${encodeURIComponent(String(limit))}` : '';
  return gameFetch(`/game/leaderboards/recent${query}`, { signal }, parseRecentLeaderboards);
}

// --- Backend #18 / fcoins_y #11: player round economy -------------------------

// Authenticated read of the caller's authoritative participant plus their
// recent executed FEE/TAX/EVENT cash events. The server reconciles the
// lifecycle first and falls back to the most recent participant during the
// settlement hand-off — the caller is responsible for only adopting a
// participant that belongs to the live apocalypse.
export async function getMyRoundEconomy(
  token: string,
  { limit, signal }: { limit?: number; signal?: AbortSignal } = {}
): Promise<PlayerRoundEconomy> {
  const query = typeof limit === 'number' ? `?limit=${encodeURIComponent(String(limit))}` : '';
  return gameFetch(`/game/participant${query}`, { token, signal }, parsePlayerRoundEconomy);
}

// --- V2-1/V2-3: public market signals ------------------------------------------

// Public coarse market signals for the live round. The payload belongs to one
// apocalypse (apocalypseId) — callers adopt it only for the live cycle so a
// settlement hand-off can never show the previous round's market as current.
export async function getMarketSignals(signal?: AbortSignal): Promise<MarketSignals> {
  return gameFetch('/game/market-signals', { signal }, parseMarketSignals);
}
