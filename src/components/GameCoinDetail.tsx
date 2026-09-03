import { Skull } from 'lucide-react';
import { PriceChart } from './PriceChart';
import { PersistentTradePanel } from './PersistentTradePanel.tsx';
import { formatCurrency } from '../services/transactionService.ts';
import type { MarketSignalCoin } from '../services/gameService.ts';
import type { PersistentHolding } from '../services/persistentService.ts';
import {
  archetypePersonality,
  formatQuantity,
  formatRecentChangePct,
  formatSignedGbp,
  formatSignedPct,
  formatTypicalCycle,
  formatTypicalSwing,
  momentumArrow
} from '../utils/gameLogic.ts';
import { sparklineRangeForCoin } from '../utils/sparkline.ts';
import type { Coin, TimeRange } from '../types';

// Issue #13: the detailed V2 coin view. Opened from any primary market
// card's non-trade area (via GameMarketGrid's modal), it is where the
// secondary information lives — the compact card stays a fast
// read-and-trade surface.
//
// Everything here is public, already-happened data: the shared GameContext
// market-signals poll (phase, momentum, archetype, typical ranges, collapse
// risk), the server-owned participant holding economics, and the
// authoritative per-coin /coins/:id/price-history endpoint. No hidden or
// future market information exists in these contracts and none is rendered.

// Short cycle windows are first-class so the current dip → rise → boom →
// fall → dip cycle is inspectable; the longer windows are secondary.
const DETAIL_PRIMARY_RANGES: readonly TimeRange[] = ['10M', '30M', '1H', '2H'];
const DETAIL_SECONDARY_RANGES: readonly TimeRange[] = ['24H', '7D', '30D', 'ALL'];

interface GameCoinDetailProps {
  coin: MarketSignalCoin;
  /** The player's PERSISTENT holding in this coin (server-owned economics). */
  holding: PersistentHolding | null;
}

export function GameCoinDetail({ coin, holding }: GameCoinDetailProps) {
  const owned = !!holding && holding.quantity > 0;

  // The classic trade panel consumes the legacy Coin shape; only
  // coin_id/symbol/current_price are read from it. The price stays the
  // server-published signal price (same mapping as the compact card).
  const legacyCoin: Coin = {
    coin_id: coin.coinId,
    name: coin.name,
    symbol: coin.symbol,
    current_price: String(coin.currentPrice),
    market_cap: '£0.00',
    circulating_supply: 0,
    price_change_24h: coin.recentChangePct ?? 0,
    founder: ''
  };

  // The default detail window makes the current cycle inspectable: the
  // same public archetype/typical-cycle mapping as the compact sparkline
  // (issue #12) — no hidden timing is ever consulted.
  const initialRange = sparklineRangeForCoin(coin);

  const pnlClass = holding && holding.unrealizedPnl >= 0 ? 'text-verdigris' : 'text-oxblood';
  const pnlWord = holding && holding.unrealizedPnl >= 0 ? 'profit' : 'loss';

  return (
    <div className="p-1 sm:p-2" aria-label={`${coin.name} detail`}>
      {/* Masthead: identity is traceable — id, name, symbol, live price. */}
      <div className="border-b border-rule pb-4 mb-4 pr-10">
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 label mb-1.5">
          <span>Coin {coin.coinId}</span>
          <span>·</span>
          <span>{coin.symbol}/GBP</span>
          <span className={`signal-chip phase-${coin.phase.toLowerCase()}`}>{coin.phase}</span>
          <span className={`signal-chip risk-${coin.collapseRisk.toLowerCase()}`}>
            Risk {coin.collapseRisk}
          </span>
        </div>
        <h2 className="font-display text-2xl sm:text-4xl font-semibold text-ink leading-tight">
          {coin.name}
        </h2>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
          <div className={`numeral text-3xl sm:text-4xl tnum ${coin.dead ? 'text-oxblood' : 'text-ink'}`}>
            {coin.dead ? '£0.00' : formatCurrency(coin.currentPrice)}
          </div>
          <div className={`font-mono text-sm font-bold tnum ${(coin.recentChangePct ?? 0) >= 0 ? 'text-verdigris' : 'text-oxblood'}`}>
            1m {formatRecentChangePct(coin.recentChangePct)} {momentumArrow(coin.momentum)}
          </div>
        </div>
      </div>

      {coin.dead && (
        <div className="mb-4 border border-oxblood rounded-xl p-4 bg-paper-alt flex items-center gap-3" role="note">
          <Skull className="w-5 h-5 text-oxblood shrink-0" aria-hidden="true" />
          <p className="text-sm text-ink-dim">
            <strong className="text-oxblood">DEAD · PERMANENT.</strong>{' '}
            This coin died in the persistent market and trading has stopped permanently. Its history is preserved.
          </p>
        </div>
      )}

      {/* Public signal facts — every state is explicit text. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5" aria-label="Market signal detail">
        <div className="stat-cell">
          <div className="label mb-0.5">Phase</div>
          <div className="mt-1"><span className={`signal-chip phase-${coin.phase.toLowerCase()}`}>{coin.phase}</span></div>
        </div>
        <div className="stat-cell">
          <div className="label mb-0.5">Momentum</div>
          <div className="font-mono text-sm font-bold text-ink tnum mt-1">{momentumArrow(coin.momentum)}</div>
        </div>
        <div className="stat-cell">
          <div className="label mb-0.5">Recent movement</div>
          <div className={`font-mono text-sm font-bold tnum mt-1 ${(coin.recentChangePct ?? 0) >= 0 ? 'text-verdigris' : 'text-oxblood'}`}>
            {formatRecentChangePct(coin.recentChangePct)} in 1m
          </div>
        </div>
        <div className="stat-cell">
          <div className="label mb-0.5">Archetype</div>
          <div className="text-sm text-ink mt-1">{coin.archetype} · {archetypePersonality(coin.archetype)}</div>
        </div>
        <div className="stat-cell">
          <div className="label mb-0.5">Typical cycle</div>
          <div className="font-mono text-xs text-ink-dim tnum mt-1">{formatTypicalCycle(coin)}</div>
        </div>
        <div className="stat-cell">
          <div className="label mb-0.5">Typical swing</div>
          <div className="font-mono text-xs text-ink-dim tnum mt-1">{formatTypicalSwing(coin)}</div>
        </div>
      </div>

      {/* Owned position economics — server-owned holding fields verbatim. */}
      {owned && holding && (
        <div className="position-economics mb-5" aria-label={`Position ${pnlWord}`}>
          <div className="label mb-2">Your position</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
            <div className="stat-cell">
              <div className="label mb-0.5">Quantity</div>
              <div className="font-mono text-sm text-ink tnum mt-1">{formatQuantity(holding.quantity)} {coin.symbol}</div>
            </div>
            <div className="stat-cell">
              <div className="label mb-0.5">Avg entry</div>
              <div className="font-mono text-sm text-ink tnum mt-1">
                {holding.averageEntryPrice === null ? '—' : formatCurrency(holding.averageEntryPrice)}
              </div>
            </div>
            <div className="stat-cell">
              <div className="label mb-0.5">Cost basis</div>
              <div className="font-mono text-sm text-ink tnum mt-1">{formatCurrency(holding.costBasis)}</div>
            </div>
            <div className="stat-cell">
              <div className="label mb-0.5">Current price</div>
              <div className="font-mono text-sm text-ink tnum mt-1">{formatCurrency(holding.currentPrice)}</div>
            </div>
            <div className="stat-cell">
              <div className="label mb-0.5">Position value</div>
              <div className="font-mono text-sm font-bold text-ink tnum mt-1">{formatCurrency(holding.currentValue)}</div>
            </div>
            <div className="stat-cell">
              <div className="label mb-0.5">P&amp;L</div>
              <div className={`font-mono text-sm font-bold tnum mt-1 ${pnlClass}`}>
                {formatSignedGbp(holding.unrealizedPnl)} ({formatSignedPct(holding.unrealizedPnlPct)}) {pnlWord}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Larger authoritative per-coin chart: short cycle windows first.
          There is no cycle in the persistent market — the chart is never
          clipped to an apocalypse; the average-entry marker appears only
          when it sits inside the visible window. */}
      <div className="mb-5">
        <div className="label mb-3">Price history</div>
        <PriceChart
          key={coin.coinId}
          coinId={coin.coinId}
          ranges={DETAIL_PRIMARY_RANGES}
          secondaryRanges={DETAIL_SECONDARY_RANGES}
          initialRange={initialRange}
          cycleStartTime={null}
          averageEntryPrice={owned && holding ? holding.averageEntryPrice : null}
          heightClass="h-[280px] sm:h-[440px]"
        />
      </div>

      {/* Trade area: explicit controls only. The shared persistent trade
          panel owns confirmation, gating, the authoritative trade() call
          and verbatim server rejections; the browser never derives Cash,
          P&L, limits or trade success. */}
      {coin.dead ? (
        owned && (
          <div>
            <div className="label mb-2">Persistent trading</div>
            <PersistentTradePanel coin={legacyCoin} />
          </div>
        )
      ) : (
        <div>
          <div className="label mb-2">Persistent trading</div>
          <PersistentTradePanel coin={legacyCoin} />
        </div>
      )}
    </div>
  );
}
