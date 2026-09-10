// Pure helpers for MarketValueChart: range windows, sanitize/window-filter,
// adaptive Chart.js time units, and clamp of persisted/selector ranges.
// Caps user-facing market charts at ≤12h. No DOM.

/** Market aggregate chart ranges offered in the UI (≤12h). */
export type MarketChartRange = '5M' | '10M' | '30M' | '1H' | '2H' | '12H';

/** Coin price-history ranges offered in the UI (BE-supported ∩ ≤12h → max 2H). */
export type CoinChartRange = '10M' | '30M' | '1H' | '2H';

export const MARKET_CHART_RANGES: readonly MarketChartRange[] = [
  '5M',
  '10M',
  '30M',
  '1H',
  '2H',
  '12H',
] as const;

export const COIN_CHART_RANGES: readonly CoinChartRange[] = [
  '10M',
  '30M',
  '1H',
  '2H',
] as const;

export const DEFAULT_MARKET_CHART_RANGE: MarketChartRange = '30M';
export const DEFAULT_COIN_CHART_RANGE: CoinChartRange = '2H';

/** Duration of each selectable market range in milliseconds. */
export const RANGE_MS: Readonly<Record<MarketChartRange, number>> = {
  '5M': 5 * 60 * 1000,
  '10M': 10 * 60 * 1000,
  '30M': 30 * 60 * 1000,
  '1H': 60 * 60 * 1000,
  '2H': 2 * 60 * 60 * 1000,
  '12H': 12 * 60 * 60 * 1000,
};

export interface MarketHistoryPoint {
  value: number;
  created_at: string;
  trend: string;
}

export interface SanitizedMarketHistoryPoint {
  value: number;
  created_at: string;
  trend: string;
  /** Parsed epoch ms for charting / filtering. */
  t: number;
}

function isMarketChartRange(value: string): value is MarketChartRange {
  return (MARKET_CHART_RANGES as readonly string[]).includes(value);
}

function isCoinChartRange(value: string): value is CoinChartRange {
  return (COIN_CHART_RANGES as readonly string[]).includes(value);
}

/** Clamp a persisted/unknown market range to ≤12h (fallback default or 12H for known long keys). */
export function clampMarketChartRange(
  value: unknown,
  fallback: MarketChartRange = DEFAULT_MARKET_CHART_RANGE
): MarketChartRange {
  if (typeof value === 'string' && isMarketChartRange(value)) return value;
  // Explicit long aliases that must never render: fall back to max 12H.
  if (value === '24H' || value === 'ALL' || value === '7D' || value === '30D') {
    return '12H';
  }
  return fallback;
}

/** Clamp a persisted/unknown coin range to ≤2H (BE has no 12H). */
export function clampCoinChartRange(
  value: unknown,
  fallback: CoinChartRange = DEFAULT_COIN_CHART_RANGE
): CoinChartRange {
  if (typeof value === 'string' && isCoinChartRange(value)) return value;
  if (
    value === '24H' ||
    value === 'ALL' ||
    value === '7D' ||
    value === '30D' ||
    value === '12H' ||
    value === '5M'
  ) {
    return '2H';
  }
  return fallback;
}

/**
 * Parse, drop invalid, sort ascending, dedupe same timestamp (keep last),
 * then window-filter to the selected range duration.
 *
 * Anchor for the window prefers max(created_at) in the payload; falls back
 * to `nowMs` (Date.now() is fine for market history) when the payload is empty
 * of valid timestamps.
 */
export function sanitizeMarketHistoryPoints(
  points: MarketHistoryPoint[] | null | undefined,
  range: MarketChartRange,
  nowMs: number = Date.now()
): SanitizedMarketHistoryPoint[] {
  if (!Array.isArray(points) || points.length === 0) return [];

  const parsed: SanitizedMarketHistoryPoint[] = [];
  for (const p of points) {
    if (!p || typeof p.created_at !== 'string') continue;
    const t = Date.parse(p.created_at);
    if (!Number.isFinite(t)) continue;
    const value = typeof p.value === 'number' ? p.value : Number(p.value);
    if (!Number.isFinite(value)) continue;
    parsed.push({
      value,
      created_at: p.created_at,
      trend: typeof p.trend === 'string' ? p.trend : '',
      t,
    });
  }

  if (parsed.length === 0) return [];

  parsed.sort((a, b) => a.t - b.t);

  // Dedupe identical timestamps — keep the last occurrence after sort.
  const deduped: SanitizedMarketHistoryPoint[] = [];
  for (const point of parsed) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.t === point.t) {
      deduped[deduped.length - 1] = point;
    } else {
      deduped.push(point);
    }
  }

  const windowMs = RANGE_MS[range];
  if (!Number.isFinite(windowMs) || windowMs <= 0) return deduped;

  const maxT = deduped[deduped.length - 1].t;
  const anchorMs = Number.isFinite(maxT) ? maxT : nowMs;
  const cutoff = anchorMs - windowMs;

  return deduped.filter((p) => p.t >= cutoff);
}

/** Chart.js TimeScale unit: minute for ≤2H, hour for 12H. */
export function chartTimeUnitForRange(range: MarketChartRange): 'minute' | 'hour' {
  return range === '12H' ? 'hour' : 'minute';
}
