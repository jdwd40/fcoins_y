import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Coin, MarketEvent } from '../types';
import { PriceChart } from './PriceChart';

interface CoinDetailProps {
  coin: Coin;
  events: MarketEvent[];
}

function EventItem({ event }: { event: MarketEvent }) {
  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {event.type}
      </span>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${
          event.effect === 'POSITIVE' ? 'text-green-500' : 'text-red-500'
        }`}>
          {event.effect}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {event.timeRemaining}
        </span>
      </div>
    </div>
  );
}

export function CoinDetail({ coin, events = [] }: CoinDetailProps) {
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchInitialPriceHistory = async () => {
      try {
        console.log('Fetching initial price history for coin:', coin.coin_id);
        // Remove 'range=' parameter as it's not needed for default 30M data
        const response = await fetch(`https://jdwd40.com/api-2/api/coins/${coin.coin_id}/price-history`);
        const data = await response.json();
        console.log('Received initial price history data:', data);
        
        // Handle both array and object responses
        const historyData = Array.isArray(data) ? data : data.price_history;
        
        if (!historyData || !Array.isArray(historyData)) {
          console.error('Invalid initial price history data:', data);
          setPriceHistory([]);
          return;
        }
        
        setPriceHistory(historyData);
      } catch (error) {
        console.error('Error fetching initial price history:', error);
        setPriceHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialPriceHistory();
  }, [coin.coin_id]);

  console.log('Current price history in CoinDetail:', priceHistory);

  const activeEvents = events.filter(event => event.coinId === coin.coin_id);
  const priceChange = typeof coin.price_change_24h === 'string' 
    ? parseFloat(coin.price_change_24h) 
    : coin.price_change_24h || 0;
  
  const priceChangeClass = priceChange >= 0 ? 'text-green-500' : 'text-red-500';
  const priceChangeIcon = priceChange >= 0 ? (
    <TrendingUp className="w-5 h-5" />
  ) : (
    <TrendingDown className="w-5 h-5" />
  );

  const currentPrice = typeof coin.current_price === 'string' 
    ? parseFloat(coin.current_price) 
    : coin.current_price;

  const volume = typeof coin.market_cap === 'string'
    ? parseFloat(coin.market_cap)
    : coin.market_cap;

  const marketCap = typeof coin.market_cap === 'string'
    ? parseFloat(coin.market_cap)
    : coin.market_cap;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {coin.name}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Current Price: £{currentPrice.toFixed(2)}
          </p>
        </div>
        <div className={`flex items-center gap-1 ${priceChangeClass}`}>
          {priceChangeIcon}
          <span className="font-medium">
            {priceChange >= 0 ? '+' : ''}
            {priceChange.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Price Statistics
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">24h Change</span>
              <span className={`text-sm font-medium ${priceChangeClass}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Current Price</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                £{currentPrice.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Trading Info
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Volume</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                £{volume.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Market Cap</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                £{marketCap.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <PriceChart coinId={coin.coin_id.toString()} priceHistory={priceHistory} />
        </div>
        
        {activeEvents.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Active Events</h3>
            <div className="space-y-2">
              {activeEvents.map((event, index) => (
                <EventItem key={index} event={event} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}