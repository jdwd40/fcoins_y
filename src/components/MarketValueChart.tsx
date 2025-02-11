import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

type TimeRange = '10M' | '30M' | '1H' | '24H';

interface MarketValueChartProps {
  className?: string;
}

const TIME_RANGES = [
  { value: '10M', label: '10m' },
  { value: '30M', label: '30m' },
  { value: '1H', label: '1h' },
  { value: '24H', label: '24h' }
] as const;

export function MarketValueChart({ className = '' }: MarketValueChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30M');
  const [priceHistory, setPriceHistory] = useState<Array<{ value: number; created_at: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{
    value: number;
    time: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const fetchMarketHistory = async () => {
      try {
        setLoading(true);
        // Add interval=5m parameter to get 5-minute increments
        const url = `https://jdwd40.com/api-2/api/market/history${timeRange === '30M' ? '?interval=5m' : `?timeRange=${timeRange}&interval=5m`}`;
        
        console.log('Fetching market history from:', url);
        const response = await fetch(url);
        const data = await response.json();
        console.log('Received market history data:', data);

        // Handle both array and object responses
        const historyData = Array.isArray(data) ? data : data.history;

        if (!historyData || !Array.isArray(historyData)) {
          console.error('Invalid market history data:', data);
          setPriceHistory([]);
          return;
        }

        // Filter to 5-minute increments if needed
        const FIVE_MINUTES = 5 * 60 * 1000;
        let lastTimestamp = 0;
        
        const filteredData = historyData.filter(point => {
          const timestamp = new Date(point.timestamp).getTime();
          if (timestamp - lastTimestamp >= FIVE_MINUTES) {
            lastTimestamp = timestamp;
            return true;
          }
          return false;
        });

        setPriceHistory(filteredData);
      } catch (error) {
        console.error('Error fetching market history:', error);
        setPriceHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketHistory();
  }, [timeRange]);

  console.log('Current market history state:', priceHistory);
  if (priceHistory.length > 0) {
    console.log('Sample history point:', priceHistory[0]);
  }

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

  const calculateDynamicRange = (min: number, max: number) => {
    const range = max - min;
    const padding = range * 0.1; // Add 10% padding
    
    // Helper to round to significant digits
    const roundToSignificant = (num: number) => {
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(num))));
      return Math.round(num / magnitude) * magnitude;
    };

    return {
      min: Math.max(0, roundToSignificant(min - padding)),
      max: roundToSignificant(max + padding)
    };
  };

  const values = priceHistory.map(p => {
    const value = p.total_market_value;
    return typeof value === 'number' ? value : parseFloat(String(value));
  }).filter(v => !isNaN(v));

  const rawMinValue = Math.min(...values);
  const rawMaxValue = Math.max(...values);
  const { min: minValue, max: maxValue } = calculateDynamicRange(rawMinValue, rawMaxValue);
  const valueRange = maxValue - minValue;

  // Calculate percentage change
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const valueChange = lastValue - firstValue;
  const percentageChange = ((valueChange / firstValue) * 100).toFixed(2);
  const isPositive = valueChange >= 0;

  // Format value with appropriate scale
  const formatValue = (value: number) => {
    if (value >= 1000000000) {
      return `$${(value / 1000000000).toFixed(2)}B`;
    } else if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  // Calculate value labels with dynamic steps
  const numLabels = 5;
  const valueLabels = Array.from({ length: numLabels }, (_, i) => {
    const value = maxValue - (i * (valueRange / (numLabels - 1)));
    return formatValue(value);
  });

  const points = priceHistory.map((point, index) => {
    const value = point.total_market_value;
    const validValue = typeof value === 'number' ? value : parseFloat(String(value));
    const x = (index / (priceHistory.length - 1)) * 100;
    const y = 100 - ((validValue - minValue) / valueRange) * 100;
    return `${x},${y}`;
  }).join(' ');

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - svgRect.left) / svgRect.width;
    const index = Math.min(
      Math.floor(x * priceHistory.length),
      priceHistory.length - 1
    );
    const point = priceHistory[index];
    const value = point.total_market_value;
    const validValue = typeof value === 'number' ? value : parseFloat(String(value));
    const pointX = (index / (priceHistory.length - 1)) * 100;
    const pointY = 100 - ((validValue - minValue) / valueRange) * 100;

    setHoveredPoint({
      value: validValue,
      time: point.timestamp,
      x: pointX,
      y: pointY,
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Get 5 evenly spaced timestamps for x-axis
  const timeLabels = Array.from({ length: 5 }, (_, i) => {
    const index = Math.floor((i * (priceHistory.length - 1)) / 4);
    return formatTime(priceHistory[index].timestamp);
  });

  return (
    <div className="w-full">
      {/* Time range buttons */}
      <div className="flex justify-end space-x-2 mb-4">
        {['10M', '30M', '1H', '24H'].map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 py-1 text-sm rounded ${
              timeRange === range
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Simple chart container */}
      <div className="relative w-full h-64 border border-gray-200 rounded">
        {/* Y-axis (values) */}
        <div className="absolute left-0 top-0 bottom-20 w-20 flex flex-col justify-between text-xs text-gray-500 border-r border-gray-200 bg-white">
          {Array.from({ length: 6 }, (_, i) => {
            const value = (maxValue * (5 - i) / 5);
            return (
              <div key={i} className="px-2 text-right">
                {formatValue(value)}
              </div>
            );
          })}
        </div>

        {/* Chart area */}
        <div className="absolute left-20 right-0 top-0 bottom-20">
          <svg
            className="w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Horizontal grid lines */}
            {Array.from({ length: 6 }, (_, i) => (
              <line
                key={`h-${i}`}
                x1="0"
                y1={`${i * 20}%`}
                x2="100%"
                y2={`${i * 20}%`}
                stroke="#f0f0f0"
                strokeWidth="1"
              />
            ))}

            {/* Value line */}
            <path
              d={`M ${points}`}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
            />

            {/* Current value indicator */}
            {hoveredPoint ? (
              <g>
                <line
                  x1={`${hoveredPoint.x}%`}
                  y1="0"
                  x2={`${hoveredPoint.x}%`}
                  y2="100%"
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <circle
                  cx={`${hoveredPoint.x}%`}
                  cy={`${hoveredPoint.y}%`}
                  r="3"
                  fill="#2563eb"
                />
                <rect
                  x={`${hoveredPoint.x - 20}%`}
                  y={`${hoveredPoint.y - 15}%`}
                  width="40%"
                  height="20"
                  fill="white"
                  stroke="#e2e8f0"
                  rx="4"
                />
                <text
                  x={`${hoveredPoint.x}%`}
                  y={`${hoveredPoint.y - 5}%`}
                  textAnchor="middle"
                  className="text-xs"
                  fill="#1e293b"
                >
                  {formatValue(hoveredPoint.value)}
                </text>
              </g>
            ) : null}
          </svg>
        </div>

        {/* X-axis (time) */}
        <div className="absolute left-20 right-0 bottom-0 h-20 border-t border-gray-200">
          <div className="flex justify-between px-4 pt-2 text-xs text-gray-500">
            {timeLabels.map((time, i) => (
              <div key={i} className="text-center">
                {time}
              </div>
            ))}
          </div>
        </div>

        {/* Current value display */}
        <div className="absolute top-2 right-2 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-200">
          <span className="text-sm font-medium text-gray-700">
            Current: {formatValue(lastValue)}
          </span>
        </div>
      </div>
    </div>
  );
}
