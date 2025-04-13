import type { Coin, MarketEvent } from '../types';
import { TradingViewChart } from './TradingViewChart';
import { BuyForm } from './BuyForm';
import { DebugUserInfo } from './DebugUserInfo';
import { formatCurrency, parsePrice } from '../services/transactionService';

interface CoinDetailProps {
  coin: Coin;
  events: MarketEvent[];
  refreshTrigger: number;
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
              {/* Debug Component - Only visible in development */}
              {process.env.NODE_ENV !== 'production' && <DebugUserInfo />}
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
            <div className="h-[400px]"> 
              <TradingViewChart
                coinId={coin.coin_id.toString()}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}