import React, { useState, useEffect, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { PriceHistory } from '../types';

type TimeRange = '10M' | '30M' | '1H' | '24H';

interface PriceChartProps {
  coinId: string;
  priceHistory: Array<{ price: string; created_at: string }>;
}

const TIME_RANGES = [
  { value: '10M', label: '10m' },
  { value: '30M', label: '30m' },
  { value: '1H', label: '1h' },
  { value: '24H', label: '24h' }
] as const;

export function PriceChart({ coinId, priceHistory: initialPriceHistory }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30M');
  const [priceHistory, setPriceHistory] = useState(initialPriceHistory);
  const [loading, setLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{
    price: string;
    time: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
        setLoading(true);
        // Add interval=5m parameter to get 5-minute increments
        const url = `https://jdwd40.com/api-2/api/coins/${coinId}/price-history${timeRange === '30M' ? '?interval=5m' : `?timeRange=${timeRange}&interval=5m`}`;

        console.log('Fetching from URL:', url);
        const response = await fetch(url);
        const data = await response.json();
        console.log('Received price history data:', data);
        
        // Handle both array and object responses
        const historyData = Array.isArray(data) ? data : data.price_history;
        
        if (!historyData || !Array.isArray(historyData)) {
          console.error('Invalid data structure received:', data);
          setPriceHistory([]);
          return;
        }

        setPriceHistory(historyData);
      } catch (error) {
        console.error('Error fetching price history:', error);
        setPriceHistory([]);
      } finally {
        setLoading(false);
      }
    };

    console.log('Initial price history:', initialPriceHistory);
    if (timeRange !== '30M' || !initialPriceHistory.length) {
      fetchPriceHistory();
    } else {
      // Filter initial price history to 5-minute increments if needed
      const FIVE_MINUTES = 5 * 60 * 1000;
      let lastTimestamp = 0;
      
      const filteredInitial = initialPriceHistory.filter(point => {
        const timestamp = new Date(point.timestamp || point.created_at).getTime();
        if (timestamp - lastTimestamp >= FIVE_MINUTES) {
          lastTimestamp = timestamp;
          return true;
        }
        return false;
      });

      setPriceHistory(filteredInitial);
    }
  }, [coinId, timeRange, initialPriceHistory]);

  // Filter price history to 5-minute increments
  const filteredPriceHistory = useMemo(() => {
    if (!priceHistory.length) return [];

    const FIVE_MINUTES = 5 * 60 * 1000; // 5 minutes in milliseconds
    let lastTimestamp = 0;
    
    return priceHistory.filter(point => {
      const timestamp = new Date(point.timestamp || point.created_at).getTime();
      if (timestamp - lastTimestamp >= FIVE_MINUTES) {
        lastTimestamp = timestamp;
        return true;
      }
      return false;
    });
  }, [priceHistory]);

  console.log('Filtered price points:', filteredPriceHistory.length);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Clock className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!filteredPriceHistory.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No price history available
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

  const prices = filteredPriceHistory.map(p => {
    const price = p.price || p.latest_price;
    return typeof price === 'number' ? price : parseFloat(String(price));
  }).filter(p => !isNaN(p));

  const rawMinPrice = Math.min(...prices);
  const rawMaxPrice = Math.max(...prices);
  const { min: minPrice, max: maxPrice } = calculateDynamicRange(rawMinPrice, rawMaxPrice);
  const priceRange = maxPrice - minPrice;

  // Calculate percentage change
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const priceChange = lastPrice - firstPrice;
  const percentageChange = ((priceChange / firstPrice) * 100).toFixed(2);
  const isPositive = priceChange >= 0;

  // Format price with appropriate precision
  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `£${(price / 1000000).toFixed(2)}M`;
    } else if (price >= 1000) {
      return `£${(price / 1000).toFixed(2)}K`;
    } else if (price >= 1) {
      return `£${price.toFixed(2)}`;
    } else {
      // For very small values, use more decimal places
      return `£${price.toFixed(6)}`;
    }
  };

  // Calculate price labels with dynamic steps
  const numLabels = 5;
  const priceLabels = Array.from({ length: numLabels }, (_, i) => {
    const price = maxPrice - (i * (priceRange / (numLabels - 1)));
    return formatPrice(price);
  });

  const points = filteredPriceHistory.map((point, index) => {
    const price = point.price || point.latest_price;
    const validPrice = typeof price === 'number' ? price : parseFloat(String(price));
    const x = (index / (filteredPriceHistory.length - 1)) * 100;
    const y = 100 - ((validPrice - minPrice) / priceRange) * 100;
    return `${x},${y}`;
  }).join(' ');

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - svgRect.left) / svgRect.width;
    const index = Math.min(
      Math.floor(x * filteredPriceHistory.length),
      filteredPriceHistory.length - 1
    );
    const point = filteredPriceHistory[index];
    const price = point.price || point.latest_price;
    const validPrice = typeof price === 'number' ? price : parseFloat(String(price));
    const pointX = (index / (filteredPriceHistory.length - 1)) * 100;
    const pointY = 100 - ((validPrice - minPrice) / priceRange) * 100;

    setHoveredPoint({
      price: validPrice.toString(),
      time: point.timestamp || point.created_at,
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

  // Calculate time labels based on filtered data
  const numTimeLabels = window.innerWidth < 640 ? 3 : 5;
  const timeLabels = Array.from({ length: numTimeLabels }, (_, i) => {
    const index = Math.floor((i * (filteredPriceHistory.length - 1)) / (numTimeLabels - 1));
    const point = filteredPriceHistory[index];
    return {
      time: formatTime(point.timestamp || point.created_at),
      index
    };
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
        {/* Y-axis (prices) */}
        <div className="absolute left-0 top-0 bottom-20 w-16 flex flex-col justify-between text-xs text-gray-500 border-r border-gray-200 bg-white">
          {Array.from({ length: 6 }, (_, i) => {
            const price = (maxPrice * (5 - i) / 5);
            return (
              <div key={i} className="px-2 text-right">
                {formatPrice(price)}
              </div>
            );
          })}
        </div>

        {/* Chart area */}
        <div className="absolute left-16 right-0 top-0 bottom-20">
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

            {/* Price line */}
            <path
              d={`M ${points}`}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
            />

            {/* Current price indicator */}
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
                  {formatPrice(parseFloat(hoveredPoint.price))}
                </text>
              </g>
            ) : null}
          </svg>
        </div>

        {/* X-axis (time) */}
        <div className="absolute left-16 right-0 bottom-0 h-20 border-t border-gray-200">
          <div className="flex justify-between px-4 pt-2 text-xs text-gray-500">
            {timeLabels.map(({ time }, i) => (
              <div key={i} className="text-center">
                {time}
              </div>
            ))}
          </div>
        </div>

        {/* Current price display */}
        <div className="absolute top-2 right-2 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-200">
          <span className="text-sm font-medium text-gray-700">
            Current: {formatPrice(lastPrice)}
          </span>
        </div>
      </div>
    </div>
  );
}