import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatModifierPct } from './formatModifierPct.ts';

describe('formatModifierPct', () => {
  it('rounds to one decimal place with glyph and sign', () => {
    assert.equal(formatModifierPct(4.0808, 'positive'), '▲ +4.1%');
    assert.equal(formatModifierPct(-2.5555, 'negative'), '▼ −2.6%');
    assert.equal(formatModifierPct(1.04, 'positive'), '▲ +1.0%');
  });

  it('collapses non-zero magnitudes below 0.1 to "<0.1%"', () => {
    assert.equal(formatModifierPct(-0.1981, 'negative'), '▼ −0.2%');
    assert.equal(formatModifierPct(0.0508, 'positive'), '▲ +<0.1%');
    assert.equal(formatModifierPct(-0.0999, 'negative'), '▼ −<0.1%');
  });

  it('keeps the glyph/sign even for zero and non-finite input', () => {
    assert.equal(formatModifierPct(0, 'positive'), '▲ +0.0%');
    assert.equal(formatModifierPct(0, 'negative'), '▼ −0.0%');
    assert.equal(formatModifierPct(Number.NaN, 'positive'), '▲ +0.0%');
  });

  it('uses the magnitude, so a negative positive-event still shows +', () => {
    assert.equal(formatModifierPct(-4.0808, 'positive'), '▲ +4.1%');
  });
});
