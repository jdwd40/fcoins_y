import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import { enGB } from 'date-fns/locale';
import { PriceHistoryResponse } from '../types';

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

type TimeRange = '10M' | '30M' | '1H' | '2H' | '24H';

interface PriceChartProps {
  coinId: number;
  refreshTrigger: number;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '10M', label: '10m' },
  { value: '30M', label: '30m' },
  { value: '1H', label: '1h' },
  { value: '2H', label: '2h' },
  { value: '24H', label: '24h' },
];

export function PriceChart({ coinId, refreshTrigger }: PriceChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('30M');
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [chartData, setChartData] = useState<PriceHistoryResponse>({
    data: [],
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      hasMore: false,
    },
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPriceHistory = useCallback(async (range: TimeRange, page = 1, existingData: any[] = []) => {
    try {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);
      console.log(`Fetching price history for range: ${range}, coinId: ${coinId}, page: ${page}`);
      
      const response = await fetch(
        `https://jdwd40.com/api-2/api/coins/${coinId}/price-history?range=${range}&page=${page}`,
        { signal: abortControllerRef.current.signal }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Fetched price history:', result);
      
      if (!result.data || !Array.isArray(result.data)) {
        console.error('Invalid data format received:', result);
        return;
      }

      const newData = [...existingData, ...result.data];

      // Update chart data with accumulated data
      setChartData({
        data: newData,
        pagination: result.pagination
      });

      // For longer time ranges (1H, 2H, 24H), fetch more pages to get complete data
      const maxPages = range === '24H' ? 10 : 
                      range === '2H' ? 5 : 
                      range === '1H' ? 3 : 
                      range === '30M' ? 2 : 1;
      
      if (result.pagination.hasMore && page < result.pagination.totalPages && page < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Add small delay between requests
        await fetchPriceHistory(range, page + 1, newData);
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted');
      } else {
        console.error('Error fetching price history:', error);
      }
    } finally {
      if (page === 1) {
        setLoading(false);
      }
    }
  }, [coinId]);

  // Initial mount - fetch 30M data once
  useEffect(() => {
    if (!isMounted && coinId) {
      console.log('Initial mount - fetching 30M data');
      setIsMounted(true);
      fetchPriceHistory('30M', 1, []);
    }
    // Cleanup function to abort any ongoing requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [coinId, isMounted, fetchPriceHistory]);

  // Handle range changes and refreshes
  useEffect(() => {
    if (isMounted && coinId) {
      fetchPriceHistory(selectedRange, 1, []);
    }
  }, [selectedRange, refreshTrigger, fetchPriceHistory, coinId, isMounted]);

  const handleRangeChange = (range: TimeRange) => {
    console.log(`Changing time range to: ${range}`);
    setSelectedRange(range);
    // Remove direct fetchPriceHistory call here as it's handled by the useEffect
  };

  const getTimeConfig = (range: TimeRange) => {
    switch (range) {
      case '10M':
        return { 
          unit: 'minute' as const, 
          stepSize: 2, 
          maxTicks: 5,
          displayFormat: 'HH:mm'
        };
      case '30M':
        return { 
          unit: 'minute' as const, 
          stepSize: 5, 
          maxTicks: 6,
          displayFormat: 'HH:mm'
        };
      case '1H':
        return { 
          unit: 'minute' as const, 
          stepSize: 10, 
          maxTicks: 6,
          displayFormat: 'HH:mm'
        };
      case '2H':
        return { 
          unit: 'minute' as const, 
          stepSize: 20, 
          maxTicks: 6,
          displayFormat: 'HH:mm'
        };
      case '24H':
        return { 
          unit: 'hour' as const, 
          stepSize: 4, 
          maxTicks: 6,
          displayFormat: 'dd MMM HH:mm'
        };
      default:
        return { 
          unit: 'minute' as const, 
          stepSize: 5, 
          maxTicks: 6,
          displayFormat: 'HH:mm'
        };
    }
  };

  const timeConfig = getTimeConfig(selectedRange);

  const processChartData = (rawData: any[]) => {
    return rawData
      .filter(item => {
        // Filter out invalid data points
        const timestamp = new Date(item.created_at).getTime();
        const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
        return !isNaN(timestamp) && !isNaN(price) && price > 0;
      })
      .map(item => ({
        x: new Date(item.created_at).getTime(),
        y: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
      }))
      .sort((a, b) => a.x - b.x);
  };

  const data = {
    datasets: [
      {
        label: 'Price',
        data: processChartData(chartData.data),
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
        backgroundColor: '#1F2937',
        titleColor: '#F3F4F6',
        bodyColor: '#F3F4F6',
        padding: 12,
        displayColors: false,
        callbacks: {
          title: (tooltipItems: any) => {
            const date = new Date(tooltipItems[0].parsed.x);
            return date.toLocaleString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              ...(selectedRange === '24H' && { day: '2-digit', month: 'short' })
            });
          },
          label: (context: any) => {
            return `£${context.parsed.y.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeConfig.unit,
          stepSize: timeConfig.stepSize,
          displayFormats: {
            minute: timeConfig.displayFormat,
            hour: timeConfig.displayFormat
          },
        },
        adapters: {
          date: {
            locale: enGB,
          },
        },
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          color: '#6B7280',
          maxTicksLimit: timeConfig.maxTicks,
          font: {
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: '#E5E7EB',
        },
        ticks: {
          color: '#6B7280',
          callback: (value: number) => `£${value.toFixed(2)}`,
          font: {
            size: 11,
          },
        },
      },
    },
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {TIME_RANGES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleRangeChange(value)}
              className={`px-3 py-1 text-sm rounded ${
                selectedRange === value
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
          <Line data={data} options={options} />
        </div>
      </div>
    </div>
  );
}