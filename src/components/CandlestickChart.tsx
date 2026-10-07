import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../services/apiConfig.ts';
import type { PriceHistoryResponse } from '../types';
import { computePeriodSummary } from '../utils/priceSummary.ts';
import { clipPointsSince, entryMarkerVisible } from '../utils/sparkline.ts';
import { formatPrice } from '../utils/formatPrice.ts';
import {
  COIN_CHART_RANGES,
  DEFAULT_COIN_CHART_RANGE,
  RANGE_MS,
  clampCoinChartRange,
  apiRangeForCoinChart,
  type CoinChartRange,
} from '../utils/marketHistoryChart.ts';
import {
  CANDLE_REFRESH_MS,
  aggregateSanitized,
  candleTargetFor,
  describeCandles,
  formatTimeTicks,
  layoutCandles,
  priceTicks,
  sanitizeOhlcPoints,
  timeTicks,
  visiblePriceDomain,
  windowCandles,
  xForTime,
  yForPrice,
  type Candle,
} from '../utils/candlestick.ts';

// Issue #28: the coin page candlestick chart. A dependency-free SVG renderer
// (Chart.js core has no candlestick series; CoinSparkline is the precedent)
// driven entirely by the pure helpers in utils/candlestick.ts:
//
//   - data: the coin's own public price history only — raw ticks and
//     pre-bucketed OHLC both become candles, nothing is invented;
//   - scale: a dynamic y-domain around the visible candles AND the current
//     price (never zero-anchored), so the live price is always on screen;
//   - ranges: 5M (10M + client window) … 12H (24H + client window); every
//     switch aborts the superseded request and never draws another range's
//     candles under the new label;
//   - refresh: a quiet refetch every CANDLE_REFRESH_MS while mounted (the
//     endpoint is cached for 10s); a failed refresh keeps the last candles;
//   - purely presentational: nothing in the chart can place a trade.

interface CandlestickChartProps {
  coinId: number;
  /** Selectable ranges (default: every coin chart range, ≤12H). */
  ranges?: readonly CoinChartRange[];
  /** Initially selected range; clamped to the coin chart ranges. */
  initialRange?: string;
  /** Authoritative live-window start (ISO). Older points are clipped so a
   *  previous regime can never render as current movement (issue #12 rule). */
  cycleStartTime?: string | null;
  /** Server-owned average entry price; drawn as a dashed marker only when it
   *  sits inside the visible price domain (never distorts the scale). */
  averageEntryPrice?: number | null;
  /** Chart area height utility classes. */
  heightClass?: string;
  /** Show the big current-price figure in the header (default true). The
   *  coin page hero already shows the live price, so it passes false. */
  showCurrentPrice?: boolean;
}

const API_BASE = API_BASE_URL;

// Plot margins (px): room for time labels below and the price axis right.
const MARGIN_TOP = 10;
const MARGIN_BOTTOM = 24;
const AXIS_GAP = 6;
const CHAR_PX = 6.4; // 10px JetBrains Mono advance, rounded up

interface LoadedHistory {
  key: string;
  candles: Candle[];
  latestValue: number | null;
  symbol: string | null;
}

export function CandlestickChart({
  coinId,
  ranges,
  initialRange,
  cycleStartTime = null,
  averageEntryPrice = null,
  heightClass = 'h-[260px] sm:h-[420px]',
  showCurrentPrice = true,
}: CandlestickChartProps) {
  const primaryRanges = (ranges ?? COIN_CHART_RANGES).map((r) => clampCoinChartRange(r));
  const [selectedRange, setSelectedRange] = useState<CoinChartRange>(() =>
    clampCoinChartRange(initialRange ?? primaryRanges[0] ?? DEFAULT_COIN_CHART_RANGE)
  );
  const [loaded, setLoaded] = useState<LoadedHistory | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Render key: candles are only ever drawn under the coin+range they were
  // fetched for, so a range switch can never flash the previous series.
  const requestKey = `${coinId}:${selectedRange}`;

  const sinceMs = useMemo(() => {
    const parsed = cycleStartTime ? Date.parse(cycleStartTime) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [cycleStartTime]);

  const fetchPriceHistory = useCallback(async (range: CoinChartRange, silent = false) => {
    // Abort any superseded request (range switch / unmount / retry).
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const key = `${coinId}:${range}`;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      // BE has no 5M/12H — request 10M/24H then client-window the selection.
      const apiRange = apiRangeForCoinChart(range);
      const response = await fetch(
        `${API_BASE}/coins/${coinId}/price-history?range=${apiRange}`,
        { signal: controller.signal }
      );
      if (!response.ok) throw new Error(`Chart data could not be loaded (${response.status})`);
      const result: PriceHistoryResponse = await response.json();
      // Clip to the live window and the selected range BEFORE summarising or
      // drawing, so the header figures and the candles describe one window.
      const livePoints = clipPointsSince(result.points || [], sinceMs);
      const candles = windowCandles(sanitizeOhlcPoints(livePoints), range);
      const latest = typeof result.latestValue === 'number' && Number.isFinite(result.latestValue)
        ? result.latestValue
        : null;
      setLoaded({ key, candles, latestValue: latest, symbol: result.coin?.symbol ?? null });
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      // A failed quiet refresh keeps the last good candles on screen; the
      // error state only shows when this range has nothing to draw.
      setError({ key, message: err instanceof Error ? err.message : 'Chart data could not be loaded' });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setLoading(false);
      }
    }
  }, [coinId, sinceMs]);

  useEffect(() => {
    fetchPriceHistory(selectedRange);
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [selectedRange, fetchPriceHistory]);

  // Live updates while this page is mounted: one quiet refetch per cadence,
  // skipped while hidden or while a request is already in flight.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (abortControllerRef.current) return;
      void fetchPriceHistory(selectedRange, true);
    }, CANDLE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [selectedRange, fetchPriceHistory]);

  // Measure the plot box so SVG text stays crisp (no viewBox stretching).
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const current = loaded && loaded.key === requestKey ? loaded : null;
  const currentError = !current && error && error.key === requestKey ? error : null;
  const candles = useMemo(() => current?.candles ?? [], [current]);
  const latestValue = current?.latestValue ?? null;

  const summary = useMemo(
    () => (candles.length > 0 && latestValue !== null ? computePeriodSummary(candles, latestValue) : null),
    [candles, latestValue]
  );

  const chart = useMemo(() => {
    if (candles.length === 0 || size.width <= 0 || size.height <= 0) return null;
    // First pass: a provisional domain sizes the price axis from its labels.
    const roughDomain = visiblePriceDomain(candles, latestValue);
    if (!roughDomain) return null;
    const roughLabels = [...priceTicks(roughDomain), latestValue ?? roughDomain.max].map(formatPrice);
    const axisWidth = Math.ceil(Math.max(...roughLabels.map((l) => l.length)) * CHAR_PX + AXIS_GAP * 2 + 4);
    const plotWidth = Math.max(40, size.width - axisWidth);
    const plotHeight = Math.max(40, size.height - MARGIN_TOP - MARGIN_BOTTOM);

    const series = aggregateSanitized(candles, candleTargetFor(selectedRange, plotWidth));
    const domain = visiblePriceDomain(series.candles, latestValue);
    if (!domain) return null;
    const layout = layoutCandles(series, domain, { width: plotWidth, height: plotHeight });
    if (!layout) return null;
    const yTicks = priceTicks(domain, plotHeight < 180 ? 4 : 6);
    const xTicks = timeTicks(layout.startMs, layout.endMs, Math.max(2, Math.min(6, Math.floor(plotWidth / 72))));
    const xLabels = formatTimeTicks(xTicks, RANGE_MS[selectedRange]);
    const entryVisible = entryMarkerVisible(averageEntryPrice, domain.min, domain.max);
    return {
      series,
      domain,
      layout,
      plotWidth,
      plotHeight,
      yTicks,
      xTicks,
      xLabels,
      latestY: latestValue !== null ? yForPrice(latestValue, domain, plotHeight) : null,
      entryY: entryVisible ? yForPrice(averageEntryPrice as number, domain, plotHeight) : null,
    };
  }, [candles, latestValue, size.width, size.height, selectedRange, averageEntryPrice]);

  const symbol = current?.symbol || 'COIN';
  const rangeLabel = selectedRange;
  const entryMarked = chart?.entryY !== null && chart?.entryY !== undefined;

  // Header change pill: range-relative move, glyph + sign + colour.
  let changeText = '● £0.00 (0.00%)';
  let changeClass = 'text-ink-mute';
  if (summary) {
    if (summary.direction === 'up') {
      changeText = `▲ +${formatPrice(Math.abs(summary.change))} (+${summary.changePct.toFixed(2)}%)`;
      changeClass = 'text-verdigris';
    } else if (summary.direction === 'down') {
      changeText = `▼ -${formatPrice(Math.abs(summary.change))} (${summary.changePct.toFixed(2)}%)`;
      changeClass = 'text-oxblood';
    }
  }

  const ariaLabel = describeCandles({
    symbol,
    rangeLabel,
    candles: chart?.series.candles ?? candles,
    latestValue,
    averageEntry: averageEntryPrice,
    entryMarked,
  });

  const rangeButton = (value: CoinChartRange) => (
    <button
      key={value}
      type="button"
      onClick={() => setSelectedRange(clampCoinChartRange(value))}
      aria-pressed={selectedRange === value}
      className={`flex-1 sm:flex-none min-h-[44px] min-w-0 px-1 sm:px-4 py-2 font-mono text-xs sm:text-sm tracking-[0.5px] uppercase border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
        selectedRange === value
          ? 'border-gold text-gold bg-paper-alt'
          : 'border-transparent text-ink-mute hover:text-ink hover:border-rule'
      }`}
    >
      {value}
    </button>
  );

  const showLoading = loading && !current;
  const showEmpty = !showLoading && !currentError && current !== null && candles.length === 0;

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Header: current price + range-relative change + high/low */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-rule pb-3">
        <div>
          {showCurrentPrice && (
            <div className="numeral text-2xl sm:text-3xl font-semibold tracking-tight break-all">
              {latestValue !== null ? formatPrice(latestValue) : '—'}
            </div>
          )}
          {summary && (
            <div className={`mt-1 text-sm sm:text-lg font-semibold ${changeClass}`}>{changeText}</div>
          )}
          {!summary && current && (
            <div className="mt-1 text-sm text-ink-mute">No change data for period</div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-6 text-sm sm:text-right font-mono tnum">
          <div>
            <span className="label text-ink-mute block">{rangeLabel} High</span>
            <span>{summary ? formatPrice(summary.high) : '—'}</span>
          </div>
          <div>
            <span className="label text-ink-mute block">{rangeLabel} Low</span>
            <span>{summary ? formatPrice(summary.low) : '—'}</span>
          </div>
        </div>
      </div>

      {/* Range selector: 44px targets, aria-pressed. */}
      <div role="group" aria-label="Select chart time range" className="flex gap-1 sm:gap-2">
        {primaryRanges.map(rangeButton)}
      </div>

      {/* Chart area with states */}
      <div className="relative" role="img" aria-label={ariaLabel}>
        {showLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/70 z-10">
            <div className="text-sm text-ink-mute animate-flicker">Loading price history…</div>
          </div>
        )}
        {currentError && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/70 z-10">
            <div className="text-center px-4">
              <p className="font-display font-semibold text-xl text-oxblood mb-1">Price history unavailable</p>
              <p className="label mb-3">Trading is unaffected — try again in a moment.</p>
              <button type="button" onClick={() => fetchPriceHistory(selectedRange)} className="btn-ink">
                Retry
              </button>
            </div>
          </div>
        )}
        {showEmpty && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="label">No price history available for this period yet</p>
          </div>
        )}
        <div ref={plotRef} className={`${heightClass} w-full overflow-hidden`}>
          {chart && (
            <svg
              className="candle-chart block"
              width={size.width}
              height={size.height}
              viewBox={`0 0 ${size.width} ${size.height}`}
              aria-hidden="true"
              focusable="false"
            >
              <g transform={`translate(0 ${MARGIN_TOP})`}>
                {/* Price grid + axis labels (right). */}
                {chart.yTicks.map((value) => {
                  const y = yForPrice(value, chart.domain, chart.plotHeight);
                  return (
                    <g key={`y-${value}`}>
                      <line className="candle-grid" x1={0} x2={chart.plotWidth} y1={y} y2={y} />
                      <text className="candle-axis-text" x={chart.plotWidth + AXIS_GAP} y={y} dominantBaseline="middle">
                        {formatPrice(value)}
                      </text>
                    </g>
                  );
                })}

                {/* Time axis labels (bottom). */}
                {chart.xTicks.map((t, i) => {
                  const x = xForTime(t, chart.layout.startMs, chart.layout.endMs, chart.plotWidth);
                  const anchor = x < 24 ? 'start' : x > chart.plotWidth - 24 ? 'end' : 'middle';
                  return (
                    <text
                      key={`x-${t}`}
                      className="candle-axis-text"
                      x={x}
                      y={chart.plotHeight + 16}
                      textAnchor={anchor}
                    >
                      {chart.xLabels[i]}
                    </text>
                  );
                })}

                {/* Candles: wick line + body rect. Up = hollow, down = solid,
                    so direction never relies on colour alone. */}
                {chart.layout.shapes.map((s) => (
                  <g
                    key={s.t}
                    className={`candle candle-${s.direction}${s.complete ? '' : ' candle-forming'}`}
                  >
                    <line className="candle-wick" x1={s.x} x2={s.x} y1={s.wickTop} y2={s.wickBottom} />
                    <rect
                      className="candle-body"
                      x={s.bodyX}
                      y={s.bodyY}
                      width={s.bodyWidth}
                      height={s.bodyHeight}
                    />
                  </g>
                ))}

                {/* Average entry (owned coins): dashed, only inside the domain. */}
                {chart.entryY !== null && (
                  <line className="candle-entry" x1={0} x2={chart.plotWidth} y1={chart.entryY} y2={chart.entryY} />
                )}

                {/* Current price reference line + axis tag. */}
                {chart.latestY !== null && latestValue !== null && (
                  <g className="candle-current">
                    <line x1={0} x2={chart.plotWidth} y1={chart.latestY} y2={chart.latestY} />
                    <rect
                      x={chart.plotWidth + 1}
                      y={Math.min(Math.max(chart.latestY - 9, -MARGIN_TOP), chart.plotHeight + MARGIN_BOTTOM - 18)}
                      width={size.width - chart.plotWidth - 1}
                      height={18}
                      rx={3}
                    />
                    <text
                      x={chart.plotWidth + AXIS_GAP}
                      y={Math.min(Math.max(chart.latestY, 9 - MARGIN_TOP), chart.plotHeight + MARGIN_BOTTOM - 9)}
                      dominantBaseline="middle"
                    >
                      {formatPrice(latestValue)}
                    </text>
                  </g>
                )}
              </g>
            </svg>
          )}
        </div>
      </div>
      {entryMarked && averageEntryPrice !== null && (
        <p className="font-mono text-xs text-gold tnum">
          ┄ Your average entry {formatPrice(averageEntryPrice)}
        </p>
      )}
    </div>
  );
}
