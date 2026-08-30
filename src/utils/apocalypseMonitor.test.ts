// Apocalypse Monitor Phase 3 Plan 1: pure helper tests for the internal
// operator monitor dashboard. Everything here is deterministic and DOM-free
// so it runs under plain `node --test`.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MONITOR_ATTRIBUTION_LABEL,
  MONITOR_CHART_MODE_LABEL,
  attributionLabel,
  buildMonitorSeries,
  clampReplayTime,
  formatElapsed,
  formatInspecting,
  formatMonitorChangePct,
  formatMonitorPrice,
  getCoinStateAtTime,
  getPriceAtTime,
  monitorReplayBounds,
  pickNewestCycle,
  summariseMonitorCoin
} from './apocalypseMonitor.ts';
import type {
  MonitorCoin,
  MonitorCycleStatus,
  MonitorCycleSummary,
  MonitorSnapshot
} from '../services/monitorService.ts';

const CYCLE_START = '2026-08-30T10:00:00.000Z';
const CYCLE_END = '2026-08-30T10:30:00.000Z';

function coin(partial: Partial<MonitorCoin> & Pick<MonitorCoin, 'coinId' | 'symbol' | 'name'>): MonitorCoin {
  return {
    history: {
      sampleCount: 0,
      firstObservedAt: null,
      lastObservedAt: null,
      attribution: null,
      points: []
    },
    ...partial
  };
}

// --- Elapsed-time formatting --------------------------------------------------

test('formatElapsed renders MM:SS below one hour and H:MM:SS above', () => {
  assert.equal(formatElapsed(0), '00:00');
  assert.equal(formatElapsed(30_000), '00:30');
  assert.equal(formatElapsed(90_000), '01:30');
  assert.equal(formatElapsed(599_999), '09:59');
  assert.equal(formatElapsed(3_599_999), '59:59');
  assert.equal(formatElapsed(3_600_000), '1:00:00');
  assert.equal(formatElapsed(3_661_000), '1:01:01');
  // A point timestamped fractionally before the cycle start never renders a
  // negative elapsed time.
  assert.equal(formatElapsed(-5_000), '00:00');
});

// --- Cycle selection ----------------------------------------------------------

test('pickNewestCycle selects the first row (backend orders newest-first) and null on empty', () => {
  const cycles: MonitorCycleSummary[] = [
    { cycleId: 'APOC-0042', status: 'ACTIVE', startTime: CYCLE_START, endTime: CYCLE_END, settledAt: null, hasExactHistory: true },
    { cycleId: 'APOC-0041', status: 'COMPLETED', startTime: CYCLE_START, endTime: CYCLE_END, settledAt: null, hasExactHistory: true }
  ];
  assert.equal(pickNewestCycle(cycles)?.cycleId, 'APOC-0042');
  assert.equal(pickNewestCycle([]), null);
});

// --- Series transformation ------------------------------------------------------

const JDC = coin({
  coinId: 2,
  symbol: 'JDC',
  name: 'JD Coin',
  history: {
    sampleCount: 3,
    firstObservedAt: '2026-08-30T10:00:30.000Z',
    lastObservedAt: '2026-08-30T10:01:30.000Z',
    attribution: 'exact',
    points: [
      { time: '2026-08-30T10:00:30.000Z', price: 10, source: 'TICK' },
      { time: '2026-08-30T10:01:00.000Z', price: 15, source: 'TICK' },
      { time: '2026-08-30T10:01:30.000Z', price: 12, source: 'COLLAPSE' }
    ]
  }
});

test('PRICE mode passes the raw backend points through with elapsed x and preserved source', () => {
  const series = buildMonitorSeries(JDC, CYCLE_START, 'price');
  assert.equal(series.coinId, 2);
  assert.equal(series.symbol, 'JDC');
  assert.equal(series.points.length, 3);
  assert.deepEqual(
    series.points.map((p) => [p.elapsedMs, p.value, p.source]),
    [
      [30_000, 10, 'TICK'],
      [60_000, 15, 'TICK'],
      [90_000, 12, 'COLLAPSE'] // source COLLAPSE preserved in transformed data
    ]
  );
  // The raw backend price is retained alongside the display value.
  assert.equal(series.points[2].price, 12);
});

test('% CHANGE mode normalises against the first observed price', () => {
  const series = buildMonitorSeries(JDC, CYCLE_START, 'percent');
  assert.equal(series.points[0].value, 0);
  assert.equal(series.points[1].value, 50); // (15-10)/10 * 100
  assert.equal(series.points[2].value, 20); // (12-10)/10 * 100
});

test('% CHANGE mode with a zero starting price yields nulls — never divide-by-zero', () => {
  const zeroStart = coin({
    coinId: 4,
    symbol: 'ZR',
    name: 'Zero Start',
    history: {
      sampleCount: 2,
      firstObservedAt: '2026-08-30T10:00:30.000Z',
      lastObservedAt: '2026-08-30T10:01:00.000Z',
      attribution: 'mixed',
      points: [
        { time: '2026-08-30T10:00:30.000Z', price: 0, source: 'COLLAPSE' },
        { time: '2026-08-30T10:01:00.000Z', price: 0, source: 'TICK' }
      ]
    }
  });
  const series = buildMonitorSeries(zeroStart, CYCLE_START, 'percent');
  assert.deepEqual(series.points.map((p) => p.value), [null, null]);
  // PRICE mode still shows the raw zero points.
  const raw = buildMonitorSeries(zeroStart, CYCLE_START, 'price');
  assert.deepEqual(raw.points.map((p) => p.value), [0, 0]);
});

test('series are sorted ascending by time (defensive — no interpolation ever added)', () => {
  const shuffled = coin({
    coinId: 5,
    symbol: 'SHF',
    name: 'Shuffled',
    history: {
      sampleCount: 2,
      firstObservedAt: '2026-08-30T10:00:30.000Z',
      lastObservedAt: '2026-08-30T10:01:00.000Z',
      attribution: 'exact',
      points: [
        { time: '2026-08-30T10:01:00.000Z', price: 20, source: 'TICK' },
        { time: '2026-08-30T10:00:30.000Z', price: 10, source: 'TICK' }
      ]
    }
  });
  const series = buildMonitorSeries(shuffled, CYCLE_START, 'price');
  assert.deepEqual(series.points.map((p) => p.value), [10, 20]);
  // Percentage normalisation follows the sorted first observation.
  const pct = buildMonitorSeries(shuffled, CYCLE_START, 'percent');
  assert.deepEqual(pct.points.map((p) => p.value), [0, 100]);
});

test('a coin with no history produces an empty series — never a crash', () => {
  const empty = coin({ coinId: 9, symbol: 'EMP', name: 'Empty Coin' });
  for (const mode of ['price', 'percent'] as const) {
    const series = buildMonitorSeries(empty, CYCLE_START, mode);
    assert.deepEqual(series.points, []);
  }
});

// --- Summary calculations ---------------------------------------------------

test('summariseMonitorCoin computes start/end/latest/high/low/change and sample count', () => {
  const summary = summariseMonitorCoin(JDC, CYCLE_END);
  assert.equal(summary.startPrice, 10);
  assert.equal(summary.endPrice, 12);
  assert.equal(summary.latestPrice, 12);
  assert.equal(summary.highPrice, 15);
  assert.equal(summary.lowPrice, 10);
  assert.equal(summary.changeAbs, 2);
  assert.equal(summary.changePct, 20);
  assert.equal(summary.sampleCount, 3);
  assert.equal(summary.collapsed, false);
  assert.equal(summary.hasCollapseEvent, true); // source COLLAPSE seen
  assert.equal(summary.attribution, 'exact');
});

test('a collapsed final zero is detected and displayed as collapsed', () => {
  const dead = coin({
    coinId: 6,
    symbol: 'RUG',
    name: 'Rug Coin',
    history: {
      sampleCount: 2,
      firstObservedAt: '2026-08-30T10:00:30.000Z',
      lastObservedAt: '2026-08-30T10:05:00.000Z',
      attribution: 'exact',
      points: [
        { time: '2026-08-30T10:00:30.000Z', price: 50, source: 'TICK' },
        { time: '2026-08-30T10:05:00.000Z', price: 0, source: 'COLLAPSE' }
      ]
    }
  });
  const summary = summariseMonitorCoin(dead, CYCLE_END);
  assert.equal(summary.latestPrice, 0);
  assert.equal(summary.collapsed, true); // final zero — visually obvious in the table
  assert.equal(summary.hasCollapseEvent, true);
  assert.equal(summary.changeAbs, -50);
  assert.equal(summary.changePct, -100);
});

test('zero-start change percentage is null, not Infinity/NaN', () => {
  const zeroStart = coin({
    coinId: 7,
    symbol: 'ZRO',
    name: 'Zero',
    history: {
      sampleCount: 1,
      firstObservedAt: '2026-08-30T10:00:30.000Z',
      lastObservedAt: '2026-08-30T10:00:30.000Z',
      attribution: 'time_window_derived',
      points: [{ time: '2026-08-30T10:00:30.000Z', price: 0, source: 'COLLAPSE' }]
    }
  });
  const summary = summariseMonitorCoin(zeroStart, CYCLE_END);
  assert.equal(summary.changePct, null);
  assert.equal(summary.startPrice, 0);
  assert.equal(summary.collapsed, true);
});

test('an empty history summarises to nulls and zero samples without crashing', () => {
  const summary = summariseMonitorCoin(coin({ coinId: 8, symbol: 'EMP', name: 'Empty' }), CYCLE_END);
  assert.equal(summary.sampleCount, 0);
  assert.equal(summary.startPrice, null);
  assert.equal(summary.endPrice, null);
  assert.equal(summary.latestPrice, null);
  assert.equal(summary.highPrice, null);
  assert.equal(summary.lowPrice, null);
  assert.equal(summary.changeAbs, null);
  assert.equal(summary.changePct, null);
  assert.equal(summary.collapsed, false);
  assert.equal(summary.hasCollapseEvent, false);
  assert.equal(summary.attribution, null);
});

// --- Provenance + display labels ----------------------------------------------

test('provenance labels cover exact / time_window_derived / mixed / no-data', () => {
  assert.equal(MONITOR_ATTRIBUTION_LABEL.exact, 'Exact');
  assert.equal(attributionLabel('exact'), 'Exact');
  assert.equal(attributionLabel('time_window_derived'), 'Time-window derived');
  assert.equal(attributionLabel('mixed'), 'Mixed');
  assert.equal(attributionLabel(null), 'No data');
});

test('chart mode labels and value formatting are operator-legible', () => {
  assert.equal(MONITOR_CHART_MODE_LABEL.price, 'PRICE');
  assert.equal(MONITOR_CHART_MODE_LABEL.percent, '% CHANGE');
  assert.equal(formatMonitorPrice(12), '£12.00');
  assert.equal(formatMonitorPrice(null), 'n/a');
  assert.equal(formatMonitorChangePct(20), '+20.00%');
  assert.equal(formatMonitorChangePct(-100), '-100.00%');
  assert.equal(formatMonitorChangePct(null), 'n/a');
});

// =============================================================================
// Apocalypse Monitor Phase 4: replay cursor (scrubbing) helpers.
// The cursor is elapsed ms since the cycle start — the same unit as the chart
// x-axis — so Phase 5 playback can advance it arithmetically. Loaded
// monitorData is never refetched or mutated while scrubbing.
// =============================================================================

function makeSnapshot(overrides: {
  status?: MonitorCycleStatus;
  startTime?: string;
  endTime?: string;
  observedAt?: string;
  coins?: MonitorCoin[];
} = {}): MonitorSnapshot {
  const status = overrides.status ?? 'COMPLETED';
  return {
    cycle: {
      cycleId: 'APOC-0042',
      status,
      startTime: overrides.startTime ?? CYCLE_START,
      endTime: overrides.endTime ?? CYCLE_END,
      settlementStartedAt: null,
      settledAt: status === 'COMPLETED' ? CYCLE_END : null,
      observedAt: overrides.observedAt ?? CYCLE_END
    },
    attribution: 'exact',
    exact: true,
    coins: overrides.coins ?? [],
    warnings: []
  };
}

// --- Replay bounds -------------------------------------------------------------

test('monitorReplayBounds: a completed cycle spans the full cycle and defaults the cursor to the cycle end', () => {
  const bounds = monitorReplayBounds(makeSnapshot());
  assert.deepEqual(bounds, { minMs: 0, maxMs: 1_800_000, defaultMs: 1_800_000 });
});

test('monitorReplayBounds: SETTLING is bounded by the cycle end, like a finished cycle', () => {
  const bounds = monitorReplayBounds(makeSnapshot({ status: 'SETTLING', observedAt: '2026-08-30T10:31:00.000Z' }));
  assert.equal(bounds.maxMs, 1_800_000);
  assert.equal(bounds.defaultMs, 1_800_000);
});

test('monitorReplayBounds: an ACTIVE cycle caps the cursor at the latest legitimately observable time — never the future', () => {
  // observedAt is 10:20 but one coin sampled at 10:25 (clock skew): the
  // operator may legitimately inspect through 10:25, not to the 10:30 end.
  const skewed = coin({
    coinId: 11,
    symbol: 'SKW',
    name: 'Skewed',
    history: {
      sampleCount: 2,
      firstObservedAt: '2026-08-30T10:10:00.000Z',
      lastObservedAt: '2026-08-30T10:25:00.000Z',
      attribution: 'exact',
      points: [
        { time: '2026-08-30T10:10:00.000Z', price: 1, source: 'TICK' },
        { time: '2026-08-30T10:25:00.000Z', price: 2, source: 'TICK' }
      ]
    }
  });
  const bounds = monitorReplayBounds(
    makeSnapshot({ status: 'ACTIVE', observedAt: '2026-08-30T10:20:00.000Z', coins: [skewed] })
  );
  assert.equal(bounds.minMs, 0);
  assert.equal(bounds.maxMs, 1_500_000); // 25:00 — the latest real observation
  assert.equal(bounds.defaultMs, bounds.maxMs); // ACTIVE defaults to latest observable
});

test('monitorReplayBounds: ACTIVE with no samples falls back to the snapshot observation time', () => {
  const bounds = monitorReplayBounds(
    makeSnapshot({ status: 'ACTIVE', observedAt: '2026-08-30T10:12:00.000Z' })
  );
  assert.equal(bounds.maxMs, 720_000); // 12:00 — nothing observable past the read
  assert.equal(bounds.defaultMs, 720_000);
});

test('monitorReplayBounds: ACTIVE never bounds past the cycle end even with skewed future timestamps', () => {
  const future = coin({
    coinId: 12,
    symbol: 'FUT',
    name: 'Future',
    history: {
      sampleCount: 1,
      firstObservedAt: '2026-08-30T10:35:00.000Z',
      lastObservedAt: '2026-08-30T10:35:00.000Z',
      attribution: 'exact',
      points: [{ time: '2026-08-30T10:35:00.000Z', price: 9, source: 'TICK' }]
    }
  });
  const bounds = monitorReplayBounds(
    makeSnapshot({ status: 'ACTIVE', observedAt: '2026-08-30T10:35:00.000Z', coins: [future] })
  );
  assert.equal(bounds.maxMs, 1_800_000); // clamped to the cycle end
});

test('monitorReplayBounds: malformed cycle or point timestamps degrade safely — never NaN, never a crash', () => {
  assert.deepEqual(
    monitorReplayBounds(makeSnapshot({ startTime: 'not-a-date' })),
    { minMs: 0, maxMs: 0, defaultMs: 0 }
  );
  assert.deepEqual(
    monitorReplayBounds(makeSnapshot({ endTime: '' })),
    { minMs: 0, maxMs: 0, defaultMs: 0 }
  );
  // A malformed observedAt and malformed point times are simply ignored for
  // the ACTIVE bound (falls back to the cycle start = nothing observable).
  const malformed = coin({
    coinId: 13,
    symbol: 'BAD',
    name: 'Bad',
    history: {
      sampleCount: 1,
      firstObservedAt: null,
      lastObservedAt: null,
      attribution: null,
      points: [{ time: 'garbage', price: 5, source: 'TICK' }]
    }
  });
  const bounds = monitorReplayBounds(
    makeSnapshot({ status: 'ACTIVE', observedAt: 'also-garbage', coins: [malformed] })
  );
  assert.deepEqual(bounds, { minMs: 0, maxMs: 0, defaultMs: 0 });
});

test('clampReplayTime clamps into bounds and recovers from NaN', () => {
  const bounds = { minMs: 0, maxMs: 1_800_000, defaultMs: 1_800_000 };
  assert.equal(clampReplayTime(-5_000, bounds), 0);
  assert.equal(clampReplayTime(300_000, bounds), 300_000);
  assert.equal(clampReplayTime(9_999_999, bounds), 1_800_000);
  assert.equal(clampReplayTime(Number.NaN, bounds), 1_800_000); // NaN → default (end/latest)
});

// --- Point-in-time price lookup -------------------------------------------------

// 10 → 15 → COLLAPSE to 0, at 00:30 / 01:00 / 05:00 elapsed.
const REPLAY_COIN = coin({
  coinId: 14,
  symbol: 'RLY',
  name: 'Replay Coin',
  history: {
    sampleCount: 3,
    firstObservedAt: '2026-08-30T10:00:30.000Z',
    lastObservedAt: '2026-08-30T10:05:00.000Z',
    attribution: 'exact',
    points: [
      { time: '2026-08-30T10:00:30.000Z', price: 10, source: 'TICK' },
      { time: '2026-08-30T10:01:00.000Z', price: 15, source: 'TICK' },
      { time: '2026-08-30T10:05:00.000Z', price: 0, source: 'COLLAPSE' }
    ]
  }
});

test('getPriceAtTime returns the latest sample at or before the cursor — never interpolated', () => {
  assert.equal(getPriceAtTime(REPLAY_COIN, CYCLE_START, 30_000), 10); // exactly on a sample
  assert.equal(getPriceAtTime(REPLAY_COIN, CYCLE_START, 45_000), 10); // between samples: earlier price, no interpolation
  assert.equal(getPriceAtTime(REPLAY_COIN, CYCLE_START, 60_000), 15);
  assert.equal(getPriceAtTime(REPLAY_COIN, CYCLE_START, 299_999), 15); // just before the collapse
  assert.equal(getPriceAtTime(REPLAY_COIN, CYCLE_START, 300_000), 0); // at the collapse
  assert.equal(getPriceAtTime(REPLAY_COIN, CYCLE_START, 1_800_000), 0); // past the last sample → latest observed
});

test('getPriceAtTime is null before the first observation and for empty history', () => {
  assert.equal(getPriceAtTime(REPLAY_COIN, CYCLE_START, 0), null);
  assert.equal(getPriceAtTime(REPLAY_COIN, CYCLE_START, 29_999), null);
  assert.equal(getPriceAtTime(coin({ coinId: 15, symbol: 'EMP', name: 'Empty' }), CYCLE_START, 90_000), null);
});

test('getCoinStateAtTime is unavailable before the first observation', () => {
  const state = getCoinStateAtTime(REPLAY_COIN, CYCLE_START, 10_000);
  assert.deepEqual(state, {
    available: false,
    price: null,
    time: null,
    source: null,
    changePct: null,
    collapsed: false
  });
});

test('getCoinStateAtTime before the collapse shows the prior price and % change vs first observed', () => {
  const state = getCoinStateAtTime(REPLAY_COIN, CYCLE_START, 60_000);
  assert.equal(state.available, true);
  assert.equal(state.price, 15);
  assert.equal(state.source, 'TICK');
  assert.equal(state.time, '2026-08-30T10:01:00.000Z');
  assert.equal(state.changePct, 50); // (15-10)/10 * 100
  assert.equal(state.collapsed, false);
});

test('getCoinStateAtTime at/after the zero COLLAPSE sample is collapsed at £0', () => {
  for (const cursor of [300_000, 300_001, 1_800_000]) {
    const state = getCoinStateAtTime(REPLAY_COIN, CYCLE_START, cursor);
    assert.equal(state.collapsed, true);
    assert.equal(state.price, 0);
    assert.equal(state.source, 'COLLAPSE');
    assert.equal(state.changePct, -100);
  }
});

test('a COLLAPSE-tagged sample with a non-zero price does not collapse the point-in-time state', () => {
  // JDC's final sample carries source COLLAPSE at price 12 (provenance tag on
  // a surviving row): the point-in-time state shows the price, not collapsed.
  const state = getCoinStateAtTime(JDC, CYCLE_START, 90_000);
  assert.equal(state.available, true);
  assert.equal(state.price, 12);
  assert.equal(state.collapsed, false);
  assert.equal(state.changePct, 20);
});

test('point-in-time % change is null for a zero starting price — never Infinity/NaN', () => {
  const zeroStart = coin({
    coinId: 16,
    symbol: 'ZRO',
    name: 'Zero',
    history: {
      sampleCount: 2,
      firstObservedAt: '2026-08-30T10:00:30.000Z',
      lastObservedAt: '2026-08-30T10:01:00.000Z',
      attribution: 'exact',
      points: [
        { time: '2026-08-30T10:00:30.000Z', price: 0, source: 'COLLAPSE' },
        { time: '2026-08-30T10:01:00.000Z', price: 0, source: 'TICK' }
      ]
    }
  });
  const state = getCoinStateAtTime(zeroStart, CYCLE_START, 60_000);
  assert.equal(state.available, true);
  assert.equal(state.price, 0);
  assert.equal(state.changePct, null);
  assert.equal(state.collapsed, false); // latest sample is not the COLLAPSE row
});

test('one malformed or empty coin cannot crash the point-in-time helpers', () => {
  const malformed = coin({
    coinId: 17,
    symbol: 'BAD',
    name: 'Bad',
    history: {
      sampleCount: 3,
      firstObservedAt: null,
      lastObservedAt: null,
      attribution: null,
      points: [
        { time: 'garbage', price: 5, source: 'TICK' },
        { time: '2026-08-30T10:00:30.000Z', price: 7, source: 'TICK' },
        { time: '', price: 9, source: null }
      ]
    }
  });
  // Malformed points are ignored; the valid one answers normally.
  assert.equal(getPriceAtTime(malformed, CYCLE_START, 45_000), 7);
  assert.equal(getPriceAtTime(malformed, CYCLE_START, 29_999), null);
  const state = getCoinStateAtTime(malformed, CYCLE_START, 45_000);
  assert.equal(state.price, 7);
  assert.equal(state.collapsed, false);
  // Empty coin: fully unavailable, no crash.
  const empty = getCoinStateAtTime(coin({ coinId: 18, symbol: 'EMP', name: 'Empty' }), CYCLE_START, 60_000);
  assert.equal(empty.available, false);
  assert.equal(empty.price, null);
});

// --- Inspecting readout -----------------------------------------------------------

test('formatInspecting renders the "Inspecting: elapsed / total" readout', () => {
  assert.equal(formatInspecting(0, 1_800_000), 'Inspecting: 00:00 / 30:00');
  assert.equal(formatInspecting(300_000, 1_800_000), 'Inspecting: 05:00 / 30:00');
  assert.equal(formatInspecting(3_661_000, 7_200_000), 'Inspecting: 1:01:01 / 2:00:00');
  // A negative cursor clamps to zero elapsed via formatElapsed.
  assert.equal(formatInspecting(-1_000, 1_800_000), 'Inspecting: 00:00 / 30:00');
});
