import { useMemo } from 'react';
import { useCoinSparkline } from '../hooks/useCoinSparkline.ts';
import { computePeriodSummary } from '../utils/priceSummary.ts';
import {
  buildSparklinePath,
  clipPointsSince,
  deadFlatlinePath,
  describeSparkline,
  entryMarkerY,
  SPARKLINE_RANGE_LABEL,
  toSparklineSeries
} from '../utils/sparkline.ts';
import type { MarketSignalCoin } from '../services/gameService.ts';

// Issue #12: the compact dip→boom→dip sparkline for V2 coin cards. A tiny
// dependency-free SVG polyline (no Chart.js on compact cards), locally
// y-scaled, with an accessible text description and no axes/legend clutter.
// Loading/empty/error states are compact text rows — they never hide or
// displace the card's trade actions.

const VIEW_W = 100;
const VIEW_H = 36;
const PAD = 2;

interface CoinSparklineProps {
  coin: Pick<MarketSignalCoin, 'coinId' | 'symbol' | 'archetype' | 'typicalCycleMinutes'>;
  /** Owned cards only: the player's server-owned average entry, drawn as a
   *  dashed horizontal line when it falls inside the visible window. */
  averageEntryPrice?: number | null;
  /** Authoritative LIVE apocalypse start (ISO). Prices reset at every cycle
   *  boundary, so the sparkline never renders the previous round's points. */
  cycleStartTime?: string | null;
}

export function CoinSparkline({ coin, averageEntryPrice = null, cycleStartTime = null }: CoinSparklineProps) {
  const { range, status, points, latestValue } = useCoinSparkline(coin);

  const sinceMs = useMemo(() => {
    const parsed = cycleStartTime ? Date.parse(cycleStartTime) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [cycleStartTime]);
  const livePoints = useMemo(() => clipPointsSince(points, sinceMs), [points, sinceMs]);
  const series = useMemo(() => toSparklineSeries(livePoints), [livePoints]);
  const summary = useMemo(
    () => (livePoints.length > 0 && latestValue !== null ? computePeriodSummary(livePoints, latestValue) : null),
    [livePoints, latestValue]
  );
  const geometry = useMemo(() => buildSparklinePath(series, VIEW_W, VIEW_H, PAD), [series]);
  const markerY = useMemo(
    () => (geometry ? entryMarkerY(averageEntryPrice, geometry.min, geometry.max, VIEW_H, PAD) : null),
    [geometry, averageEntryPrice]
  );

  const direction = summary?.direction ?? 'flat';
  const ariaLabel = describeSparkline({
    symbol: coin.symbol,
    range,
    direction: summary?.direction ?? null,
    changePct: summary?.changePct ?? null,
    latestValue,
    high: summary?.high ?? null,
    low: summary?.low ?? null,
    entryMarked: markerY !== null,
    averageEntry: averageEntryPrice
  });

  let body;
  if (status === 'loading' && series.length === 0) {
    body = <div className="sparkline-state">Loading price history…</div>;
  } else if (status === 'error' && series.length === 0) {
    body = <div className="sparkline-state">Price history unavailable — trading is unaffected.</div>;
  } else if (geometry === null) {
    body = <div className="sparkline-state">No recent history yet — trading is unaffected.</div>;
  } else {
    body = (
      <svg
        className={`sparkline-svg sparkline-${direction}`}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {markerY !== null && (
          <line className="sparkline-entry" x1={0} x2={VIEW_W} y1={markerY} y2={markerY} />
        )}
        <path d={geometry.path} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  return (
    <div className="coin-sparkline" role="img" aria-label={ariaLabel}>
      {body}
      <div className="sparkline-caption">
        <span>{SPARKLINE_RANGE_LABEL[range]} history</span>
        {summary && (
          <span className={`sparkline-change sparkline-change-${summary.direction}`}>
            {summary.direction === 'up' ? '▲' : summary.direction === 'down' ? '▼' : '●'}{' '}
            {summary.changePct >= 0 ? '+' : ''}
            {summary.changePct.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  );
}

// Dead/collapsed cards get a deterministic flatline instead of a fetch: the
// coin stays at £0.00 for the rest of the apocalypse, so no history request
// is made and nothing on the card can imply recovery or buyability.
export function DeadCoinSparkline({ symbol }: { symbol: string }) {
  const path = deadFlatlinePath(VIEW_W, VIEW_H);
  return (
    <div
      className="coin-sparkline coin-sparkline-dead"
      role="img"
      aria-label={`${symbol} flatlined at £0.00 — collapsed and cannot be bought`}
    >
      <svg
        className="sparkline-svg sparkline-flat"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d={path} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="sparkline-caption">
        <span>Flatlined at £0.00</span>
      </div>
    </div>
  );
}
