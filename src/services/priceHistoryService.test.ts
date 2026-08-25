// Issue #12: cache/dedup/TTL/stale-response behaviour of the central
// price-history store. Fully deterministic: fake fetch, fake clock and a
// manually-pumped interval are injected through createPriceHistoryStore.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HISTORY_CACHE_TTL_MS,
  HISTORY_REFRESH_MS,
  createPriceHistoryStore
} from './priceHistoryService.ts';
import type { CoinHistorySnapshot } from './priceHistoryService.ts';

interface FakeCall { url: string; signal: AbortSignal }

function makePayload(close: number) {
  return {
    range: { requested: '30M', from: 'a', to: 'b' },
    resolution: '1m',
    serverTime: '2026-08-25T10:00:00.000Z',
    latestValue: close,
    coin: { coin_id: 2, symbol: 'NVC' },
    points: [
      { time: '2026-08-25T09:59:00.000Z', open: close, high: close, low: close, close, samples: 1, complete: true }
    ]
  };
}

function makeHarness() {
  let clock = 1_000_000;
  const calls: FakeCall[] = [];
  let intervalHandler: (() => void) | null = null;
  const pending: Array<{ resolve: (value: { ok: boolean; status: number; json(): Promise<unknown> }) => void; reject: (err: unknown) => void; call: FakeCall }> = [];

  const store = createPriceHistoryStore({
    now: () => clock,
    fetchImpl: (url, init) => {
      const call = { url, signal: init.signal };
      calls.push(call);
      return new Promise((resolve, reject) => {
        pending.push({ resolve, reject, call });
        init.signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    },
    setIntervalImpl: (handler) => {
      intervalHandler = handler;
      return 1;
    },
    clearIntervalImpl: () => {
      intervalHandler = null;
    },
    baseUrl: 'https://example.test/api'
  });

  return {
    store,
    calls,
    pending,
    tick: () => intervalHandler?.(),
    hasTimer: () => intervalHandler !== null,
    advance: (ms: number) => { clock += ms; }
  };
}

const okResponse = (close: number) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(makePayload(close))
});

// The request path chains several promises (fetch → json → adopt), so tests
// flush the microtask queue generously rather than coupling to that depth.
const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

test('constants: TTL matches the backend 10s HTTP cache; refresh is within the 10–15s cadence', () => {
  assert.equal(HISTORY_CACHE_TTL_MS, 10_000);
  assert.equal(HISTORY_REFRESH_MS, 12_000);
});

test('subscribe fetches the authoritative per-coin endpoint once and reports ready', async () => {
  const h = makeHarness();
  const seen: CoinHistorySnapshot[] = [];
  h.store.subscribe(2, '30M', () => seen.push(h.store.getSnapshot(2, '30M')));
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, 'https://example.test/api/coins/2/price-history?range=30M');
  assert.equal(h.store.getSnapshot(2, '30M').status, 'loading');

  h.pending[0].resolve(okResponse(1.43));
  await flush();
  await flush();
  const snapshot = h.store.getSnapshot(2, '30M');
  assert.equal(snapshot.status, 'ready');
  assert.equal(snapshot.latestValue, 1.43);
  assert.equal(snapshot.points.length, 1);
  assert.ok(seen.length >= 1, 'subscribers were notified');
});

test('concurrent subscribers for the same coin/range share ONE in-flight request', async () => {
  const h = makeHarness();
  h.store.subscribe(2, '30M', () => undefined);
  h.store.subscribe(2, '30M', () => undefined);
  assert.equal(h.calls.length, 1, 'deduped');
  h.pending[0].resolve(okResponse(1.43));
  await flush();
  assert.equal(h.store.getSnapshot(2, '30M').status, 'ready');
});

test('a fresh cache hit is served without any request', async () => {
  const h = makeHarness();
  const unsub1 = h.store.subscribe(2, '30M', () => undefined);
  h.pending[0].resolve(okResponse(1.43));
  await flush();
  assert.equal(h.calls.length, 1);

  h.advance(HISTORY_CACHE_TTL_MS - 1); // still inside the TTL
  const unsub2 = h.store.subscribe(2, '30M', () => undefined);
  assert.equal(h.calls.length, 1, 'no refetch inside the TTL');
  assert.equal(h.store.getSnapshot(2, '30M').status, 'ready');
  unsub1();
  unsub2();
});

test('the shared timer refreshes stale entries and leaves fresh ones alone', async () => {
  const h = makeHarness();
  h.store.subscribe(2, '30M', () => undefined);
  h.pending[0].resolve(okResponse(1.43));
  await flush();
  assert.ok(h.hasTimer(), 'the shared refresh timer is running');

  h.advance(HISTORY_CACHE_TTL_MS - 1);
  h.tick();
  assert.equal(h.calls.length, 1, 'fresh entry not refetched');

  h.advance(2); // now older than the TTL
  h.tick();
  assert.equal(h.calls.length, 2, 'stale entry refreshed on the shared cadence');
  h.pending[1].resolve(okResponse(1.5));
  await flush();
  assert.equal(h.store.getSnapshot(2, '30M').latestValue, 1.5);
});

test('unsubscribing the last listener aborts the request, drops the entry and stops the timer', async () => {
  const h = makeHarness();
  const unsub = h.store.subscribe(2, '30M', () => undefined);
  assert.equal(h.store.size(), 1);
  assert.ok(h.hasTimer());

  unsub();
  assert.equal(h.store.size(), 0);
  assert.equal(h.hasTimer(), false, 'timer stops when nothing is subscribed');
  assert.ok(h.calls[0].signal.aborted, 'in-flight request aborted');

  // A late rejection after abort is swallowed; the snapshot is the stable empty one.
  await flush();
  assert.equal(h.store.getSnapshot(2, '30M').status, 'loading');
});

test('a response landing after the entry went away is discarded (stale-response safety)', async () => {
  const h = makeHarness();
  const unsub = h.store.subscribe(2, '30M', () => undefined);
  unsub(); // entry removed while the request is still in flight
  h.pending[0].resolve(okResponse(1.43));
  await flush();
  await flush();
  assert.equal(h.store.size(), 0);
  assert.equal(h.store.getSnapshot(2, '30M'), h.store.getSnapshot(2, '30M'));
  assert.equal(h.store.getSnapshot(2, '30M').fetchedAt, null, 'late response never adopted');
});

test('a failed first load enters the error state; a failed refresh keeps the last good line', async () => {
  const h = makeHarness();
  h.store.subscribe(2, '30M', () => undefined);
  h.pending[0].reject(new Error('boom'));
  await flush();
  await flush();
  let snapshot = h.store.getSnapshot(2, '30M');
  assert.equal(snapshot.status, 'error');
  assert.equal(snapshot.error, 'boom');

  // Recover, then fail a REFRESH: the last good data must survive.
  h.store.subscribe(2, '30M', () => undefined);
  h.pending[1].resolve(okResponse(1.43));
  await flush();
  await flush();
  h.advance(HISTORY_CACHE_TTL_MS + 1);
  h.tick();
  assert.equal(h.calls.length, 3);
  h.pending[2].reject(new Error('refresh boom'));
  await flush();
  await flush();
  snapshot = h.store.getSnapshot(2, '30M');
  assert.equal(snapshot.status, 'ready', 'stale-while-revalidate keeps the line drawn');
  assert.equal(snapshot.latestValue, 1.43);
  assert.equal(snapshot.error, 'refresh boom');
});

test('an HTTP failure carries the status in the message', async () => {
  const h = makeHarness();
  h.store.subscribe(2, '30M', () => undefined);
  h.pending[0].resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
  await flush();
  await flush();
  const snapshot = h.store.getSnapshot(2, '30M');
  assert.equal(snapshot.status, 'error');
  assert.match(snapshot.error ?? '', /HTTP 500/);
});

test('different coins and ranges are independent entries', async () => {
  const h = makeHarness();
  h.store.subscribe(1, '10M', () => undefined);
  h.store.subscribe(1, '30M', () => undefined);
  h.store.subscribe(2, '30M', () => undefined);
  assert.equal(h.calls.length, 3);
  assert.equal(h.store.size(), 3);
  assert.equal(h.calls[0].url, 'https://example.test/api/coins/1/price-history?range=10M');
  assert.equal(h.calls[1].url, 'https://example.test/api/coins/1/price-history?range=30M');
  assert.equal(h.calls[2].url, 'https://example.test/api/coins/2/price-history?range=30M');
});
