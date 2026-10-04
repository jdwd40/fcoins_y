import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../services/apiConfig.ts';
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
import { readChartTheme, withAlpha } from '../utils/chartTheme.ts';
import {
  MARKET_CHART_RANGES,
  DEFAULT_MARKET_CHART_RANGE,
  clampMarketChartRange,
  sanitizeMarketHistoryPoints,
  chartTimeUnitForRange,
  apiRangeForMarketChart,
  type MarketChartRange,
  type SanitizedMarketHistoryPoint,
} from '../utils/marketHistoryChart.ts';

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

const RANGE_LABELS: Record<MarketChartRange, string> = {
  '5M': '5m',
  '10M': '10m',
  '30M': '30m',
  '1H': '1h',
  '2H': '2h',
  '12H': '12h',
};

const TIME_RANGES: { value: MarketChartRange; label: string }[] = MARKET_CHART_RANGES.map(
  (value) => ({ value, label: RANGE_LABELS[value] })
);

function readPersistedMarketRange(): MarketChartRange {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_MARKET_CHART_RANGE;
    return clampMarketChartRange(localStorage.getItem('marketValueChartRange'));
  } catch {
    return DEFAULT_MARKET_CHART_RANGE;
  }
}

export function MarketValueChart({ className = '', refreshTrigger }: MarketValueChartProps) {
  const [timeRange, setTimeRange] = useState<MarketChartRange>(() => readPersistedMarketRange());
  const [priceHistory, setPriceHistory] = useState<SanitizedMarketHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const selectRange = (next: MarketChartRange) => {
    const clamped = clampMarketChartRange(next);
    setTimeRange(clamped);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('marketValueChartRange', clamped);
      }
    } catch {
      // ignore quota / private mode
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchMarketHistory = async () => {
      try {
        setLoading(true);
        // Clear immediately so a previous (wrong) range never stays visible
        // while the next fetch/sanitize is in flight.
        setPriceHistory([]);
        // BE market timeRanges: 10M,30M,1H,2H,12H,24H,ALL — no 5M. Unknown
        // keys return unfiltered ALL history. Request 10M for 5M (nearest
        // supported), then always sanitize/window-filter client-side.
        const apiRange = apiRangeForMarketChart(timeRange);
        const url = `${API_BASE_URL}/market/price-history?timeRange=${apiRange}`;
        const response = await fetch(url);
        const data = await response.json();
        if (cancelled) return;
        if (!data.history || !Array.isArray(data.history)) {
          setPriceHistory([]);
          return;
        }
        const transformed = data.history.map(
          (item: { total_value: string; created_at: string; market_trend: string }) => ({
            value: parseFloat(item.total_value),
            created_at: item.created_at,
            trend: item.market_trend,
          })
        );
        // Atomic replace after sanitize so wrong-range data never stays visible.
        setPriceHistory(sanitizeMarketHistoryPoints(transformed, timeRange, Date.now()));
      } catch (error) {
        console.error('Error fetching market history:', error);
        if (!cancelled) setPriceHistory([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchMarketHistory();
    return () => {
      cancelled = true;
    };
  }, [timeRange, refreshTrigger]);

  const theme = readChartTheme();
  const lineColor = theme.brand;
  const fillColor = withAlpha(theme.brand, 0.12);
  const axisColor = theme.textMuted;
  const gridColor = theme.grid;
  const timeUnit = chartTimeUnitForRange(timeRange);

  const chartData = {
    datasets: [
      {
        label: 'Market Value',
        data: priceHistory.map((item) => ({
          x: new Date(item.t),
          y: item.value,
        })),
        borderColor: lineColor,
        backgroundColor: fillColor,
        borderWidth: 1.75,
        pointRadius: priceHistory.length <= 2 ? 3 : 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: lineColor,
        pointHoverBorderColor: theme.tooltipBg,
        pointHoverBorderWidth: 2,
        fill: true,
        tension: priceHistory.length >= 3 ? 0.35 : 0,
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
        backgroundColor: theme.tooltipBg,
        titleColor: theme.text,
        bodyColor: theme.brand,
        borderColor: theme.tooltipBorder,
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
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toUpperCase();
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: timeUnit,
          displayFormats: { minute: 'HH:mm', hour: 'HH:mm' },
        },
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
    <div className={className}>
      <div
        role="group"
        aria-label="Select market chart time range"
        className="flex flex-wrap gap-1 mb-4"
      >
        {TIME_RANGES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => selectRange(value)}
            aria-pressed={timeRange === value}
            className={`font-mono text-xs tracking-caps uppercase px-3 min-h-[44px] rounded-lg border transition-colors ${
              timeRange === value
                ? 'border-brand text-brand bg-accent-soft'
                : 'border-transparent text-ink-mute hover:text-ink hover:border-rule'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        {loading && priceHistory.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm text-ink-mute">Loading market history…</div>
          </div>
        )}
        {!loading && priceHistory.length === 0 && (
          <div className="flex items-center justify-center h-64 label">No market history available</div>
        )}
        {priceHistory.length > 0 && (
          <div className="h-[260px] sm:h-[360px]">
            <Line key={`market-${timeRange}`} data={chartData} options={options} />
          </div>
        )}
      </div>
    </div>
  );
}
