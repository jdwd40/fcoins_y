import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Crown, HelpCircle, Skull, TrendingDown, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePersistent } from '../context/PersistentContext.tsx';
import { usePageTitle } from '../hooks/usePageTitle.ts';
import { usePersistentTransactions } from '../hooks/usePersistentTransactions.ts';
import { useShellServices } from '../components/shell/shellServices.ts';
import { CoinSparkline } from '../components/CoinSparkline.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Delta } from '../components/ui/Delta.tsx';
import { Price } from '../components/ui/Price.tsx';
import { CoinAvatar } from '../components/ui/CoinAvatar.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { InlineAlert } from '../components/ui/InlineAlert.tsx';
import { InfoTip } from '../components/ui/InfoTip.tsx';
import { formatCurrency } from '../services/transactionService.ts';
import type { PersistentCoinSignal, PersistentHolding } from '../services/persistentService.ts';
import {
  formatQuantity,
  formatSignedGbp,
  formatSignedPct
} from '../utils/gameLogic.ts';
import {
  BOARD_FILTERS,
  BOARD_SORTS,
  filterBoardCoins,
  sortBoardCoins,
  topMovers,
  type BoardFilter,
  type BoardSort
} from '../utils/marketBoard.ts';
import { collectActiveEvents, coinIdsWithEvents, soonestEndingEvents } from '../utils/worldEvents.ts';
import { topEntriesWithSelf } from '../utils/leaderboardGap.ts';
import { formatModifierPct } from '../utils/formatModifierPct.ts';
import { formatRemaining, remainingMs } from '../utils/persistentCountdown.ts';
import { usePersistentCountdownTick } from '../hooks/usePersistentCountdown.ts';

// Market (home): account summary, top movers, the market board, and the
// right rail (leaderboard peek, live events, recent activity).

export function MarketPage() {
  usePageTitle('Market · Crypto Chaos');
  const { user } = useAuth();
  const { signals, signalsError, account, runtime } = usePersistent();

  const [filter, setFilter] = useState<BoardFilter>('all');
  const [sort, setSort] = useState<BoardSort>('featured');
  const [graveyardOpen, setGraveyardOpen] = useState(false);

  const holdingByCoinId = useMemo(
    () => new Map((account?.holdings ?? []).map((h) => [h.coinId, h])),
    [account]
  );
  const isOwned = (coinId: number) => (holdingByCoinId.get(coinId)?.quantity ?? 0) > 0;
  const eventCoinIds = useMemo(() => coinIdsWithEvents(runtime), [runtime]);

  const movers = useMemo(() => topMovers(signals?.coins ?? []), [signals]);
  const boardCoins = useMemo(() => {
    if (!signals) return [];
    return sortBoardCoins(filterBoardCoins(signals.coins, filter, isOwned, (id) => eventCoinIds.has(id)), sort, isOwned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, filter, sort, holdingByCoinId, eventCoinIds]);
  const deadCoins = useMemo(() => (signals?.coins ?? []).filter((coin) => coin.dead), [signals]);

  return (
    <div className="game-shell py-4 sm:py-6">
      {user ? <AccountSummaryCard /> : <SignedOutHero />}

      {signals !== null && (movers.rising.length > 0 || movers.falling.length > 0) && (
        <section aria-label="Top movers" className="mt-5">
          <div className="flex gap-4 overflow-x-auto world-strip-scroll pb-1">
            {movers.rising.length > 0 && (
              <MoverGroup label="Rising" icon={<TrendingUp className="w-3.5 h-3.5 text-up" aria-hidden="true" />} coins={movers.rising} />
            )}
            {movers.falling.length > 0 && (
              <MoverGroup label="Falling" icon={<TrendingDown className="w-3.5 h-3.5 text-down" aria-hidden="true" />} coins={movers.falling} />
            )}
          </div>
        </section>
      )}

      <div className="mt-5 lg:grid lg:grid-cols-3 lg:gap-6">
        <section aria-label="Market board" className="lg:col-span-2 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter coins">
              {BOARD_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`chip min-h-[36px] transition-colors ${
                    filter === f.id ? 'border-brand text-brand bg-accent-soft' : 'hover:border-rule-strong'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-mute">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as BoardSort)}
                className="bg-surface-2 border border-rule rounded-lg text-sm text-ink px-2 py-1.5 min-h-[36px]"
              >
                {BOARD_SORTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>

          {signalsError && (
            <InlineAlert tone="warn" className="mb-3">
              Market update failed — showing the last update. {signalsError}
            </InlineAlert>
          )}

          {signals === null ? (
            <Card className="p-4 space-y-3" aria-label="Loading market">
              <Skeleton className="h-14" lines={5} />
            </Card>
          ) : signals.coins.length === 0 ? (
            <EmptyState
              title="No coins in the market yet"
              body="The market is quiet right now. Coins appear here as soon as a world is running."
            />
          ) : boardCoins.length === 0 ? (
            <EmptyState
              title="Nothing matches this filter"
              body="Try a different filter — the full board is under All."
              action={<Button variant="ghost" onClick={() => setFilter('all')}>Show all coins</Button>}
            />
          ) : (
            <Card className="overflow-hidden">
              {/* Desktop rows */}
              <div className="hidden md:block">
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] gap-x-4 items-center px-4 py-2 border-b border-rule label" aria-hidden="true">
                  <span>Coin</span><span>Price</span><span>1m</span><span>Spark</span><span>Your position</span><span className="sr-only">Trade</span>
                </div>
                <ul className="divide-rule">
                  {boardCoins.map((coin) => (
                    <BoardRow
                      key={coin.coinId}
                      coin={coin}
                      holding={holdingByCoinId.get(coin.coinId) ?? null}
                      hasEvents={eventCoinIds.has(coin.coinId)}
                    />
                  ))}
                </ul>
              </div>
              {/* Phone cards */}
              <ul className="md:hidden divide-rule">
                {boardCoins.map((coin) => (
                  <BoardCard
                    key={coin.coinId}
                    coin={coin}
                    holding={holdingByCoinId.get(coin.coinId) ?? null}
                    hasEvents={eventCoinIds.has(coin.coinId)}
                  />
                ))}
              </ul>
            </Card>
          )}

          {deadCoins.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setGraveyardOpen((v) => !v)}
                aria-expanded={graveyardOpen}
                className="flex items-center gap-2 min-h-[44px] text-sm font-semibold text-ink-mute hover:text-ink transition-colors"
              >
                <Skull className="w-4 h-4 text-down" aria-hidden="true" />
                Graveyard · {deadCoins.length} dead coin{deadCoins.length === 1 ? '' : 's'} — trading has stopped permanently
                <ChevronDown className={`w-4 h-4 transition-transform ${graveyardOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {graveyardOpen && (
                <Card className="overflow-hidden mt-1">
                  <ul className="divide-rule">
                    {deadCoins.map((coin) => (
                      <li key={coin.coinId} className="opacity-70">
                        <Link
                          to={`/coin/${coin.coinId}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                        >
                          <CoinAvatar symbol={coin.symbol} coinId={coin.coinId} size="sm" dead />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-ink-dim truncate">{coin.name}</span>
                            <span className="block text-xs text-ink-mute font-mono">{coin.symbol} · Dead</span>
                          </span>
                          <Badge tone="down">
                            <Skull className="w-3 h-3" aria-hidden="true" /> Dead · £0.00
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </section>

        <RightRail />
      </div>
    </div>
  );
}

// --- Signed-out hero ---------------------------------------------------------

function SignedOutHero() {
  const { openAuth, openHowToPlay } = useShellServices();
  return (
    <Card className="p-6 sm:p-10 text-center overflow-hidden">
      <p className="label text-brand mb-3">The after-hours exchange</p>
      <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-ink leading-tight max-w-2xl mx-auto">
        A fantasy coin market that never sleeps.
      </h1>
      <p className="text-ink-dim text-sm sm:text-base mt-4 max-w-xl mx-auto">
        Coins rise, fall and die around the clock while the Director stirs the pot. Start with
        £10,000 virtual cash and out-trade the bots.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
        <Button variant="primary" onClick={() => openAuth('register')} className="w-full sm:w-auto">
          Start with £10,000 virtual cash
        </Button>
        <Button variant="ghost" onClick={openHowToPlay} className="w-full sm:w-auto">
          <HelpCircle className="w-4 h-4" aria-hidden="true" /> How to play
        </Button>
      </div>
      <p className="text-xs text-ink-mute mt-4">Virtual GBP only — no real money, ever.</p>
    </Card>
  );
}

// --- Account summary (signed in) ----------------------------------------------

function AccountSummaryCard() {
  const { account, synced, provisioned, accountError, myEntry, leaderboard, syncNow } = usePersistent();

  if (!synced) {
    return (
      <Card className="p-6" aria-label="Your account">
        <div className="label mb-2">Your account</div>
        <Skeleton className="h-10 w-48 mb-3" />
        <p className="text-sm text-ink-dim" role="status">Syncing your account…</p>
      </Card>
    );
  }

  if (accountError !== null && account === null) {
    return (
      <Card className="p-6" aria-label="Your account">
        <InlineAlert tone="error" className="mb-3">Your account is unavailable — {accountError}</InlineAlert>
        <Button variant="ghost" onClick={() => void syncNow()}>Retry</Button>
      </Card>
    );
  }

  if (!provisioned || account === null) {
    return (
      <Card className="p-6" aria-label="Your account">
        <div className="label mb-2">Your account</div>
        <p className="text-sm text-ink-dim">
          Your account is set up with your first trade — the starting cash is added when it
          goes through. Pick a coin below to begin.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6" aria-label="Your account">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="label mb-1">
            Net worth
            <InfoTip label="Net worth" text="Cash plus the live value of your holdings, minus any debt. This is your leaderboard score." />
          </div>
          <div className="numeral text-4xl sm:text-5xl text-ink">{formatCurrency(account.netWealth)}</div>
        </div>
        <div className="flex gap-6 sm:gap-8">
          <div>
            <div className="label mb-1">Cash</div>
            <div className="font-mono text-lg font-semibold text-ink tnum">{formatCurrency(account.cash)}</div>
          </div>
          <div>
            <div className="label mb-1">Holdings</div>
            <div className="font-mono text-lg font-semibold text-ink tnum">{formatCurrency(account.holdingsValue)}</div>
          </div>
          {myEntry && leaderboard && (
            <Link to="/leaderboard" className="group">
              <div className="label mb-1 group-hover:text-brand transition-colors">Rank</div>
              <div className="font-mono text-lg font-semibold text-brand tnum">
                #{myEntry.rank} <span className="text-ink-mute font-normal">of {leaderboard.entries.length}</span>
              </div>
            </Link>
          )}
        </div>
      </div>
      {accountError && (
        <p className="text-xs text-warn mt-3" role="status">
          Account refresh failed — showing the last synced figures. {accountError}
        </p>
      )}
    </Card>
  );
}

// --- Top movers -----------------------------------------------------------------

function MoverGroup({ label, icon, coins }: { label: string; icon: ReactNode; coins: PersistentCoinSignal[] }) {
  return (
    <div className="flex items-center gap-2 flex-none">
      <span className="label flex items-center gap-1">{icon}{label}</span>
      {coins.map((coin) => (
        <Link
          key={coin.coinId}
          to={`/coin/${coin.coinId}`}
          className="chip hover:border-brand transition-colors"
          aria-label={`${coin.name}, ${coin.recentChangePct !== null && coin.recentChangePct >= 0 ? 'up' : 'down'} ${Math.abs(coin.recentChangePct ?? 0).toFixed(2)} percent in the last minute`}
        >
          <span className="font-mono font-bold">{coin.symbol}</span>
          <Delta pct={coin.recentChangePct} className="text-xs" />
        </Link>
      ))}
    </div>
  );
}

// --- Board rows -------------------------------------------------------------------

function RoleBadges({ coin }: { coin: PersistentCoinSignal }) {
  const { runtime } = usePersistent();
  const director = runtime?.director ?? null;
  return (
    <>
      {director?.goldenCoinId === coin.coinId && (
        <Badge tone="golden"><Crown className="w-3 h-3" aria-hidden="true" /> Golden</Badge>
      )}
      {director?.demonCoinId === coin.coinId && (
        <Badge tone="demon">Demon</Badge>
      )}
    </>
  );
}

function BoardRow({
  coin,
  holding,
  hasEvents
}: {
  coin: PersistentCoinSignal;
  holding: PersistentHolding | null;
  hasEvents: boolean;
}) {
  const { openTrade } = useShellServices();
  const owned = !!holding && holding.quantity > 0;
  return (
    <li className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] gap-x-4 items-center px-4 py-3 hover:bg-surface-2 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <CoinAvatar symbol={coin.symbol} coinId={coin.coinId} size="sm" />
        <div className="min-w-0">
          <Link to={`/coin/${coin.coinId}`} className="font-semibold text-ink hover:text-brand transition-colors truncate block">
            {coin.name}
          </Link>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-ink-mute font-mono">{coin.symbol}</span>
            <RoleBadges coin={coin} />
            {hasEvents && <Badge tone="brand">Event</Badge>}
          </div>
        </div>
      </div>
      <div className="text-ink font-semibold"><Price value={coin.currentPrice} flash /></div>
      <div><Delta pct={coin.recentChangePct} /></div>
      <div className="w-full max-w-[140px]"><CoinSparkline coin={coin} cycleStartTime={null} /></div>
      <div className="font-mono text-xs tnum">
        {owned && holding ? (
          <span className={holding.unrealizedPnl >= 0 ? 'text-up' : 'text-down'}>
            {formatCurrency(holding.currentValue)}
            <span className="block text-ink-mute">{formatSignedGbp(holding.unrealizedPnl)} ({formatSignedPct(holding.unrealizedPnlPct)})</span>
          </span>
        ) : (
          <span className="text-ink-mute">—</span>
        )}
      </div>
      <div>
        <Button variant="subtle" className="min-h-[44px]" onClick={() => openTrade(coin.coinId, owned ? 'SELL' : 'BUY')}>
          Trade
        </Button>
      </div>
    </li>
  );
}

function BoardCard({
  coin,
  holding,
  hasEvents
}: {
  coin: PersistentCoinSignal;
  holding: PersistentHolding | null;
  hasEvents: boolean;
}) {
  const { openTrade } = useShellServices();
  const owned = !!holding && holding.quantity > 0;
  return (
    <li className="relative px-4 py-2">
      {/* Whole card navigates via a real link; the Trade button sits above it. */}
      <Link
        to={`/coin/${coin.coinId}`}
        className="absolute inset-0 rounded-none"
        aria-label={`${coin.name} (${coin.symbol}) — open coin page`}
      />
      <div className="relative pointer-events-none">
        {/* Line 1: avatar · name (all remaining width) · price + 1m delta. */}
        <div className="flex items-center gap-2.5">
          <CoinAvatar symbol={coin.symbol} coinId={coin.coinId} size="sm" />
          <span className="min-w-0 flex-1 font-semibold text-ink truncate">{coin.name}</span>
          <div className="flex items-baseline gap-2 shrink-0">
            <span className="font-semibold text-ink"><Price value={coin.currentPrice} flash /></span>
            <Delta pct={coin.recentChangePct} className="text-xs" />
          </div>
        </div>
        {/* Line 2: symbol · role/event badges · sparkline · position · Trade. */}
        <div className="flex items-center gap-2 mt-1">
          <span className="shrink-0 text-xs text-ink-mute font-mono">
            {coin.symbol}
            <span className="hidden min-[380px]:inline"> · {coin.archetype}</span>
          </span>
          <RoleBadges coin={coin} />
          {hasEvents && <Badge tone="brand">Event</Badge>}
          <div className="flex-1 min-w-0">
            <CoinSparkline coin={coin} cycleStartTime={null} compact />
          </div>
          {owned && holding && (
            <span className={`font-mono text-xs tnum shrink-0 ${holding.unrealizedPnl >= 0 ? 'text-up' : 'text-down'}`}>
              {formatCurrency(holding.currentValue)} · {formatSignedPct(holding.unrealizedPnlPct)}
            </span>
          )}
          <span className="pointer-events-auto shrink-0">
            <Button variant="subtle" className="min-h-[44px]" onClick={() => openTrade(coin.coinId, owned ? 'SELL' : 'BUY')}>
              Trade
            </Button>
          </span>
        </div>
      </div>
    </li>
  );
}

// --- Right rail ---------------------------------------------------------------------

function RightRail() {
  return (
    <div className="mt-6 lg:mt-0 space-y-4 min-w-0">
      <LeaderboardPeek />
      <LiveEventsPeek />
      <RecentActivityPeek />
    </div>
  );
}

function LeaderboardPeek() {
  const { leaderboard, myEntry } = usePersistent();
  const entries = leaderboard?.entries ?? [];
  const peek = topEntriesWithSelf(entries, myEntry, 3);
  return (
    <Card className="p-4" aria-label="Leaderboard">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-ink">Leaderboard</h2>
        <Link to="/leaderboard" className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1 min-h-[44px]">
          Full board <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
      {peek.length === 0 ? (
        <p className="text-sm text-ink-mute">No competitors on the board yet.</p>
      ) : (
        <ol className="space-y-2">
          {peek.map((entry) => (
            <li
              key={entry.accountId}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${myEntry?.accountId === entry.accountId ? 'leaderboard-me' : ''}`}
              aria-current={myEntry?.accountId === entry.accountId ? 'true' : undefined}
            >
              <span className="font-mono text-sm font-bold text-ink-mute tnum w-7">#{entry.rank}</span>
              {entry.rank === 1 && <Crown className="w-3.5 h-3.5 text-golden" aria-label="Leader" />}
              <span className="text-sm text-ink truncate flex-1">
                {entry.username}
                {entry.isBot && <span className="text-xs text-ink-mute"> · Bot</span>}
              </span>
              <span className={`font-mono text-sm tnum ${entry.netWorth < 0 ? 'text-down' : 'text-ink'}`}>
                {formatCurrency(entry.netWorth)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function LiveEventsPeek() {
  const { runtime, runtimeSyncedAt, signals } = usePersistent();
  const nowLocal = usePersistentCountdownTick(true);
  const events = soonestEndingEvents(collectActiveEvents(runtime), 5);
  const coinById = new Map((signals?.coins ?? []).map((c) => [c.coinId, c]));
  const receivedAtLocal = runtimeSyncedAt ?? Date.now();
  const serverTime = runtime?.serverTime ?? new Date().toISOString();

  return (
    <Card className="p-4" aria-label="Live events">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-ink">Live events</h2>
        <Link to="/world" className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1 min-h-[44px]">
          World <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-ink-mute">No live coin events right now.</p>
      ) : (
        <ul className="space-y-2">
          {events.map(({ coinId, kind, event }) => (
            <li key={event.eventId} className="flex items-center gap-2 text-sm">
              <Link to={`/coin/${coinId}`} className="font-mono font-bold text-brand hover:underline shrink-0">
                {coinById.get(coinId)?.symbol ?? `#${coinId}`}
              </Link>
              <span className="text-ink-dim truncate flex-1">{event.name}</span>
              <span className={`font-mono text-xs font-bold tnum ${kind === 'positive' ? 'text-up' : 'text-down'}`}>
                {formatModifierPct(event.modifierPct, kind)}
              </span>
              <span className="font-mono text-xs text-ink-mute tnum shrink-0" aria-label={`Ends in ${formatRemaining(remainingMs(event.endsAt, serverTime, receivedAtLocal, nowLocal))}`}>
                {formatRemaining(remainingMs(event.endsAt, serverTime, receivedAtLocal, nowLocal))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentActivityPeek() {
  const { user } = useAuth();
  const { transactions } = usePersistentTransactions(5);
  if (!user) return null;
  return (
    <Card className="p-4" aria-label="Your recent activity">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-ink">Recent activity</h2>
        <Link to="/portfolio" className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1 min-h-[44px]">
          Portfolio <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
      {transactions === null ? (
        <Skeleton lines={3} className="h-4" />
      ) : transactions.length === 0 ? (
        <p className="text-sm text-ink-mute">No trades yet — your buys and sells will appear here.</p>
      ) : (
        <ul className="space-y-2">
          {transactions.map((tx) => (
            <li key={tx.persistentTransactionId} className="flex items-center gap-2 text-sm">
              <Badge tone={tx.type === 'BUY' ? 'up' : 'down'}>
                {tx.type === 'BUY' ? '▲ Buy' : '▼ Sell'}
              </Badge>
              <Link to={`/coin/${tx.coinId}`} className="font-mono font-bold text-ink hover:text-brand shrink-0">
                {tx.symbol}
              </Link>
              <span className="text-xs text-ink-mute truncate flex-1">
                {formatQuantity(tx.quantity)} @ {formatCurrency(tx.price)}
              </span>
              <span className={`font-mono text-xs tnum ${tx.type === 'BUY' ? 'text-down' : 'text-up'}`}>
                {tx.type === 'BUY' ? '−' : '+'}{formatCurrency(tx.totalAmount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
