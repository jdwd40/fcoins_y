import React, { useEffect, useState } from 'react';
import { Timer, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { MarketStatus as MarketStatusType, MarketEvent } from '../types';

interface MarketStatusProps {
  status: MarketStatusType;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function MarketStatus({ status }: MarketStatusProps) {
  const [timeRemaining, setTimeRemaining] = useState(status?.currentCycle?.timeRemaining ?? 0);

  useEffect(() => {
    if (!status?.currentCycle?.timeRemaining) return;
    
    setTimeRemaining(status.currentCycle.timeRemaining);
    
    const timer = setInterval(() => {
      setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  const getCycleIcon = () => {
    return status?.currentCycle?.type === 'BOOM' ? (
      <TrendingUp className="w-5 h-5 text-green-500" />
    ) : (
      <TrendingDown className="w-5 h-5 text-red-500" />
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Market Status</h2>
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {formatTime(timeRemaining)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mb-4">
        {getCycleIcon()}
        <div>
          {status?.currentCycle?.type && (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">Current Cycle</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {String(status.currentCycle.type)} CYCLE
              </p>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {status?.currentCycle?.type && (
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {String(status.currentCycle.type) === 'BOOM' ? 'Bull Market' : 'Bear Market'}
          </p>
        )}
      </div>
    </div>
  );
}