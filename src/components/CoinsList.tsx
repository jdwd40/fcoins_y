import React from 'react';
import { Coins } from 'lucide-react';
import { Coin, MarketEvent } from '../types';

interface CoinsListProps {
  coins: Coin[];
  onSelectCoin: (id: number) => void;
  selectedCoinId: number | null;
  events: MarketEvent[];
}

const sortCoinsByPrice = (coins: Coin[]) => {
  return [...coins].sort((a, b) => {
    const priceA = parseFloat(a.current_price?.toString() ?? '0');
    const priceB = parseFloat(b.current_price?.toString() ?? '0');
    return priceB - priceA;
  });
};

export function CoinsList({ coins, onSelectCoin, selectedCoinId }: CoinsListProps) {
  const sortedCoins = sortCoinsByPrice(coins);

  return (
    <div className="w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden mb-6">
      <div className="p-4 bg-indigo-600 text-white flex items-center gap-2">
        <Coins className="w-5 h-5" />
        <h2 className="font-semibold">Coins by Value</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4">
        {sortedCoins.map((coin) => {
          const price = parseFloat(coin?.current_price?.toString() ?? '0');
          const priceChange = parseFloat(coin?.price_change_24h?.toString() ?? '0');
          return (
            <div 
              key={coin.coin_id} 
              className={`bg-gray-50 dark:bg-gray-700 rounded-lg hover:shadow-md transition-all ${
                selectedCoinId === coin.coin_id ? 'ring-2 ring-indigo-500' : ''
              }`}
            >
              <button
                onClick={() => onSelectCoin(coin.coin_id)}
                className="w-full p-4 text-left focus:outline-none"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{coin.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{coin.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900 dark:text-white">
                      £{price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p
                      className={`text-sm ${
                        priceChange >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {priceChange >= 0 ? '↑' : '↓'}{' '}
                      {Math.abs(priceChange).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}