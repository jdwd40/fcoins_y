/* eslint-disable @typescript-eslint/ban-ts-comment */
import test from 'node:test';
import assert from 'node:assert/strict';



import { computePeriodSummary } from './priceSummary.ts';

test('returns null for empty points', () => {
  assert.strictEqual(computePeriodSummary([], 100), null);
  assert.strictEqual(computePeriodSummary(undefined as unknown as { high: number; low: number; close: number }[], 100), null);
});

test('single point is neutral, high=low=that price, change=0', () => {
  const summary = computePeriodSummary([{ high: 123.45, low: 123.45, close: 123.45 }], 123.45);
  assert.ok(summary);
  assert.strictEqual(summary.first, 123.45);
  assert.strictEqual(summary.last, 123.45);
  assert.strictEqual(summary.change, 0);
  assert.strictEqual(summary.changePct, 0);
  assert.strictEqual(summary.high, 123.45);
  assert.strictEqual(summary.low, 123.45);
  assert.strictEqual(summary.direction, 'flat');
});

test('up direction and correct change/pct', () => {
  const points = [
    { high: 100, low: 99, close: 100 },
    { high: 105, low: 100, close: 104 },
  ];
  const s = computePeriodSummary(points, 105);
  assert.ok(s);
  assert.strictEqual(s.first, 100);
  assert.strictEqual(s.last, 105);
  assert.strictEqual(s.change, 5);
  assert.strictEqual(s.changePct, 5);
  assert.strictEqual(s.high, 105);
  assert.strictEqual(s.low, 99);
  assert.strictEqual(s.direction, 'up');
});

test('down direction', () => {
  const points = [{ high: 200, low: 190, close: 200 }];
  const s = computePeriodSummary(points, 180);
  assert.ok(s);
  assert.strictEqual(s.change, -20);
  assert.ok(s.changePct < 0);
  assert.strictEqual(s.direction, 'down');
});

test('flat on zero change', () => {
  const s = computePeriodSummary([{ high: 50, low: 50, close: 50 }], 50);
  assert.strictEqual(s!.direction, 'flat');
});

test('flat threshold boundary |changePct| < 0.005', () => {
  // ~0.00499% change
  const s = computePeriodSummary([{ high: 1000, low: 1000, close: 1000 }], 1000.0499);
  assert.strictEqual(s!.direction, 'flat');
  // above threshold
  const s2 = computePeriodSummary([{ high: 1000, low: 1000, close: 1000 }], 1000.06);
  assert.strictEqual(s2!.direction, 'up');
});

test('high/low extracted from points high/low not closes', () => {
  const points = [
    { high: 110, low: 90, close: 100 },
    { high: 105, low: 95, close: 102 },
  ];
  const s = computePeriodSummary(points, 101);
  assert.strictEqual(s!.high, 110);
  assert.strictEqual(s!.low, 90);
});
