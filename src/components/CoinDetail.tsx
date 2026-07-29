import type { Coin, MarketEvent } from '../types';
import { PriceChart } from './PriceChart';
import { BuyForm } from './BuyForm';
import { formatCurrency, parsePrice } from '../services/transactionService';

interface CoinDetailProps {
  coin: Coin;
  events: MarketEvent[];
  refreshTrigger: number;
}

function formatEventType(type: string): string {
  const eventLabels: Record<string, string> = {
    'PARTNERSHIP': 'Partnership Announcement',
    'ADOPTION': 'Mass Adoption',
    'RUMOR': 'Market Rumor',
    'REGULATION': 'Regulatory News',
    'SCANDAL': 'Scandal',
  };
  return eventLabels[type] || type.charAt(0) + type.slice(1).toLowerCase();
}

function formatDuration(timeRemaining: string): string {
  if (timeRemaining.includes('min') || timeRemaining.includes('sec') || timeRemaining.includes('hour')) {
    return timeRemaining;
  }
  const seconds = parseInt(timeRemaining, 10);
  if (!isNaN(seconds)) {
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    } else if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    } else {
      return `${seconds}s`;
    }
  }
  return timeRemaining;
}

function EventItem({ event }: { event: MarketEvent }) {
  const positive = event.effect === 'POSITIVE';
  return (
    <div className="flex items-center justify-between py-3 border-b border-rule last:border-b-0">
      <div>
        <div className="font-display italic text-lg text-ink leading-tight">
          {formatEventType(event.type)}
        </div>
        <div className={`label mt-1 ${positive ? 'text-verdigris' : 'text-oxblood'}`}>
          {positive ? '▲ Bullish' : '▼ Bearish'}
        </div>
      </div>
      <div className="chip">{formatDuration(event.timeRemaining)}</div>
    </div>
  );
}

export function CoinDetail({ coin, events = [], refreshTrigger }: CoinDetailProps) {
  const priceChange = typeof coin.price_change_24h === 'string'
    ? parseFloat(coin.price_change_24h)
    : coin.price_change_24h || 0;
  const up = priceChange >= 0;
  const currentPrice = parsePrice(coin.current_price);
  const marketCap = parsePrice(coin.market_cap);
  const activeEvents = events.filter((event) => event.coinId === coin.coin_id);

  return (
    <div className="p-2 sm:p-4">
      {/* Masthead */}
      <div className="border-b border-rule pb-6 mb-6">
        <div className="flex items-baseline gap-3 label mb-2">
          <span>Asset {String(coin.coin_id).padStart(3, '0')}</span>
          <span>·</span>
          <span>{coin.symbol}</span>
        </div>
        <h2 className="font-display text-5xl sm:text-6xl font-semibold text-ink leading-none"
            style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 50" }}>
          {coin.name}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: stats + forms */}
        <div className="lg:col-span-2 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="label mb-2">Current Price</div>
              <div className="numeral text-ink text-4xl"
                   style={{ fontVariationSettings: "'opsz' 144" }}>
                {formatCurrency(currentPrice)}
              </div>
            </div>
            <div>
              <div className="label mb-2">24h Change</div>
              <div className={`numeral text-4xl ${up ? 'text-verdigris' : 'text-oxblood'}`}>
                {up ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="label mb-2">Market Cap</div>
              <div className="font-mono text-lg text-ink tnum">{formatCurrency(marketCap)}</div>
            </div>
            <div>
              <div className="label mb-2">Supply</div>
              <div className="font-mono text-lg text-ink tnum">
                {coin.circulating_supply.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Buy form */}
          <BuyForm coin={coin} />

          {/* Events */}
          {activeEvents.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-rule">
                <div>
                  <div className="label">Dispatch</div>
                  <h3 className="font-display text-2xl italic text-ink">
                    Active Events
                  </h3>
                </div>
              </div>
              <div>
                {activeEvents.map((event, index) => (
                  <EventItem key={index} event={event} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: chart */}
        <div className="lg:col-span-3">
          <div className="label mb-3">Price History</div>
          <PriceChart coinId={coin.coin_id} refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </div>
  );
}
