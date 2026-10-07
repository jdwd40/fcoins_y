// Issue #28: pure candlestick helpers for the coin page chart. Everything
// here is deterministic and DOM-free so it runs under plain `node --test`;
// CandlestickChart.tsx only measures its box and draws what these return.
//
// Data rule: every candle comes from the coin's own public price history
// (GET /coins/:id/price-history). Raw observations (10M, resolution "raw":
// one flat point per sample, ~30s apart in production) are always merged
// into time-aligned OHLC candles; pre-bucketed OHLC (30M/1H/2H/24H) passes
// through or is re-bucketed only to fit the screen. Nothing is interpolated,
// smoothed or invented — bucketing only merges consecutive real points.

import type { CoinChartRange } from './marketHistoryChart.ts';
import { RANGE_MS } from './marketHistoryChart.ts';
import { formatPrice } from './formatPrice.ts';

export interface Candle {
  /** Bucket start, epoch ms. */
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Number of underlying samples (best effort; 1 per point when unknown). */
  samples: number;
  /** False while the bucket may still change (trailing / incomplete input). */
  complete: boolean;
}

export interface CandleSeries {
  candles: Candle[];
  /** Time width of one candle slot in ms (bucket size or inferred spacing). */
  slotMs: number;
}

// Refresh cadence while the coin page is mounted. The endpoint is HTTP-cached
// for 10s, so refetching any faster could only return the same payload.
export const CANDLE_REFRESH_MS = 12_000;

// Ideal (maximum) candle counts per range on a wide screen. Raw ranges
// (5M/10M) are additionally held to the raw bucket floor below, so they
// draw fewer, real candles; bucketed ranges mostly pass through.
export const CANDLE_TARGETS: Readonly<Record<CoinChartRange, number>> = {
  '5M': 36,
  '10M': 48,
  '30M': 30,
  '1H': 60,
  '2H': 60,
  '12H': 48
};

// Narrow screens: never draw more candles than fit at MIN_SLOT_PX each, so
// a body (BODY_RATIO of the slot) stays at least ~3px wide on a 360px phone.
export const MIN_SLOT_PX = 4.5;
export const BODY_RATIO = 0.7;
// Sparse windows (a handful of points) never balloon into slabs.
export const MAX_BODY_PX = 18;
const MIN_CANDLES = 8;

/** Candle budget for a plot of `plotWidthPx`, capped by the range target. */
export function candleTargetFor(range: CoinChartRange, plotWidthPx: number): number {
  const ideal = CANDLE_TARGETS[range] ?? 48;
  if (!Number.isFinite(plotWidthPx) || plotWidthPx <= 0) return ideal;
  const fit = Math.floor(plotWidthPx / MIN_SLOT_PX);
  return Math.max(MIN_CANDLES, Math.min(ideal, fit));
}

// --- Parse / validate / sort / dedupe ---------------------------------------

function toFinite(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Turn a raw price-history `points` array into clean ascending candles:
 * unparseable times, non-finite or negative prices are dropped; the OHLC
 * envelope is normalised (high/low always contain open and close); same
 * timestamps are deduped keeping the LAST occurrence (the freshest copy).
 */
export function sanitizeOhlcPoints(points: unknown): Candle[] {
  if (!Array.isArray(points)) return [];
  const parsed: Candle[] = [];
  for (const raw of points) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    const t = typeof p.time === 'string' ? Date.parse(p.time) : NaN;
    if (!Number.isFinite(t)) continue;
    const close = toFinite(p.close);
    if (close === null || close < 0) continue;
    // A point with only a close (e.g. a single raw tick) is a doji at close.
    const open = toFinite(p.open) ?? close;
    const high = toFinite(p.high) ?? close;
    const low = toFinite(p.low) ?? close;
    if (open < 0 || high < 0 || low < 0) continue;
    const samples = toFinite(p.samples);
    parsed.push({
      t,
      open,
      close,
      high: Math.max(open, high, low, close),
      low: Math.min(open, high, low, close),
      samples: samples !== null && samples > 0 ? Math.floor(samples) : 1,
      complete: p.complete !== false
    });
  }
  // Stable sort keeps input order for equal timestamps, so "keep last" below
  // keeps the later copy from the payload.
  parsed.sort((a, b) => a.t - b.t);
  const deduped: Candle[] = [];
  for (const candle of parsed) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.t === candle.t) deduped[deduped.length - 1] = candle;
    else deduped.push(candle);
  }
  return deduped;
}

/**
 * Client window: keep candles inside the selected range, anchored on the
 * newest point (so 5M from a 10M payload, or 12H from a 24H payload, shows
 * exactly that span). The cut is exclusive because each candle owns the slot
 * AFTER its start: 48 × 15m candles are exactly 12 hours. `sinceMs`
 * additionally clips anything older than an authoritative live-window start.
 */
export function windowCandles(
  candles: Candle[],
  range: CoinChartRange,
  sinceMs: number | null = null
): Candle[] {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const windowMs = RANGE_MS[range];
  const anchor = candles[candles.length - 1].t;
  const cutoff = Number.isFinite(windowMs) ? anchor - windowMs : -Infinity;
  const since = typeof sinceMs === 'number' && Number.isFinite(sinceMs) ? sinceMs : -Infinity;
  return candles.filter((c) => c.t > cutoff && c.t >= since);
}

// --- Aggregation -------------------------------------------------------------

// Calendar-friendly bucket sizes so candle boundaries land on clean clock
// times and stay put as new ticks arrive (no re-bucketing wobble on refresh).
const NICE_BUCKETS_MS = [
  1_000, 2_000, 5_000, 10_000, 15_000, 30_000,
  60_000, 2 * 60_000, 3 * 60_000, 5 * 60_000, 10 * 60_000, 15 * 60_000, 30 * 60_000,
  3_600_000, 2 * 3_600_000, 3 * 3_600_000, 4 * 3_600_000, 6 * 3_600_000, 12 * 3_600_000, 86_400_000
];

function bucketCount(firstT: number, lastT: number, bucketMs: number): number {
  return Math.floor(lastT / bucketMs) - Math.floor(firstT / bucketMs) + 1;
}

// Raw history policy: a candle covers at least one clock minute AND at
// least RAW_MIN_SAMPLES_PER_CANDLE sample intervals, so every complete
// candle holds several real observations (30s feed → 1m candles; a 60s
// feed → 2m candles). One flat point per candle would only draw dojis.
export const RAW_MIN_BUCKET_MS = 60_000;
export const RAW_MIN_SAMPLES_PER_CANDLE = 2;

/**
 * True when the payload is raw observations rather than authoritative OHLC
 * buckets. The server's `resolution` decides ("raw" vs "1m"/"5m"/…); only
 * when it is missing does the shape decide (every point flat, ≤1 sample).
 */
export function isRawHistory(resolution: unknown, clean: Candle[]): boolean {
  if (typeof resolution === 'string' && resolution.trim().length > 0) {
    return resolution.trim().toLowerCase() === 'raw';
  }
  return (
    Array.isArray(clean) &&
    clean.length > 0 &&
    clean.every((c) => c.samples <= 1 && c.open === c.close && c.high === c.close && c.low === c.close)
  );
}

/** Smallest bucket raw observations may use (see RAW_MIN_BUCKET_MS). */
export function rawBucketFloorMs(clean: Candle[]): number {
  // Whole seconds, so ms jitter (30_000 vs 30_001) never flips the bucket.
  const cadence = Math.round(rawCadenceMs(clean) / 1_000) * 1_000;
  return Math.max(RAW_MIN_BUCKET_MS, cadence * RAW_MIN_SAMPLES_PER_CANDLE);
}

/**
 * Sampling cadence of raw observations: the lower median gap, so a feed
 * interruption can never outvote the regular interval ([30s, 300s] → 30s).
 * A single gap is no evidence of a cadence, so it sets no floor.
 */
function rawCadenceMs(clean: Candle[]): number {
  const gaps: number[] = [];
  for (let i = 1; i < clean.length; i++) {
    const gap = clean[i].t - clean[i - 1].t;
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length < 2) return 0;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor((gaps.length - 1) / 2)];
}

/** Median gap between consecutive candles (robust to a missing tick or two). */
export function inferSlotMs(candles: Candle[], fallbackMs = 60_000): number {
  if (!Array.isArray(candles) || candles.length < 2) return fallbackMs;
  const gaps: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const gap = candles[i].t - candles[i - 1].t;
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return fallbackMs;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/**
 * Turn price-history points into at most `targetCandles` OHLC candles.
 *
 *  - pre-bucketed OHLC, n ≤ target: points pass through as candles.
 *  - `raw: true` (raw observations): always merged, into the smallest clean
 *    bucket ≥ rawBucketFloorMs that yields ≤ target candles.
 *  - n > target: consecutive points are merged into time-aligned buckets
 *    (the smallest clean bucket size that yields ≤ target candles):
 *    open = first open, high = max high, low = min low, close = last close,
 *    time = bucket start. A bucket is incomplete if any input point was, and
 *    the trailing bucket is always incomplete (more ticks may still land).
 *
 * Empty buckets are never filled in — a gap in the data stays a gap.
 */
export function aggregateCandles(
  points: unknown,
  targetCandles: number,
  options: AggregateOptions = {}
): CandleSeries {
  const clean = sanitizeOhlcPoints(points);
  return aggregateSanitized(clean, targetCandles, options);
}

export interface AggregateOptions {
  /** Input is raw observations (see isRawHistory), not OHLC buckets. */
  raw?: boolean;
}

/** aggregateCandles for input that has already been through sanitizeOhlcPoints. */
export function aggregateSanitized(
  clean: Candle[],
  targetCandles: number,
  options: AggregateOptions = {}
): CandleSeries {
  const target = Number.isFinite(targetCandles) && targetCandles >= 1 ? Math.floor(targetCandles) : 1;
  if (clean.length === 0) return { candles: [], slotMs: 60_000 };
  const floorMs = options.raw ? rawBucketFloorMs(clean) : 0;
  if (floorMs === 0 && clean.length <= target) {
    return { candles: clean.map((c) => ({ ...c })), slotMs: inferSlotMs(clean) };
  }

  const firstT = clean[0].t;
  const lastT = clean[clean.length - 1].t;
  let bucketMs =
    NICE_BUCKETS_MS.find((ms) => ms >= floorMs && bucketCount(firstT, lastT, ms) <= target) ?? null;
  if (bucketMs === null) {
    // Spans beyond the nice table: an exact size that still honours the cap.
    const span = Math.max(1, lastT - firstT);
    bucketMs = Math.max(floorMs, target > 1 ? Math.ceil(span / (target - 1)) : span + 1);
  }

  const candles: Candle[] = [];
  let current: Candle | null = null;
  let currentKey = Number.NaN;
  for (const point of clean) {
    const key = Math.floor(point.t / bucketMs);
    if (current === null || key !== currentKey) {
      if (current) candles.push(current);
      currentKey = key;
      current = {
        t: key * bucketMs,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        samples: point.samples,
        complete: point.complete
      };
    } else {
      current.high = Math.max(current.high, point.high);
      current.low = Math.min(current.low, point.low);
      current.close = point.close;
      current.samples += point.samples;
      current.complete = current.complete && point.complete;
    }
  }
  if (current) {
    current.complete = false;
    candles.push(current);
  }
  return { candles, slotMs: bucketMs };
}

// --- Price domain --------------------------------------------------------------

export interface PriceDomain {
  min: number;
  max: number;
}

export const DOMAIN_PAD_RATIO = 0.08;
// A flat (or near-flat) window still gets a readable band: at least this
// fraction of the price, split evenly around it. Relative, so it works for
// a £0.10 coin and a £100,000 coin alike.
export const MIN_RELATIVE_SPAN = 0.005;
const ZERO_PRICE_SPAN = 0.01;

/**
 * Dynamic y-domain: [min low, max high] ∪ latestValue, padded ~8%.
 * Never anchored at zero unless the data itself goes (or nearly goes)
 * there — prices are never negative, so the floor clamps at £0.
 */
export function visiblePriceDomain(
  candles: Pick<Candle, 'high' | 'low'>[],
  latestValue: number | null | undefined,
  padRatio = DOMAIN_PAD_RATIO
): PriceDomain | null {
  const values: number[] = [];
  for (const c of Array.isArray(candles) ? candles : []) {
    if (Number.isFinite(c.low) && c.low >= 0) values.push(c.low);
    if (Number.isFinite(c.high) && c.high >= 0) values.push(c.high);
  }
  if (typeof latestValue === 'number' && Number.isFinite(latestValue) && latestValue >= 0) {
    values.push(latestValue);
  }
  if (values.length === 0) return null;

  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const mid = (lo + hi) / 2;
  const minSpan = mid > 0 ? mid * MIN_RELATIVE_SPAN : ZERO_PRICE_SPAN;
  if (hi - lo < minSpan) {
    // Degenerate / near-flat: symmetric band around the price.
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const pad = (hi - lo) * padRatio;
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  return { min, max: max > min ? max : min + ZERO_PRICE_SPAN };
}

// --- Geometry -------------------------------------------------------------------

export interface PlotBox {
  width: number;
  height: number;
}

export interface CandleShape {
  t: number;
  /** Slot centre x (wick x). */
  x: number;
  bodyX: number;
  bodyWidth: number;
  bodyY: number;
  bodyHeight: number;
  wickTop: number;
  wickBottom: number;
  direction: 'up' | 'down' | 'flat';
  complete: boolean;
}

export interface CandleLayout {
  shapes: CandleShape[];
  /** Time extent drawn across the plot width (first slot start → last slot end). */
  startMs: number;
  endMs: number;
  slotWidth: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Price → y pixel inside a plot of `height` (top = domain.max). */
export function yForPrice(price: number, domain: PriceDomain, height: number): number {
  const span = domain.max - domain.min;
  if (!(span > 0)) return round2(height / 2);
  return round2((1 - (price - domain.min) / span) * height);
}

/** Time → x pixel across [startMs, endMs] mapped to [0, width]. */
export function xForTime(t: number, startMs: number, endMs: number, width: number): number {
  const span = endMs - startMs;
  if (!(span > 0)) return round2(width / 2);
  return round2(((t - startMs) / span) * width);
}

/**
 * Map candles to drawable rectangles/lines on a time-proportional x axis:
 * each candle owns one slot of `slotMs` starting at its bucket time, so
 * gaps in the data show as gaps. Bodies are at least 1px tall (a doji is a
 * visible tick) and at least 1px wide.
 */
export function layoutCandles(
  series: CandleSeries,
  domain: PriceDomain,
  box: PlotBox
): CandleLayout | null {
  const { candles } = series;
  if (!Array.isArray(candles) || candles.length === 0) return null;
  if (!(box.width > 0) || !(box.height > 0)) return null;
  const slotMs = series.slotMs > 0 ? series.slotMs : 60_000;
  const startMs = candles[0].t;
  const endMs = candles[candles.length - 1].t + slotMs;
  const slotWidth = (slotMs / (endMs - startMs)) * box.width;
  const bodyWidth = Math.min(MAX_BODY_PX, Math.max(1, round2(slotWidth * BODY_RATIO)));

  const shapes = candles.map((c): CandleShape => {
    const left = xForTime(c.t, startMs, endMs, box.width);
    const x = round2(left + slotWidth / 2);
    const yOpen = yForPrice(c.open, domain, box.height);
    const yClose = yForPrice(c.close, domain, box.height);
    const top = Math.min(yOpen, yClose);
    const bodyHeight = Math.max(1, round2(Math.abs(yOpen - yClose)));
    return {
      t: c.t,
      x,
      bodyX: round2(x - bodyWidth / 2),
      bodyWidth,
      bodyY: round2(Math.min(top, box.height - bodyHeight)),
      bodyHeight,
      wickTop: yForPrice(c.high, domain, box.height),
      wickBottom: yForPrice(c.low, domain, box.height),
      direction: c.close > c.open ? 'up' : c.close < c.open ? 'down' : 'flat',
      complete: c.complete
    };
  });
  return { shapes, startMs, endMs, slotWidth: round2(slotWidth) };
}

// --- Axes -------------------------------------------------------------------------

/** "Nice" step (1/2/2.5/5 × 10^k) giving at most `maxTicks` ticks across `span`. */
export function niceStep(span: number, maxTicks: number): number {
  if (!(span > 0) || !(maxTicks >= 1)) return 0;
  const raw = span / maxTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    const step = m * magnitude;
    if (span / step <= maxTicks) return step;
  }
  return 10 * magnitude;
}

/** Price ticks inside the domain, at most `maxTicks`, with distinct labels. */
export function priceTicks(domain: PriceDomain, maxTicks = 6): number[] {
  const step = niceStep(domain.max - domain.min, maxTicks);
  if (!(step > 0)) return [domain.min];
  const ticks: number[] = [];
  const first = Math.ceil(domain.min / step) * step;
  for (let i = 0; i <= maxTicks + 1; i++) {
    const value = first + i * step;
    if (value > domain.max + step * 1e-9) break;
    ticks.push(Number(value.toPrecision(12)));
  }
  // formatPrice rounds (2dp ≥ £1, 4dp under £1): drop ticks whose label
  // would repeat its neighbour so the axis never reads "£0.10, £0.10".
  const seen = new Set<string>();
  return ticks.filter((value) => {
    const label = formatPrice(value);
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

const TIME_STEPS_MS = [
  30_000, 60_000, 2 * 60_000, 5 * 60_000, 10 * 60_000, 15 * 60_000, 30 * 60_000,
  3_600_000, 2 * 3_600_000, 3 * 3_600_000, 6 * 3_600_000, 12 * 3_600_000
];

/**
 * Time ticks on clean local clock boundaries inside [startMs, endMs], at
 * most `maxTicks`. `tzOffsetMinutes` is Date#getTimezoneOffset (minutes
 * WEST of UTC); it defaults to the local zone at `startMs`.
 */
export function timeTicks(
  startMs: number,
  endMs: number,
  maxTicks = 6,
  tzOffsetMinutes: number = new Date(startMs).getTimezoneOffset()
): number[] {
  const span = endMs - startMs;
  if (!(span > 0) || !(maxTicks >= 1)) return [];
  const step = TIME_STEPS_MS.find((ms) => span / ms <= maxTicks) ?? Math.ceil(span / maxTicks);
  const shift = -tzOffsetMinutes * 60_000;
  const first = Math.ceil((startMs + shift) / step) * step - shift;
  const ticks: number[] = [];
  for (let t = first; t <= endMs && ticks.length < maxTicks; t += step) ticks.push(t);
  return ticks;
}

const TWO_HOURS_MS = 2 * 3_600_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Local labels for time ticks: HH:mm for windows ≤2H; beyond that HH:mm
 * stays the default but the first tick on a new local day is prefixed with
 * the weekday ("Tue 00:00") so a 12H window crossing midnight stays clear.
 */
export function formatTimeTicks(ticks: number[], spanMs: number): string[] {
  const dayAware = spanMs > TWO_HOURS_MS;
  let prevDay: string | null = null;
  return ticks.map((t, i) => {
    const d = new Date(t);
    const label = hhmm(d);
    if (!dayAware) return label;
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const crossed = i > 0 && prevDay !== null && dayKey !== prevDay;
    prevDay = dayKey;
    return crossed ? `${WEEKDAYS[d.getDay()]} ${label}` : label;
  });
}

// --- Accessible summary -----------------------------------------------------------

export interface CandleDescriptionInput {
  symbol: string;
  rangeLabel: string;
  candles: Pick<Candle, 'high' | 'low' | 'close'>[];
  latestValue: number | null;
  averageEntry: number | null;
  entryMarked: boolean;
}

/**
 * Text equivalent of the chart: window, direction and size of the move from
 * the first candle's close to the current price, window high/low, candle
 * count, and the entry line when drawn. Describes only what already happened.
 */
export function describeCandles(input: CandleDescriptionInput): string {
  let text = `Candlestick price chart for ${input.symbol} over ${input.rangeLabel}`;
  const candles = Array.isArray(input.candles) ? input.candles : [];
  if (candles.length === 0 || input.latestValue === null || !Number.isFinite(input.latestValue)) {
    return `${text}: no price history for this period yet.`;
  }
  const first = candles[0].close;
  const change = input.latestValue - first;
  const pct = first !== 0 ? (change / first) * 100 : 0;
  const flat = change === 0 || Math.abs(pct) < 0.005;
  const dir = flat ? 'flat' : change > 0 ? 'up' : 'down';
  const pctText = `${pct >= 0 ? '+' : ''}${(flat ? 0 : pct).toFixed(2)} percent`;
  const high = Math.max(...candles.map((c) => c.high));
  const low = Math.min(...candles.map((c) => c.low));
  text += `: ${dir} ${pctText} to ${formatPrice(input.latestValue)}.`;
  text += ` Period high ${formatPrice(high)}, low ${formatPrice(low)}.`;
  text += ` ${candles.length} candle${candles.length === 1 ? '' : 's'}.`;
  if (input.entryMarked && input.averageEntry !== null) {
    text += ` Your average entry ${formatPrice(input.averageEntry)} is shown as a dashed line.`;
  }
  return text;
}
