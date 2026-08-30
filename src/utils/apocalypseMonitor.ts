// Apocalypse Monitor Phase 3 Plan 1: pure helpers for the internal operator
// monitor dashboard. Everything here is deterministic and DOM-free so it
// runs under plain `node --test`.
//
// Hard rules encoded here:
//   * Raw backend points are preserved — sorting is defensive only, no
//     interpolation, no resampling, and the `source` tag (COLLAPSE included)
//     rides along into the transformed series.
//   * % CHANGE normalises each coin against its FIRST observed price:
//     ((price - start) / start) * 100. A zero starting price can never
//     divide — those points become null and the UI renders a clear "n/a".

import type {
  MonitorAttribution,
  MonitorCoin,
  MonitorCycleSummary
} from '../services/monitorService.ts';

export type MonitorChartMode = 'price' | 'percent';

export const MONITOR_CHART_MODE_LABEL: Record<MonitorChartMode, string> = {
  price: 'PRICE',
  percent: '% CHANGE'
};

// Provenance vocabulary mirrors the backend attribution contract exactly.
export const MONITOR_ATTRIBUTION_LABEL: Record<MonitorAttribution, string> = {
  exact: 'Exact',
  time_window_derived: 'Time-window derived',
  mixed: 'Mixed'
};

export function attributionLabel(attribution: MonitorAttribution | null): string {
  return attribution === null ? 'No data' : MONITOR_ATTRIBUTION_LABEL[attribution];
}

// Elapsed Apocalypse time formatting: MM:SS under an hour, H:MM:SS above.
// Negative input (a point fractionally before the cycle start) clamps to 0.
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Milliseconds between a point timestamp and the cycle start. Unparseable
// input yields NaN; callers clamp via formatElapsed / chart filtering.
export function elapsedMs(time: string, cycleStartTime: string): number {
  return new Date(time).getTime() - new Date(cycleStartTime).getTime();
}

// Newest cycle = the first row: the backend orders the cycles endpoint
// newest-first (cycle_id DESC). Null on an empty list.
export function pickNewestCycle(cycles: MonitorCycleSummary[]): MonitorCycleSummary | null {
  return cycles.length > 0 ? cycles[0] : null;
}

export interface MonitorSeriesPoint {
  /** Milliseconds elapsed since the cycle start (may be fractionally negative). */
  elapsedMs: number;
  /** Display value: raw price in PRICE mode, % change in % CHANGE mode. Null
   *  when the % change is undefined (zero starting price). */
  value: number | null;
  /** Raw backend price, always preserved. */
  price: number;
  /** Raw backend source tag (COLLAPSE included), always preserved. */
  source: string | null;
  time: string;
}

export interface MonitorSeries {
  coinId: number;
  symbol: string;
  name: string;
  points: MonitorSeriesPoint[];
}

// Transform one coin's raw history into a chart series. Raw points are kept
// verbatim (defensive ascending sort only — never interpolated). In percent
// mode each point is normalised against the first observed price; a zero (or
// negative, defensively) starting price yields null values so the chart
// never divides by zero and the UI can render a clear "n/a".
export function buildMonitorSeries(
  coin: MonitorCoin,
  cycleStartTime: string,
  mode: MonitorChartMode
): MonitorSeries {
  const sorted = [...coin.history.points]
    .filter((point) => Number.isFinite(new Date(point.time).getTime()))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const startPrice = sorted.length > 0 ? sorted[0].price : null;
  const normalisable = startPrice !== null && startPrice > 0;
  return {
    coinId: coin.coinId,
    symbol: coin.symbol,
    name: coin.name,
    points: sorted.map((point) => ({
      elapsedMs: elapsedMs(point.time, cycleStartTime),
      value:
        mode === 'price'
          ? point.price
          : normalisable
            ? ((point.price - startPrice) / startPrice) * 100
            : null,
      price: point.price,
      source: point.source,
      time: point.time
    }))
  };
}

export interface MonitorCoinSummary {
  coinId: number;
  symbol: string;
  name: string;
  sampleCount: number;
  /** First observed price in the cycle (null with no history). */
  startPrice: number | null;
  /** Last observation at or before the cycle end time. */
  endPrice: number | null;
  /** Most recent observed price overall. */
  latestPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  /** latest - start (null with no history). */
  changeAbs: number | null;
  /** ((latest - start) / start) * 100; null when start is zero/absent. */
  changePct: number | null;
  /** Final observed price is exactly 0 — the collapsed end state. */
  collapsed: boolean;
  /** At least one point carries the COLLAPSE source tag. */
  hasCollapseEvent: boolean;
  attribution: MonitorAttribution | null;
}

// Per-coin summary row for the table below the chart. Coins with no history
// summarise to nulls and zero samples — never a crash.
export function summariseMonitorCoin(coin: MonitorCoin, cycleEndTime: string): MonitorCoinSummary {
  const points = [...coin.history.points]
    .filter((point) => Number.isFinite(new Date(point.time).getTime()))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const endMs = new Date(cycleEndTime).getTime();

  const base: MonitorCoinSummary = {
    coinId: coin.coinId,
    symbol: coin.symbol,
    name: coin.name,
    sampleCount: points.length,
    startPrice: null,
    endPrice: null,
    latestPrice: null,
    highPrice: null,
    lowPrice: null,
    changeAbs: null,
    changePct: null,
    collapsed: false,
    hasCollapseEvent: false,
    attribution: coin.history.attribution
  };
  if (points.length === 0) return base;

  const prices = points.map((point) => point.price);
  const startPrice = points[0].price;
  const latestPrice = points[points.length - 1].price;
  const beforeEnd = points.filter((point) => new Date(point.time).getTime() <= endMs);
  const endPrice = (beforeEnd.length > 0 ? beforeEnd[beforeEnd.length - 1] : points[points.length - 1]).price;

  return {
    ...base,
    startPrice,
    endPrice,
    latestPrice,
    highPrice: Math.max(...prices),
    lowPrice: Math.min(...prices),
    changeAbs: latestPrice - startPrice,
    changePct: startPrice > 0 ? ((latestPrice - startPrice) / startPrice) * 100 : null,
    collapsed: latestPrice === 0,
    hasCollapseEvent: points.some((point) => point.source === 'COLLAPSE')
  };
}

// --- Display formatting --------------------------------------------------------

export function formatMonitorPrice(price: number | null): string {
  return price === null ? 'n/a' : `£${price.toFixed(2)}`;
}

export function formatMonitorChangePct(pct: number | null): string {
  if (pct === null) return 'n/a';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}
