import { API_BASE_URL } from './apiConfig.ts';

// Apocalypse Monitor Phase 3 Plan 1: typed REST client for the read-only
// operator diagnostics monitor (backend issue #21, Apocalypse Monitor
// Phase 2/2.5). This module is the ONLY frontend boundary that touches
// /game/diagnostics/*; the player-facing gameService is contractually barred
// from those routes (see scripts/ui-contract.mjs).
//
// Token handling rules (hard requirements):
//   * The operator token is supplied by the caller (entered manually on the
//     internal dashboard) and used ONLY as `Authorization: Bearer <token>`.
//   * It is never hard-coded, never read from Vite env, never persisted to
//     localStorage/sessionStorage and NEVER logged or embedded in an error
//     message — a 401 surfaces the fixed INVALID_MONITOR_TOKEN_MESSAGE.
//
// Both endpoints answer { status:'success', data } on 200; domain rejections
// are { status:'error', message }, auth failures { msg } and the fail-closed
// "diagnostics disabled" shape is { message:'Route not found' } with 404.

export type MonitorCycleStatus = 'ACTIVE' | 'SETTLING' | 'COMPLETED';

export type MonitorAttribution = 'exact' | 'time_window_derived' | 'mixed';

// One row from GET /game/diagnostics/monitor/cycles (newest-first discovery).
export interface MonitorCycleSummary {
  /** Public apocalypse identifier, e.g. "APOC-0042". */
  cycleId: string;
  status: MonitorCycleStatus;
  startTime: string;
  endTime: string;
  settledAt: string | null;
  /** True iff at least one price_history row carries exact cycle provenance. */
  hasExactHistory: boolean;
}

export interface MonitorCyclesResult {
  limit: number;
  returned: number;
  cycles: MonitorCycleSummary[];
}

// One raw price_history observation. `source` is the backend provenance tag
// (e.g. 'COLLAPSE' for an executed collapse); legacy rows carry null.
export interface MonitorPricePoint {
  /** ISO 8601 observation timestamp. */
  time: string;
  price: number;
  source: string | null;
}

export interface MonitorCoinHistory {
  sampleCount: number;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  /** Dataset attribution for this coin; null when the coin has no rows. */
  attribution: MonitorAttribution | null;
  points: MonitorPricePoint[];
}

export interface MonitorCoin {
  coinId: number;
  name: string;
  symbol: string;
  history: MonitorCoinHistory;
}

export interface MonitorCycleInfo {
  cycleId: string;
  status: MonitorCycleStatus;
  startTime: string;
  endTime: string;
  settlementStartedAt: string | null;
  settledAt: string | null;
  /** Database-clock timestamp of the read (constant for the snapshot). */
  observedAt: string;
}

// GET /game/diagnostics/monitor?cycleId=APOC-NNNN payload.
export interface MonitorSnapshot {
  cycle: MonitorCycleInfo;
  /** Whole-dataset attribution: exact / time_window_derived / mixed. */
  attribution: MonitorAttribution;
  /** False whenever any derived (legacy, time-window attributed) row is used. */
  exact: boolean;
  coins: MonitorCoin[];
  warnings: string[];
}

// Domain/API error carrying the backend HTTP status and the user-facing
// backend message — never the operator token.
export class MonitorApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'MonitorApiError';
    this.status = status;
  }
}

// Fixed 401 message: the backend's auth failure body carries no detail, and
// the token itself must never appear in any surfaced string.
export const INVALID_MONITOR_TOKEN_MESSAGE =
  'Invalid diagnostics token. Check the operator token and try again.';

// --- Validation helpers -------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireString(payload: Record<string, unknown>, field: string, contract: string): void {
  if (typeof payload[field] !== 'string' || (payload[field] as string).length === 0) {
    throw new Error(`Invalid ${contract} response: ${field} must be a non-empty string`);
  }
}

function requireNullableString(payload: Record<string, unknown>, field: string, contract: string): void {
  if (payload[field] !== null && typeof payload[field] !== 'string') {
    throw new Error(`Invalid ${contract} response: ${field} must be null or a string`);
  }
}

function requireFiniteNumber(payload: Record<string, unknown>, field: string, contract: string): void {
  if (typeof payload[field] !== 'number' || !Number.isFinite(payload[field] as number)) {
    throw new Error(`Invalid ${contract} response: ${field} must be a finite number`);
  }
}

function requireStatus(payload: Record<string, unknown>, contract: string): MonitorCycleStatus {
  const status = payload.status;
  if (status !== 'ACTIVE' && status !== 'SETTLING' && status !== 'COMPLETED') {
    throw new Error(`Invalid ${contract} response: unknown status ${JSON.stringify(status)}`);
  }
  return status;
}

function requireAttribution(payload: Record<string, unknown>, field: string, contract: string): MonitorAttribution {
  const value = payload[field];
  if (value !== 'exact' && value !== 'time_window_derived' && value !== 'mixed') {
    throw new Error(`Invalid ${contract} response: unknown attribution ${JSON.stringify(value)}`);
  }
  return value;
}

// --- Parsers (validate the wire contract before handing it to callers) ---------

export function parseMonitorCycles(payload: unknown): MonitorCyclesResult {
  const contract = 'monitor cycles';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  requireFiniteNumber(payload, 'limit', contract);
  requireFiniteNumber(payload, 'returned', contract);
  if (!Array.isArray(payload.cycles)) {
    throw new Error(`Invalid ${contract} response: cycles must be an array`);
  }
  for (const row of payload.cycles as unknown[]) {
    if (!isRecord(row)) throw new Error(`Invalid ${contract} response: cycle must be an object`);
    requireString(row, 'cycleId', contract);
    requireStatus(row, contract);
    requireString(row, 'startTime', contract);
    requireString(row, 'endTime', contract);
    requireNullableString(row, 'settledAt', contract);
    if (typeof row.hasExactHistory !== 'boolean') {
      throw new Error(`Invalid ${contract} response: hasExactHistory must be a boolean`);
    }
  }
  return payload as unknown as MonitorCyclesResult;
}

function parseMonitorPoint(payload: unknown, contract: string): MonitorPricePoint {
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: point must be an object`);
  requireString(payload, 'time', contract);
  requireFiniteNumber(payload, 'price', contract);
  requireNullableString(payload, 'source', contract);
  return payload as unknown as MonitorPricePoint;
}

function parseMonitorCoin(payload: unknown, contract: string): MonitorCoin {
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: coin must be an object`);
  requireFiniteNumber(payload, 'coinId', contract);
  requireString(payload, 'name', contract);
  requireString(payload, 'symbol', contract);
  if (!isRecord(payload.history)) throw new Error(`Invalid ${contract} response: history must be an object`);
  const history = payload.history;
  requireFiniteNumber(history, 'sampleCount', contract);
  requireNullableString(history, 'firstObservedAt', contract);
  requireNullableString(history, 'lastObservedAt', contract);
  if (history.attribution !== null) {
    requireAttribution(history, 'attribution', contract);
  }
  if (!Array.isArray(history.points)) {
    throw new Error(`Invalid ${contract} response: history.points must be an array`);
  }
  (history.points as unknown[]).forEach((point) => parseMonitorPoint(point, contract));
  return payload as unknown as MonitorCoin;
}

export function parseMonitorSnapshot(payload: unknown): MonitorSnapshot {
  const contract = 'monitor snapshot';
  if (!isRecord(payload)) throw new Error(`Invalid ${contract} response: expected a JSON object`);
  if (!isRecord(payload.cycle)) throw new Error(`Invalid ${contract} response: cycle must be an object`);
  requireString(payload.cycle, 'cycleId', contract);
  requireStatus(payload.cycle, contract);
  requireString(payload.cycle, 'startTime', contract);
  requireString(payload.cycle, 'endTime', contract);
  requireNullableString(payload.cycle, 'settlementStartedAt', contract);
  requireNullableString(payload.cycle, 'settledAt', contract);
  requireString(payload.cycle, 'observedAt', contract);
  requireAttribution(payload, 'attribution', contract);
  if (typeof payload.exact !== 'boolean') {
    throw new Error(`Invalid ${contract} response: exact must be a boolean`);
  }
  if (!Array.isArray(payload.coins)) {
    throw new Error(`Invalid ${contract} response: coins must be an array`);
  }
  (payload.coins as unknown[]).forEach((coin) => parseMonitorCoin(coin, contract));
  if (!Array.isArray(payload.warnings)) {
    throw new Error(`Invalid ${contract} response: warnings must be an array`);
  }
  for (const warning of payload.warnings as unknown[]) {
    if (typeof warning !== 'string') {
      throw new Error(`Invalid ${contract} response: warnings entries must be strings`);
    }
  }
  return payload as unknown as MonitorSnapshot;
}

// --- HTTP plumbing -------------------------------------------------------------

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned a malformed response (HTTP ${response.status})`);
  }
}

// Extract the backend's user-facing message from either error envelope:
// domain rejections use { status:'error', message }; auth/legacy use { msg }.
function errorMessageFrom(body: unknown, fallback: string): string {
  if (isRecord(body)) {
    if (typeof body.message === 'string' && body.message.length > 0) return body.message;
    if (typeof body.msg === 'string' && body.msg.length > 0) return body.msg;
  }
  return fallback;
}

async function monitorFetch<T>(
  path: string,
  token: string,
  signal: AbortSignal | undefined,
  parse: (payload: unknown) => T
): Promise<T> {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    throw new Error('A diagnostics token is required.');
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${trimmed}`
  };
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method: 'GET', headers, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new Error('Network failure — the diagnostics server could not be reached');
  }
  const payload = await parseJsonSafe(response);
  if (response.status === 401) {
    // Fixed message — the token is never echoed into the error surface.
    throw new MonitorApiError(INVALID_MONITOR_TOKEN_MESSAGE, 401);
  }
  if (!response.ok) {
    throw new MonitorApiError(errorMessageFrom(payload, `Request failed (HTTP ${response.status})`), response.status);
  }
  // The diagnostics API wraps payloads in { status:'success', data }.
  const unwrapped = isRecord(payload) && payload.status === 'success' && 'data' in payload
    ? payload.data
    : payload;
  return parse(unwrapped);
}

// --- Endpoints -----------------------------------------------------------------

// Newest-first cycle discovery for the monitor dashboard.
export async function getMonitorCycles(token: string, signal?: AbortSignal): Promise<MonitorCyclesResult> {
  return monitorFetch('/game/diagnostics/monitor/cycles', token, signal, parseMonitorCycles);
}

// Raw per-coin price series for one cycle (APOC-NNNN), with provenance
// attribution and warnings.
export async function getMonitorSnapshot(
  token: string,
  cycleId: string,
  signal?: AbortSignal
): Promise<MonitorSnapshot> {
  return monitorFetch(
    `/game/diagnostics/monitor?cycleId=${encodeURIComponent(cycleId)}`,
    token,
    signal,
    parseMonitorSnapshot
  );
}
