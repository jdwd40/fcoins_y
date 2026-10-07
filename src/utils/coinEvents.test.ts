// Issue #28: coin event timeline — strict wire parser for
// GET /persistent/coins/:coin_id/events plus the pure copy/ordering helpers.
// Plain `node --test`; fetch is stubbed on globalThis.
// Pin the local zone so clock-label assertions are deterministic.
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'UTC';

import test from 'node:test';
import assert from 'node:assert/strict';

import { API_BASE_URL } from '../services/apiConfig.ts';
import {
  getPersistentCoinEventHistory,
  parsePersistentCoinEventHistory,
  PERSISTENT_COIN_EVENT_SOURCES,
  type PersistentCoinHistoryEvent
} from '../services/persistentService.ts';
import { GameApiError } from '../services/gameService.ts';
import {
  COIN_EVENT_SOURCE_LABEL,
  coinEventSourceLabel,
  describeCoinEvent,
  formatCoinEventDuration,
  formatCoinEventEffect,
  formatCoinEventTime,
  isCoinEventActive,
  orderCoinEventsNewestFirst
} from './coinEvents.ts';

const EVENT_A = {
  eventId: 41,
  name: 'Whale Confidence',
  direction: 'POSITIVE',
  source: 'MARKET',
  modifierPct: 4.0808,
  startsAt: '2026-10-07T12:04:00.000Z',
  endsAt: '2026-10-07T12:07:00.000Z'
};
const EVENT_B = {
  eventId: 40,
  name: 'Market Swing',
  direction: 'NEGATIVE',
  source: 'DIRECTOR',
  modifierPct: -2.3,
  startsAt: '2026-10-07T11:50:00.000Z',
  endsAt: '2026-10-07T12:20:00.000Z'
};
const VALID = {
  serverTime: '2026-10-07T12:10:00.000Z',
  worldId: 1,
  coinId: 3,
  events: [EVENT_A, EVENT_B]
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

// --- parser ----------------------------------------------------------------------

test('parser accepts the published contract and preserves order', () => {
  const parsed = parsePersistentCoinEventHistory(clone(VALID));
  assert.equal(parsed.worldId, 1);
  assert.equal(parsed.coinId, 3);
  assert.deepEqual(parsed.events.map((e) => e.eventId), [41, 40]);
  assert.deepEqual(parsed.events[0], EVENT_A);
});

test('parser accepts the no-world response (worldId null, events [])', () => {
  const parsed = parsePersistentCoinEventHistory({ serverTime: VALID.serverTime, worldId: null, coinId: 3, events: [] });
  assert.equal(parsed.worldId, null);
  assert.deepEqual(parsed.events, []);
  assert.throws(
    () => parsePersistentCoinEventHistory({ ...clone(VALID), worldId: null }),
    /no active world must carry no events/
  );
});

test('parser rejects unknown fields at every level', () => {
  assert.throws(() => parsePersistentCoinEventHistory({ ...clone(VALID), extra: 1 }), /unknown field extra/);
  const leakyEvent = clone(VALID);
  (leakyEvent.events[0] as Record<string, unknown>).eventSeq = 7;
  assert.throws(() => parsePersistentCoinEventHistory(leakyEvent), /unknown field events\[0\]\.eventSeq/);
  const leakyReason = clone(VALID);
  (leakyReason.events[1] as Record<string, unknown>).reason = 'DEMON_ROLE';
  assert.throws(() => parsePersistentCoinEventHistory(leakyReason), /unknown field events\[1\]\.reason/);
});

test('parser rejects leaked cycle identifiers', () => {
  assert.throws(() => parsePersistentCoinEventHistory({ ...clone(VALID), cycleId: 2 }), /cycleId/);
  const leaky = clone(VALID);
  (leaky.events[0] as Record<string, unknown>).apocalypse_id = 9;
  assert.throws(() => parsePersistentCoinEventHistory(leaky), /apocalypse_id/);
});

test('parser rejects the raw stored source vocabulary and bad directions', () => {
  for (const raw of ['NORMAL', 'GOLDEN', 'DEMON', 'RESCUE', 'market', null]) {
    const bad = clone(VALID);
    (bad.events[0] as Record<string, unknown>).source = raw;
    assert.throws(() => parsePersistentCoinEventHistory(bad), /unknown events\[0\]\.source/, `source ${raw}`);
  }
  for (const raw of ['UP', 'NEUTRAL', 'positive', null]) {
    const bad = clone(VALID);
    (bad.events[1] as Record<string, unknown>).direction = raw;
    assert.throws(() => parsePersistentCoinEventHistory(bad), /unknown events\[1\]\.direction/, `direction ${raw}`);
  }
  assert.deepEqual([...PERSISTENT_COIN_EVENT_SOURCES], ['MARKET', 'DIRECTOR']);
});

test('parser rejects non-finite numbers, bad ids, bad timestamps and bad envelopes', () => {
  const cases: Array<[string, (p: ReturnType<typeof clone<typeof VALID>>) => void]> = [
    ['modifierPct NaN', (p) => { (p.events[0] as Record<string, unknown>).modifierPct = 'NaN'; }],
    ['modifierPct string', (p) => { (p.events[0] as Record<string, unknown>).modifierPct = '4.1'; }],
    ['eventId float', (p) => { (p.events[0] as Record<string, unknown>).eventId = 1.5; }],
    ['empty name', (p) => { (p.events[0] as Record<string, unknown>).name = ''; }],
    ['bad startsAt', (p) => { (p.events[0] as Record<string, unknown>).startsAt = 'yesterday'; }],
    ['missing endsAt', (p) => { delete (p.events[0] as Record<string, unknown>).endsAt; }],
    ['coinId string', (p) => { (p as Record<string, unknown>).coinId = '3'; }],
    ['worldId float', (p) => { (p as Record<string, unknown>).worldId = 1.2; }],
    ['events object', (p) => { (p as Record<string, unknown>).events = {}; }],
    ['serverTime missing', (p) => { delete (p as Record<string, unknown>).serverTime; }]
  ];
  for (const [label, mutate] of cases) {
    const bad = clone(VALID);
    mutate(bad);
    assert.throws(() => parsePersistentCoinEventHistory(bad), /Invalid persistent coin events response/, label);
  }
  assert.throws(() => parsePersistentCoinEventHistory(null), /expected a JSON object/);
  assert.throws(() => parsePersistentCoinEventHistory({ ...clone(VALID), events: [42] }), /event must be an object/);
});

// --- getter ----------------------------------------------------------------------

function stubFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('getPersistentCoinEventHistory calls the public per-coin route with the limit and no token', async () => {
  const stub = stubFetch(200, { status: 'success', data: clone(VALID) });
  try {
    const result = await getPersistentCoinEventHistory(3, { limit: 50 });
    assert.equal(result.events.length, 2);
    assert.equal(stub.calls.length, 1);
    assert.equal(stub.calls[0].url, `${API_BASE_URL}/persistent/coins/3/events?limit=50`);
    const headers = stub.calls[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, undefined);
    assert.equal(stub.calls[0].init.method, 'GET');
    assert.equal(stub.calls[0].init.body, undefined);
  } finally {
    stub.restore();
  }
});

test('getPersistentCoinEventHistory rejects a response for a different coin', async () => {
  const stub = stubFetch(200, { status: 'success', data: { ...clone(VALID), coinId: 4 } });
  try {
    await assert.rejects(getPersistentCoinEventHistory(3), /does not match/);
  } finally {
    stub.restore();
  }
});

test('getPersistentCoinEventHistory surfaces 404 as a GameApiError (the timeline hides)', async () => {
  const stub = stubFetch(404, { status: 'error', message: 'Coin not found' });
  try {
    await assert.rejects(getPersistentCoinEventHistory(999), (err: unknown) => {
      assert.ok(err instanceof GameApiError);
      assert.equal((err as GameApiError).status, 404);
      return true;
    });
  } finally {
    stub.restore();
  }
});

// --- copy helpers --------------------------------------------------------------

const ev = (over: Partial<PersistentCoinHistoryEvent>): PersistentCoinHistoryEvent => ({
  ...(EVENT_A as PersistentCoinHistoryEvent),
  ...over
});

test('source labels are exactly two game terms — never the stored roles', () => {
  assert.equal(coinEventSourceLabel('MARKET'), 'Market');
  assert.equal(coinEventSourceLabel('DIRECTOR'), 'Director');
  assert.deepEqual(Object.keys(COIN_EVENT_SOURCE_LABEL).sort(), ['DIRECTOR', 'MARKET']);
  for (const label of Object.values(COIN_EVENT_SOURCE_LABEL)) {
    assert.doesNotMatch(label, /NORMAL|GOLDEN|DEMON|RESCUE|API|backend|authoritative/i);
  }
});

test('describeCoinEvent covers POSITIVE/NEGATIVE × MARKET/DIRECTOR', () => {
  assert.equal(
    describeCoinEvent(ev({ source: 'MARKET', direction: 'POSITIVE', modifierPct: 4.0808 })),
    'Whale Confidence pushed the price up +4.1%.'
  );
  assert.equal(
    describeCoinEvent(ev({ name: 'Rug Rumours', source: 'MARKET', direction: 'NEGATIVE', modifierPct: -2.34 })),
    'Rug Rumours pushed the price down −2.3%.'
  );
  assert.equal(
    describeCoinEvent(ev({ source: 'DIRECTOR', direction: 'POSITIVE', modifierPct: 2.3 })),
    'A Director swing pushed the price up +2.3%.'
  );
  assert.equal(
    describeCoinEvent(ev({ source: 'DIRECTOR', direction: 'NEGATIVE', modifierPct: -2.3 })),
    'A Director swing pushed the price down −2.3%.'
  );
  assert.equal(
    describeCoinEvent(ev({ direction: 'NEGATIVE', modifierPct: -0.0412 })),
    'Whale Confidence pushed the price down −<0.1%.'
  );
});

test('formatCoinEventEffect is the 1dp signed effect without a glyph', () => {
  assert.equal(formatCoinEventEffect({ direction: 'POSITIVE', modifierPct: 4.0808 }), '+4.1%');
  assert.equal(formatCoinEventEffect({ direction: 'NEGATIVE', modifierPct: -12.25 }), '−12.3%');
});

test('orderCoinEventsNewestFirst sorts startsAt DESC then eventId DESC without mutating', () => {
  const input = [
    { eventId: 1, startsAt: '2026-10-07T10:00:00.000Z' },
    { eventId: 3, startsAt: '2026-10-07T12:00:00.000Z' },
    { eventId: 2, startsAt: '2026-10-07T12:00:00.000Z' },
    { eventId: 9, startsAt: 'garbage' }
  ];
  const copy = clone(input);
  assert.deepEqual(orderCoinEventsNewestFirst(input).map((e) => e.eventId), [3, 2, 1, 9]);
  assert.deepEqual(input, copy, 'input untouched');
});

test('isCoinEventActive uses [startsAt, endsAt)', () => {
  const now = Date.parse('2026-10-07T12:10:00.000Z');
  assert.equal(isCoinEventActive(EVENT_B, now), true);
  assert.equal(isCoinEventActive(EVENT_A, now), false);
  assert.equal(isCoinEventActive({ startsAt: EVENT_A.startsAt, endsAt: EVENT_A.endsAt }, Date.parse(EVENT_A.endsAt)), false);
});

test('formatCoinEventTime: HH:mm today, day + month earlier, year when different', () => {
  const now = Date.parse('2026-10-07T18:00:00.000Z');
  assert.equal(formatCoinEventTime('2026-10-07T12:04:30.000Z', now), '12:04');
  assert.equal(formatCoinEventTime('2026-10-06T09:05:00.000Z', now), '6 Oct 09:05');
  assert.equal(formatCoinEventTime('2025-12-31T23:59:00.000Z', now), '31 Dec 2025 23:59');
  assert.equal(formatCoinEventTime('nope', now), '—');
});

test('formatCoinEventDuration renders the published run length', () => {
  assert.equal(formatCoinEventDuration(EVENT_A.startsAt, EVENT_A.endsAt), '3m');
  assert.equal(formatCoinEventDuration('2026-10-07T12:00:00Z', '2026-10-07T12:00:45Z'), '45s');
  assert.equal(formatCoinEventDuration('2026-10-07T12:00:00Z', '2026-10-07T13:20:00Z'), '1h 20m');
  assert.equal(formatCoinEventDuration('2026-10-07T12:00:00Z', '2026-10-07T12:00:00Z'), null);
});
