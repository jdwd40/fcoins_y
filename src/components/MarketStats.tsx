import React from 'react';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { MarketStats as MarketStatsType } from '../types';

interface MarketStatsProps {
  stats?: MarketStatsType;
}

export function MarketStats({ stats }: MarketStatsProps) {
  if (!stats) return null;

  const formatValue = (value: number | null | undefined) => {
    return value != null ? value.toLocaleString() : '0';
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 sm:p-4 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Market Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="flex items-center p-3 bg-gray-50 rounded-lg">
          <TrendingUp className="w-5 h-5 text-green-600 mr-3" />
          <div>
            <p className="text-sm text-gray-500">All Time High</p>
            <p className="font-semibold">£{formatValue(stats.all_time_high)}</p>
          </div>
        </div>
        <div className="flex items-center p-3 bg-gray-50 rounded-lg">
          <TrendingDown className="w-5 h-5 text-red-600 mr-3" />
          <div>
            <p className="text-sm text-gray-500">All Time Low</p>
            <p className="font-semibold">£{formatValue(stats.all_time_low)}</p>
          </div>
        </div>
        <div className="flex items-center p-3 bg-gray-50 rounded-lg">
          <BarChart3 className="w-5 h-5 text-indigo-600 mr-3" />
          <div>
            <p className="text-sm text-gray-500">Market Value</p>
            <p className="font-semibold">£{formatValue(stats.current_market_value)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}