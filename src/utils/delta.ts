// After-Hours Exchange: direction/delta presentation helpers.
//
// Direction is NEVER colour-only anywhere in the UI: every movement figure
// pairs a glyph (▲ ▼ –) with a signed number and a word (or sr-only text).
// These helpers single-source that pairing so no component can drift.

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface DeltaParts {
  direction: DeltaDirection;
  /** ▲ / ▼ / – */
  glyph: string;
  /** 'up' / 'down' / 'flat' */
  word: string;
  /** Signed percentage text, e.g. '+3.20%', '-1.05%', '0.00%'. */
  pctText: string;
}

/** Direction of a signed percentage; |pct| below 0.005 counts as flat. */
export function deltaDirection(pct: number | null): DeltaDirection {
  if (pct === null || !Number.isFinite(pct)) return 'flat';
  if (Math.abs(pct) < 0.005) return 'flat';
  return pct > 0 ? 'up' : 'down';
}

export const DELTA_GLYPH: Record<DeltaDirection, string> = {
  up: '▲',
  down: '▼',
  flat: '–'
};

export function deltaParts(pct: number | null): DeltaParts {
  const direction = deltaDirection(pct);
  const magnitude = pct === null || !Number.isFinite(pct) ? 0 : Math.abs(pct);
  const pctText =
    direction === 'flat' ? '0.00%' : `${direction === 'up' ? '+' : '-'}${magnitude.toFixed(2)}%`;
  return { direction, glyph: DELTA_GLYPH[direction], word: direction, pctText };
}

/** Full accessible sentence fragment, e.g. 'up 3.20% in the last minute'. */
export function deltaA11yText(pct: number | null, windowLabel = 'in the last minute'): string {
  const parts = deltaParts(pct);
  if (pct === null) return `no movement data ${windowLabel}`;
  if (parts.direction === 'flat') return `flat (0.00%) ${windowLabel}`;
  return `${parts.word} ${Math.abs(pct).toFixed(2)}% ${windowLabel}`;
}
