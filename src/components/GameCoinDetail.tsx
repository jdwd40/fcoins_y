import { Skull } from 'lucide-react';
import { PriceChart } from './PriceChart';
import { PersistentTradePanel } from './PersistentTradePanel.tsx';
import { usePersistent } from '../context/PersistentContext.tsx';
import { formatCurrency } from '../services/transactionService.ts';
import type { PersistentCoinSignal } from '../services/persistentService.ts';
import type { PersistentHolding, PersistentRuntimeEvent } from '../services/persistentService.ts';
import {
  archetypePersonality,
  formatQuantity,
  formatRecentChangePct,
  formatSignedGbp,
  formatSignedPct,
  momentumArrow
} from '../utils/persistentGameLogic.ts';
import { sparklineRangeForCoin } from '../utils/sparkline.ts';
import { formatRemaining, remainingMs } from '../utils/persistentCountdown.ts';
import { usePersistentCountdownTick } from '../hooks/usePersistentCountdown.ts';
import type { Coin, TimeRange } from '../types';

// Issue #13: the detailed V2 coin view. Opened from any primary market
// card's non-trade area (via GameMarketGrid's modal), it is where the
// secondary information lives — the compact card stays a fast
// read-and-trade surface.
//
// Everything here is public, already-happened data: the shared persistent
// signals (momentum, archetype, recent movement), the server-owned holding
// economics, runtime Director roles + active coin events, and the
// authoritative per-coin price-history. No hidden or future market
// information exists in these contracts and none is rendered.

const DETAIL_PRIMARY_RANGES: readonly TimeRange[] = ['5M', '10M', '30M', '1H', '2H'];
const DETAIL_SECONDARY_RANGES: readonly TimeRange[] = [];

interface GameCoinDetailProps {
  coin: PersistentCoinSignal;
  /** The player's PERSISTENT holding in this coin (server-owned economics). */
  holding: PersistentHolding | null;
}

function formatNetModifier(pct: number): string {
  if (pct === 0) return '0%';
  const rounded = Math.round(pct * 10000) / 10000;
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${Math.abs(rounded)}%`;
}

function formatSignedModifier(pct: number): string {
  if (pct === 0) return '0%';
  const sign = pct > 0 ? '+' : '−';
  return `${sign}${Math.abs(pct)}%`;
}

function EventRow({
  event,
  serverTime,
  receivedAtLocal,
  nowLocal
}: {
  event: PersistentRuntimeEvent;
  serverTime: string;
  receivedAtLocal: number;
  nowLocal: number;
}) {
  const left = formatRemaining(remainingMs(event.endsAt, serverTime, receivedAtLocal, nowLocal));
  const modClass = event.modifierPct >= 0 ? 'text-verdigris' : 'text-oxblood';
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-1.5 border-b border-rule last:border-0">
      <span className="text-sm text-ink min-w-0">{event.name}</span>
      <span className="flex items-center gap-3 shrink-0">
        <span className={`font-mono text-xs font-bold tnum ${modClass}`}>
          {formatSignedModifier(event.modifierPct)}
        </span>
        <span className="font-mono text-xs text-ink-mute tnum" aria-label={`Ends in ${left}`}>
          {left}
        </span>
      </span>
    </li>
  );
}

export function GameCoinDetail({ coin, holding }: GameCoinDetailProps) {
  const { runtime, runtimeSyncedAt } = usePersistent();
  const nowLocal = usePersistentCountdownTick(true);
  const owned = !!holding && holding.quantity > 0;

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

  const initialRange = sparklineRangeForCoin(coin);

  const pnlClass = holding && holding.unrealizedPnl >= 0 ? 'text-verdigris' : 'text-oxblood';
  const pnlWord = holding && holding.unrealizedPnl >= 0 ? 'profit' : 'loss';

  const director = runtime?.director ?? null;
  const isGolden = director?.goldenCoinId === coin.coinId;
  const isDemon = director?.demonCoinId === coin.coinId;
  const runtimeCoin = runtime?.coins.find((c) => c.coinId === coin.coinId) ?? null;
  const positiveEvents = runtimeCoin?.events.positive ?? [];
  const negativeEvents = runtimeCoin?.events.negative ?? [];
  const netPct = runtimeCoin?.activeNetModifierPct ?? 0;
  const receivedAtLocal = runtimeSyncedAt ?? Date.now();
  const serverTime = runtime?.serverTime ?? new Date().toISOString();

  return (
    <div className="p-1 sm:p-2" aria-label={`${coin.name} detail`}>
      {/* Masthead: identity is traceable — id, name, symbol, live price. */}
      <div className="border-b border-rule pb-4 mb-4 pr-10">
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 label mb-1.5">
          <span>Coin {coin.coinId}</span>
          <span>·</span>
          <span>{coin.symbol}/GBP</span>
        </div>
        <h2 className="font-display text-2xl sm:text-4xl font-semibold text-ink leading-tight">
          {coin.name}
        </h2>
        {(isGolden || isDemon) && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Director roles">
            {isGolden && (
              <span className="inline-flex items-center rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-xs font-bold tracking-caps uppercase text-gold">
                Golden Coin
              </span>
            )}
            {isDemon && (
              <span className="inline-flex items-center rounded-md border border-oxblood/40 bg-oxblood/10 px-2 py-0.5 font-mono text-xs font-bold tracking-caps uppercase text-oxblood">
                Demon Coin
              </span>
            )}
          </div>
        )}
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

      {/* Public signal facts — every state is explicit text (persistent only). */}
      <div className="grid grid-cols-3 gap-2 mb-5" aria-label="Market signal detail">
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
      </div>

      {/* Runtime coin events — matched by coinId from GET /persistent/runtime. */}
      <div className="mb-5" aria-label="Active coin events">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <div className="label">Net event effect</div>
          <div
            className={`font-mono text-sm font-bold tnum ${
              netPct > 0 ? 'text-verdigris' : netPct < 0 ? 'text-oxblood' : 'text-ink-dim'
            }`}
          >
            {formatNetModifier(netPct)}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="stat-cell">
            <div className="label mb-1">Positive events</div>
            {positiveEvents.length === 0 ? (
              <p className="text-xs text-ink-mute">No active positive events.</p>
            ) : (
              <ul>
                {positiveEvents.map((event) => (
                  <EventRow
                    key={event.eventId}
                    event={event}
                    serverTime={serverTime}
                    receivedAtLocal={receivedAtLocal}
                    nowLocal={nowLocal}
                  />
                ))}
              </ul>
            )}
          </div>
          <div className="stat-cell">
            <div className="label mb-1">Negative events</div>
            {negativeEvents.length === 0 ? (
              <p className="text-xs text-ink-mute">No active negative events.</p>
            ) : (
              <ul>
                {negativeEvents.map((event) => (
                  <EventRow
                    key={event.eventId}
                    event={event}
                    serverTime={serverTime}
                    receivedAtLocal={receivedAtLocal}
                    nowLocal={nowLocal}
                  />
                ))}
              </ul>
            )}
          </div>
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
              <div className="font-mono text-sm text-ink tnum mt-1">{formatCurrency(coin.currentPrice)}</div>
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

      {/* Larger authoritative per-coin chart: short cycle windows only
          (5M–2H — BE has no 5M/12H; 5M is client-windowed from 10M). There is no
          cycle in the persistent market — the chart is never clipped to an
          apocalypse; the average-entry marker appears only when it sits
          inside the visible window. */}
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
