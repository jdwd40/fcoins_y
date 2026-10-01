import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deltaDirection, deltaParts, deltaA11yText, DELTA_GLYPH } from './delta.ts';

describe('deltaDirection', () => {
  it('classifies up/down/flat', () => {
    assert.equal(deltaDirection(3.2), 'up');
    assert.equal(deltaDirection(-1.5), 'down');
    assert.equal(deltaDirection(0), 'flat');
    assert.equal(deltaDirection(0.004), 'flat');
    assert.equal(deltaDirection(null), 'flat');
    assert.equal(deltaDirection(NaN), 'flat');
  });
});

describe('deltaParts', () => {
  it('pairs glyph, word and signed text', () => {
    assert.deepEqual(deltaParts(3.2), { direction: 'up', glyph: '▲', word: 'up', pctText: '+3.20%' });
    assert.deepEqual(deltaParts(-1.05), { direction: 'down', glyph: '▼', word: 'down', pctText: '-1.05%' });
    assert.deepEqual(deltaParts(0), { direction: 'flat', glyph: '–', word: 'flat', pctText: '0.00%' });
  });

  it('has a glyph for every direction (never colour-only)', () => {
    for (const dir of ['up', 'down', 'flat'] as const) {
      assert.ok(DELTA_GLYPH[dir].length > 0);
    }
  });
});

describe('deltaA11yText', () => {
  it('describes movement in words', () => {
    assert.equal(deltaA11yText(3.2), 'up 3.20% in the last minute');
    assert.equal(deltaA11yText(-2), 'down 2.00% in the last minute');
    assert.equal(deltaA11yText(0), 'flat (0.00%) in the last minute');
    assert.equal(deltaA11yText(null), 'no movement data in the last minute');
  });
});
