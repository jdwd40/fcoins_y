import { useState, useEffect } from 'react';
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

type TimeRange = '5M' | '10M' | '30M' | '1H' | '2H' | '12H' | '24H' | 'ALL';

interface MarketValueChartProps {
  className?: string;
  refreshTrigger: number;
}

const TIME_RANGES = [
  { value: '5M', label: '5m' },
  { value: '10M', label: '10m' },
  { value: '30M', label: '30m' },
  { value: '1H', label: '1h' },
  { value: '2H', label: '2h' },
  { value: '12H', label: '12h' },
  { value: '24H', label: '24h' },
  { value: 'ALL', label: 'All' },
] as const;

export function MarketValueChart({ className = '', refreshTrigger }: MarketValueChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30M');
  const [priceHistory, setPriceHistory] = useState<Array<{ value: number; created_at: string; trend: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMarketHistory = async () => {
      try {
        setLoading(true);
        const url = `https://jdwd40.com/api-2/api/market/price-history?timeRange=${timeRange}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data.history || !Array.isArray(data.history)) {
          setPriceHistory([]);
          return;
        }
        const transformedData = data.history.map((item: { total_value: string; created_at: string; market_trend: string }) => ({
          value: parseFloat(item.total_value),
          created_at: item.created_at,
          trend: item.market_trend,
        }));
        setPriceHistory(transformedData);
      } catch (error) {
        console.error('Error fetching market history:', error);
        setPriceHistory([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMarketHistory();
  }, [timeRange, refreshTrigger]);

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const lineColor = isDark ? '#8b5cf6' : '#7132f5';
  const fillColor = isDark ? 'rgba(139, 92, 246, 0.16)' : 'rgba(113, 50, 245, 0.10)';
  const axisColor = isDark ? '#85899e' : '#686b82';
  const gridColor = isDark ? 'rgba(148, 151, 169, 0.10)' : 'rgba(104, 107, 130, 0.12)';

  const chartData = {
    datasets: [
      {
        label: 'Market Value',
        data: priceHistory.map((item) => ({
          x: new Date(item.created_at),
          y: item.value,
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
        bodyColor: isDark ? '#8b5cf6' : '#7132f5',
        borderColor: isDark ? 'rgba(148,151,169,0.18)' : '#dedee5',
        borderWidth: 1,
        padding: 14,
        cornerRadius: 10,
        displayColors: false,
        titleFont: { family: 'JetBrains Mono', size: 10, weight: 'normal' as const },
        bodyFont: { family: 'Inter', size: 16, weight: '600' as const },
        callbacks: {
          label: (context: { parsed: { y: number } }) => `£${context.parsed.y.toFixed(2)}`,
          title: (tooltipItems: Array<{ raw: { x: Date } }>) => {
            const date = new Date(tooltipItems[0].raw.x);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toUpperCase();
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: { unit: 'minute' as const, displayFormats: { minute: 'HH:mm' } },
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

      <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-rule">
        {TIME_RANGES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTimeRange(value)}
            className={`font-mono text-[0.7rem] tracking-caps uppercase px-3 py-1.5 border transition-all ${
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
        {loading && priceHistory.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm text-ink-mute animate-flicker">Loading market history…</div>
          </div>
        )}
        {!loading && priceHistory.length === 0 && (
          <div className="flex items-center justify-center h-64 label">No market history available</div>
        )}
        {priceHistory.length > 0 && (
          <div className="h-[300px] sm:h-[360px]">
            <Line data={chartData} options={options} />
          </div>
        )}
      </div>
    </div>
  );
}
