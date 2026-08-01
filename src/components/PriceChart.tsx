import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

import { PricePoint, PriceHistoryResponse, TimeRange } from '../types';
import { computePeriodSummary, PeriodSummary } from '../utils/priceSummary';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  TimeScale
);

interface PriceChartProps {
  coinId: number;
  refreshTrigger?: number;
}

function formatAdaptivePrice(value: number): string {
  if (value < 0.01) return `£${value.toFixed(6)}`;
  if (value < 1) return `£${value.toFixed(4)}`;
  return value.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '24H', label: '24H' },
  { value: '7D', label: '7D' },
  { value: '30D', label: '30D' },
  { value: 'ALL', label: 'ALL' },
];

const API_BASE = 'https://jdwd40.com/api-2/api';

function getRangeLabel(range: TimeRange): string {
  switch (range) {
    case '24H': return '24H';
    case '7D': return '7D';
    case '30D': return '30D';
    case 'ALL': return 'ALL';
    default: return range;
  }
}

function getTimeFormat(range: TimeRange): string {
  switch (range) {
    case '24H':
      return 'HH:mm';
    case '7D':
      return 'EEE HH:mm';
    case '30D':
    case 'ALL':
      return 'dd MMM';
    default:
      return 'HH:mm';
  }
}

function getTooltipTitleFormat(/* eslint-disable-line @typescript-eslint/no-unused-vars */ _range: TimeRange): Intl.DateTimeFormatOptions {
  // full always
  return {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
}

export function PriceChart({ coinId, refreshTrigger = 0 }: PriceChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('24H');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PriceHistoryResponse | null>(null);
  const [chartData, setChartData] = useState<{ x: number; y: number }[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const fetchPriceHistory = useCallback(async (range: TimeRange) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/coins/${coinId}/price-history?range=${range}`,
        { signal: controller.signal }
      );
      if (!response.ok) throw new Error(`Failed to fetch data (${response.status})`);
      const result: PriceHistoryResponse = await response.json();
      // Ignore stale responses from aborted/superseded requests
      if (requestId !== requestIdRef.current) return;

      setHistory(result);

      const processed = (result.points || [])
        .filter((p: PricePoint) => {
          const ts = new Date(p.time).getTime();
          return !isNaN(ts) && !isNaN(p.close) && p.close > 0;
        })
        .map((p: PricePoint) => ({
          x: new Date(p.time).getTime(),
          y: p.close,
        }))
        .sort((a, b) => a.x - b.x);
      setChartData(processed);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load price data');
      setHistory(null);
      setChartData([]);
    } finally {
      // Only the active request may clear loading — prevents races hiding newer loads
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [coinId]);

  useEffect(() => {
    fetchPriceHistory(selectedRange);
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [selectedRange, refreshTrigger, fetchPriceHistory]);

  const summary: PeriodSummary | null = history
    ? computePeriodSummary(history.points || [], history.latestValue)
    : null;

  const symbol = history?.coin?.symbol || 'COIN';
  const latestValue = history?.latestValue ?? 0;

  // movement state for colors (neutral when no summary or flat)
  const direction = summary?.direction || 'flat';
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const lineColor = direction === 'up'
    ? (isDark ? '#2ed58a' : '#149e61')
    : direction === 'down'
      ? (isDark ? '#ff5d68' : '#dc3545')
      : (isDark ? '#85899e' : '#686b82');

  const fillColor = direction === 'up'
    ? (isDark ? 'rgba(46, 213, 138, 0.12)' : 'rgba(20, 158, 97, 0.10)')
    : direction === 'down'
      ? (isDark ? 'rgba(255, 93, 104, 0.12)' : 'rgba(220, 53, 69, 0.10)')
      : (isDark ? 'rgba(133, 137, 158, 0.12)' : 'rgba(104, 107, 130, 0.10)');

  const axisColor = isDark ? '#85899e' : '#686b82';
  const gridColor = isDark ? 'rgba(148, 151, 169, 0.10)' : 'rgba(104, 107, 130, 0.12)';

  // change pill text
  let changeText = '● £0.00 (0.00%)';
  let changeClass = 'text-ink-mute';
  if (summary) {
    const dir = summary.direction;
    let signGlyph = '● ';
    let pct = '0.00%';
    let amtStr = '£0.00';
    if (dir === 'up') {
      signGlyph = '▲ +';
      changeClass = 'text-verdigris';
      amtStr = formatAdaptivePrice(Math.abs(summary.change));
      pct = `+${summary.changePct.toFixed(2)}%`;
    } else if (dir === 'down') {
      signGlyph = '▼ -';
      changeClass = 'text-oxblood';
      amtStr = formatAdaptivePrice(Math.abs(summary.change));
      pct = `${summary.changePct.toFixed(2)}%`;
    } else {
      signGlyph = '● ';
      changeClass = 'text-ink-mute';
      amtStr = '£0.00';
      pct = '0.00%';
    }
    changeText = `${signGlyph}${amtStr} (${pct})`;
  }

  const rangeLabel = getRangeLabel(selectedRange);
  const highLabel = `${rangeLabel} High`;
  const lowLabel = `${rangeLabel} Low`;

  const yBounds = (() => {
    if (chartData.length === 0) return { min: 0, max: 100 };
    const prices = chartData.map((d) => d.y);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;
    const padding = range > 0 ? range * 0.1 : (minPrice || 1) * 0.1;
    return {
      min: Math.max(0, minPrice - padding),
      max: maxPrice + padding,
    };
  })();

  const data = {
    datasets: [
      {
        data: chartData,
        borderColor: lineColor,
        backgroundColor: fillColor,
        borderWidth: 1.75,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: lineColor,
        pointHoverBorderColor: isDark ? '#08090d' : '#ffffff',
        pointHoverBorderWidth: 2,
        fill: true,
        tension: 0.35,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#12141d' : '#ffffff',
        titleColor: isDark ? '#f5f6fa' : '#101114',
        bodyColor: lineColor,
        borderColor: isDark ? 'rgba(148,151,169,0.18)' : '#dedee5',
        borderWidth: 1,
        padding: 14,
        cornerRadius: 10,
        displayColors: false,
        titleFont: { family: 'JetBrains Mono', size: 10, weight: 'normal' as const },
        bodyFont: { family: 'Inter', size: 16, weight: '600' as const },
        callbacks: {
          title: (tooltipItems: Array<{ parsed: { x: number } }>) => {
            const date = new Date(tooltipItems[0].parsed.x);
            return date.toLocaleString('en-GB', getTooltipTitleFormat(selectedRange)).toUpperCase();
          },
          label: (context: { parsed: { y: number } }) => formatAdaptivePrice(context.parsed.y),
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          displayFormats: {
            minute: getTimeFormat(selectedRange),
            hour: getTimeFormat(selectedRange),
            day: getTimeFormat(selectedRange),
          },
        },
        grid: { display: false },
        border: { display: false },
        ticks: {
          maxRotation: 0,
          color: axisColor,
          font: { family: 'JetBrains Mono', size: 10 },
          maxTicksLimit: 6,
        },
      },
      y: {
        position: 'left' as const,
        min: yBounds.min,
        max: yBounds.max,
        grid: { color: gridColor },
        border: { display: false },
        ticks: {
          color: axisColor,
          font: { family: 'JetBrains Mono', size: 10 },
          callback: (value: number | string) => formatAdaptivePrice(Number(value)),
          maxTicksLimit: 6,
        },
      },
    },
  };

  // dynamic aria label per spec
  const ariaLabel = (() => {
    if (!history) return `Price chart for ${symbol} over ${rangeLabel}`;
    const priceStr = formatAdaptivePrice(latestValue);
    let desc = `Price chart for ${symbol} over ${rangeLabel}`;
    if (summary) {
      const pctStr = `${summary.changePct >= 0 ? '+' : ''}${summary.changePct.toFixed(2)} percent`;
      const dirWord = summary.direction === 'up' ? 'up' : summary.direction === 'down' ? 'down' : 'flat';
      desc += `: ${dirWord} ${pctStr} to ${priceStr}. Period high ${formatAdaptivePrice(summary.high)}, low ${formatAdaptivePrice(summary.low)}.`;
    } else {
      desc += `: current ${priceStr}. No period data yet.`;
    }
    return desc;
  })();

  return (
    <div className="w-full space-y-4">
      {/* Header: current price + range-relative change + high/low */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-rule pb-3">
        <div>
          <div className="numeral text-3xl sm:text-4xl font-semibold tracking-tight">
            {formatAdaptivePrice(latestValue)}
          </div>
          {summary && (
            <div className={`mt-1 text-lg font-semibold ${changeClass}`}>
              {changeText}
            </div>
          )}
          {!summary && history && (
            <div className="mt-1 text-sm text-ink-mute">No change data for period</div>
          )}
        </div>

        {/* high / low */}
        <div className="grid grid-cols-2 gap-x-6 text-sm sm:text-right font-mono tnum">
          <div>
            <span className="label text-ink-mute block">{highLabel}</span>
            <span>{history && summary ? formatAdaptivePrice(summary.high) : '—'}</span>
          </div>
          <div>
            <span className="label text-ink-mute block">{lowLabel}</span>
            <span>{history && summary ? formatAdaptivePrice(summary.low) : '—'}</span>
          </div>
        </div>
      </div>

      {/* Range selector: 24H 7D 30D ALL , 44px targets, aria-pressed */}
      <div
        role="group"
        aria-label="Select chart time range"
        className="flex flex-wrap gap-2"
      >
        {TIME_RANGES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSelectedRange(value)}
            aria-pressed={selectedRange === value}
            className={`min-h-[44px] px-4 py-2 font-mono text-sm tracking-[0.5px] uppercase border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
              selectedRange === value
                ? 'border-gold text-gold bg-paper-alt'
                : 'border-transparent text-ink-mute hover:text-ink hover:border-rule'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart area with states — role=img only on the chart graphic, not overlays/controls */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/70 z-10" aria-live="polite">
            <div className="text-sm text-ink-mute animate-flicker">Loading price history…</div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/70 z-10" role="alert">
            <div className="text-center">
              <p className="font-display font-semibold text-xl text-oxblood mb-1">Price history unavailable</p>
              <p className="label mb-3">{error}</p>
              <button
                onClick={() => fetchPriceHistory(selectedRange)}
                className="btn-ink"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {!loading && !error && chartData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="label">No price history available for this period yet</p>
          </div>
        )}
        <div className="h-[300px] sm:h-[380px]" role="img" aria-label={ariaLabel}>
          <Line data={data} options={options} />
        </div>
      </div>
    </div>
  );
}
