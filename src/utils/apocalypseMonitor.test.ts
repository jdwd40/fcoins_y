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
  formatElapsed,
  formatMonitorChangePct,
  formatMonitorPrice,
  pickNewestCycle,
  summariseMonitorCoin
} from './apocalypseMonitor.ts';
import type { MonitorCoin, MonitorCycleSummary } from '../services/monitorService.ts';

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
