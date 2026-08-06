import type { Coin } from '../types';
import { PriceChart } from './PriceChart';
import { BuyForm } from './BuyForm';
import { formatAdaptivePrice, formatCurrency, formatCountdown, formatCompact } from '../utils/format';

interface ActiveEvent {
  asset_id: number;
  event_type: string;
  event_multiplier: number;
  event_ends_at: string | null;
}

interface CoinDetailProps {
  coin: Coin;
  activeEvents: ActiveEvent[];
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

function EventItem({ event }: { event: ActiveEvent }) {
  const positive = event.event_multiplier >= 1;
  const remaining = event.event_ends_at
    ? formatCountdown((new Date(event.event_ends_at).getTime() - Date.now()) / 1000)
    : '—';
  return (
    <div className="flex items-center justify-between py-3 border-b border-rule last:border-b-0">
      <div>
        <div className="font-display italic text-lg text-ink leading-tight">
          {formatEventType(event.event_type)}
        </div>
        <div className={`label mt-1 ${positive ? 'text-verdigris' : 'text-oxblood'}`}>
          {positive ? '▲ Bullish' : '▼ Bearish'}
        </div>
      </div>
      <div className="chip">{remaining}</div>
    </div>
  );
}

export function CoinDetail({ coin, activeEvents = [], refreshTrigger }: CoinDetailProps) {
  const priceChange = Number(coin.price_change_24h ?? 0);
  const up = priceChange >= 0;
  const events = activeEvents.filter((event) => event.asset_id === coin.id);

  return (
    <div className="p-2 sm:p-4">
      {/* Masthead */}
      <div className="border-b border-rule pb-6 mb-6">
        <div className="flex items-baseline gap-3 label mb-2">
          <span>Asset {String(coin.id).padStart(3, '0')}</span>
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
                {formatAdaptivePrice(Number(coin.current_price))}
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
              <div className="font-mono text-lg text-ink tnum">{formatCurrency(Number(coin.market_cap))}</div>
            </div>
            <div>
              <div className="label mb-2">Supply</div>
              <div className="font-mono text-lg text-ink tnum">
                {formatCompact(Number(coin.circulating_supply))}
              </div>
            </div>
          </div>

          {/* Buy form */}
          <BuyForm coin={coin} />

          {/* Events */}
          {events.length > 0 && (
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
                {events.map((event, index) => (
                  <EventItem key={index} event={event} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: chart */}
        <div className="lg:col-span-3">
          <div className="label mb-3">Price History</div>
          <PriceChart coinId={coin.id} symbol={coin.symbol} refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </div>
  );
}
