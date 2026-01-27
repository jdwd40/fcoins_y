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

interface PriceDataPoint {
  price: number | string;
  created_at: string;
}

interface ApiResponse {
  data: PriceDataPoint[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasMore: boolean;
  };
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
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      // Fetch all pages needed for the time range
      const allData: PriceDataPoint[] = [];
      let page = 1;
      const maxPages = range === '24H' ? 10 : range === '2H' ? 5 : range === '1H' ? 3 : 2;

      while (page <= maxPages) {
        const response = await fetch(
          `${API_BASE}/coins/${coinId}/price-history?range=${range}&page=${page}`,
          { signal: abortControllerRef.current.signal }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch data (${response.status})`);
        }

        const result: ApiResponse = await response.json();

        if (!result.data || !Array.isArray(result.data)) {
          break;
        }

        allData.push(...result.data);

        if (!result.pagination.hasMore || page >= result.pagination.totalPages) {
          break;
        }

        page++;
      }

      // Process and sort data
      const processed = allData
        .filter(item => {
          const timestamp = new Date(item.created_at).getTime();
          const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
          return !isNaN(timestamp) && !isNaN(price) && price > 0;
        })
        .map(item => ({
          x: new Date(item.created_at).getTime(),
          y: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
        }))
        .sort((a, b) => a.x - b.x);

      setChartData(processed);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Silently ignore aborted requests
      }
      setError(err instanceof Error ? err.message : 'Failed to load price data');
    } finally {
      setLoading(false);
    }
  }, [coinId]);

  useEffect(() => {
    fetchPriceHistory(selectedRange);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedRange, refreshTrigger, fetchPriceHistory]);

  // Calculate dynamic Y-axis bounds with padding
  const getYAxisBounds = () => {
    if (chartData.length === 0) return { min: 0, max: 100 };

    const prices = chartData.map(d => d.y);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;

    // Add 10% padding, but ensure there's always some range visible
    const padding = range > 0 ? range * 0.1 : minPrice * 0.1;

    return {
      min: Math.max(0, minPrice - padding),
      max: maxPrice + padding,
    };
  };

  // Get time display format based on selected range
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

  const data = {
    datasets: [
      {
        data: chartData,
        borderColor: '#10B981',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height);
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
          gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
          return gradient;
        },
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#10B981',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(31, 41, 55, 0.95)',
        titleColor: '#F3F4F6',
        bodyColor: '#F3F4F6',
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        titleFont: {
          size: 12,
        },
        bodyFont: {
          size: 14,
          weight: 'bold' as const,
        },
        callbacks: {
          title: (tooltipItems: any) => {
            const date = new Date(tooltipItems[0].parsed.x);
            const options: Intl.DateTimeFormatOptions = {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            };
            if (selectedRange === '24H') {
              options.day = '2-digit';
              options.month = 'short';
            }
            return date.toLocaleString('en-GB', options);
          },
          label: (context: any) => {
            return `£${context.parsed.y.toFixed(2)}`;
          },
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
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          color: '#6B7280',
          font: {
            size: 11,
          },
          maxTicksLimit: 6,
        },
        border: {
          display: false,
        },
      },
      y: {
        position: 'left' as const,
        min: yBounds.min,
        max: yBounds.max,
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
        },
        ticks: {
          color: '#6B7280',
          font: {
            size: 11,
          },
          callback: (value: number | string) => `£${Number(value).toFixed(2)}`,
          maxTicksLimit: 6,
        },
        border: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="w-full space-y-4">
      {/* Time Range Buttons */}
      <div className="flex flex-wrap gap-2">
        {TIME_RANGES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSelectedRange(value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              selectedRange === value
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart Container */}
      <div className="relative">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-800/70 rounded-lg z-10">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Loading...</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-800/70 rounded-lg z-10">
            <div className="text-center text-red-500 dark:text-red-400">
              <p className="font-medium">Error loading chart</p>
              <p className="text-sm">{error}</p>
              <button
                onClick={() => fetchPriceHistory(selectedRange)}
                className="mt-2 px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* No Data Message */}
        {!loading && !error && chartData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-800/70 rounded-lg z-10">
            <p className="text-gray-500 dark:text-gray-400">No price data available</p>
          </div>
        )}

        {/* Chart */}
        <div className="h-[300px] sm:h-[400px]">
          <Line data={data} options={options} />
        </div>
      </div>
    </div>
  );
}
