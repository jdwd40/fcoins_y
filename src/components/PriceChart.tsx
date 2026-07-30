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

import { PricePoint, PriceHistoryResponse } from '../types';

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

type TimeRange = '10M' | '30M' | '1H' | '2H' | '24H';

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
  { value: '10M', label: '10m' },
  { value: '30M', label: '30m' },
  { value: '1H', label: '1h' },
  { value: '2H', label: '2h' },
  { value: '24H', label: '24h' },
];

const API_BASE = 'https://jdwd40.com/api-2/api';

export function PriceChart({ coinId, refreshTrigger = 0 }: PriceChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1H');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ x: number; y: number }[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPriceHistory = useCallback(async (range: TimeRange) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      // Single request per design (no pagination)
      const response = await fetch(
        `${API_BASE}/coins/${coinId}/price-history?range=${range}`,
        { signal: abortControllerRef.current.signal }
      );
      if (!response.ok) throw new Error(`Failed to fetch data (${response.status})`);
      const result: PriceHistoryResponse = await response.json();

      const processed = (result.points || [])
        .filter((p: PricePoint) => {
          const ts = new Date(p.time).getTime();
          return !isNaN(ts) && !isNaN(p.close) && p.close > 0;
        })
        .map((p: PricePoint) => ({
          x: new Date(p.time).getTime(),
          y: p.close,
        }))
        // already chronological from backend; explicit sort for safety
        .sort((a, b) => a.x - b.x);
      setChartData(processed);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load price data');
    } finally {
      setLoading(false);
    }
  }, [coinId]);

  useEffect(() => {
    fetchPriceHistory(selectedRange);
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [selectedRange, refreshTrigger, fetchPriceHistory]);

  const getYAxisBounds = () => {
    if (chartData.length === 0) return { min: 0, max: 100 };
    const prices = chartData.map((d) => d.y);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;
    const padding = range > 0 ? range * 0.1 : minPrice * 0.1;
    return {
      min: Math.max(0, minPrice - padding),
      max: maxPrice + padding,
    };
  };

  const getTimeFormat = (range: TimeRange) => {
    switch (range) {
      case '10M':
      case '30M':
      case '1H':
      case '2H':
        return 'HH:mm';
      case '24H':
        return 'dd MMM HH:mm';
      default:
        return 'HH:mm';
    }
  };

  const yBounds = getYAxisBounds();

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const first = chartData[0]?.y ?? 0;
  const last = chartData[chartData.length - 1]?.y ?? 0;
  const isUp = last >= first;
  const accent = isUp
    ? (isDark ? '#2ed58a' : '#149e61')
    : (isDark ? '#ff5d68' : '#dc3545');
  const fillColor = isUp
    ? (isDark ? 'rgba(46, 213, 138, 0.12)' : 'rgba(20, 158, 97, 0.10)')
    : (isDark ? 'rgba(255, 93, 104, 0.12)' : 'rgba(220, 53, 69, 0.10)');
  const axisColor = isDark ? '#85899e' : '#686b82';
  const gridColor = isDark ? 'rgba(148, 151, 169, 0.10)' : 'rgba(104, 107, 130, 0.12)';

  const data = {
    datasets: [
      {
        data: chartData,
        borderColor: accent,
        backgroundColor: fillColor,
        borderWidth: 1.75,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: accent,
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
        bodyColor: accent,
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
            const opts: Intl.DateTimeFormatOptions = {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            };
            if (selectedRange === '24H') {
              opts.day = '2-digit';
              opts.month = 'short';
            }
            return date.toLocaleString('en-GB', opts).toUpperCase();
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

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap gap-2 pb-4 border-b border-rule">
        {TIME_RANGES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSelectedRange(value)}
            className={`font-mono text-[0.7rem] tracking-caps uppercase px-3 py-1.5 border transition-all ${
              selectedRange === value
                ? 'border-gold text-gold bg-paper-alt'
                : 'border-transparent text-ink-mute hover:text-ink hover:border-rule'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/70 z-10">
            <div className="text-sm text-ink-mute animate-flicker">Loading price history…</div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/70 z-10">
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
            <p className="label">No price history available</p>
          </div>
        )}
        <div className="h-[300px] sm:h-[380px]">
          <Line data={data} options={options} />
        </div>
      </div>
    </div>
  );
}
