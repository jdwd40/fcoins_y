// Apocalypse Monitor Phase 3 Plan 1 + Phase 4: pure helpers for the internal
// operator monitor dashboard. Everything here is deterministic and DOM-free
// so it runs under plain `node --test`.
//
// Phase 4 adds the replay cursor helpers (monitorReplayBounds /
// clampReplayTime / getPriceAtTime / getCoinStateAtTime / formatInspecting):
// pure reads over one loaded snapshot, used while scrubbing — never a
// refetch, never an interpolation.
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
  MonitorCycleStatus,
  MonitorCycleSummary,
  MonitorPricePoint,
  MonitorSnapshot
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

// =============================================================================
// Temporary monitor-only exclusion (HAD / CBT / HDW)
//
// Retired legacy coins HashAd (HAD), ChrisByte (CBT) and HodlWayne (HDW) are
// TEMPORARILY hidden from the Apocalypse Monitor chart and per-coin summary
// table. This is a render-side filter ONLY: it never mutates the loaded
// snapshot (monitorData), never touches the service/API response, and must
// never be imported by player-facing code. Remove this block to restore the
// full history display.
// =============================================================================

export const TEMPORARY_MONITOR_EXCLUDED_SYMBOLS: readonly string[] = ['HAD', 'CBT', 'HDW'];

// Pure filter: returns a NEW array with the temporarily excluded symbols
// removed, sharing the same coin object references. The input array (the
// loaded snapshot's coin list) is never mutated.
export function filterMonitorCoins(coins: MonitorCoin[]): MonitorCoin[] {
  return coins.filter((coin) => !TEMPORARY_MONITOR_EXCLUDED_SYMBOLS.includes(coin.symbol));
}

// =============================================================================
// Apocalypse Monitor Phase 4: replay cursor (scrubbing) helpers.
//
// The replay cursor is ELAPSED MILLISECONDS since the cycle start — the same
// unit as the chart x-axis — so a future playback phase can advance it
// arithmetically without timestamp bookkeeping. Scrubbing never refetches or
// mutates the loaded snapshot; everything below is a pure read over it.
// =============================================================================

export interface MonitorReplayBounds {
  /** Slider lower bound: the cycle start (always 0 elapsed). */
  minMs: number;
  /** Slider upper bound: cycle end for finished cycles; the latest
   *  legitimately observable time for ACTIVE cycles (never the future). */
  maxMs: number;
  /** Cursor position after a cycle selection / data load. */
  defaultMs: number;
}

// Replay bounds for one loaded snapshot. COMPLETED/SETTLING cycles span the
// whole cycle and default the cursor to the cycle end. ACTIVE cycles are
// capped at the latest legitimately observable time — the later of the
// snapshot's database-clock read (observedAt) and the newest real sample
// across all coins, clamped to the cycle end — so the operator can never
// scrub into the future over invented prices. Malformed timestamps are
// ignored; unparseable cycle bounds degrade to a zero-width safe range.
export function monitorReplayBounds(snapshot: MonitorSnapshot): MonitorReplayBounds {
  const zero: MonitorReplayBounds = { minMs: 0, maxMs: 0, defaultMs: 0 };
  const startMs = new Date(snapshot.cycle.startTime).getTime();
  const endMs = new Date(snapshot.cycle.endTime).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return zero;
  }
  const cycleLengthMs = endMs - startMs;
  if (snapshot.cycle.status === 'ACTIVE') {
    let observableMs = startMs;
    const observedMs = new Date(snapshot.cycle.observedAt).getTime();
    if (Number.isFinite(observedMs)) observableMs = Math.max(observableMs, observedMs);
    for (const coin of snapshot.coins) {
      for (const point of coin.history.points) {
        const pointMs = new Date(point.time).getTime();
        if (Number.isFinite(pointMs) && pointMs > observableMs) observableMs = pointMs;
      }
    }
    const maxMs = Math.max(0, Math.min(cycleLengthMs, observableMs - startMs));
    return { minMs: 0, maxMs, defaultMs: maxMs };
  }
  return { minMs: 0, maxMs: cycleLengthMs, defaultMs: cycleLengthMs };
}

// Clamp a cursor into the bounds; NaN input recovers to the default (cycle
// end / latest observable) rather than propagating.
export function clampReplayTime(ms: number, bounds: MonitorReplayBounds): number {
  if (!Number.isFinite(ms)) return bounds.defaultMs;
  return Math.min(bounds.maxMs, Math.max(bounds.minMs, ms));
}

// Valid samples of one coin, ascending by time — the shared defensive
// filter/sort used by every point-in-time lookup. Malformed timestamps are
// dropped, so one bad row (or a whole bad coin) can never crash the lookup.
function sortedValidPoints(coin: MonitorCoin): MonitorPricePoint[] {
  return [...coin.history.points]
    .filter((point) => Number.isFinite(new Date(point.time).getTime()))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

// Latest sample at or before the cursor — step semantics, never
// interpolated. Null before the first observation (or with no valid
// samples); past the final sample the latest observed price answers.
export function getPriceAtTime(
  coin: MonitorCoin,
  cycleStartTime: string,
  cursorMs: number
): number | null {
  const startMs = new Date(cycleStartTime).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(cursorMs)) return null;
  const points = sortedValidPoints(coin);
  let price: number | null = null;
  for (const point of points) {
    if (new Date(point.time).getTime() - startMs > cursorMs) break;
    price = point.price;
  }
  return price;
}

export interface MonitorCoinReplayState {
  /** False before the first observation (or with no valid samples). */
  available: boolean;
  /** Price at the cursor (latest sample ≤ cursor). */
  price: number | null;
  /** Timestamp of the sample answering the cursor. */
  time: string | null;
  /** Source tag of that sample (COLLAPSE included). */
  source: string | null;
  /** % change vs the FIRST observed price; null when that price is zero or
   *  the coin is unavailable — never Infinity/NaN. */
  changePct: number | null;
  /** True at/after a zero-priced COLLAPSE sample: the coin is collapsed. */
  collapsed: boolean;
}

const UNAVAILABLE_REPLAY_STATE: MonitorCoinReplayState = {
  available: false,
  price: null,
  time: null,
  source: null,
  changePct: null,
  collapsed: false
};

// Full point-in-time state for one coin at the replay cursor. Before a
// collapse the prior price answers; at/after a zero-priced sample whose
// source is COLLAPSE the state is price 0 and collapsed. A COLLAPSE-tagged
// sample with a non-zero price (a provenance tag on a surviving row) does
// not collapse the point-in-time state.
export function getCoinStateAtTime(
  coin: MonitorCoin,
  cycleStartTime: string,
  cursorMs: number
): MonitorCoinReplayState {
  const startMs = new Date(cycleStartTime).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(cursorMs)) return UNAVAILABLE_REPLAY_STATE;
  const points = sortedValidPoints(coin);
  if (points.length === 0) return UNAVAILABLE_REPLAY_STATE;
  let at: MonitorPricePoint | null = null;
  for (const point of points) {
    if (new Date(point.time).getTime() - startMs > cursorMs) break;
    at = point;
  }
  if (at === null) return UNAVAILABLE_REPLAY_STATE;
  const startPrice = points[0].price;
  return {
    available: true,
    price: at.price,
    time: at.time,
    source: at.source,
    changePct: startPrice > 0 ? ((at.price - startPrice) / startPrice) * 100 : null,
    collapsed: at.source === 'COLLAPSE' && at.price === 0
  };
}

// "Inspecting: elapsed / total" readout next to the replay slider.
export function formatInspecting(cursorMs: number, totalMs: number): string {
  return `Inspecting: ${formatElapsed(cursorMs)} / ${formatElapsed(totalMs)}`;
}

// =============================================================================
// Apocalypse Monitor Phase 5: automatic replay playback helpers.
//
// Playback advances the SAME Phase 4 cursor (`currentReplayTime`, elapsed ms
// since the cycle start) by REAL ELAPSED BROWSER TIME * SPEED:
//   replayAdvance = (frameTimestamp - previousFrameTimestamp) * speed.
// The component feeds requestAnimationFrame timestamps into advanceReplayTime,
// so a delayed callback (busy tab, background throttling) advances
// proportionally and can never drift or accumulate error. Everything here is
// pure with injected timestamps — deterministic under `node --test`.
// =============================================================================

// Supported playback speeds (multipliers over real time). 10x is the default:
// a 30-minute apocalypse replays in ~3 minutes of operator time.
export const MONITOR_PLAYBACK_SPEEDS = [1, 5, 10, 30, 60] as const;
export type MonitorPlaybackSpeed = (typeof MONITOR_PLAYBACK_SPEEDS)[number];
export const DEFAULT_MONITOR_PLAYBACK_SPEED: MonitorPlaybackSpeed = 10;

export function isMonitorPlaybackSpeed(value: number): value is MonitorPlaybackSpeed {
  return (MONITOR_PLAYBACK_SPEEDS as readonly number[]).includes(value);
}

// Operator-facing speed button label: 1x / 5x / 10x / 30x / 60x.
export function playbackSpeedLabel(speed: number): string {
  return `${speed}x`;
}

export interface MonitorReplayAdvance {
  /** Cursor after the advance, clamped exactly into the bounds. */
  cursorMs: number;
  /** True when the clamped cursor sits at the upper bound: the component
   *  pauses there — no looping, never a wrap to the start. */
  reachedEnd: boolean;
}

// Advance the replay cursor by `elapsedRealMs * speed`, clamped exactly into
// the bounds. Invalid input is a deterministic no-op (the cursor is merely
// clamped into range; NaN recovers to the default), so one bad frame can
// never corrupt the timeline. A negative delta clamps at the lower bound.
export function advanceReplayTime(
  cursorMs: number,
  elapsedRealMs: number,
  speed: number,
  bounds: MonitorReplayBounds
): MonitorReplayAdvance {
  const base = Number.isFinite(cursorMs) ? cursorMs : bounds.defaultMs;
  const validDelta = Number.isFinite(elapsedRealMs) && Number.isFinite(speed) && speed > 0;
  const advanced = validDelta ? base + elapsedRealMs * speed : base;
  const clamped = Math.min(bounds.maxMs, Math.max(bounds.minMs, advanced));
  return { cursorMs: clamped, reachedEnd: clamped >= bounds.maxMs };
}

// Where playback begins when Play is pressed. A finished cycle
// (COMPLETED/SETTLING) parked at the upper bound RESTARTS from the cycle
// start; anywhere before the bound it resumes from the cursor. An ACTIVE
// cycle always plays from the cursor and stops at its existing replay upper
// bound (the latest observable time) — never restarted, never the future.
export function resolveReplayPlayStart(
  cursorMs: number,
  bounds: MonitorReplayBounds,
  status: MonitorCycleStatus
): number {
  const clamped = clampReplayTime(cursorMs, bounds);
  if (status !== 'ACTIVE' && clamped >= bounds.maxMs && bounds.maxMs > bounds.minMs) {
    return bounds.minMs;
  }
  return clamped;
}
