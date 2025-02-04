import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, TrendingUp, CircleDollarSign } from 'lucide-react';
import { Coin, MarketEvent, User } from '../types';
import { useAuth } from '../context/AuthContext';

function formatTime(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

interface CoinDetailProps {
  coin: Coin;
  events?: MarketEvent[];
}

function EventItem({ event }: { event: MarketEvent }) {
  const [timeLeft, setTimeLeft] = useState(event.timeRemaining);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
          {formatTime(timeLeft)}
        </span>
      </div>
    </div>
  );
}

export function CoinDetail({ coin, events = [] }: CoinDetailProps) {
  const { user } = useAuth();
  const [spendAmount, setSpendAmount] = useState<string>('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [buyStatus, setBuyStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  const price = parseFloat(coin?.current_price?.toString() ?? '0');
  const priceChange = parseFloat(coin?.price_change_24h?.toString() ?? '0');
  const marketCap = parseFloat(coin?.market_cap?.toString() ?? '0');
  const circulatingSupply = parseFloat(coin?.circulating_supply?.toString() ?? '0');

  // Calculate crypto amount based on spend amount
  const cryptoAmount = spendAmount ? parseFloat(spendAmount) / price : 0;

  const handleBuyClick = async () => {
    if (!user || !spendAmount || parseFloat(spendAmount) <= 0) return;
    setShowConfirmation(true);
  };

  const handleConfirmBuy = async () => {
    try {
      setIsLoading(true);
      setBuyStatus('');
      const token = localStorage.getItem('token');
      
      if (!token) {
        setBuyStatus('Please log in to buy coins');
        return;
      }

      const response = await fetch('https://jdwd40.com/api-2/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: user.id,
          coin_id: coin.coin_id,
          type: 'buy',
          amount: cryptoAmount
        })
      });

      const data = await response.json();
      if (response.ok) {
        setBuyStatus('Purchase successful!');
        setSpendAmount('');
        setShowConfirmation(false);
      } else {
        setBuyStatus(data.message || 'Failed to purchase coins');
      }
    } catch (error) {
      setBuyStatus('Error occurred while processing purchase');
      console.error('Buy error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="relative mb-6">
        <div className="absolute left-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{coin.name}</h1>
          <p className="text-gray-500 dark:text-gray-400">{coin.symbol}</p>
        </div>
        <div className="text-center">
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            £{price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p
            className={`text-sm ${
              priceChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {priceChange >= 0 ? '↑' : '↓'}{' '}
            {Math.abs(priceChange).toFixed(2)}% (24h)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
        <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <DollarSign className="w-6 h-6 text-indigo-600 mr-3" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Market Cap</p>
            <p className="font-semibold dark:text-white">£{marketCap.toLocaleString('en-GB', { minimumFractionDigits: 0 })}</p>
          </div>
        </div>
        <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <CircleDollarSign className="w-6 h-6 text-indigo-600 mr-3" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Circulating Supply</p>
            <p className="font-semibold dark:text-white">
              {circulatingSupply.toLocaleString()} {coin.symbol}
            </p>
          </div>
        </div>
        <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <TrendingUp className="w-6 h-6 text-indigo-600 mr-3" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Price Change (24h)</p>
            <p
              className={`font-semibold ${
                priceChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {priceChange.toFixed(2)}%
            </p>
          </div>
        </div>
        <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <Calendar className="w-6 h-6 text-indigo-600 mr-3" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Date Added</p>
            <p className="font-semibold dark:text-white">
              {new Date(coin.date_added).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
      {user && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Buy {coin.name}</h2>
          <div className="flex flex-col space-y-4">
            <div>
              <label htmlFor="spendAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Amount to spend (£)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">£</span>
                </span>
                <input
                  type="number"
                  name="spendAmount"
                  id="spendAmount"
                  min="0.01"
                  step="0.01"
                  className="block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md dark:bg-gray-600 dark:border-gray-500 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                  value={spendAmount}
                  onChange={(e) => setSpendAmount(e.target.value)}
                />
              </div>
              {spendAmount && parseFloat(spendAmount) > 0 && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  You will receive approximately {cryptoAmount.toFixed(8)} {coin.symbol.toUpperCase()}
                  <br />
                  <span className="text-xs text-gray-500">
                    (1 {coin.symbol.toUpperCase()} = £{price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </p>
              )}
            </div>
            <button
              onClick={handleBuyClick}
              disabled={isLoading || !spendAmount || parseFloat(spendAmount) <= 0}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isLoading || !spendAmount || parseFloat(spendAmount) <= 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }`}
            >
              {isLoading ? 'Processing...' : 'Buy Coins'}
            </button>
            {buyStatus && (
              <p className={`text-sm ${buyStatus.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {buyStatus}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Confirm Purchase</h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-300">
                You are about to purchase:<br />
                <span className="font-medium text-gray-900 dark:text-white">
                  {cryptoAmount.toFixed(8)} {coin.symbol.toUpperCase()}
                </span>
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-300">
                Total cost:<br />
                <span className="font-medium text-gray-900 dark:text-white">
                  £{parseFloat(spendAmount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmBuy}
                  disabled={isLoading}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                >
                  {isLoading ? 'Processing...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowConfirmation(false)}
                  disabled={isLoading}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {events.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Active Events</h3>
          <div className="space-y-2">
            {events?.filter(event => event.coinId === coin.coin_id).map((event) => (
              <EventItem key={`${event.coinId}-${event.type}`} event={event} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}