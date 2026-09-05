// Issue #12: deterministic tests for the pure sparkline helpers — the
// archetype/cycle → history-window mapping, series normalization, local
// y-scaling/path generation, the average-entry marker rule, and the
// accessible description. Runs under plain Node (node --test); no DOM.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARCHETYPE_MAX_CYCLE_MINUTES,
  DEFAULT_SPARKLINE_RANGE,
  SPARKLINE_CYCLES_TARGET,
  SPARKLINE_RANGE_LABEL,
  buildSparklinePath,
  clipPointsSince,
  deadFlatlinePath,
  describeSparkline,
  entryMarkerVisible,
  entryMarkerY,
  formatSparkPrice,
  sparklineRangeForCoin,
  toSparklineSeries
} from './sparkline.ts';
import type { PricePoint } from '../types.ts';
import type { PersistentCoinSignal } from '../services/persistentService.ts';

const coin = (archetype: string) => ({ archetype } as Pick<PersistentCoinSignal, 'archetype'>);

// --- Range mapping (documented per-archetype table in sparkline.ts) --------

test('sparklineRangeForCoin targets ~3 public typical cycles and picks the smallest covering range', () => {
  assert.equal(SPARKLINE_CYCLES_TARGET, 3);
  // ZIP ~1–3 min cycles → target 9 min → 10M
  assert.equal(sparklineRangeForCoin(coin('ZIP')), '10M');
  // MOON ~3–5 min cycles → target 15 min → 30M
  assert.equal(sparklineRangeForCoin(coin('MOON')), '30M');
  // BULL ~5–8 min cycles → target 24 min → 30M
  assert.equal(sparklineRangeForCoin(coin('BULL')), '30M');
  // HODL ~10–15 min cycles → target 45 min → 1H
  assert.equal(sparklineRangeForCoin(coin('HODL')), '1H');
  // DEGEN ~2–8 min cycles → target 24 min → 30M
  assert.equal(sparklineRangeForCoin(coin('DEGEN')), '30M');
  // RUG ~1.5–10 min cycles → target 30 min → 30M
  assert.equal(sparklineRangeForCoin(coin('RUG')), '30M');
});

test('sparklineRangeForCoin uses the public archetype table (persistent signals have no typicalCycleMinutes)', () => {
  assert.equal(ARCHETYPE_MAX_CYCLE_MINUTES.HODL, 15);
  assert.equal(sparklineRangeForCoin(coin('HODL')), '1H');
  assert.equal(sparklineRangeForCoin(coin('ZIP')), '10M');
  // Malformed signal values are ignored the same way (archetype table only).
  assert.equal(sparklineRangeForCoin(coin('BULL')), '30M');
  assert.equal(sparklineRangeForCoin(coin('BULL')), '30M');
});

test('sparklineRangeForCoin never invents a window for unknown archetypes', () => {
  assert.equal(sparklineRangeForCoin(coin('UNKNOWN')), DEFAULT_SPARKLINE_RANGE);
  assert.equal(DEFAULT_SPARKLINE_RANGE, '30M');
});

test('every selectable range is a real backend range with a human label', () => {
  for (const range of ['10M', '30M', '1H', '2H', '24H', '7D', '30D', 'ALL'] as const) {
    assert.ok(SPARKLINE_RANGE_LABEL[range].length > 0);
  }
});

// --- Series normalization ---------------------------------------------------

const point = (time: string, close: number): PricePoint => ({
  time,
  open: close,
  high: close,
  low: close,
  close,
  samples: 1,
  complete: true
});

test('toSparklineSeries sorts ascending and drops malformed/non-positive points', () => {
  const series = toSparklineSeries([
    point('2026-08-25T10:02:00.000Z', 1.5),
    point('2026-08-25T10:01:00.000Z', 1.2),
    point('not-a-date', 9.9),
    point('2026-08-25T10:03:00.000Z', 0), // collapsed/£0 close: meaningless on a live card
    point('2026-08-25T10:04:00.000Z', NaN)
  ]);
  assert.deepEqual(series, [
    { t: Date.parse('2026-08-25T10:01:00.000Z'), price: 1.2 },
    { t: Date.parse('2026-08-25T10:02:00.000Z'), price: 1.5 }
  ]);
  assert.deepEqual(toSparklineSeries([]), []);
  // @ts-expect-error defensive: a non-array payload normalizes to empty
  assert.deepEqual(toSparklineSeries(null), []);
});

test('toSparklineSeries/clipPointsSince drop the previous apocalypse when the live start is known', () => {
  // Prices reset to a persisted baseline at every cycle boundary, so points
  // before the live apocalypse start are the previous round's dead regime.
  const start = Date.parse('2026-08-25T10:00:00.000Z');
  const points = [
    point('2026-08-25T09:58:00.000Z', 0.5), // previous round: collapsed regime
    point('2026-08-25T09:59:00.000Z', 0.05), // previous round
    point('2026-08-25T10:01:00.000Z', 1.2),
    point('2026-08-25T10:02:00.000Z', 1.5)
  ];
  assert.deepEqual(
    toSparklineSeries(points, start),
    [
      { t: Date.parse('2026-08-25T10:01:00.000Z'), price: 1.2 },
      { t: Date.parse('2026-08-25T10:02:00.000Z'), price: 1.5 }
    ]
  );
  assert.equal(clipPointsSince(points, start).length, 2);
  // No known start → endpoint data rendered as-is (no fabricated clipping).
  assert.equal(clipPointsSince(points, null), points);
  assert.equal(toSparklineSeries(points, null).length, 4);
  assert.equal(clipPointsSince(points, NaN), points);
});

// --- Path generation / local y-scaling --------------------------------------

test('buildSparklinePath maps the series min/max onto the padded viewbox', () => {
  const series = [
    { t: 0, price: 10 },
    { t: 1, price: 20 },
    { t: 2, price: 15 }
  ];
  const geometry = buildSparklinePath(series, 100, 36, 2);
  assert.ok(geometry);
  assert.equal(geometry.min, 10);
  assert.equal(geometry.max, 20);
  // First point = lowest price → bottom of padded box; mid point = highest → top.
  assert.equal(geometry.path, 'M0,34 L50,2 L100,18');
});

test('buildSparklinePath renders a flat series as a horizontal midline', () => {
  const geometry = buildSparklinePath(
    [
      { t: 0, price: 5 },
      { t: 1, price: 5 },
      { t: 2, price: 5 }
    ],
    100,
    36,
    2
  );
  assert.ok(geometry);
  assert.equal(geometry.path, 'M0,18 L50,18 L100,18');
});

test('buildSparklinePath refuses degenerate input instead of producing NaN paths', () => {
  assert.equal(buildSparklinePath([], 100, 36), null);
  assert.equal(buildSparklinePath([{ t: 0, price: 5 }], 100, 36), null);
});

// --- Average-entry marker -----------------------------------------------------

test('entryMarkerY draws only inside the visible window and never distorts scale', () => {
  // mid-window entry → mid-height
  assert.equal(entryMarkerY(15, 10, 20, 36, 2), 18);
  // exact bounds land on the padded edges
  assert.equal(entryMarkerY(10, 10, 20, 36, 2), 34);
  assert.equal(entryMarkerY(20, 10, 20, 36, 2), 2);
  // outside the window → no marker (never squeeze the local scale for it)
  assert.equal(entryMarkerY(30, 10, 20, 36, 2), null);
  assert.equal(entryMarkerY(5, 10, 20, 36, 2), null);
  // no entry / malformed entry → no marker
  assert.equal(entryMarkerY(null, 10, 20, 36, 2), null);
  assert.equal(entryMarkerY(0, 10, 20, 36, 2), null);
  // flat window → midline
  assert.equal(entryMarkerY(10, 10, 10, 36, 2), 18);
});

// Issue #13: the SAME in-window rule gates the larger detail chart's
// average-entry marker (entryMarkerVisible is the shared decision;
// entryMarkerY only adds SVG-space geometry on top of it).
test('entryMarkerVisible gates the marker identically for sparkline and detail chart', () => {
  assert.equal(entryMarkerVisible(15, 10, 20), true);
  assert.equal(entryMarkerVisible(10, 10, 20), true); // bounds are visible
  assert.equal(entryMarkerVisible(20, 10, 20), true);
  assert.equal(entryMarkerVisible(30, 10, 20), false); // off-window never distorts scale
  assert.equal(entryMarkerVisible(5, 10, 20), false);
  assert.equal(entryMarkerVisible(null, 10, 20), false);
  assert.equal(entryMarkerVisible(0, 10, 20), false); // £0 entry is not a real entry
  assert.equal(entryMarkerVisible(-3, 10, 20), false);
  assert.equal(entryMarkerVisible(NaN, 10, 20), false);
  assert.equal(entryMarkerVisible(10, NaN, 20), false);
  // a flat window still counts as visible (rendered as a midline)
  assert.equal(entryMarkerVisible(10, 10, 10), true);
  // entryMarkerY now delegates the decision: visibility and geometry agree
  assert.equal(entryMarkerY(30, 10, 20, 36, 2) === null, !entryMarkerVisible(30, 10, 20));
  assert.equal(entryMarkerY(15, 10, 20, 36, 2) !== null, entryMarkerVisible(15, 10, 20));
});

// --- Dead flatline ------------------------------------------------------------

test('deadFlatlinePath is a deterministic flat line near the bottom, no data required', () => {
  assert.equal(deadFlatlinePath(100, 36), 'M0,33 L100,33');
});

// --- Accessible description ----------------------------------------------------

test('describeSparkline states window, direction, move, high/low and the entry marker', () => {
  const text = describeSparkline({
    symbol: 'NVC',
    range: '30M',
    direction: 'up',
    changePct: 4.2,
    latestValue: 1.4321,
    high: 1.45,
    low: 0.131,
    entryMarked: true,
    averageEntry: 0.135
  });
  assert.equal(
    text,
    'NVC 30-minute price history: up +4.20 percent to £1.43; window high £1.45, low £0.1310; your average entry £0.1350 is shown as a dashed line.'
  );
});

test('describeSparkline degrades honestly when there is no data', () => {
  assert.equal(
    describeSparkline({
      symbol: 'FTR',
      range: '10M',
      direction: null,
      changePct: null,
      latestValue: null,
      high: null,
      low: null,
      entryMarked: false,
      averageEntry: null
    }),
    'FTR 10-minute price history: no recent points yet.'
  );
});

test('formatSparkPrice keeps sub-£1 prices meaningful', () => {
  assert.equal(formatSparkPrice(43.46), '£43.46');
  assert.equal(formatSparkPrice(0.1234), '£0.1234');
  assert.equal(formatSparkPrice(0.000123), '£0.000123');
  assert.equal(formatSparkPrice(NaN), '—');
});
