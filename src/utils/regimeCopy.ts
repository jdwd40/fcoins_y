// After-Hours Exchange: market climate (regime) copy.
//
// GET /persistent/signals carries director { regime, intensity } — the
// long-run climate. The regime vocabulary below is exhaustive for the
// documented values; an unknown regime falls back to the raw word so the UI
// never invents an explanation. Pure and unit-tested.

export const REGIME_LABEL: Record<string, string> = {
  GOLDEN_AGE: 'Golden age',
  BOOM: 'Boom',
  BULL: 'Bull',
  BEAR: 'Bear',
  BUST: 'Bust',
  RECESSION: 'Recession'
};

export const REGIME_COPY: Record<string, string> = {
  GOLDEN_AGE: 'A rare stretch of broad, strong gains across the whole market.',
  BOOM: 'Prices are climbing broadly and quickly.',
  BULL: 'Prices are trending upward across the market.',
  BEAR: 'Prices are trending downward across the market.',
  BUST: 'Prices are falling broadly and sharply.',
  RECESSION: 'A long, slow grind downward — patience matters.'
};

/** Title-cased display label; unknown regimes render as their raw word. */
export function regimeLabel(regime: string | null | undefined): string {
  if (!regime) return 'No climate data';
  return REGIME_LABEL[regime] ?? regime;
}

/** One-line plain explanation; unknown regimes get a neutral fallback. */
export function regimeCopy(regime: string | null | undefined): string {
  if (!regime) return 'The long-run market climate is unavailable.';
  return REGIME_COPY[regime] ?? 'Unusual market climate — watch the board closely.';
}

/** Sentiment for styling only; the WORD always carries the meaning. */
export function regimeSentiment(regime: string | null | undefined): 'positive' | 'negative' | 'neutral' {
  if (regime === 'GOLDEN_AGE' || regime === 'BOOM' || regime === 'BULL') return 'positive';
  if (regime === 'BEAR' || regime === 'BUST' || regime === 'RECESSION') return 'negative';
  return 'neutral';
}
