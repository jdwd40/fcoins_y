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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-rule">
      {sortedCoins.map((coin, i) => {
        const price = parseFloat(coin?.current_price?.toString() ?? '0');
        const priceChange = parseFloat(coin?.price_change_24h?.toString() ?? '0');
        const up = priceChange >= 0;
        const selected = selectedCoinId === coin.coin_id;
        return (
          <button
            key={coin.coin_id}
            onClick={() => onSelectCoin(coin.coin_id)}
            className={`group relative text-left bg-card p-6 transition-all duration-300 hover:bg-paper-alt animate-reveal-fast ${
              selected ? 'ring-1 ring-gold' : ''
            }`}
            style={{ animationDelay: `${Math.min(i * 40, 600)}ms` }}
          >
            {/* Top row: label + trend arrow */}
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0 flex-1">
                <div className="label mb-1 truncate">№ {String(coin.coin_id).padStart(3, '0')}</div>
                <h3 className="font-display text-2xl italic text-ink leading-tight truncate"
                    style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 30" }}>
                  {coin.name}
                </h3>
              </div>
              <div className={`font-mono text-xs font-bold tracking-caps shrink-0 ml-3 ${up ? 'text-verdigris' : 'text-oxblood'}`}>
                {up ? '▲' : '▼'}
              </div>
            </div>

            <div className="rule-thin mb-4"></div>

            {/* Price row */}
            <div className="flex items-end justify-between">
              <div>
                <div className="label mb-1">{coin.symbol}</div>
                <div className="numeral text-ink text-3xl"
                     style={{ fontVariationSettings: "'opsz' 144" }}>
                  £{price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className={`font-mono text-xs tnum ${up ? 'text-verdigris' : 'text-oxblood'}`}>
                {up ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
            </div>

            {/* Hover indicator line */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gold origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
          </button>
        );
      })}
    </div>
  );
}
