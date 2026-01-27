import type { Coin, MarketEvent } from '../types';
import { PriceChart } from './PriceChart';
import { BuyForm } from './BuyForm';
import { formatCurrency, parsePrice } from '../services/transactionService';

interface CoinDetailProps {
  coin: Coin;
  events: MarketEvent[];
  refreshTrigger: number;
}

// Format event type to be more readable
function formatEventType(type: string): string {
  const eventLabels: Record<string, string> = {
    'PARTNERSHIP': 'Partnership Announcement',
    'ADOPTION': 'Mass Adoption',
    'RUMOR': 'Market Rumor',
    'REGULATION': 'Regulatory News',
    'SCANDAL': 'Scandal'
  };
  return eventLabels[type] || type.charAt(0) + type.slice(1).toLowerCase();
}

// Format duration to be more readable
function formatDuration(timeRemaining: string): string {
  // If already formatted nicely, return as-is
  if (timeRemaining.includes('min') || timeRemaining.includes('sec') || timeRemaining.includes('hour')) {
    return timeRemaining;
  }
  // Try to parse if it's in seconds or other formats
  const seconds = parseInt(timeRemaining, 10);
  if (!isNaN(seconds)) {
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m remaining`;
    } else if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s remaining`;
    } else {
      return `${seconds}s remaining`;
    }
  }
  return timeRemaining;
}

function EventItem({ event }: { event: MarketEvent }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {formatEventType(event.type)}
        </span>
        <span className={`text-xs font-medium ${
          event.effect === 'POSITIVE' ? 'text-green-500' : 'text-red-500'
        }`}>
          {event.effect === 'POSITIVE' ? '↑ Bullish' : '↓ Bearish'}
        </span>
      </div>
      <div className="flex items-center">
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
          {formatDuration(event.timeRemaining)}
        </span>
      </div>
    </div>
  );
}

export function CoinDetail({ coin, events = [], refreshTrigger }: CoinDetailProps) {
  const priceChange = typeof coin.price_change_24h === 'string'
    ? parseFloat(coin.price_change_24h)
    : coin.price_change_24h || 0;

  const priceChangeClass = priceChange >= 0 ? 'text-green-500' : 'text-red-500';

  const currentPrice = parsePrice(coin.current_price);
  const marketCap = parsePrice(coin.market_cap);

  const activeEvents = events.filter((event) => event.coinId === coin.coin_id);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        {/* Coin Info */}
        <div className="w-full md:w-1/3">
          <h2 className="text-2xl font-bold mb-4">{coin.name}</h2>
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Current Price</p>
                  <p className="text-lg font-semibold">{formatCurrency(currentPrice)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">24h Change</p>
                  <p className={`text-lg font-semibold ${priceChangeClass}`}>
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Market Cap</p>
                  <p className="text-lg font-semibold">{formatCurrency(marketCap)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Supply</p>
                  <p className="text-lg font-semibold">{coin.circulating_supply.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Transaction Forms */}
            <div className="grid grid-cols-1 gap-4">
              <BuyForm 
                coin={coin} 
              />
            </div>

            {/* Events Section */}
            {activeEvents.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-3">Market Events</h3>
                <div className="space-y-2">
                  {activeEvents.map((event, index) => (
                    <EventItem key={index} event={event} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Price Chart */}
        <div className="w-full md:w-2/3">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Price History</h3>
            <PriceChart
              coinId={coin.coin_id}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>
      </div>
    </div>
  );
}