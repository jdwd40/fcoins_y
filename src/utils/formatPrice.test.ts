import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice } from './formatPrice.ts';

describe('formatPrice', () => {
  it('formats prices >= £1 at 2dp', () => {
    assert.equal(formatPrice(1), '£1.00');
    assert.equal(formatPrice(1.1939), '£1.19');
    assert.equal(formatPrice(1234.5), '£1,234.50');
  });

  it('formats sub-pound prices at 4dp so movement stays visible', () => {
    assert.equal(formatPrice(0.1021), '£0.1021');
    assert.equal(formatPrice(0.0984), '£0.0984');
    assert.equal(formatPrice(0.9999), '£0.9999');
  });

  it('formats zero as £0.00', () => {
    assert.equal(formatPrice(0), '£0.00');
  });

  it('handles non-finite input gracefully', () => {
    assert.equal(formatPrice(NaN), '—');
    assert.equal(formatPrice(Infinity), '—');
  });

  it('never shows a negative price', () => {
    assert.equal(formatPrice(-1), '£0.00');
  });
});
