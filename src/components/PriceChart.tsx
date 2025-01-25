import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { PriceHistory } from '../types';

type TimeRange = '10M' | '30M' | '1H' | '2H' | '12H' | '24H' | 'ALL';

interface PriceChartProps {
  priceHistory: PriceHistory['price_history'];
}

const TIME_RANGES = [
  { value: '10M', label: '10m' },
  { value: '30M', label: '30m' },
  { value: '1H', label: '1h' },
  { value: '2H', label: '2h' },
  { value: '12H', label: '12h' },
  { value: '24H', label: '24h' },
  { value: 'ALL', label: 'ALL' }
] as const;

export function PriceChart({ priceHistory }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1H');
  const [hoveredPoint, setHoveredPoint] = useState<{
    price: string;
    time: string;
    x: number;
    y: number;
  } | null>(null);

  const getFilteredData = () => {
    const now = new Date();
    const msRange = {
      '10M': 10 * 60 * 1000,
      '30M': 30 * 60 * 1000,
      '1H': 60 * 60 * 1000,
      '2H': 2 * 60 * 60 * 1000,
      '12H': 12 * 60 * 60 * 1000,
      '24H': 24 * 60 * 60 * 1000,
      'ALL': Number.MAX_SAFE_INTEGER
    }[timeRange];

    return priceHistory.filter(point => {
      const pointDate = new Date(point.created_at);
      return now.getTime() - pointDate.getTime() <= msRange;
    });
  };

  const filteredData = getFilteredData();
  const maxPrice = Math.max(...filteredData.map((p) => parseFloat(p.price)));
  const minPrice = Math.min(...filteredData.map((p) => parseFloat(p.price)));
  const range = maxPrice - minPrice;
  const height = 300;
  const width = 800;
  const padding = {
    left: 80,   // Increased left padding for price labels
    right: 40,
    top: 20,
    bottom: 40
  };
  const priceStep = range / 4;

  const points = filteredData.map((point, index) => {
    const x = (index / (filteredData.length - 1)) * (width - padding.left - padding.right) + padding.left;
    const y =
      height -
      ((parseFloat(point.price) - minPrice) / range) * (height - padding.top - padding.bottom) -
      padding.bottom;
    return `${x},${y}`;
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 sm:p-6 mt-6">
      <div className="relative">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 relative">
            {hoveredPoint && (
              <div 
                className="absolute z-10 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-2 pointer-events-none transform -translate-x-1/2 -translate-y-full"
                style={{ left: hoveredPoint.x, top: hoveredPoint.y - 16 }}
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  £{parseFloat(hoveredPoint.price).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{hoveredPoint.time}</p>
              </div>
            )}
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="xMidYMid meet"
              className="w-full transition-transform duration-300 ease-in-out"
              style={{ width: '100%', minWidth: '600px', touchAction: 'pinch-zoom' }}
            >
              {/* Background */}
              <rect
                x={padding.left}
                y={padding.top}
                width={width - padding.left - padding.right}
                height={height - padding.top - padding.bottom}
                fill="none"
                stroke="#374151"
                strokeWidth="0.5"
                strokeOpacity="0.1"
              />

              {/* Grid lines */}
              {Array.from({ length: 5 }).map((_, i) => (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={padding.top + (i * (height - padding.top - padding.bottom)) / 4}
                    x2={width - padding.right}
                    y2={padding.top + (i * (height - padding.top - padding.bottom)) / 4}
                    stroke="#374151"
                    strokeWidth="0.5"
                    strokeDasharray="4"
                    opacity="0.2"
                  />
                  <text
                    x={padding.left - 10}
                    y={padding.top + (i * (height - padding.top - padding.bottom)) / 4}
                    className="text-xs fill-gray-500 dark:fill-gray-400 text-right"
                    textAnchor="end"
                    dominantBaseline="middle"
                  >
                    £{(maxPrice - i * priceStep).toFixed(2)}
                  </text>
                </g>
              ))}

              {/* X-axis line */}
              <line
                x1={padding.left}
                y1={height - padding.bottom}
                x2={width - padding.right}
                y2={height - padding.bottom}
                stroke="#374151"
                strokeWidth="0.5"
                opacity="0.2"
              />

              {/* Price line */}
              <polyline
                points={points.join(' ')}
                className="transition-all duration-300 ease-in-out"
                style={{
                  fill: 'none',
                  stroke: '#4f46e5',
                  strokeWidth: '2',
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))'
                }}
              />

              {/* Time labels */}
              {filteredData.filter((_, i) => i % Math.ceil(filteredData.length / 6) === 0).map((point, i) => (
                <text
                  key={i}
                  x={padding.left + (i * (width - padding.left - padding.right)) / 6}
                  y={height - 10}
                  className="text-[10px] sm:text-xs fill-gray-500 dark:fill-gray-400"
                  textAnchor="middle"
                >
                  {formatTime(point.created_at)}
                </text>
              ))}

              {/* Price dots */}
              {filteredData.map((point, index) => {
                const x = (index / (filteredData.length - 1)) * (width - padding.left - padding.right) + padding.left;
                const y = height - ((parseFloat(point.price) - minPrice) / range) * (height - padding.top - padding.bottom) - padding.bottom;
                return (
                  <g
                    key={index}
                    onMouseEnter={() => setHoveredPoint({
                      price: point.price,
                      time: formatTime(point.created_at),
                      x,
                      y
                    })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#4f46e5"
                      className="opacity-0 hover:opacity-100 transition-all duration-200"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r="12"
                      fill="transparent"
                      className="cursor-pointer"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
      
      <div className="mt-6 flex justify-center">
        <div className="inline-flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
          {TIME_RANGES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                timeRange === value
                  ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}