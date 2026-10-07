// Issue #28: candlestick aggregation, dynamic price domain, geometry and axis
// helpers for the coin page chart. Plain `node --test`, no DOM.
// Pin the local zone so clock-label assertions are deterministic.
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'UTC';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateCandles,
  aggregateSanitized,
  candleTargetFor,
  describeCandles,
  formatTimeTicks,
  inferSlotMs,
  isRawHistory,
  layoutCandles,
  RAW_MIN_BUCKET_MS,
  MIN_SLOT_PX,
  BODY_RATIO,
  priceTicks,
  sanitizeOhlcPoints,
  timeTicks,
  visiblePriceDomain,
  windowCandles,
  xForTime,
  yForPrice,
  type Candle
} from './candlestick.ts';
import { formatPrice } from './formatPrice.ts';

const T0 = Date.parse('2026-10-07T12:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

function tick(ms: number, price: number) {
  // 10M raw-tick shape: open == high == low == close per point.
  return { time: iso(ms), open: price, high: price, low: price, close: price, samples: 1, complete: true };
}

function bar(ms: number, open: number, high: number, low: number, close: number, complete = true) {
  return { time: iso(ms), open, high, low, close, samples: 12, complete };
}

// --- sanitize ------------------------------------------------------------------

test('sanitizeOhlcPoints sorts, dedupes same timestamp (keep last) and drops dirty rows', () => {
  const clean = sanitizeOhlcPoints([
    tick(T0 + 20_000, 3),
    tick(T0, 1),
    { time: 'not-a-date', open: 1, high: 1, low: 1, close: 1 },
    { time: iso(T0 + 5_000), open: 1, high: 1, low: 1, close: Number.NaN },
    { time: iso(T0 + 6_000), open: 1, high: 1, low: 1, close: -2 },
    null,
    'junk',
    tick(T0 + 10_000, 2),
    tick(T0 + 10_000, 22) // same ts, later in payload → wins
  ]);
  assert.deepEqual(clean.map((c) => c.t), [T0, T0 + 10_000, T0 + 20_000]);
  assert.deepEqual(clean.map((c) => c.close), [1, 22, 3]);
});

test('sanitizeOhlcPoints normalises an inconsistent OHLC envelope and accepts numeric strings', () => {
  const [c] = sanitizeOhlcPoints([{ time: iso(T0), open: '10', high: 9, low: 11, close: '12', complete: false }]);
  assert.equal(c.open, 10);
  assert.equal(c.close, 12);
  assert.equal(c.high, 12, 'high always covers open/close');
  assert.equal(c.low, 9, 'low always covers open/close');
  assert.equal(c.complete, false);
});

test('sanitizeOhlcPoints tolerates non-arrays', () => {
  assert.deepEqual(sanitizeOhlcPoints(null), []);
  assert.deepEqual(sanitizeOhlcPoints(undefined), []);
  assert.deepEqual(sanitizeOhlcPoints({ points: [] }), []);
});

// --- aggregation -------------------------------------------------------------

test('aggregateCandles merges raw ticks into time-aligned OHLC buckets', () => {
  // 10 minutes of 5-second ticks (121 points) → target 48 → 15s buckets.
  const points = [];
  for (let i = 0; i <= 120; i++) points.push(tick(T0 + i * 5_000, 100 + (i % 7) - (i % 3)));
  const { candles, slotMs } = aggregateCandles(points, 48);
  assert.equal(slotMs, 15_000);
  assert.ok(candles.length <= 48, `got ${candles.length}`);
  assert.equal(candles.length, 41);
  // First bucket = ticks 0,1,2 (0s, 5s, 10s).
  const [first] = candles;
  const prices = [0, 1, 2].map((i) => 100 + (i % 7) - (i % 3));
  assert.equal(first.t, T0);
  assert.equal(first.open, prices[0]);
  assert.equal(first.close, prices[2]);
  assert.equal(first.high, Math.max(...prices));
  assert.equal(first.low, Math.min(...prices));
  assert.equal(first.samples, 3);
  assert.equal(first.complete, true);
  // Every candle's envelope contains its open/close.
  for (const c of candles) {
    assert.ok(c.high >= Math.max(c.open, c.close));
    assert.ok(c.low <= Math.min(c.open, c.close));
  }
});

test('aggregateCandles flags the trailing bucket incomplete', () => {
  const points = [];
  for (let i = 0; i < 100; i++) points.push(tick(T0 + i * 5_000, 50 + i));
  const { candles } = aggregateCandles(points, 20);
  assert.equal(candles[candles.length - 1].complete, false);
  assert.ok(candles.slice(0, -1).every((c) => c.complete));
});

test('aggregateCandles marks a bucket incomplete when any input point is incomplete', () => {
  const points = [];
  for (let i = 0; i < 60; i++) points.push(bar(T0 + i * 60_000, 10, 11, 9, 10.5, i !== 3));
  const { candles, slotMs } = aggregateCandles(points, 30);
  assert.equal(slotMs, 120_000);
  assert.equal(candles[1].complete, false, 'bucket holding minute 3 is incomplete');
  assert.equal(candles[0].complete, true);
});

test('aggregateCandles passes pre-bucketed OHLC through untouched when within target', () => {
  const points = [
    bar(T0, 10, 12, 9, 11),
    bar(T0 + 300_000, 11, 11.5, 10.2, 10.4),
    bar(T0 + 600_000, 10.4, 10.9, 10.1, 10.8, false)
  ];
  const { candles, slotMs } = aggregateCandles(points, 60);
  assert.equal(slotMs, 300_000, 'slot inferred from the 5m bucket spacing');
  assert.deepEqual(
    candles.map((c) => [c.t, c.open, c.high, c.low, c.close, c.complete]),
    [
      [T0, 10, 12, 9, 11, true],
      [T0 + 300_000, 11, 11.5, 10.2, 10.4, true],
      [T0 + 600_000, 10.4, 10.9, 10.1, 10.8, false]
    ]
  );
});

test('aggregateCandles re-buckets pre-bucketed OHLC to the target count (1H of 1m → 2m on a phone)', () => {
  const points = [];
  for (let i = 0; i < 60; i++) points.push(bar(T0 + i * 60_000, 100 + i, 101 + i, 99 + i, 100.5 + i));
  const { candles, slotMs } = aggregateCandles(points, 40);
  assert.equal(slotMs, 120_000);
  assert.equal(candles.length, 30);
  assert.deepEqual(
    [candles[0].open, candles[0].high, candles[0].low, candles[0].close],
    [100, 102, 99, 101.5],
    'open=first open, high=max high, low=min low, close=last close'
  );
});

test('aggregateCandles handles raw ticks and bucketed input identically when shapes match', () => {
  const raw = [tick(T0, 5), tick(T0 + 1_000, 7), tick(T0 + 2_000, 4), tick(T0 + 3_000, 6)];
  const bucketed = [bar(T0, 5, 7, 4, 6)];
  const fromRaw = aggregateCandles(raw, 1).candles;
  const fromBars = aggregateCandles(bucketed, 1).candles;
  assert.deepEqual(
    [fromRaw[0].open, fromRaw[0].high, fromRaw[0].low, fromRaw[0].close],
    [fromBars[0].open, fromBars[0].high, fromBars[0].low, fromBars[0].close]
  );
});

test('aggregateCandles never fills gaps — empty buckets stay empty', () => {
  const points = [tick(T0, 1), tick(T0 + 5_000, 2), tick(T0 + 600_000, 3), tick(T0 + 605_000, 4)];
  const { candles } = aggregateCandles(points, 3);
  assert.equal(candles.length, 2, 'two real clusters, no invented candles between them');
});

test('aggregateCandles handles empty and single-point input', () => {
  assert.deepEqual(aggregateCandles([], 30).candles, []);
  assert.deepEqual(aggregateCandles(null, 30).candles, []);
  const one = aggregateCandles([tick(T0, 0.1234)], 30);
  assert.equal(one.candles.length, 1);
  assert.equal(one.candles[0].close, 0.1234);
  assert.ok(one.slotMs > 0);
});

test('aggregateCandles cleans unsorted/duplicate input before bucketing', () => {
  const sorted = [];
  for (let i = 0; i < 40; i++) sorted.push(tick(T0 + i * 5_000, 10 + i));
  const shuffled = [...sorted].reverse();
  shuffled.push(tick(T0 + 5_000, 999)); // duplicate ts, later → wins
  const a = aggregateCandles(shuffled, 10).candles;
  const expected = sorted.map((p, i) => (i === 1 ? tick(T0 + 5_000, 999) : p));
  const b = aggregateCandles(expected, 10).candles;
  assert.deepEqual(a, b);
  assert.equal(Math.max(...a.map((c) => c.high)), 999);
});

test('inferSlotMs uses the median spacing', () => {
  const c = (t: number): Candle => ({ t, open: 1, high: 1, low: 1, close: 1, samples: 1, complete: true });
  assert.equal(inferSlotMs([c(0), c(60_000), c(120_000), c(600_000)]), 60_000);
  assert.equal(inferSlotMs([c(0)], 5_000), 5_000);
});

// --- live raw history (production repro) --------------------------------------

// Captured from the public GET /coins/1/price-history?range=10M on
// 2026-10-07 (resolution "raw"): one observation every ~30s, each point
// open == high == low == close with samples 1. Two page loads 9s apart:
// load A saw the first 20 points, load B the last 20.
const LIVE_RAW_30S: Array<[string, number]> = [
  ['2026-10-07T11:27:56.484Z', 38042.3775],
  ['2026-10-07T11:28:26.484Z', 35824.8764],
  ['2026-10-07T11:28:56.485Z', 36281.1422],
  ['2026-10-07T11:29:26.485Z', 39307.6877],
  ['2026-10-07T11:29:56.485Z', 38523.8447],
  ['2026-10-07T11:30:26.485Z', 37337.1488],
  ['2026-10-07T11:30:56.485Z', 37040.092],
  ['2026-10-07T11:31:26.485Z', 39185.4698],
  ['2026-10-07T11:31:56.485Z', 37277.8551],
  ['2026-10-07T11:32:26.485Z', 35763.7354],
  ['2026-10-07T11:32:56.485Z', 37164.0249],
  ['2026-10-07T11:33:26.486Z', 36272.3903],
  ['2026-10-07T11:33:56.486Z', 34319.4361],
  ['2026-10-07T11:34:26.486Z', 35575.7518],
  ['2026-10-07T11:34:56.486Z', 36869.8999],
  ['2026-10-07T11:35:26.487Z', 36239.3135],
  ['2026-10-07T11:35:56.487Z', 34816.8301],
  ['2026-10-07T11:36:26.487Z', 33300.0613],
  ['2026-10-07T11:36:56.488Z', 36306.583],
  ['2026-10-07T11:37:26.488Z', 35724.4946],
  ['2026-10-07T11:37:56.488Z', 35018.3849]
];
const liveRaw = (rows: Array<[string, number]>) =>
  rows.map(([time, p]) => ({ time, open: p, high: p, low: p, close: p, samples: 1, complete: true }));
const LIVE_LOAD_A = liveRaw(LIVE_RAW_30S.slice(0, 20));
const LIVE_LOAD_B = liveRaw(LIVE_RAW_30S.slice(1));

/** Independent oracle: group the raw rows by UTC minute, first/max/min/last. */
function minuteOhlc(rows: Array<[string, number]>) {
  const out: Array<{ t: number; open: number; high: number; low: number; close: number; samples: number }> = [];
  for (const [time, p] of rows) {
    const t = Math.floor(Date.parse(time) / 60_000) * 60_000;
    const last = out[out.length - 1];
    if (last && last.t === t) {
      last.high = Math.max(last.high, p);
      last.low = Math.min(last.low, p);
      last.close = p;
      last.samples += 1;
    } else {
      out.push({ t, open: p, high: p, low: p, close: p, samples: 1 });
    }
  }
  return out;
}

const ohlc = (c: Candle) => ({ t: c.t, open: c.open, high: c.high, low: c.low, close: c.close, samples: c.samples });

test('live 10M raw history at 30s cadence becomes real 1-minute OHLC candles, not 20 flat dojis', () => {
  const windowed = windowCandles(sanitizeOhlcPoints(LIVE_LOAD_A), '10M');
  assert.equal(windowed.length, 20, 'all 20 captured points are inside the 10M window');
  for (const width of [1200, 330]) {
    const { candles, slotMs } = aggregateSanitized(windowed, candleTargetFor('10M', width), { raw: true });
    assert.equal(slotMs, 60_000, `1-minute candles for 30s raw cadence at ${width}px`);
    assert.ok(candles.every((c) => c.t % 60_000 === 0), 'candles start on whole minutes');
    assert.deepEqual(candles.map(ohlc), minuteOhlc(LIVE_RAW_30S.slice(0, 20)));
    assert.equal(candles.length, 11);
    // Leading/trailing minutes are cut by the window; every interior minute
    // holds both of its 30s observations.
    assert.ok(candles.slice(1, -1).every((c) => c.samples === 2), 'two real samples per interior candle');
    assert.equal(candles.reduce((n, c) => n + c.samples, 0), 20, 'no sample lost or duplicated');
    const moving = candles.filter((c) => c.high > c.low);
    assert.equal(moving.length, 9, 'every two-sample minute shows its real range');
    assert.deepEqual(
      candles.map((c) => (c.close > c.open ? 'up' : c.close < c.open ? 'down' : 'flat')),
      ['flat', 'up', 'down', 'down', 'down', 'up', 'down', 'up', 'down', 'up', 'flat']
    );
    assert.equal(candles[candles.length - 1].complete, false, 'trailing minute may still change');
    assert.ok(candles.slice(0, -1).every((c) => c.complete));
  }
});

test('live raw candles never invent prices: open is the bucket\'s own first sample, not the previous close', () => {
  const { candles } = aggregateSanitized(windowCandles(sanitizeOhlcPoints(LIVE_LOAD_A), '10M'), 48, { raw: true });
  const observed = new Set(LIVE_RAW_30S.map(([, p]) => p));
  for (const c of candles) {
    for (const v of [c.open, c.high, c.low, c.close]) assert.ok(observed.has(v), `${v} is a real observation`);
  }
  // 11:28 opens at its own 11:28:26 tick, not at 11:27's close.
  assert.equal(candles[1].open, 35824.8764);
  assert.notEqual(candles[1].open, candles[0].close);
});

test('live raw 5M window (client-cut from the 10M payload) keeps 2 real samples per candle', () => {
  const windowed = windowCandles(sanitizeOhlcPoints(LIVE_LOAD_B), '5M');
  const { candles, slotMs } = aggregateSanitized(windowed, candleTargetFor('5M', 330), { raw: true });
  assert.equal(slotMs, 60_000);
  assert.deepEqual(candles.map(ohlc), minuteOhlc(LIVE_RAW_30S.slice(-10)));
  assert.equal(candles.length, 5);
  assert.ok(candles.every((c) => c.samples === 2 && c.high > c.low));
  // Narrow phone: the few wide candles stay readable and capped.
  const domain = visiblePriceDomain(candles, 35018.3849)!;
  const layout = layoutCandles({ candles, slotMs }, domain, { width: 330, height: 200 })!;
  assert.ok(layout.shapes.every((s) => s.bodyWidth >= 3 && s.bodyWidth <= 18));
  assert.ok(layout.shapes.every((s) => s.wickBottom - s.wickTop > 1), 'wicks show the real range');
});

test('live raw buckets are stable across refreshes: completed minutes do not move', () => {
  const a = aggregateSanitized(windowCandles(sanitizeOhlcPoints(LIVE_LOAD_A), '10M'), 48, { raw: true }).candles;
  const b = aggregateSanitized(windowCandles(sanitizeOhlcPoints(LIVE_LOAD_B), '10M'), 48, { raw: true }).candles;
  const doneA = a.filter((c) => c.complete);
  const shared = b.filter((c) => doneA.some((d) => d.t === c.t) && c.complete);
  assert.equal(shared.length, 9, '11:28–11:36 are complete in both loads');
  for (const c of shared) assert.deepEqual(ohlc(c), ohlc(doneA.find((d) => d.t === c.t)!));
  // The trailing 11:37 minute grew from one to two real samples.
  assert.deepEqual([a[a.length - 1].t, a[a.length - 1].samples], [Date.parse('2026-10-07T11:37:00Z'), 1]);
  assert.deepEqual([b[b.length - 1].t, b[b.length - 1].samples], [Date.parse('2026-10-07T11:37:00Z'), 2]);
});

test('live raw: truly flat 30s data stays flat and gaps stay gaps', () => {
  const flat = [];
  for (let i = 0; i < 20; i++) flat.push(tick(T0 + 26_000 + i * 30_000, 1234.5));
  const { candles } = aggregateSanitized(sanitizeOhlcPoints(flat), 48, { raw: true });
  assert.ok(candles.length > 1);
  assert.ok(candles.every((c) => c.open === 1234.5 && c.high === 1234.5 && c.low === 1234.5 && c.close === 1234.5));

  // Feed paused for 4 minutes: no candles are created for the silent minutes.
  const gappy = [0, 30, 60, 90, 330, 360, 390].map((s, i) => tick(T0 + s * 1_000, 10 + i));
  const g = aggregateSanitized(sanitizeOhlcPoints(gappy), 48, { raw: true }).candles;
  assert.deepEqual(g.map((c) => (c.t - T0) / 60_000), [0, 1, 5, 6]);
});

test('live raw: a sparse interruption is not mistaken for the feed cadence', () => {
  // Two 30s observations, then the feed pauses for 5 minutes. Gaps are
  // [30s, 300s]: the interruption must not set the bucket size.
  const sparse = [tick(T0, 100), tick(T0 + 30_000, 101), tick(T0 + 330_000, 102)];
  const { candles, slotMs } = aggregateSanitized(sanitizeOhlcPoints(sparse), 48, { raw: true });
  assert.equal(slotMs, 60_000, '30s cadence keeps 1-minute candles');
  assert.deepEqual(candles.map(ohlc), [
    { t: T0, open: 100, high: 101, low: 100, close: 101, samples: 2 },
    { t: T0 + 300_000, open: 102, high: 102, low: 102, close: 102, samples: 1 }
  ]);
  assert.deepEqual(candles.map((c) => c.complete), [true, false], 'only the trailing candle is open');
  // Minutes 12:01–12:04 stay blank: the two bodies sit 5 slots apart.
  const layout = layoutCandles({ candles, slotMs }, visiblePriceDomain(candles, 102)!, { width: 600, height: 200 })!;
  const slotPx = layout.shapes[1].x - layout.shapes[0].x;
  assert.equal(layout.shapes.length, 2);
  assert.ok(Math.abs(slotPx - 5 * (600 / 6)) < 0.01, `post-gap candle is 5 slots on (${slotPx}px)`);

  // A lone pair of observations is no evidence of a slow feed either.
  const pair = aggregateSanitized(sanitizeOhlcPoints([tick(T0, 100), tick(T0 + 300_000, 102)]), 48, { raw: true });
  assert.equal(pair.slotMs, 60_000);
  assert.deepEqual(pair.candles.map((c) => (c.t - T0) / 60_000), [0, 5]);
});

test('raw buckets widen with a slower feed and still honour the candle cap', () => {
  // 60s cadence → ≥2-minute candles so each still holds two observations.
  const slow = [];
  for (let i = 0; i < 10; i++) slow.push(tick(T0 + i * 60_000, 50 + (i % 3)));
  assert.equal(aggregateSanitized(sanitizeOhlcPoints(slow), 48, { raw: true }).slotMs, 120_000);
  // Even a short regular 60s feed, or one with an interruption, keeps 2m.
  const short60 = [0, 60, 120].map((s, i) => tick(T0 + s * 1_000, 50 + i));
  assert.equal(aggregateSanitized(sanitizeOhlcPoints(short60), 48, { raw: true }).slotMs, 120_000);
  const paused60 = [0, 60, 120, 180, 480].map((s, i) => tick(T0 + s * 1_000, 50 + i));
  const p = aggregateSanitized(sanitizeOhlcPoints(paused60), 48, { raw: true });
  assert.equal(p.slotMs, 120_000);
  assert.deepEqual(p.candles.map((c) => (c.t - T0) / 60_000), [0, 2, 8], 'silent 4m–6m stay blank');
  // Regular 30s feed → 1m floor.
  const reg30 = [0, 30, 60, 90].map((s, i) => tick(T0 + s * 1_000, 50 + i));
  assert.equal(aggregateSanitized(sanitizeOhlcPoints(reg30), 48, { raw: true }).slotMs, 60_000);
  // Fast 5s feed over 10M on a target of 8: the cap still wins.
  const fast = [];
  for (let i = 0; i <= 120; i++) fast.push(tick(T0 + i * 5_000, 100 + (i % 4)));
  const capped = aggregateSanitized(sanitizeOhlcPoints(fast), 8, { raw: true });
  assert.ok(capped.candles.length <= 8, `got ${capped.candles.length}`);
  assert.ok(capped.slotMs >= 60_000);
});

test('pre-bucketed OHLC (not raw) is unaffected by the raw-tick policy', () => {
  const bars = [];
  for (let i = 0; i < 30; i++) bars.push(bar(T0 + i * 60_000, 10 + i, 11 + i, 9 + i, 10.5 + i));
  const clean = sanitizeOhlcPoints(bars);
  const passed = aggregateSanitized(clean, 30);
  assert.equal(passed.slotMs, 60_000);
  assert.deepEqual(passed.candles, clean, '30M of 1m bars passes through envelope-for-envelope');
  assert.deepEqual(aggregateSanitized(clean, 30, { raw: false }), passed);
});

test('isRawHistory trusts the server resolution, falling back to shape only when it is missing', () => {
  const ticks = sanitizeOhlcPoints(LIVE_LOAD_A);
  const bars = sanitizeOhlcPoints([bar(T0, 10, 12, 9, 11), bar(T0 + 60_000, 11, 11.5, 10.2, 10.4)]);
  assert.equal(isRawHistory('raw', ticks), true);
  assert.equal(isRawHistory('RAW', bars), true, 'the server label wins over the shape');
  for (const res of ['1m', '5m', '15m']) assert.equal(isRawHistory(res, ticks), false, `${res} is OHLC`);
  assert.equal(isRawHistory(undefined, ticks), true, 'flat samples=1 points without a label are raw');
  assert.equal(isRawHistory(undefined, bars), false);
  assert.equal(isRawHistory(undefined, []), false);
  assert.equal(RAW_MIN_BUCKET_MS, 60_000);
});

test('candleTargetFor caps candle count so bodies stay ≥3px on a 360px phone', () => {
  // ~250px plot area on a 360px screen.
  const target = candleTargetFor('1H', 250);
  assert.ok(target <= 250 / MIN_SLOT_PX);
  assert.ok((250 / target) * BODY_RATIO >= 3, 'body ≥ 3px');
  assert.equal(candleTargetFor('1H', 1200), 60, 'wide screens use the range target');
  assert.equal(candleTargetFor('12H', 1200), 48);
});

// --- windowing -----------------------------------------------------------------

test('windowCandles clips 12H out of a 24H payload and 5M out of a 10M payload', () => {
  const day = [];
  for (let i = 0; i < 96; i++) day.push(bar(T0 + i * 15 * 60_000, 10, 11, 9, 10));
  const twelve = windowCandles(sanitizeOhlcPoints(day), '12H');
  const span = twelve[twelve.length - 1].t - twelve[0].t;
  assert.equal(span + 15 * 60_000, 12 * 3_600_000, '48 slots of 15m = exactly 12 hours');
  assert.equal(twelve.length, 48);
  assert.equal(aggregateSanitized(twelve, candleTargetFor('12H', 1200)).candles.length, 48, 'passes through at 15m');

  const ten = [];
  for (let i = 0; i <= 120; i++) ten.push(tick(T0 + i * 5_000, 1));
  const five = windowCandles(sanitizeOhlcPoints(ten), '5M');
  assert.equal(five.length, 60);
  assert.equal(five[five.length - 1].t - five[0].t + 5_000, 5 * 60_000);
});

test('windowCandles honours an authoritative live-window start', () => {
  const pts = sanitizeOhlcPoints([tick(T0, 1), tick(T0 + 60_000, 2), tick(T0 + 120_000, 3)]);
  assert.deepEqual(windowCandles(pts, '1H', T0 + 60_000).map((c) => c.close), [2, 3]);
  assert.deepEqual(windowCandles([], '1H'), []);
});

// --- price domain -------------------------------------------------------------

test('visiblePriceDomain is not anchored at zero', () => {
  const d = visiblePriceDomain([{ low: 95, high: 105 }], 100)!;
  assert.ok(d.min > 90 && d.min < 95, `min ${d.min}`);
  assert.ok(d.max > 105 && d.max < 110, `max ${d.max}`);
  assert.ok(Math.abs(d.min - (95 - 10 * 0.08)) < 1e-9);
});

test('visiblePriceDomain always contains latestValue, even outside the candles', () => {
  const above = visiblePriceDomain([{ low: 10, high: 11 }], 12.5)!;
  assert.ok(above.max > 12.5);
  const below = visiblePriceDomain([{ low: 10, high: 11 }], 9.2)!;
  assert.ok(below.min < 9.2);
  assert.ok(below.min > 0);
});

test('visiblePriceDomain handles a sub-£1 coin (0.10x) with 4dp-readable ticks', () => {
  const d = visiblePriceDomain([{ low: 0.1012, high: 0.1031 }], 0.1025)!;
  assert.ok(d.min > 0.09 && d.max < 0.11);
  const ticks = priceTicks(d);
  assert.ok(ticks.length >= 3 && ticks.length <= 6, `ticks ${ticks}`);
  const labels = ticks.map(formatPrice);
  assert.equal(new Set(labels).size, labels.length, 'labels are distinct');
  assert.ok(labels.every((l) => /^£0\.\d{4}$/.test(l)), `labels ${labels}`);
});

test('visiblePriceDomain handles a £100,000 coin', () => {
  const d = visiblePriceDomain([{ low: 99_400, high: 100_900 }], 100_250)!;
  assert.ok(d.min > 99_000 && d.max < 101_100);
  const labels = priceTicks(d).map(formatPrice);
  assert.ok(labels.length >= 3 && labels.length <= 6);
  assert.equal(new Set(labels).size, labels.length);
});

test('visiblePriceDomain pads a flat/degenerate series symmetrically and relatively', () => {
  for (const price of [0.1, 1, 250, 100_000]) {
    const d = visiblePriceDomain([{ low: price, high: price }], price)!;
    assert.ok(d.max > price && d.min < price, `flat ${price}`);
    assert.ok(Math.abs((price - d.min) - (d.max - price)) < price * 1e-9, 'symmetric');
    assert.ok((d.max - d.min) / price < 0.02, 'relative band, not zero-anchored');
    assert.ok(d.min > 0);
  }
});

test('visiblePriceDomain floors at £0 only when the data reaches zero', () => {
  const dead = visiblePriceDomain([{ low: 0, high: 3 }], 0)!;
  assert.equal(dead.min, 0);
  const zeroFlat = visiblePriceDomain([{ low: 0, high: 0 }], 0)!;
  assert.equal(zeroFlat.min, 0);
  assert.ok(zeroFlat.max > 0);
});

test('visiblePriceDomain with no data / bad data', () => {
  assert.equal(visiblePriceDomain([], null), null);
  assert.equal(visiblePriceDomain([{ low: Number.NaN, high: Number.NaN }], Number.NaN), null);
  const onlyLatest = visiblePriceDomain([], 4.2)!;
  assert.ok(onlyLatest.min < 4.2 && onlyLatest.max > 4.2);
});

// --- geometry ----------------------------------------------------------------

test('yForPrice / xForTime map linearly and survive zero spans', () => {
  const domain = { min: 10, max: 20 };
  assert.equal(yForPrice(20, domain, 200), 0);
  assert.equal(yForPrice(10, domain, 200), 200);
  assert.equal(yForPrice(15, domain, 200), 100);
  assert.equal(yForPrice(15, { min: 5, max: 5 }, 200), 100);
  assert.equal(xForTime(50, 0, 100, 300), 150);
  assert.equal(xForTime(50, 7, 7, 300), 150);
});

test('layoutCandles maps candles to wick/body coordinates', () => {
  const series = aggregateCandles(
    [bar(T0, 10, 14, 8, 12), bar(T0 + 60_000, 12, 13, 9, 10), bar(T0 + 120_000, 10, 10, 10, 10)],
    60
  );
  const domain = { min: 8, max: 14 };
  const layout = layoutCandles(series, domain, { width: 300, height: 120 })!;
  assert.equal(layout.shapes.length, 3);
  assert.equal(layout.slotWidth, 100);
  const [up, down, doji] = layout.shapes;
  assert.equal(up.direction, 'up');
  assert.equal(down.direction, 'down');
  assert.equal(doji.direction, 'flat');
  assert.equal(up.x, 50);
  assert.equal(up.wickTop, 0, 'high 14 at the top');
  assert.equal(up.wickBottom, 120, 'low 8 at the bottom');
  assert.equal(up.bodyY, yForPrice(12, domain, 120), 'up body top = close');
  assert.equal(up.bodyHeight, yForPrice(10, domain, 120) - yForPrice(12, domain, 120));
  assert.equal(down.bodyY, yForPrice(12, domain, 120), 'down body top = open');
  assert.ok(doji.bodyHeight >= 1, 'a doji stays visible');
  for (const s of layout.shapes) {
    assert.ok(s.bodyWidth >= 1 && s.bodyWidth <= 18);
    assert.ok(s.bodyX >= 0 && s.bodyX + s.bodyWidth <= 300);
  }
});

test('layoutCandles keeps bodies ≥3px for a capped 360px phone series', () => {
  const pts = [];
  for (let i = 0; i < 60; i++) pts.push(bar(T0 + i * 60_000, 10, 11, 9, 10.5));
  const width = 250;
  const series = aggregateCandles(pts, candleTargetFor('1H', width));
  const layout = layoutCandles(series, { min: 8, max: 12 }, { width, height: 200 })!;
  assert.ok(layout.shapes.every((s) => s.bodyWidth >= 3), `body ${layout.shapes[0].bodyWidth}`);
});

test('layoutCandles returns null without candles or space', () => {
  assert.equal(layoutCandles({ candles: [], slotMs: 1 }, { min: 0, max: 1 }, { width: 10, height: 10 }), null);
  const series = aggregateCandles([tick(T0, 1)], 5);
  assert.equal(layoutCandles(series, { min: 0, max: 2 }, { width: 0, height: 10 }), null);
});

// --- axes ----------------------------------------------------------------------

test('priceTicks stays within the domain and caps at 6', () => {
  const d = { min: 93.7, max: 107.4 };
  const ticks = priceTicks(d);
  assert.ok(ticks.length >= 3 && ticks.length <= 6);
  assert.ok(ticks.every((t) => t >= d.min && t <= d.max));
});

test('timeTicks lands on clean clock boundaries, ≤6 ticks', () => {
  const start = T0 + 37_000;
  const ticks = timeTicks(start, start + 2 * 3_600_000, 6, 0);
  assert.ok(ticks.length >= 3 && ticks.length <= 6);
  assert.ok(ticks.every((t) => t % (30 * 60_000) === 0), 'half-hour boundaries for 2H');
  // 12H in a +01:00 zone: ticks align to LOCAL 2/3-hour marks.
  const local = timeTicks(T0, T0 + 12 * 3_600_000, 6, -60);
  assert.ok(local.length <= 6);
  assert.ok(local.every((t) => (t + 3_600_000) % (2 * 3_600_000) === 0 || (t + 3_600_000) % (3 * 3_600_000) === 0));
  assert.deepEqual(timeTicks(5, 5), []);
});

test('formatTimeTicks: HH:mm up to 2H, weekday prefix when 12H crosses midnight', () => {
  const short = formatTimeTicks([T0, T0 + 30 * 60_000], 2 * 3_600_000);
  assert.deepEqual(short, ['12:00', '12:30']);
  const midnight = Date.parse('2026-10-08T00:00:00.000Z'); // a Thursday
  const long = formatTimeTicks(
    [midnight - 4 * 3_600_000, midnight - 2 * 3_600_000, midnight, midnight + 2 * 3_600_000],
    12 * 3_600_000
  );
  assert.deepEqual(long, ['20:00', '22:00', 'Thu 00:00', '02:00']);
});

// --- description ---------------------------------------------------------------

test('describeCandles summarises direction, change, high/low and the entry line', () => {
  const text = describeCandles({
    symbol: 'ZPX',
    rangeLabel: '1H',
    candles: [
      { high: 11, low: 9.5, close: 10 },
      { high: 12, low: 10, close: 11.5 }
    ],
    latestValue: 11,
    averageEntry: 10.5,
    entryMarked: true
  });
  assert.match(text, /ZPX over 1H: up \+10\.00 percent to £11\.00\./);
  assert.match(text, /Period high £12\.00, low £9\.50\./);
  assert.match(text, /2 candles\./);
  assert.match(text, /average entry £10\.50 is shown as a dashed line/);

  const down = describeCandles({
    symbol: 'D', rangeLabel: '5M', candles: [{ high: 1, low: 1, close: 1 }], latestValue: 0.5,
    averageEntry: null, entryMarked: false
  });
  assert.match(down, /down -50\.00 percent to £0\.5000/);
  const empty = describeCandles({
    symbol: 'E', rangeLabel: '12H', candles: [], latestValue: null, averageEntry: null, entryMarked: false
  });
  assert.match(empty, /no price history for this period yet/);
});
