import { API_BASE_URL } from './apiConfig.ts';
import { SessionExpiredError } from './transactionService.ts';
import { GameApiError } from './gameService.ts';

// Persistent-market Stage 6: typed REST client for the additive persistent
// backend surface (/api/persistent/*). This is the ONLY client the new
// gameplay uses for buy/sell/account/portfolio/transaction flows.
//
// Contract guarantees (enforced by the backend and re-validated here):
//   * No Apocalypse/cycle identifier exists anywhere in these requests or
//     responses — the persistent economy is scoped to THE active world,
//     resolved server-side;
//   * the execution price is server-owned: trade requests carry only
//     { coin_id, quantity } — never a price, never a cycleId;
//   * the authenticated token is the account owner: no user_id is ever sent;
//   * every wire payload is validated at this boundary before it reaches UI
//     state — a malformed or non-conforming response fails loudly here.
//
// The old cycle-shaped client (gameService.ts) is untouched: it still serves
// the retained compatibility surfaces (results/round panels and the legacy
// cycle leaderboard) until their post-deploy retirement (Stage 13 debt).
// Stage 10B moves the player-facing live board onto GET /persistent/leaderboard.

export type PersistentTradeSide = 'BUY' | 'SELL';

export interface PersistentHolding {
  coinId: number;
  symbol: string;
  quantity: number;
  /** Total remaining cost basis (GBP) for the open quantity. */
  costBasis: number;
  /** Server-computed weighted average entry price; null for a zero quantity. */
  averageEntryPrice: number | null;
  /** Server-published live price used for the value figure. */
  currentPrice: number;
  currentValue: number;
  /** currentValue - costBasis, server-rounded to 2dp. */
  unrealizedPnl: number;
  /** P&L as a percentage of cost basis; null when basis is £0. */
  unrealizedPnlPct: number | null;
}

export interface PersistentAccount {
  accountId: number;
  worldId: number;
  userId: number;
  startingCash: number;
  cash: number;
  /** Outstanding bot-loan principal (always 0 for humans — debt is bot-only). */
  debt: number;
  /** ISO 8601 provisioning instant. */
  provisionedAt: string;
  holdings: PersistentHolding[];
  holdingsValue: number;
  /** cash + live holdings value — the server-owned figure, never derived. */
  wealth: number;
  /** cash + live holdings value − debt — the persistent leaderboard figure. */
  netWealth: number;
}

// GET /persistent/account response data: the account either exists (full
// state) or has never been provisioned (registration provisions it
// idempotently; the first trade is the safety net).
export type PersistentAccountResponse =
  | { provisioned: false }
  | ({ provisioned: true } & PersistentAccount);

export interface PersistentTransaction {
  persistentTransactionId: number;
  type: PersistentTradeSide;
  coinId: number;
  symbol: string;
  quantity: number;
  price: number;
  totalAmount: number;
  /** ISO 8601 execution timestamp. */
  createdAt: string;
}

export interface PersistentTransactionsResponse {
  provisioned: boolean;
  transactions: PersistentTransaction[];
}

export interface PersistentTradeResult {
  transaction: {
    persistentTransactionId: number;
    type: PersistentTradeSide;
    coinId: number;
    quantity: number;
    /** The server-locked execution price — reported back, never requested. */
    price: number;
    totalAmount: number;
  };
  /** The authoritative account state AFTER the committed trade. */
  account: PersistentAccount;
}

// Stage 10B: GET /persistent/leaderboard — public ranking of every provisioned
// persistent account in THE active world. Backend rank is authoritative;
// the client never re-sorts or recalculates rank.
export interface PersistentLeaderboardEntry {
  rank: number;
  accountId: number;
  userId: number;
  username: string;
  isBot: boolean;
  personality: string | null;
  cash: number;
  holdingsValue: number;
  debt: number;
  /** cash + holdingsValue − debt — the persistent score. May be negative. */
  netWorth: number;
}

export interface PersistentLeaderboard {
  /** Null when no active world is provisioned yet (entries will be []). */
  worldId: number | null;
  serverTime: string;
  /** Backend order is authoritative — never re-sort client-side. */
  entries: PersistentLeaderboardEntry[];
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

// The persistent contract is world-scoped, never cycle-scoped: any leaked
// Apocalypse/cycle identifier in a persistent payload is a contract breach
// and fails loudly instead of silently re-coupling the client to cycles.
function forbidCycleFields(payload: Record<string, unknown>, contract: string): void {
  for (const field of ['apocalypseId', 'cycleId', 'apocalypse_id', 'cycle_id']) {
    if (field in payload) {
      throw new Error(`Invalid ${contract} response: persistent payloads never carry ${field}`);
    }
  }
}

function requireNullableFiniteNumber(payload: Record<string, unknown>, field: string, contract: string): void {
  if (payload[field] !== null && (typeof payload[field] !== 'number' || !Number.isFinite(payload[field] as number))) {
    throw new Error(`Invalid ${contract} response: ${field} must be null or a finite number`);
  }
}

function requireBoolean(payload: Record<string, unknown>, field: string, contract: string): void {
  if (typeof payload[field] !== 'boolean') {
    throw new Error(`Invalid ${contract} response: ${field} must be a boolean`);
  }
}

function parsePersistentHolding(payload: unknown, contract: string): PersistentHolding {
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: holding must be an object`);
  forbidCycleFields(payload, contract);
  requireFiniteNumber(payload, 'coinId', contract);
  requireString(payload, 'symbol', contract);
  for (const field of ['quantity', 'costBasis', 'currentPrice', 'currentValue', 'unrealizedPnl'] as const) {
    requireFiniteNumber(payload, field, contract);
  }
  requireNullableFiniteNumber(payload, 'averageEntryPrice', contract);
  requireNullableFiniteNumber(payload, 'unrealizedPnlPct', contract);
  return payload as unknown as PersistentHolding;
}

export function parsePersistentAccount(payload: unknown): PersistentAccount {
  const contract = 'persistent account';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  forbidCycleFields(payload, contract);
  for (const field of ['accountId', 'worldId', 'userId'] as const) {
    requireFiniteNumber(payload, field, contract);
  }
  for (const field of ['startingCash', 'cash', 'debt', 'holdingsValue', 'wealth', 'netWealth'] as const) {
    requireFiniteNumber(payload, field, contract);
  }
  requireString(payload, 'provisionedAt', contract);
  if (!Array.isArray(payload.holdings)) {
    throw new Error(`Invalid ${contract} response: holdings must be an array`);
  }
  const holdings = (payload.holdings as unknown[]).map((holding) => parsePersistentHolding(holding, contract));
  return {
    accountId: payload.accountId as number,
    worldId: payload.worldId as number,
    userId: payload.userId as number,
    startingCash: payload.startingCash as number,
    cash: payload.cash as number,
    debt: payload.debt as number,
    provisionedAt: payload.provisionedAt as string,
    holdings,
    holdingsValue: payload.holdingsValue as number,
    wealth: payload.wealth as number,
    netWealth: payload.netWealth as number
  };
}

export function parsePersistentAccountResponse(payload: unknown): PersistentAccountResponse {
  const contract = 'persistent account';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  forbidCycleFields(payload, contract);
  if (payload.provisioned === false) {
    return { provisioned: false };
  }
  if (payload.provisioned !== true) {
    throw new Error(`Invalid ${contract} response: provisioned must be a boolean`);
  }
  return { provisioned: true, ...parsePersistentAccount(payload) };
}

export function parsePersistentTradeResult(payload: unknown): PersistentTradeResult {
  const contract = 'persistent trade';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  forbidCycleFields(payload, contract);
  if (!isRecord(payload.transaction)) {
    throw new Error(`Invalid ${contract} response: transaction must be an object`);
  }
  forbidCycleFields(payload.transaction, contract);
  requireFiniteNumber(payload.transaction, 'persistentTransactionId', contract);
  if (payload.transaction.type !== 'BUY' && payload.transaction.type !== 'SELL') {
    throw new Error(`Invalid ${contract} response: unknown transaction type`);
  }
  for (const field of ['coinId', 'quantity', 'price', 'totalAmount'] as const) {
    requireFiniteNumber(payload.transaction, field, contract);
  }
  const account = parsePersistentAccount(payload.account);
  return {
    transaction: payload.transaction as unknown as PersistentTradeResult['transaction'],
    account
  };
}

export function parsePersistentTransaction(payload: unknown): PersistentTransaction {
  const contract = 'persistent transaction';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  forbidCycleFields(payload, contract);
  requireFiniteNumber(payload, 'persistentTransactionId', contract);
  if (payload.type !== 'BUY' && payload.type !== 'SELL') {
    throw new Error(`Invalid ${contract} response: unknown type ${JSON.stringify(payload.type)}`);
  }
  requireFiniteNumber(payload, 'coinId', contract);
  requireString(payload, 'symbol', contract);
  for (const field of ['quantity', 'price', 'totalAmount'] as const) {
    requireFiniteNumber(payload, field, contract);
  }
  requireString(payload, 'createdAt', contract);
  return payload as unknown as PersistentTransaction;
}

export function parsePersistentTransactionsResponse(payload: unknown): PersistentTransactionsResponse {
  const contract = 'persistent transactions';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  forbidCycleFields(payload, contract);
  if (typeof payload.provisioned !== 'boolean') {
    throw new Error(`Invalid ${contract} response: provisioned must be a boolean`);
  }
  if (!Array.isArray(payload.transactions)) {
    throw new Error(`Invalid ${contract} response: transactions must be an array`);
  }
  return {
    provisioned: payload.provisioned,
    transactions: (payload.transactions as unknown[]).map((row) => parsePersistentTransaction(row))
  };
}

export function parsePersistentLeaderboardEntry(payload: unknown): PersistentLeaderboardEntry {
  const contract = 'persistent leaderboard entry';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  forbidCycleFields(payload, contract);
  for (const field of ['rank', 'accountId', 'userId', 'cash', 'holdingsValue', 'debt', 'netWorth'] as const) {
    requireFiniteNumber(payload, field, contract);
  }
  requireString(payload, 'username', contract);
  requireBoolean(payload, 'isBot', contract);
  if (payload.personality !== null && typeof payload.personality !== 'string') {
    throw new Error(`Invalid ${contract} response: personality must be null or a string`);
  }
  return {
    rank: payload.rank as number,
    accountId: payload.accountId as number,
    userId: payload.userId as number,
    username: payload.username as string,
    isBot: payload.isBot as boolean,
    personality: payload.personality as string | null,
    cash: payload.cash as number,
    holdingsValue: payload.holdingsValue as number,
    debt: payload.debt as number,
    netWorth: payload.netWorth as number
  };
}

export function parsePersistentLeaderboard(payload: unknown): PersistentLeaderboard {
  const contract = 'persistent leaderboard';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  forbidCycleFields(payload, contract);
  if (payload.worldId !== null && (typeof payload.worldId !== 'number' || !Number.isFinite(payload.worldId as number))) {
    throw new Error(`Invalid ${contract} response: worldId must be null or a finite number`);
  }
  requireString(payload, 'serverTime', contract);
  if (!Array.isArray(payload.entries)) {
    throw new Error(`Invalid ${contract} response: entries must be an array`);
  }
  // Preserve backend order verbatim — never re-sort or recompute rank here.
  const entries = (payload.entries as unknown[]).map((row) => parsePersistentLeaderboardEntry(row));
  return {
    worldId: payload.worldId as number | null,
    serverTime: payload.serverTime as string,
    entries
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

// Same error-envelope convention as gameService: domain rejections carry
// { status:'error', message }; legacy/auth failures carry { msg }.
function errorMessageFrom(body: unknown, fallback: string): string {
  if (isRecord(body)) {
    if (typeof body.message === 'string' && body.message.length > 0) return body.message;
    if (typeof body.msg === 'string' && body.msg.length > 0) return body.msg;
  }
  return fallback;
}

async function persistentFetch<T>(
  path: string,
  { token, method = 'GET', body, signal }: { token?: string; method?: string; body?: unknown; signal?: AbortSignal },
  parse: (payload: unknown) => T
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json'
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
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
  // The persistent API wraps payloads in { status:'success', data }.
  const unwrapped = isRecord(payload) && payload.status === 'success' && 'data' in payload
    ? payload.data
    : payload;
  return parse(unwrapped);
}

// --- Endpoints -----------------------------------------------------------------

// The caller's persistent account (cash, holdings at live server value,
// wealth) — or provisioned:false before the idempotent first provisioning.
export async function getPersistentAccount(token: string, signal?: AbortSignal): Promise<PersistentAccountResponse> {
  return persistentFetch('/persistent/account', { token, signal }, parsePersistentAccountResponse);
}

// The caller's own persistent trade ledger, newest first, server-bounded.
export async function getPersistentTransactions(
  token: string,
  { limit, signal }: { limit?: number; signal?: AbortSignal } = {}
): Promise<PersistentTransactionsResponse> {
  const query = typeof limit === 'number' ? `?limit=${encodeURIComponent(String(limit))}` : '';
  return persistentFetch(`/persistent/transactions${query}`, { token, signal }, parsePersistentTransactionsResponse);
}

// Buy at the server-locked live price. The request is exactly
// { coin_id, quantity } — no price, no cycle id, no user id.
export async function buyPersistentTrade(
  token: string,
  { coinId, quantity }: { coinId: number; quantity: number },
  signal?: AbortSignal
): Promise<PersistentTradeResult> {
  return persistentFetch(
    '/persistent/trades/buy',
    { token, method: 'POST', body: { coin_id: coinId, quantity }, signal },
    parsePersistentTradeResult
  );
}

// Sell at the server-locked live price. Same request shape as the buy.
export async function sellPersistentTrade(
  token: string,
  { coinId, quantity }: { coinId: number; quantity: number },
  signal?: AbortSignal
): Promise<PersistentTradeResult> {
  return persistentFetch(
    '/persistent/trades/sell',
    { token, method: 'POST', body: { coin_id: coinId, quantity }, signal },
    parsePersistentTradeResult
  );
}

// Stage 10B: public persistent leaderboard for THE active world. No auth —
// matches the legacy GET /game/leaderboard convention. worldId may be null
// with entries: [] when no world is provisioned; never fabricate rows.
export async function getPersistentLeaderboard(signal?: AbortSignal): Promise<PersistentLeaderboard> {
  return persistentFetch('/persistent/leaderboard', { signal }, parsePersistentLeaderboard);
}
