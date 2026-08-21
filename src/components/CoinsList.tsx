import { Coin, MarketEvent } from '../types';
import { parsePrice } from '../services/transactionService';

interface CoinsListProps {
  coins: Coin[];
  onSelectCoin: (id: number) => void;
  selectedCoinId: number | null;
  events: MarketEvent[];
}

const sortCoinsByPrice = (coins: Coin[]) =>
  [...coins].sort((a, b) => {
    const priceA = parsePrice(a.current_price ?? 0);
    const priceB = parsePrice(b.current_price ?? 0);
    return priceB - priceA;
  });

const formatCompact = (value: string | number) =>
  new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(parsePrice(value) || 0);

export function CoinsList({ coins, onSelectCoin, selectedCoinId }: CoinsListProps) {
  // Dead coins (collapsed to exactly £0 by the apocalypse) stay listed —
  // sorted to the bottom by the price ordering — visibly DEAD but still
  // openable for their history/chart.
  const sortedCoins = sortCoinsByPrice(coins);

  return (
    <div className="paper-card overflow-hidden">
      <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 bg-paper-alt border-b border-rule label">
        <div className="col-span-4">Asset</div>
        <div className="col-span-2 text-right">Price</div>
        <div className="col-span-2 text-right">24h</div>
        <div className="col-span-2 text-right">Market cap</div>
        <div className="col-span-2 text-right">Supply</div>
      </div>

      <div className="divide-rule">
        {sortedCoins.map((coin, index) => {
          const price = parsePrice(coin?.current_price ?? 0);
          const priceChange = parseFloat(coin?.price_change_24h?.toString() ?? '0');
          const up = priceChange >= 0;
          const selected = selectedCoinId === coin.coin_id;
          const dead = !(price > 0);
          const extreme = !dead && Math.abs(priceChange) >= 15;

          return (
            <button
              key={coin.coin_id}
              onClick={() => onSelectCoin(coin.coin_id)}
              className={`group w-full text-left px-4 sm:px-5 py-3 sm:py-4 transition-colors animate-reveal-fast hover:bg-paper-alt ${
                selected ? 'bg-paper-alt ring-1 ring-inset ring-gold' : 'bg-card'
              } ${dead ? 'coin-dead' : ''}`}
              style={{ animationDelay: `${Math.min(index * 35, 450)}ms` }}
            >
              {/* Mobile: compact 2-row card */}
              <div className="md:hidden">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`asset-mark ${dead ? 'asset-mark-dead' : ''}`}>{coin.symbol.slice(0, 3)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-semibold text-ink truncate group-hover:text-gold transition-colors">
                      {coin.name}
                      {dead && <span className="ml-2 font-mono text-[0.62rem] font-bold text-oxblood tracking-caps">DEAD</span>}
                    </div>
                    <div className="font-mono text-[0.68rem] text-ink-mute mt-0.5">{coin.symbol}/GBP</div>
                  </div>
                  <span className={`font-mono text-base font-semibold tnum shrink-0 ${dead ? 'text-oxblood' : 'text-ink'}`}>
                    {dead ? '£0.00' : `£${price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pl-[3.25rem]">
                  <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold tnum ${up ? 'text-verdigris' : 'text-oxblood'}`}>
                    {up ? '↗' : '↘'} {up ? '+' : ''}{priceChange.toFixed(2)}%
                    {extreme && <span className="text-gold ml-1">⚡EXTREME</span>}
                  </span>
                  <span className="font-mono text-xs text-ink-dim tnum">MCap £{formatCompact(coin.market_cap)}</span>
                </div>
              </div>

              {/* Desktop: 12-col table row */}
              <div className="hidden md:grid md:grid-cols-12 md:items-center gap-4">
                <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                  <span className={`asset-mark ${dead ? 'asset-mark-dead' : ''}`}>{coin.symbol.slice(0, 3)}</span>
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-ink truncate group-hover:text-gold transition-colors">
                      {coin.name}
                      {dead && <span className="ml-2 font-mono text-[0.62rem] font-bold text-oxblood tracking-caps">DEAD · COLLAPSED</span>}
                    </div>
                    <div className="font-mono text-[0.68rem] text-ink-mute mt-0.5">{coin.symbol}/GBP</div>
                  </div>
                </div>

                <div className="md:col-span-2 md:text-right">
                  <span className={`font-mono text-sm font-semibold tnum ${dead ? 'text-oxblood' : 'text-ink'}`}>
                    {dead ? '£0.00' : `£${price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>

                <div className="md:col-span-2 md:text-right">
                  <span className={`inline-flex items-center justify-end gap-1 font-mono text-sm font-semibold tnum ${up ? 'text-verdigris' : 'text-oxblood'}`}>
                    {up ? '↗' : '↘'} {up ? '+' : ''}{priceChange.toFixed(2)}%
                    {extreme && <span className="text-gold ml-1 text-[0.66rem]">⚡EXTREME</span>}
                  </span>
                </div>

                <div className="md:col-span-2 md:text-right">
                  <span className="font-mono text-sm text-ink-dim tnum">£{formatCompact(coin.market_cap)}</span>
                </div>

                <div className="md:col-span-2 md:text-right">
                  <span className="font-mono text-sm text-ink-dim tnum">{formatCompact(coin.circulating_supply)} {coin.symbol}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
