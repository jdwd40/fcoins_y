import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { coinHue, coinAvatarStyle } from './coinIdentity.ts';

describe('coinHue', () => {
  it('is deterministic for the same coin', () => {
    const a = coinHue({ symbol: 'FTR', coinId: 1 });
    const b = coinHue({ symbol: 'FTR', coinId: 1 });
    assert.equal(a, b);
  });

  it('returns a hue within [0, 360)', () => {
    for (const symbol of ['FTR', 'NVC', 'BYT', 'GLM', 'X', 'ZZZZ']) {
      const hue = coinHue({ symbol, coinId: 7 });
      assert.ok(hue >= 0 && hue < 360, `${symbol} hue ${hue} out of range`);
    }
  });

  it('gives different coins different hues in practice', () => {
    const hues = new Set(
      ['FTR', 'NVC', 'BYT', 'GLM', 'MND'].map((s, i) => coinHue({ symbol: s, coinId: i }))
    );
    assert.ok(hues.size >= 4, 'expected near-unique hues');
  });
});

describe('coinAvatarStyle', () => {
  it('embeds the hue in every channel', () => {
    const style = coinAvatarStyle(200);
    assert.match(style.background, /hsl\(200 /);
    assert.match(style.color, /hsl\(200 /);
    assert.match(style.borderColor, /hsl\(200 /);
  });
});
