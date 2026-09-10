import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRemaining, remainingMs } from './persistentCountdown.ts';

const SERVER = '2026-09-10T12:00:00.000Z';
const RECEIVED = 1_000_000;

test('remainingMs uses serverTime + local elapsed and clamps at 0', () => {
  const endsAt = '2026-09-10T12:08:12.000Z'; // +8m12s from SERVER
  assert.equal(remainingMs(endsAt, SERVER, RECEIVED, RECEIVED), 8 * 60_000 + 12_000);
  assert.equal(remainingMs(endsAt, SERVER, RECEIVED, RECEIVED + 12_000), 8 * 60_000);
  // Past end — never negative
  assert.equal(remainingMs(endsAt, SERVER, RECEIVED, RECEIVED + 9 * 60_000), 0);
  assert.equal(remainingMs(endsAt, SERVER, RECEIVED, RECEIVED + 20 * 60_000), 0);
});

test('remainingMs ignores invalid timestamps as zero remaining', () => {
  assert.equal(remainingMs('not-a-date', SERVER, RECEIVED, RECEIVED), 0);
  assert.equal(remainingMs('2026-09-10T12:01:00.000Z', 'bad', RECEIVED, RECEIVED), 0);
});

test('formatRemaining is compact and never negative', () => {
  assert.equal(formatRemaining(8 * 60_000 + 12_000), '8m 12s');
  assert.equal(formatRemaining(42_000), '42s');
  assert.equal(formatRemaining(1000), '1s');
  assert.equal(formatRemaining(0), 'Ended — updating');
  assert.equal(formatRemaining(-5000), 'Ended — updating');
  assert.equal(formatRemaining(59_999), '59s');
  assert.equal(formatRemaining(60_000), '1m 0s');
});
