import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  MARKET_CHART_RANGES,
  COIN_CHART_RANGES,
  RANGE_MS,
  DEFAULT_MARKET_CHART_RANGE,
  DEFAULT_COIN_CHART_RANGE,
  sanitizeMarketHistoryPoints,
  chartTimeUnitForRange,
  clampMarketChartRange,
  clampCoinChartRange,
  type MarketHistoryPoint,
} from './marketHistoryChart.ts';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, '..');

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function point(ms: number, value: number, trend = 'flat'): MarketHistoryPoint {
  return { value, created_at: iso(ms), trend };
}

const NOW = Date.parse('2026-09-10T18:00:00.000Z');

test('MARKET_CHART_RANGES is ≤12h only — no ALL/24H/7D/30D', () => {
  assert.deepEqual([...MARKET_CHART_RANGES], ['5M', '10M', '30M', '1H', '2H', '12H']);
  for (const forbidden of ['24H', '7D', '30D', 'ALL']) {
    assert.equal((MARKET_CHART_RANGES as readonly string[]).includes(forbidden), false);
  }
});

test('COIN_CHART_RANGES is ≤2H only (BE has no 12H)', () => {
  assert.deepEqual([...COIN_CHART_RANGES], ['10M', '30M', '1H', '2H']);
  for (const forbidden of ['5M', '12H', '24H', '7D', '30D', 'ALL']) {
    assert.equal((COIN_CHART_RANGES as readonly string[]).includes(forbidden), false);
  }
});

test('RANGE_MS covers every market chart range', () => {
  for (const range of MARKET_CHART_RANGES) {
    assert.ok(RANGE_MS[range] > 0);
  }
  assert.equal(RANGE_MS['5M'], 5 * 60 * 1000);
  assert.equal(RANGE_MS['12H'], 12 * 60 * 60 * 1000);
});

test('sanitizeMarketHistoryPoints windows an ALL-sized payload down to ~5 minutes for 5M', () => {
  const points: MarketHistoryPoint[] = [];
  // 3 hours of history at 1-minute cadence — mimics ALL leakage for unknown 5M.
  for (let i = 180; i >= 0; i--) {
    points.push(point(NOW - i * 60_000, 1000 + i));
  }
  const sanitized = sanitizeMarketHistoryPoints(points, '5M', NOW);
  assert.ok(sanitized.length >= 2);
  assert.ok(sanitized.length <= 7, `expected ~6 points in 5M, got ${sanitized.length}`);
  const span = sanitized[sanitized.length - 1].t - sanitized[0].t;
  assert.ok(span <= RANGE_MS['5M'], `span ${span} exceeds 5M`);
  assert.equal(sanitized[sanitized.length - 1].t, NOW);
});

test('sanitizeMarketHistoryPoints windows to 10M', () => {
  const points: MarketHistoryPoint[] = [];
  for (let i = 60; i >= 0; i--) {
    points.push(point(NOW - i * 60_000, 500 + i));
  }
  const sanitized = sanitizeMarketHistoryPoints(points, '10M', NOW);
  const span = sanitized[sanitized.length - 1].t - sanitized[0].t;
  assert.ok(span <= RANGE_MS['10M']);
  assert.ok(sanitized.length <= 12);
  assert.ok(sanitized.length >= 10);
});

test('sanitizeMarketHistoryPoints sorts ascending and dedupes same timestamp (keep last)', () => {
  const a = point(NOW - 120_000, 1);
  const b = point(NOW - 60_000, 2);
  const bDup = point(NOW - 60_000, 99); // same ts — later in input wins after stable sort
  const c = point(NOW, 3);
  const shuffled = [c, b, a, bDup];
  const sanitized = sanitizeMarketHistoryPoints(shuffled, '10M', NOW);
  assert.equal(sanitized.length, 3);
  assert.deepEqual(
    sanitized.map((p) => p.value),
    [1, 99, 3]
  );
  assert.ok(sanitized[0].t < sanitized[1].t && sanitized[1].t < sanitized[2].t);
});

test('sanitizeMarketHistoryPoints handles switching ranges on the same payload', () => {
  const points: MarketHistoryPoint[] = [];
  for (let i = 120; i >= 0; i--) {
    points.push(point(NOW - i * 60_000, i));
  }
  const five = sanitizeMarketHistoryPoints(points, '5M', NOW);
  const thirty = sanitizeMarketHistoryPoints(points, '30M', NOW);
  const twoH = sanitizeMarketHistoryPoints(points, '2H', NOW);
  assert.ok(five.length < thirty.length);
  assert.ok(thirty.length < twoH.length);
  assert.ok(twoH.length <= points.length);
});

test('sanitizeMarketHistoryPoints handles 0/1/2 points without crashing', () => {
  assert.deepEqual(sanitizeMarketHistoryPoints([], '5M', NOW), []);
  assert.deepEqual(sanitizeMarketHistoryPoints(null, '5M', NOW), []);
  assert.deepEqual(sanitizeMarketHistoryPoints(undefined, '30M', NOW), []);

  const one = sanitizeMarketHistoryPoints([point(NOW, 42)], '5M', NOW);
  assert.equal(one.length, 1);
  assert.equal(one[0].value, 42);

  const two = sanitizeMarketHistoryPoints(
    [point(NOW - 60_000, 1), point(NOW, 2)],
    '5M',
    NOW
  );
  assert.equal(two.length, 2);
  assert.equal(two[0].value, 1);
  assert.equal(two[1].value, 2);
});

test('sanitizeMarketHistoryPoints drops invalid dates and non-finite values', () => {
  const sanitized = sanitizeMarketHistoryPoints(
    [
      { value: 1, created_at: 'not-a-date', trend: 'x' },
      { value: Number.NaN, created_at: iso(NOW), trend: 'x' },
      point(NOW - 30_000, 7),
    ],
    '5M',
    NOW
  );
  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].value, 7);
});

test('chartTimeUnitForRange is minute for ≤2H and hour for 12H', () => {
  assert.equal(chartTimeUnitForRange('5M'), 'minute');
  assert.equal(chartTimeUnitForRange('10M'), 'minute');
  assert.equal(chartTimeUnitForRange('30M'), 'minute');
  assert.equal(chartTimeUnitForRange('1H'), 'minute');
  assert.equal(chartTimeUnitForRange('2H'), 'minute');
  assert.equal(chartTimeUnitForRange('12H'), 'hour');
});

test('clampMarketChartRange falls back for invalid / >12h persisted values', () => {
  assert.equal(clampMarketChartRange('5M'), '5M');
  assert.equal(clampMarketChartRange('12H'), '12H');
  assert.equal(clampMarketChartRange('24H'), '12H');
  assert.equal(clampMarketChartRange('ALL'), '12H');
  assert.equal(clampMarketChartRange('7D'), '12H');
  assert.equal(clampMarketChartRange('30D'), '12H');
  assert.equal(clampMarketChartRange('nope'), DEFAULT_MARKET_CHART_RANGE);
  assert.equal(clampMarketChartRange(null), DEFAULT_MARKET_CHART_RANGE);
  assert.equal(clampMarketChartRange(undefined, '1H'), '1H');
});

test('clampCoinChartRange falls back for invalid / >2H persisted values', () => {
  assert.equal(clampCoinChartRange('10M'), '10M');
  assert.equal(clampCoinChartRange('2H'), '2H');
  assert.equal(clampCoinChartRange('24H'), '2H');
  assert.equal(clampCoinChartRange('ALL'), '2H');
  assert.equal(clampCoinChartRange('12H'), '2H');
  assert.equal(clampCoinChartRange('5M'), '2H');
  assert.equal(clampCoinChartRange('garbage'), DEFAULT_COIN_CHART_RANGE);
});

test('MarketValueChart defaults expose ≤12h only (no ALL/24H)', () => {
  const src = readFileSync(join(srcRoot, 'components/MarketValueChart.tsx'), 'utf8');
  assert.match(src, /MARKET_CHART_RANGES|TIME_RANGES/);
  assert.doesNotMatch(src, /value:\s*'24H'/);
  assert.doesNotMatch(src, /value:\s*'ALL'/);
  assert.doesNotMatch(src, /value:\s*'7D'/);
  assert.doesNotMatch(src, /value:\s*'30D'/);
  assert.match(src, /sanitizeMarketHistoryPoints/);
  assert.match(src, /chartTimeUnitForRange/);
});

test('PriceChart defaults expose ≤2H only (no ALL/24H/7D/30D)', () => {
  const src = readFileSync(join(srcRoot, 'components/PriceChart.tsx'), 'utf8');
  assert.match(src, /COIN_CHART_RANGES\.map/);
  assert.match(src, /clampCoinChartRange/);
  // Default TIME_RANGES is derived from COIN_CHART_RANGES — no long literals in the decl.
  const match = src.match(/const TIME_RANGES[\s\S]*?;\n/);
  assert.ok(match, 'TIME_RANGES constant missing');
  const block = match![0];
  assert.match(block, /COIN_CHART_RANGES/);
  assert.doesNotMatch(block, /24H/);
  assert.doesNotMatch(block, /7D/);
  assert.doesNotMatch(block, /30D/);
  assert.doesNotMatch(block, /ALL/);
});

test('GameCoinDetail secondary ranges are empty (no >12h / no unsupported 12H)', () => {
  const src = readFileSync(join(srcRoot, 'components/GameCoinDetail.tsx'), 'utf8');
  assert.match(src, /DETAIL_PRIMARY_RANGES: readonly TimeRange\[\] = \['10M', '30M', '1H', '2H'\]/);
  assert.match(src, /DETAIL_SECONDARY_RANGES: readonly TimeRange\[\] = \[\]/);
  assert.doesNotMatch(src, /DETAIL_SECONDARY_RANGES: readonly TimeRange\[\] = \['24H'/);
});
