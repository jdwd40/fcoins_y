import React, { useEffect, useRef, useState } from 'react';
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

type TimeRange = '5M' | '10M' | '30M' | '1H' | '24H';

interface PriceChartProps {
  coinId: number;
  priceHistory: PriceHistoryResponse;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '5M', label: '5m' },
  { value: '10M', label: '10m' },
  { value: '30M', label: '30m' },
  { value: '1H', label: '1h' },
  { value: '24H', label: '24h' },
];

export function PriceChart({ coinId, priceHistory }: PriceChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('30M');
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<PriceHistoryResponse>(priceHistory);

  const fetchPriceHistory = async (range: TimeRange) => {
    try {
      setLoading(true);
      const response = await fetch(`https://jdwd40.com/api-2/api/coins/${coinId}/price-history?range=${range}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Fetched price history:', data);
      setChartData(data);
    } catch (error) {
      console.error('Error fetching price history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRange !== '30M') {
      fetchPriceHistory(selectedRange);
    }
  }, [selectedRange, coinId]);

  const data = {
    datasets: [
      {
        label: 'Price',
        data: chartData.data.map((item: any) => ({
          x: new Date(item.created_at).getTime(),
          y: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
        })).sort((a, b) => a.x - b.x),
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

  const timeUnit = selectedRange === '24H' ? 'hour' : 'minute';
  const stepSize = selectedRange === '24H' ? 2 : selectedRange === '1H' ? 10 : 5;

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
            return date.toLocaleString('en-GB', { 
              hour: '2-digit',
              minute: '2-digit',
              ...(selectedRange === '24H' && { day: '2-digit', month: 'short' })
            });
          },
        },
      },
      filler: {
        propagate: false,
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeUnit,
          stepSize: stepSize,
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
          },
          tooltipFormat: 'PPp',
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
          maxTicksLimit: 8,
          font: {
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
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
              onClick={() => setSelectedRange(value)}
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