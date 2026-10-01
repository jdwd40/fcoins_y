import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { REGIME_LABEL, REGIME_COPY, regimeLabel, regimeCopy, regimeSentiment } from './regimeCopy.ts';

const KNOWN = ['GOLDEN_AGE', 'BOOM', 'BULL', 'BEAR', 'BUST', 'RECESSION'];

describe('regime copy map', () => {
  it('is exhaustive over the documented regime vocabulary', () => {
    for (const regime of KNOWN) {
      assert.ok(REGIME_LABEL[regime], `missing label for ${regime}`);
      assert.ok(REGIME_COPY[regime], `missing copy for ${regime}`);
    }
  });

  it('falls back to the raw word for unknown regimes', () => {
    assert.equal(regimeLabel('SIDEWAYS'), 'SIDEWAYS');
    assert.match(regimeCopy('SIDEWAYS'), /Unusual market climate/);
  });

  it('handles null/undefined', () => {
    assert.equal(regimeLabel(null), 'No climate data');
    assert.match(regimeCopy(undefined), /unavailable/);
    assert.equal(regimeSentiment(null), 'neutral');
  });

  it('classifies sentiment by the documented sign convention', () => {
    assert.equal(regimeSentiment('GOLDEN_AGE'), 'positive');
    assert.equal(regimeSentiment('BOOM'), 'positive');
    assert.equal(regimeSentiment('BULL'), 'positive');
    assert.equal(regimeSentiment('BEAR'), 'negative');
    assert.equal(regimeSentiment('BUST'), 'negative');
    assert.equal(regimeSentiment('RECESSION'), 'negative');
  });
});
