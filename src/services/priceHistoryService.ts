// Issue #12: central per-coin price-history service for the compact card
// sparklines. One module-level store feeds EVERY card so a full market grid
// never creates independent per-card polling loops coupled to the normal
// GameContext poll:
//
//   - dedupe: one in-flight request per coin/range, shared by all subscribers;
//   - cache: successful responses are kept for HISTORY_CACHE_TTL_MS (matching
//     the backend's `Cache-Control: public, max-age=10` on this endpoint);
//   - refresh: a single shared timer revisits subscribed entries roughly
//     every HISTORY_REFRESH_MS (12s — inside the issue's 10–15s cadence);
//   - isolation: nothing here listens to game state, so an unrelated poll or
//     trade can never refetch every chart;
//   - safety: unsubscribed entries are dropped and their requests aborted, and
//     a response that lands after its entry went away is discarded;
//   - resilience: a failed refresh keeps the last good line
//     (stale-while-revalidate); only a coin with NO data at all shows the
//     error state.
//
// The store is framework-free; the React binding lives in
// hooks/useCoinSparkline.ts. Tests inject fake fetch/time/timers through
// createPriceHistoryStore.

import { API_BASE_URL } from './apiConfig.ts';
import type { PriceHistoryResponse, PricePoint } from '../types.ts';
import type { SparklineRange } from '../utils/sparkline.ts';

// Matches the backend's 10s HTTP cache on GET /api/coins/:id/price-history.
export const HISTORY_CACHE_TTL_MS = 10_000;
// Shared refresh cadence for subscribed entries (issue #12: ~every 10–15s).
export const HISTORY_REFRESH_MS = 12_000;

export interface CoinHistorySnapshot {
  status: 'loading' | 'ready' | 'error';
  points: PricePoint[];
  latestValue: number | null;
  error: string | null;
  /** Epoch ms of the last successful fetch (null = never succeeded). */
  fetchedAt: number | null;
}

// Stable identity for "no entry yet" so useSyncExternalStore never loops.
const EMPTY_SNAPSHOT: CoinHistorySnapshot = {
  status: 'loading',
  points: [],
  latestValue: null,
  error: null,
  fetchedAt: null
};

interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type HistoryFetchImpl = (url: string, init: { signal: AbortSignal }) => Promise<FetchResponseLike>;

export interface PriceHistoryStoreDeps {
  fetchImpl?: HistoryFetchImpl;
  now?: () => number;
  setIntervalImpl?: (handler: () => void, ms: number) => unknown;
  clearIntervalImpl?: (handle: unknown) => void;
  baseUrl?: string;
}

interface HistoryEntry {
  key: string;
  coinId: number;
  range: SparklineRange;
  snapshot: CoinHistorySnapshot;
  listeners: Set<() => void>;
  /** Shared in-flight request; concurrent subscribers attach to it. */
  inflight: AbortController | null;
  /** Monotonic request id; a late response from a superseded/removed entry is discarded. */
  requestSeq: number;
}

export interface PriceHistoryStore {
  /** Subscribe to one coin/range. Returns the unsubscribe function. */
  subscribe(coinId: number, range: SparklineRange, listener: () => void): () => void;
  /** Current immutable snapshot for one coin/range (stable identity). */
  getSnapshot(coinId: number, range: SparklineRange): CoinHistorySnapshot;
  /** Test/diagnostic aid: number of live entries. */
  size(): number;
}

export function createPriceHistoryStore(deps: PriceHistoryStoreDeps = {}): PriceHistoryStore {
  const fetchImpl: HistoryFetchImpl = deps.fetchImpl ?? ((url, init) => fetch(url, init));
  const now = deps.now ?? (() => Date.now());
  const setIntervalImpl = deps.setIntervalImpl ?? ((handler, ms) => setInterval(handler, ms));
  const clearIntervalImpl = deps.clearIntervalImpl ?? ((handle) => clearInterval(handle as Parameters<typeof clearInterval>[0]));
  const baseUrl = deps.baseUrl ?? API_BASE_URL;

  const entries = new Map<string, HistoryEntry>();
  let timer: unknown = null;

  const keyOf = (coinId: number, range: SparklineRange) => `${coinId}:${range}`;

  function notify(entry: HistoryEntry): void {
    for (const listener of entry.listeners) listener();
  }

  function ensureTimer(): void {
    if (timer === null && entries.size > 0) {
      timer = setIntervalImpl(refreshStaleEntries, HISTORY_REFRESH_MS);
    }
  }

  function stopTimerIfIdle(): void {
    if (timer !== null && entries.size === 0) {
      clearIntervalImpl(timer);
      timer = null;
    }
  }

  async function request(entry: HistoryEntry): Promise<void> {
    // Dedupe: a concurrent subscriber (or an early refresh tick) never
    // doubles the request for the same coin/range.
    if (entry.inflight !== null) return;
    const controller = new AbortController();
    entry.inflight = controller;
    const seq = ++entry.requestSeq;
    try {
      const response = await fetchImpl(
        `${baseUrl}/coins/${entry.coinId}/price-history?range=${entry.range}`,
        { signal: controller.signal }
      );
      if (!response.ok) {
        throw new Error(`Price history unavailable (HTTP ${response.status})`);
      }
      const payload = (await response.json()) as PriceHistoryResponse;
      // Stale-response guard: the entry was removed (last subscriber left)
      // or a newer request superseded this one — discard silently.
      if (entries.get(entry.key) !== entry || entry.requestSeq !== seq) return;
      entry.snapshot = {
        status: 'ready',
        points: Array.isArray(payload.points) ? payload.points : [],
        latestValue: typeof payload.latestValue === 'number' ? payload.latestValue : null,
        error: null,
        fetchedAt: now()
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (entries.get(entry.key) !== entry || entry.requestSeq !== seq) return;
      const message = err instanceof Error ? err.message : 'Price history unavailable';
      // Keep the last good line on a refresh failure; only a coin with no
      // data at all enters the explicit error state.
      entry.snapshot = { ...entry.snapshot, status: entry.snapshot.fetchedAt === null ? 'error' : 'ready', error: message };
    } finally {
      if (entry.inflight === controller) entry.inflight = null;
      if (entries.get(entry.key) === entry) notify(entry);
    }
  }

  function refreshStaleEntries(): void {
    const at = now();
    for (const entry of entries.values()) {
      if (entry.listeners.size === 0) continue;
      if (entry.snapshot.fetchedAt === null) continue; // initial load in flight
      if (at - entry.snapshot.fetchedAt >= HISTORY_CACHE_TTL_MS) void request(entry);
    }
  }

  return {
    subscribe(coinId, range, listener) {
      const key = keyOf(coinId, range);
      let entry = entries.get(key);
      if (!entry) {
        entry = {
          key,
          coinId,
          range,
          snapshot: EMPTY_SNAPSHOT,
          listeners: new Set(),
          inflight: null,
          requestSeq: 0
        };
        entries.set(key, entry);
      }
      entry.listeners.add(listener);
      ensureTimer();
      // Serve a fresh cache hit without any request; otherwise fetch (a
      // stale cache line is shown immediately and refreshed in the
      // background — the card never blanks a drawn line).
      const age = entry.snapshot.fetchedAt === null ? null : now() - entry.snapshot.fetchedAt;
      if (age === null || age >= HISTORY_CACHE_TTL_MS) void request(entry);
      return () => {
        entry.listeners.delete(listener);
        if (entry.listeners.size === 0) {
          // Card unmounted / coin left the grid / range changed: abort the
          // in-flight request and drop the entry so no late response can
          // update anything.
          entry.inflight?.abort();
          entries.delete(key);
          stopTimerIfIdle();
        }
      };
    },
    getSnapshot(coinId, range) {
      return entries.get(keyOf(coinId, range))?.snapshot ?? EMPTY_SNAPSHOT;
    },
    size() {
      return entries.size;
    }
  };
}

// The one shared store every coin card subscribes to.
export const coinPriceHistory = createPriceHistoryStore();
