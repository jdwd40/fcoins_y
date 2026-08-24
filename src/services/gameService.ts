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

export interface RoundHolding {
  coinId: number;
  symbol: string;
  quantity: number;
  currentPrice: number;
  currentValue: number;
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
  if (!Array.isArray(payload.holdings)) {
    throw new Error(`Invalid ${contract} response: holdings must be an array`);
  }
  for (const holding of payload.holdings as unknown[]) {
    if (!isRecord(holding)) throw new Error(`Invalid ${contract} response: holding must be an object`);
    requireFiniteNumber(holding, 'coinId', contract);
    requireString(holding, 'symbol', contract);
    for (const field of ['quantity', 'currentPrice', 'currentValue'] as const) {
      requireFiniteNumber(holding, field, contract);
    }
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
