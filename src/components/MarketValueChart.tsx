import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
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
  TimeScale
);

type TimeRange = '5M' | '10M' | '30M' | '1H' | '2H' | '12H' | '24H' | 'ALL';

interface MarketValueChartProps {
  className?: string;
}

const TIME_RANGES = [
  { value: '5M', label: '5m' },
  { value: '10M', label: '10m' },
  { value: '30M', label: '30m' },
  { value: '1H', label: '1h' },
  { value: '2H', label: '2h' },
  { value: '12H', label: '12h' },
  { value: '24H', label: '24h' },
  { value: 'ALL', label: 'All' }
] as const;

export function MarketValueChart({ className = '' }: MarketValueChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30M');
  const [priceHistory, setPriceHistory] = useState<Array<{ value: number; created_at: string; trend: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMarketHistory = async () => {
      try {
        setLoading(true);
        const url = `https://jdwd40.com/api-2/api/market/price-history?timeRange=${timeRange}`;
        
        console.log('Fetching market history from:', url);
        const response = await fetch(url);
        const data = await response.json();
        console.log('Received market history data:', data);

        if (!data.history || !Array.isArray(data.history)) {
          console.error('Invalid market history data:', data);
          setPriceHistory([]);
          return;
        }

        // Transform the data to match our component's expected format
        const transformedData = data.history.map(item => ({
          value: parseFloat(item.total_value),
          created_at: item.created_at,
          trend: item.market_trend
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
  }, [timeRange]);

  const chartData = {
    datasets: [
      {
        label: 'Market Value',
        data: priceHistory.map((item) => ({
          x: new Date(item.created_at),
          y: item.value,
        })),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#10B981',
        pointHoverBorderColor: '#fff',
        fill: true,
        tension: 0.4,
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
        backgroundColor: 'rgba(17, 24, 39, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context: any) => {
            return `£${context.parsed.y.toFixed(2)}`;
          },
          title: (tooltipItems: any) => {
            const date = new Date(tooltipItems[0].raw.x);
            return date.toLocaleTimeString([], { 
              hour: '2-digit',
              minute: '2-digit',
            });
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: 'minute' as const,
          displayFormats: {
            minute: 'HH:mm',
          },
        },
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          color: '#6B7280',
        },
      },
      y: {
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
        },
        ticks: {
          color: '#6B7280',
          callback: (value: number) => `£${value.toFixed(2)}`,
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Clock className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!priceHistory.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No market data available
      </div>
    );
  }

  return (
    <div className={`w-full space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {TIME_RANGES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={`px-3 py-1 text-sm rounded ${
                timeRange === value
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
            <div className="text-white">Loading...</div>
          </div>
        )}
        <div className="h-[400px]">
          <Line data={chartData} options={options} />
        </div>
      </div>
    </div>
  );
}
