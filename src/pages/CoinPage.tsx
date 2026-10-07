import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, Flame, Gem, Moon, Skull, TrendingUp, Zap, Dices, AlertTriangle } from 'lucide-react';
import { usePersistent } from '../context/PersistentContext.tsx';
import { usePageTitle } from '../hooks/usePageTitle.ts';
import { useCoinCatalogue } from '../hooks/useCoinCatalogue.ts';
import { usePersistentCountdownTick } from '../hooks/usePersistentCountdown.ts';
import { useShellServices } from '../components/shell/shellServices.ts';
import { CandlestickChart } from '../components/CandlestickChart.tsx';
import { CoinEventTimeline } from '../components/CoinEventTimeline.tsx';
import { TradeTicket } from '../components/TradeTicket.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Delta } from '../components/ui/Delta.tsx';
import { Price } from '../components/ui/Price.tsx';
import { CoinAvatar } from '../components/ui/CoinAvatar.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Button, ButtonLink } from '../components/ui/Button.tsx';
import { InfoTip } from '../components/ui/InfoTip.tsx';
import { formatCurrency } from '../services/transactionService.ts';
import type { PersistentArchetype, PersistentRuntimeEvent } from '../services/persistentService.ts';
import {
  archetypePersonality,
  derivedServerNowMs,
  formatQuantity,
  formatSignedGbp,
  formatSignedPct,
  momentumArrow
} from '../utils/gameLogic.ts';
import { formatPrice } from '../utils/formatPrice.ts';
import { eventProgress } from '../utils/worldEvents.ts';
import { formatModifierPct } from '../utils/formatModifierPct.ts';
import { sparklineRangeForCoin } from '../utils/sparkline.ts';
import type { CoinChartRange } from '../utils/marketHistoryChart.ts';

// Coin page: identity hero, candlestick chart, stats, active events, event
// history, position and the shared TradeTicket. Current coin data resolves
// from the shared persistent signals/runtime; the chart (price history), the
// event history (events feed) and catalogue stats each own their read and
// are never blended into each other's figures.

const COIN_CHART_RANGES_UI: readonly CoinChartRange[] = ['5M', '10M', '30M', '1H', '2H', '12H'];

const ARCHETYPE_ICON: Record<PersistentArchetype, typeof Zap> = {
  ZIP: Zap,
  MOON: Moon,
  BULL: TrendingUp,
  HODL: Gem,
  DEGEN: Dices,
  RUG: AlertTriangle
};

export function CoinPage() {
  const params = useParams<{ coinId: string }>();
  const coinId = Number(params.coinId);
  const { signals, account, runtime, runtimeSyncedAt } = usePersistent();
  const { openTrade } = useShellServices();

  const coin = Number.isInteger(coinId) && signals
    ? signals.coins.find((c) => c.coinId === coinId) ?? null
    : null;

  usePageTitle(coin ? `${coin.name} (${coin.symbol}) · Crypto Chaos` : 'Coin · Crypto Chaos');

  const holding = account?.holdings.find((h) => h.coinId === coinId) ?? null;
  const owned = !!holding && holding.quantity > 0;
  const nowLocal = usePersistentCountdownTick(true);

  // Loading skeleton until signals arrive.
  if (signals === null) {
    return (
      <div className="game-shell py-4 sm:py-6">
        <Card className="p-6"><Skeleton lines={4} className="h-6" /></Card>
      </div>
    );
  }

  // Unknown id → friendly not-found state.
  if (coin === null) {
    return (
      <div className="game-shell py-10">
        <EmptyState
          title="This coin is not on the board"
          body="It may have been removed from the market, or the link is wrong."
          action={<ButtonLink to="/" variant="primary">Back to the market</ButtonLink>}
        />
      </div>
    );
  }

  const director = runtime?.director ?? null;
  const isGolden = director?.goldenCoinId === coin.coinId;
  const isDemon = director?.demonCoinId === coin.coinId;
  const runtimeCoin = runtime?.coins.find((c) => c.coinId === coin.coinId) ?? null;
  const activeEvents = runtimeCoin
    ? [
        ...runtimeCoin.events.positive.map((event) => ({ event, kind: 'positive' as const })),
        ...runtimeCoin.events.negative.map((event) => ({ event, kind: 'negative' as const }))
      ]
    : [];
  const netPct = runtimeCoin?.activeNetModifierPct ?? 0;
  const serverNowMs = runtime
    ? derivedServerNowMs(runtime.serverTime, runtimeSyncedAt ?? Date.now(), nowLocal)
    : nowLocal;

  const ArchetypeIcon = ARCHETYPE_ICON[coin.archetype];
  const pnlWord = holding && holding.unrealizedPnl >= 0 ? 'profit' : 'loss';

  return (
    <div className={`game-shell py-4 sm:py-6 ${coin.dead ? '' : 'pb-24 lg:pb-6'}`}>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute hover:text-brand transition-colors min-h-[44px] mb-3">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Market
      </Link>

      {/* Hero */}
      <Card className="p-5 sm:p-6 mb-4">
        <div className="flex flex-wrap items-start gap-4">
          <CoinAvatar symbol={coin.symbol} coinId={coin.coinId} size="lg" dead={coin.dead} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink leading-tight">{coin.name}</h1>
              <Badge tone="neutral">
                <ArchetypeIcon className="w-3.5 h-3.5" aria-hidden="true" />
                {coin.archetype}
              </Badge>
              <InfoTip label={coin.archetype} text={archetypePersonality(coin.archetype)} />
              {isGolden && (
                <Badge tone="golden"><Crown className="w-3.5 h-3.5" aria-hidden="true" /> Golden</Badge>
              )}
              {isDemon && (
                <Badge tone="demon"><Flame className="w-3.5 h-3.5" aria-hidden="true" /> Demon</Badge>
              )}
              {coin.dead && (
                <Badge tone="down"><Skull className="w-3.5 h-3.5" aria-hidden="true" /> Dead</Badge>
              )}
            </div>
            <p className="text-sm text-ink-mute mt-1">
              {coin.symbol}/GBP · {archetypePersonality(coin.archetype)}
            </p>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1 mt-3">
              <span className={`numeral text-4xl sm:text-5xl ${coin.dead ? 'text-ink-mute' : 'text-ink'}`}>
                {coin.dead ? '£0.00' : <Price value={coin.currentPrice} flash className="text-inherit" />}
              </span>
              {!coin.dead && (
                <>
                  <Delta pct={coin.recentChangePct} className="text-lg" />
                  <span className="text-sm text-ink-mute">Momentum {momentumArrow(coin.momentum)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {coin.dead && (
        <Card className="p-4 mb-4 border-down/50 flex items-center gap-3" role="note">
          <Skull className="w-5 h-5 text-down shrink-0" aria-hidden="true" />
          <p className="text-sm text-ink-dim">
            <strong className="text-down">Dead · trading stopped permanently · holdings worth £0.00.</strong>{' '}
            Its history is preserved below.
          </p>
        </Card>
      )}

      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2 min-w-0 space-y-4">
          {/* Chart */}
          <Card className="p-4 sm:p-5">
            <CandlestickChart
              key={coin.coinId}
              coinId={coin.coinId}
              ranges={COIN_CHART_RANGES_UI}
              initialRange={sparklineRangeForCoin(coin)}
              cycleStartTime={null}
              averageEntryPrice={owned && holding ? holding.averageEntryPrice : null}
              heightClass="h-[260px] sm:h-[420px]"
              showCurrentPrice={false}
            />
          </Card>

          {/* Stats */}
          <CoinStats coinId={coin.coinId} />

          {/* Active events */}
          <Card className="p-4 sm:p-5" aria-label="Active events">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
              <h2 className="font-display font-bold text-ink">Active events</h2>
              <span className={`font-mono text-sm font-bold tnum ${netPct > 0 ? 'text-up' : netPct < 0 ? 'text-down' : 'text-ink-mute'}`}>
                Net {netPct === 0 ? '0%' : formatModifierPct(netPct, netPct > 0 ? 'positive' : 'negative')}
              </span>
            </div>
            <p className="text-xs text-ink-mute mb-3">Events nudge this coin's price while active.</p>
            {activeEvents.length === 0 ? (
              <p className="text-sm text-ink-mute">No active events on this coin.</p>
            ) : (
              <ul className="space-y-3">
                {activeEvents.map(({ event, kind }) => (
                  <EventBar key={event.eventId} event={event} kind={kind} serverNowMs={serverNowMs} />
                ))}
              </ul>
            )}
          </Card>

          {/* Event history (historical feed; hides itself if unavailable) */}
          <CoinEventTimeline key={coin.coinId} coinId={coin.coinId} serverNowMs={serverNowMs} />
        </div>

        {/* Right column: position + trade ticket (sticky on desktop) */}
        <div className="mt-4 lg:mt-0">
          <div className="lg:sticky lg:top-20 space-y-4">
            {owned && holding && (
              <Card className="p-4 sm:p-5" aria-label={`Your position — ${pnlWord}`}>
                <h2 className="font-display font-bold text-ink mb-3">Your position</h2>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="stat-cell">
                    <dt className="label mb-1">Quantity</dt>
                    <dd className="font-mono text-ink tnum">{formatQuantity(holding.quantity)} {coin.symbol}</dd>
                  </div>
                  <div className="stat-cell">
                    <dt className="label mb-1">Avg entry</dt>
                    <dd className="font-mono text-ink tnum">
                      {holding.averageEntryPrice === null ? '—' : formatPrice(holding.averageEntryPrice)}
                    </dd>
                  </div>
                  <div className="stat-cell">
                    <dt className="label mb-1">Cost basis</dt>
                    <dd className="font-mono text-ink tnum">{formatCurrency(holding.costBasis)}</dd>
                  </div>
                  <div className="stat-cell">
                    <dt className="label mb-1">Current price</dt>
                    <dd className="font-mono text-ink tnum">{formatPrice(coin.currentPrice)}</dd>
                  </div>
                  <div className="stat-cell">
                    <dt className="label mb-1">Value</dt>
                    <dd className="font-mono font-bold text-ink tnum">{formatCurrency(holding.currentValue)}</dd>
                  </div>
                  <div className="stat-cell">
                    <dt className="label mb-1">P&amp;L</dt>
                    <dd className={`font-mono font-bold tnum ${holding.unrealizedPnl >= 0 ? 'text-up' : 'text-down'}`}>
                      {formatSignedGbp(holding.unrealizedPnl)} ({formatSignedPct(holding.unrealizedPnlPct)}) {pnlWord}
                    </dd>
                  </div>
                </dl>
              </Card>
            )}

            {!coin.dead && (
              <Card className="p-4 sm:p-5 hidden lg:block" aria-label="Trade">
                <h2 className="font-display font-bold text-ink mb-4">Trade {coin.symbol}</h2>
                <TradeTicket coinId={coin.coinId} />
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky action bar (above the tab bar). */}
      {!coin.dead && (
        <div className="lg:hidden fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] inset-x-0 z-30 px-4">
          <div className="flex gap-2 max-w-md mx-auto rounded-xl border border-rule bg-surface-3/95 backdrop-blur-md p-2 shadow-overlay">
            <Button variant="buy" className="flex-1" onClick={() => openTrade(coin.coinId, 'BUY')}>
              <TrendingUp className="w-4 h-4" aria-hidden="true" /> Buy
            </Button>
            <Button variant="sell" className="flex-1" onClick={() => openTrade(coin.coinId, 'SELL')}>
              Sell
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Catalogue stats (one-shot /coins/:id read, hides on failure) ---------------

function CoinStats({ coinId }: { coinId: number }) {
  const { coin, error } = useCoinCatalogue(coinId);
  if (error || !coin) return null;
  return (
    <Card className="p-4 sm:p-5" aria-label="Coin statistics">
      <h2 className="font-display font-bold text-ink mb-3">Statistics</h2>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div className="stat-cell">
          <dt className="label mb-1">Market cap</dt>
          <dd className="font-mono text-ink tnum">{coin.market_cap}</dd>
        </div>
        <div className="stat-cell">
          <dt className="label mb-1">Circulating</dt>
          <dd className="font-mono text-ink tnum">{coin.circulating_supply.toLocaleString('en-GB')}</dd>
        </div>
        <div className="stat-cell">
          <dt className="label mb-1">24h change</dt>
          <dd className="tnum"><Delta pct={coin.price_change_24h} windowLabel="over 24 hours" /></dd>
        </div>
        <div className="stat-cell">
          <dt className="label mb-1">Founder</dt>
          <dd className="text-ink truncate">{coin.founder || '—'}</dd>
        </div>
      </dl>
    </Card>
  );
}

// --- Event bar --------------------------------------------------------------------

function EventBar({
  event,
  kind,
  serverNowMs
}: {
  event: PersistentRuntimeEvent;
  kind: 'positive' | 'negative';
  serverNowMs: number;
}) {
  const progress = eventProgress(event, serverNowMs);
  const endsMs = Date.parse(event.endsAt);
  const leftMs = Number.isFinite(endsMs) ? Math.max(0, endsMs - serverNowMs) : 0;
  const leftText = leftMs <= 0
    ? 'Ending…'
    : (() => {
        const totalSeconds = Math.floor(leftMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return minutes > 0 ? `${minutes}m ${seconds}s left` : `${seconds}s left`;
      })();
  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1">
        <span className="text-sm text-ink min-w-0">{event.name}</span>
        <span className="flex items-center gap-3 shrink-0">
          <span className={`font-mono text-xs font-bold tnum ${kind === 'positive' ? 'text-up' : 'text-down'}`}>
            {formatModifierPct(event.modifierPct, kind)}
          </span>
          <span className="font-mono text-xs text-ink-mute tnum">{leftText}</span>
        </span>
      </div>
      <div
        className="event-progress"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${event.name} elapsed`}
      >
        <div className="event-progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </li>
  );
}
