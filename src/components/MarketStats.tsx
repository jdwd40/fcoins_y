import React from 'react';
import { TrendingUp, TrendingDown, BarChart3, Clock } from 'lucide-react';
import { MarketStats as MarketStatsType } from '../types';

interface MarketStatsProps {
  stats: MarketStatsType;
}

export function MarketStats({ stats }: MarketStatsProps) {
  if (!stats) return null;

  const formatValue = (value: number) => {
    return value.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const getCycleColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'STRONG_BOOM':
        return 'text-green-600';
      case 'BOOM':
        return 'text-green-500';
      case 'BUST':
        return 'text-red-500';
      case 'STRONG_BUST':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 sm:p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Market Overview</h2>
        <div className="flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          <span className={`text-sm font-medium ${getCycleColor(stats.currentCycle.type)}`}>
            {stats.currentCycle.type.replace('_', ' ')} ({stats.currentCycle.timeRemaining})
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <BarChart3 className="w-5 h-5 text-indigo-600 mr-3" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Current Value</p>
            <p className="font-semibold text-gray-900 dark:text-white">{formatValue(stats.currentValue)}</p>
          </div>
        </div>
        <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <TrendingUp className="w-5 h-5 text-green-600 mr-3" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">All Time High</p>
            <p className="font-semibold text-gray-900 dark:text-white">{formatValue(stats.allTimeHigh)}</p>
          </div>
        </div>
        <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <TrendingDown className="w-5 h-5 text-red-600 mr-3" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">All Time Low</p>
            <p className="font-semibold text-gray-900 dark:text-white">{formatValue(stats.allTimeLow)}</p>
          </div>
        </div>
        <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <BarChart3 className="w-5 h-5 text-purple-600 mr-3" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Latest Value</p>
            <p className="font-semibold text-gray-900 dark:text-white">{formatValue(stats.latestValue)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}