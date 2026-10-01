import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { priceFlashDirection } from './priceFlash.ts';

describe('priceFlashDirection', () => {
  it('detects up and down moves', () => {
    assert.equal(priceFlashDirection(1, 1.01), 'up');
    assert.equal(priceFlashDirection(1, 0.99), 'down');
  });

  it('returns null when unchanged', () => {
    assert.equal(priceFlashDirection(0.1021, 0.1021), null);
  });

  it('returns null on first render or bad data (no spurious flash)', () => {
    assert.equal(priceFlashDirection(null, 1), null);
    assert.equal(priceFlashDirection(undefined, 1), null);
    assert.equal(priceFlashDirection(1, null), null);
    assert.equal(priceFlashDirection(NaN, 1), null);
  });
});
