// After-Hours Exchange: deterministic per-coin identity hue.
//
// Each coin gets a stable hue derived from its symbol/id so its avatar colour
// is the same on every render, every device, every session — identity, not
// decoration. Pure and unit-tested.

// FNV-1a-ish string hash: small, stable, dependency-free.
function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic hue in [0, 360) for a coin. */
export function coinHue(coin: { symbol: string; coinId?: number }): number {
  const key = `${coin.symbol}#${coin.coinId ?? ''}`;
  return hashString(key) % 360;
}

/** Inline style pair for the hue-tinted avatar surface. */
export function coinAvatarStyle(hue: number): { background: string; color: string; borderColor: string } {
  return {
    background: `linear-gradient(145deg, hsl(${hue} 70% 52% / 0.28), hsl(${hue} 70% 38% / 0.28))`,
    color: `hsl(${hue} 85% 72%)`,
    borderColor: `hsl(${hue} 70% 55% / 0.45)`
  };
}

/** Light-theme avatar colours (dark text on tinted surface). */
export function coinAvatarStyleLight(hue: number): { background: string; color: string; borderColor: string } {
  return {
    background: `linear-gradient(145deg, hsl(${hue} 65% 88%), hsl(${hue} 60% 80%))`,
    color: `hsl(${hue} 60% 26%)`,
    borderColor: `hsl(${hue} 55% 45% / 0.5)`
  };
}
