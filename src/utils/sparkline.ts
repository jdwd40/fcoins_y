// Issue #12: pure sparkline helpers for the compact V2 coin cards. Everything
// here is deterministic and DOM-free so it runs under plain `node --test`.
//
// The card sparkline is gameplay information (dip → rise → boom → fall), not
// exchange chrome: no axes, no legend, no predictive data. Only the coin's
// OWN public, already-happened price history is rendered.

import type { PricePoint } from '../types.ts';
import type { PersistentCoinSignal } from '../services/persistentService.ts';

// The backend's public per-coin price-history ranges (coins.controller.js
// validRanges). Compact cards only ever use the four shortest windows.
export type SparklineRange = '10M' | '30M' | '1H' | '2H' | '24H' | '7D' | '30D' | 'ALL';

// Ascending window minutes for the ranges a compact card may select. A
// sparkline never needs a multi-day window, so the selectable set is capped
// at 2H (longer windows stay with the detailed PriceChart, issue #13).
const COMPACT_RANGE_WINDOWS: ReadonlyArray<readonly [SparklineRange, number]> = [
  ['10M', 10],
  ['30M', 30],
  ['1H', 60],
  ['2H', 120]
];

// How many typical cycles the window should normally cover. Three cycles is
// enough to recognise the dip → boom → dip shape without zooming so far out
// that the current move becomes invisible.
export const SPARKLINE_CYCLES_TARGET = 3;

// Safe moderate default when neither the public signal nor the archetype
// table can justify a window (defensive only — live coins always carry
// typicalCycleMinutes on the market-signals payload).
export const DEFAULT_SPARKLINE_RANGE: SparklineRange = '30M';

// Public per-archetype MAX cycle minutes. For the persistent-market cutover
// the sparkline uses the archetype directly (no typicalCycleMinutes on
// PersistentCoinSignal). This table is the authoritative range mapping and
// is retained verbatim.
export const ARCHETYPE_MAX_CYCLE_MINUTES: Record<string, number> = {
  ZIP: 3,   // ~1–3 min cycles
  MOON: 5,  // ~3–5 min cycles
  BULL: 8,  // ~5–8 min cycles
  HODL: 15, // ~10–15 min cycles
  DEGEN: 8, // ~2–8 min cycles
  RUG: 10   // ~1.5–10 min cycles
};

// Deterministic history-window mapping using archetype directly (Stage 11
// persistent signals). Aim for ~SPARKLINE_CYCLES_TARGET cycles and pick the
// smallest compact range that covers:
//   ZIP  (3) → 10M
//   MOON (5) → 30M
//   BULL (8) → 30M
//   HODL (15)→ 1H
//   DEGEN(8) → 30M
//   RUG (10) → 30M
// No legacy cycle/phase/Apocalypse timing consulted.
export function sparklineRangeForCoin(
  coin: Pick<PersistentCoinSignal, 'archetype'>
): SparklineRange {
  const maxCycleMinutes = ARCHETYPE_MAX_CYCLE_MINUTES[coin.archetype];
  if (typeof maxCycleMinutes !== 'number' || !Number.isFinite(maxCycleMinutes) || maxCycleMinutes <= 0) {
    return DEFAULT_SPARKLINE_RANGE;
  }
  const targetMinutes = maxCycleMinutes * SPARKLINE_CYCLES_TARGET;
  for (const [range, windowMinutes] of COMPACT_RANGE_WINDOWS) {
    if (windowMinutes >= targetMinutes) return range;
  }
  return '2H';
}

// Human range wording for aria text and captions.
export const SPARKLINE_RANGE_LABEL: Record<SparklineRange, string> = {
  '10M': '10-minute',
  '30M': '30-minute',
  '1H': '1-hour',
  '2H': '2-hour',
  '24H': '24-hour',
  '7D': '7-day',
  '30D': '30-day',
  ALL: 'all-time'
};

export interface SparklineSample {
  /** Epoch milliseconds. */
  t: number;
  price: number;
}

// Normalise the backend candle contract into a clean ascending series:
// malformed timestamps, non-finite closes and non-positive prices are dropped
// (a £0 close is meaningless shape on a LIVE card; dead cards use
// the deterministic flatline instead of a fetch).
//
// `sinceMs` (optional): the LIVE apocalypse's authoritative start. Prices are
// reset to a persisted baseline at every cycle boundary, so older points are
// the previous round's dead regime — the same "previous round never renders
// as current" rule the GameContext applies to signals. When the round start
// is not known yet the endpoint data is rendered as-is.
export function toSparklineSeries(points: PricePoint[], sinceMs?: number | null): SparklineSample[] {
  if (!Array.isArray(points)) return [];
  return points
    .filter((p) => {
      const t = new Date(p.time).getTime();
      if (!Number.isFinite(t) || !Number.isFinite(p.close) || p.close <= 0) return false;
      return typeof sinceMs === 'number' && Number.isFinite(sinceMs) ? t >= sinceMs : true;
    })
    .map((p) => ({ t: new Date(p.time).getTime(), price: p.close }))
    .sort((a, b) => a.t - b.t);
}

// The same cycle clip for the raw candles, so the high/low/change summary and
// the drawn line always describe the same live-round window.
export function clipPointsSince(points: PricePoint[], sinceMs?: number | null): PricePoint[] {
  if (!Array.isArray(points)) return [];
  if (typeof sinceMs !== 'number' || !Number.isFinite(sinceMs)) return points;
  return points.filter((p) => {
    const t = new Date(p.time).getTime();
    return Number.isFinite(t) && t >= sinceMs;
  });
}

export interface SparklineGeometry {
  /** SVG path data ("M… L…"). */
  path: string;
  min: number;
  max: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Local y-scaling: the series' own min/max fill the viewbox (with padding),
// so small swing archetypes still show a recognisable shape. A flat series
// renders as a horizontal midline rather than a divide-by-zero artefact.
export function buildSparklinePath(
  series: SparklineSample[],
  width: number,
  height: number,
  padding = 2
): SparklineGeometry | null {
  if (!Array.isArray(series) || series.length < 2) return null;
  const prices = series.map((sample) => sample.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min;
  const usableHeight = height - padding * 2;
  const yOf = (price: number): number =>
    span === 0 ? height / 2 : padding + (1 - (price - min) / span) * usableHeight;
  const lastIndex = series.length - 1;
  const path = series
    .map((sample, index) => {
      const x = (index / lastIndex) * width;
      return `${index === 0 ? 'M' : 'L'}${round2(x)},${round2(yOf(sample.price))}`;
    })
    .join(' ');
  return { path, min, max };
}

// Should the player's average-entry marker be drawn at all? Only when the
// server-owned entry price is real, positive and INSIDE the visible window —
// an off-window entry is simply omitted so it can never squeeze or distort
// the local scale (shared by the compact sparkline and the detail chart).
export function entryMarkerVisible(
  averageEntry: number | null,
  min: number,
  max: number
): boolean {
  if (averageEntry === null || !Number.isFinite(averageEntry) || averageEntry <= 0) return false;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
  return averageEntry >= min && averageEntry <= max;
}

// The player's average-entry marker on owned cards: a plain horizontal line
// at the entry price, rendered ONLY when the entry sits inside the visible
// window — an off-window entry never squeezes or distorts the local scale.
export function entryMarkerY(
  averageEntry: number | null,
  min: number,
  max: number,
  height: number,
  padding = 2
): number | null {
  if (!entryMarkerVisible(averageEntry, min, max)) return null;
  const entry = averageEntry as number;
  if (max === min) return height / 2;
  return round2(padding + (1 - (entry - min) / (max - min)) * (height - padding * 2));
}

// A dead coin's sparkline is a deterministic flatline near the bottom of
// the viewbox — no fetch, no history, nothing that could imply recovery.
export function deadFlatlinePath(width: number, height: number): string {
  const y = round2(height - 3);
  return `M0,${y} L${width},${y}`;
}

// Adaptive GBP formatting for tiny prices (several gameplay coins trade in
// sub-£1 territory, so a fixed 2dp would flatten the caption).
export function formatSparkPrice(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value < 0.01) return `£${value.toFixed(6)}`;
  if (value < 1) return `£${value.toFixed(4)}`;
  return `£${value.toFixed(2)}`;
}

interface SparklineDescriptionInput {
  symbol: string;
  range: SparklineRange;
  direction: 'up' | 'down' | 'flat' | null;
  changePct: number | null;
  latestValue: number | null;
  high: number | null;
  low: number | null;
  entryMarked: boolean;
  averageEntry: number | null;
}

// Accessible text equivalent of the sparkline: the selected window, the
// direction and size of the move, the window high/low, and the entry marker
// when one is drawn. No future/hidden information is ever described.
export function describeSparkline(input: SparklineDescriptionInput): string {
  const windowLabel = SPARKLINE_RANGE_LABEL[input.range];
  let text = `${input.symbol} ${windowLabel} price history`;
  if (input.latestValue === null || input.direction === null) {
    return `${text}: no recent points yet.`;
  }
  const pct = input.changePct ?? 0;
  const pctText = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)} percent`;
  const dirWord = input.direction === 'up' ? 'up' : input.direction === 'down' ? 'down' : 'flat';
  text += `: ${dirWord} ${pctText} to ${formatSparkPrice(input.latestValue)}`;
  if (input.high !== null && input.low !== null) {
    text += `; window high ${formatSparkPrice(input.high)}, low ${formatSparkPrice(input.low)}`;
  }
  if (input.entryMarked && input.averageEntry !== null) {
    text += `; your average entry ${formatSparkPrice(input.averageEntry)} is shown as a dashed line`;
  }
  return `${text}.`;
}
