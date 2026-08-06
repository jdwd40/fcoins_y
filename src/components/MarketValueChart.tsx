import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { fetchMarketHistory, type MarketRange } from '../services/marketService';
import type { HistoryPoint } from '../types/database';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
);

interface MarketValueChartProps {
  className?: string;
  refreshTrigger: number;
}

const TIME_RANGES: { value: MarketRange; label: string }[] = [
  { value: '5M', label: '5m' },
  { value: '10M', label: '10m' },
  { value: '30M', label: '30m' },
  { value: '1H', label: '1h' },
  { value: '2H', label: '2h' },
  { value: '12H', label: '12h' },
  { value: '24H', label: '24h' },
  { value: 'ALL', label: 'All' },
];

export function MarketValueChart({ className = '', refreshTrigger }: MarketValueChartProps) {
  const [timeRange, setTimeRange] = useState<MarketRange>('30M');
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const load = useCallback(async (range: MarketRange) => {
    const generation = ++generationRef.current;
    try {
      setLoading(true);
      setError(null);
      const result = await fetchMarketHistory(range);
      if (generation !== generationRef.current) return; // stale
      setPoints(result.points ?? []);
    } catch (err) {
      if (generation !== generationRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load market history');
      setPoints([]);
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(timeRange);
  }, [timeRange, refreshTrigger, load]);

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const lineColor = isDark ? '#8b5cf6' : '#7132f5';
  const fillColor = isDark ? 'rgba(139, 92, 246, 0.16)' : 'rgba(113, 50, 245, 0.10)';
  const axisColor = isDark ? '#85899e' : '#686b82';
  const gridColor = isDark ? 'rgba(148, 151, 169, 0.10)' : 'rgba(104, 107, 130, 0.12)';

  const chartData = {
    datasets: [
      {
        label: 'Market Value',
        data: points.map((p) => ({
          x: new Date(p.time).getTime(),
          y: Number(p.close),
        })),
        borderColor: lineColor,
        backgroundColor: fillColor,
        borderWidth: 1.75,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: lineColor,
        pointHoverBorderColor: isDark ? '#08090d' : '#ffffff',
        pointHoverBorderWidth: 2,
        fill: true,
        tension: 0, // no smoothing: lines connect real samples only (plan §12)
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
        bodyColor: isDark ? '#8b5cf6' : '#7132f5',
        borderColor: isDark ? 'rgba(148,151,169,0.18)' : '#dedee5',
        borderWidth: 1,
        padding: 14,
        cornerRadius: 10,
        displayColors: false,
        titleFont: { family: 'JetBrains Mono', size: 10, weight: 'normal' as const },
        bodyFont: { family: 'Inter', size: 16, weight: 600 },
        callbacks: {
          label: (context: { parsed: { y: number } }) => `£${context.parsed.y.toFixed(2)}`,
          title: (tooltipItems: Array<{ parsed: { x: number } }>) => {
            const date = new Date(tooltipItems[0].parsed.x);
            return date.toLocaleString('en-GB', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
            }).toUpperCase();
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: { displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: 'dd MMM' } },
        grid: { display: false },
        border: { color: gridColor },
        ticks: {
          maxRotation: 0,
          color: axisColor,
          font: { family: 'JetBrains Mono', size: 10 },
        },
      },
      y: {
        grid: { color: gridColor },
        border: { display: false },
        ticks: {
          color: axisColor,
          font: { family: 'JetBrains Mono', size: 10 },
          callback: (value: number | string) => `£${Number(value).toFixed(0)}`,
        },
      },
    },
  };

  return (
    <div className={`paper-card p-6 sm:p-8 h-full ${className}`}>
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="label mb-1">Market analytics</div>
          <h3 className="font-display text-3xl font-bold text-ink"
              style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40" }}>
            Aggregate market value
          </h3>
        </div>
      </div>

      <div
        role="group"
        aria-label="Select market chart time range"
        className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-rule"
      >
        {TIME_RANGES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTimeRange(value)}
            aria-pressed={timeRange === value}
            className={`min-h-[44px] font-mono text-[0.7rem] tracking-caps uppercase px-3 py-1.5 border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
              timeRange === value
                ? 'border-gold text-gold bg-paper-alt'
                : 'border-transparent text-ink-mute hover:text-ink hover:border-rule'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        {loading && points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm text-ink-mute animate-flicker">Loading market history…</div>
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="label text-oxblood">{error}</p>
            <button onClick={() => void load(timeRange)} className="btn-ink">Retry</button>
          </div>
        )}
        {!loading && !error && points.length === 0 && (
          <div className="flex items-center justify-center h-64 label">No market history available</div>
        )}
        {points.length > 0 && (
          <div
            className="h-[300px] sm:h-[360px]"
            role="img"
            aria-label={`Aggregate market value chart over ${timeRange}: ${points.length} points, latest £${Number(points[points.length - 1].close).toFixed(2)}`}
          >
            <Line data={chartData} options={options} />
          </div>
        )}
      </div>
    </div>
  );
}
