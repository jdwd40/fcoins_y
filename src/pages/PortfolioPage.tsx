import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePersistent } from '../context/PersistentContext.tsx';
import { usePageTitle } from '../hooks/usePageTitle.ts';
import { usePersistentTransactions } from '../hooks/usePersistentTransactions.ts';
import { useShellServices } from '../components/shell/shellServices.ts';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { CoinAvatar } from '../components/ui/CoinAvatar.tsx';
import { Button, ButtonLink } from '../components/ui/Button.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { InlineAlert } from '../components/ui/InlineAlert.tsx';
import { InfoTip } from '../components/ui/InfoTip.tsx';
import { Stat } from '../components/ui/Stat.tsx';
import { QuantityText } from '../components/ui/QuantityText.tsx';
import { formatCurrency } from '../services/transactionService.ts';
import type { PersistentHolding } from '../services/persistentService.ts';
import {
  formatAbsoluteTimestamp,
  formatSignedGbp,
  formatSignedPct
} from '../utils/gameLogic.ts';
import { formatPrice } from '../utils/formatPrice.ts';
import { groupTransactionsByDay } from '../utils/transactionGroups.ts';

// Portfolio: the player's account, holdings and full transaction ledger.

type TxFilter = 'all' | 'BUY' | 'SELL';
type HoldingsSort = 'value' | 'pnl';

export function PortfolioPage() {
  usePageTitle('Portfolio · Crypto Chaos');
  const { user } = useAuth();
  const { account, synced, provisioned, accountError, myEntry, leaderboard, syncNow } = usePersistent();
  const { openAuth, openTrade } = useShellServices();
  const { transactions, error: txError, loading: txLoading, refresh } = usePersistentTransactions(100);

  const [txFilter, setTxFilter] = useState<TxFilter>('all');
  const [holdingsSort, setHoldingsSort] = useState<HoldingsSort>('value');

  if (!user) {
    return (
      <div className="game-shell py-10">
        <EmptyState
          title="Sign in to see your portfolio"
          body="Your cash, holdings and trade history live on your persistent account."
          action={<Button variant="primary" onClick={() => openAuth('signin')}>Sign in</Button>}
        />
      </div>
    );
  }

  if (!synced) {
    return (
      <div className="game-shell py-6">
        <Card className="p-6"><Skeleton lines={4} className="h-6" /></Card>
      </div>
    );
  }

  if (accountError !== null && account === null) {
    return (
      <div className="game-shell py-10">
        <InlineAlert tone="error" className="mb-3">Your account is unavailable — {accountError}</InlineAlert>
        <Button variant="ghost" onClick={() => void syncNow()}>Retry</Button>
      </div>
    );
  }

  if (!provisioned || account === null) {
    return (
      <div className="game-shell py-10">
        <EmptyState
          title="Your account starts with your first trade"
          body="Your starting cash is added the moment you buy your first coin."
          action={<ButtonLink to="/" variant="primary">Browse the market</ButtonLink>}
        />
      </div>
    );
  }

  const overallPnl = account.netWealth - account.startingCash;
  const unrealisedPnl = account.holdings.reduce((sum, h) => sum + h.unrealizedPnl, 0);
  const liveHoldings = account.holdings.filter((h) => h.currentPrice > 0 && h.quantity > 0);
  const deadHoldings = account.holdings.filter((h) => !(h.currentPrice > 0) || !(h.quantity > 0));
  const sortedHoldings = [...liveHoldings].sort((a, b) =>
    holdingsSort === 'value' ? b.currentValue - a.currentValue : b.unrealizedPnl - a.unrealizedPnl
  );

  const filteredTx = (transactions ?? []).filter((tx) => txFilter === 'all' || tx.type === txFilter);
  const txGroups = groupTransactionsByDay(filteredTx, Date.now());

  const totalWealth = account.cash + account.holdingsValue;
  const cashShare = totalWealth > 0 ? Math.min(1, Math.max(0, account.cash / totalWealth)) : 0;

  return (
    <div className="game-shell py-4 sm:py-6 space-y-4">
      {/* Header */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-full bg-accent-soft border border-brand/40 grid place-items-center font-display font-bold text-brand text-lg" aria-hidden="true">
              {(user.username || 'P').slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-ink">{user.username || 'Your portfolio'}</h1>
              {myEntry && leaderboard && (
                <Link to="/leaderboard" className="text-sm text-brand hover:underline font-mono tnum">
                  Rank #{myEntry.rank} of {leaderboard.entries.length}
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat
            label={<>Net worth <InfoTip label="Net worth" text="Cash plus live holdings value, minus debt. This is your leaderboard score." /></>}
            value={formatCurrency(account.netWealth)}
          />
          <Stat label="Cash" value={formatCurrency(account.cash)} />
          <Stat label="Holdings value" value={formatCurrency(account.holdingsValue)} />
          <Stat
            label="Overall P/L"
            value={`${formatSignedGbp(overallPnl)}`}
            sub={`vs ${formatCurrency(account.startingCash)} starting cash`}
            valueClassName={overallPnl >= 0 ? 'text-up' : 'text-down'}
          />
        </div>
        <p className="text-xs text-ink-mute mt-3">
          Unrealised P&amp;L on open positions:{' '}
          <span className={`font-mono tnum ${unrealisedPnl >= 0 ? 'text-up' : 'text-down'}`}>{formatSignedGbp(unrealisedPnl)}</span>
        </p>

        {/* Cash vs holdings split */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-ink-mute mb-1">
            <span>Cash {formatCurrency(account.cash)}</span>
            <span>Holdings {formatCurrency(account.holdingsValue)}</span>
          </div>
          <div
            className="h-2.5 rounded-full overflow-hidden bg-down/25 flex"
            role="img"
            aria-label={`Split: ${Math.round(cashShare * 100)} percent cash, ${100 - Math.round(cashShare * 100)} percent holdings`}
          >
            <div className="bg-brand h-full" style={{ width: `${cashShare * 100}%` }} />
            <div className="bg-golden h-full flex-1" />
          </div>
        </div>
        {accountError && (
          <p className="text-xs text-warn mt-3" role="status">
            Account refresh failed — showing the last synced figures. {accountError}
          </p>
        )}
      </Card>

      {/* Holdings */}
      <Card className="p-5 sm:p-6" aria-label="Holdings">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-ink">Holdings</h2>
          <label className="flex items-center gap-2 text-xs text-ink-mute">
            Sort
            <select
              value={holdingsSort}
              onChange={(e) => setHoldingsSort(e.target.value as HoldingsSort)}
              className="bg-surface-2 border border-rule rounded-lg text-sm text-ink px-2 py-1.5 min-h-[36px]"
            >
              <option value="value">Value</option>
              <option value="pnl">P&amp;L</option>
            </select>
          </label>
        </div>
        {sortedHoldings.length === 0 && deadHoldings.length === 0 ? (
          <EmptyState
            title="No positions yet"
            body="Buy a coin on the market and it appears here with live value and P&L."
            action={<ButtonLink to="/" variant="primary">Browse the market</ButtonLink>}
          />
        ) : (
          <>
            {sortedHoldings.length > 0 && (
              <ul className="divide-rule border border-rule rounded-xl overflow-hidden">
                {sortedHoldings.map((holding) => (
                  <HoldingRow key={holding.coinId} holding={holding} onSell={() => openTrade(holding.coinId, 'SELL')} />
                ))}
              </ul>
            )}
            {deadHoldings.length > 0 && (
              <div className="mt-3">
                <div className="label mb-2">Dead holdings — worth £0.00</div>
                <ul className="divide-rule border border-rule rounded-xl overflow-hidden opacity-70">
                  {deadHoldings.map((holding) => (
                    <li key={holding.coinId} className="flex items-center gap-3 px-3 py-2.5 bg-surface">
                      <CoinAvatar symbol={holding.symbol} coinId={holding.coinId} size="sm" dead />
                      <div className="min-w-0 flex-1">
                        <Link to={`/coin/${holding.coinId}`} className="font-semibold text-ink-dim hover:text-brand truncate block">
                          {holding.symbol}
                        </Link>
                        <span className="text-xs text-ink-mute font-mono tnum">
                          <QuantityText value={holding.quantity} /> · cost basis {formatCurrency(holding.costBasis)}
                        </span>
                      </div>
                      <Badge tone="down">Dead · £0.00</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Transactions */}
      <Card className="p-5 sm:p-6" aria-label="Transaction history">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-display font-bold text-ink">Transactions</h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-1" role="group" aria-label="Filter transactions">
              {(['all', 'BUY', 'SELL'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={txFilter === f}
                  onClick={() => setTxFilter(f)}
                  className={`chip min-h-[36px] ${txFilter === f ? 'border-brand text-brand bg-accent-soft' : ''}`}
                >
                  {f === 'all' ? 'All' : f === 'BUY' ? 'Buys' : 'Sells'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={refresh}
              className="p-2 rounded-lg border border-rule text-ink-mute hover:text-ink min-h-[44px] min-w-[44px] grid place-items-center"
              aria-label="Refresh transactions"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {txError && (
          <p className="text-xs text-warn mb-2" role="status">
            Transaction refresh failed — showing the last synced history. {txError}
          </p>
        )}
        {transactions === null && !txError ? (
          <Skeleton lines={5} className="h-5" />
        ) : txGroups.length === 0 ? (
          <p className="text-sm text-ink-mute">
            {txFilter === 'all' ? 'No trades yet — your buys and sells will appear here as they execute.' : `No ${txFilter === 'BUY' ? 'buys' : 'sells'} yet.`}
          </p>
        ) : (
          <div className="space-y-4" aria-live="polite" aria-label="Persistent trade ledger">
            {txGroups.map((group) => (
              <div key={group.key}>
                <div className="label mb-1.5">{group.label}</div>
                <ul className="divide-rule border border-rule rounded-xl overflow-hidden">
                  {group.items.map((tx) => (
                    <li key={tx.persistentTransactionId} className="flex items-center gap-3 px-3 py-2.5 bg-surface">
                      <Badge tone={tx.type === 'BUY' ? 'up' : 'down'}>
                        {tx.type === 'BUY' ? '▲ Buy' : '▼ Sell'}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <Link to={`/coin/${tx.coinId}`} className="font-mono font-bold text-ink hover:text-brand">
                          {tx.symbol}
                        </Link>
                        <span className="block text-xs text-ink-mute font-mono tnum">
                          <QuantityText value={tx.quantity} /> @ {formatPrice(tx.price)}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-mono text-sm font-semibold tnum ${tx.type === 'BUY' ? 'text-down' : 'text-up'}`}>
                          {tx.type === 'BUY' ? '−' : '+'}{formatCurrency(tx.totalAmount)}
                        </span>
                        <time
                          dateTime={tx.createdAt}
                          title={formatAbsoluteTimestamp(tx.createdAt)}
                          className="block text-xs text-ink-mute"
                        >
                          {new Date(Date.parse(tx.createdAt)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {txLoading && transactions !== null && (
          <p className="text-xs text-ink-mute mt-2" role="status">Refreshing…</p>
        )}
      </Card>
    </div>
  );
}

function HoldingRow({ holding, onSell }: { holding: PersistentHolding; onSell: () => void }) {
  const { signals } = usePersistent();
  const signal = signals?.coins.find((c) => c.coinId === holding.coinId) ?? null;
  const pnlWord = holding.unrealizedPnl >= 0 ? 'profit' : 'loss';
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-3 bg-surface" aria-label={`${holding.symbol} position — ${pnlWord}`}>
      <CoinAvatar symbol={holding.symbol} coinId={holding.coinId} size="sm" />
      <div className="min-w-0 flex-1">
        <Link to={`/coin/${holding.coinId}`} className="font-semibold text-ink hover:text-brand truncate block">
          {signal?.name ?? holding.symbol}
        </Link>
        <span className="text-xs text-ink-mute font-mono tnum">
          <QuantityText value={holding.quantity} symbol={holding.symbol} /> · avg {holding.averageEntryPrice === null ? '—' : formatPrice(holding.averageEntryPrice)} · now {formatPrice(signal?.currentPrice ?? holding.currentPrice)}
        </span>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm font-bold text-ink tnum">{formatCurrency(holding.currentValue)}</div>
        <div className={`font-mono text-xs tnum ${holding.unrealizedPnl >= 0 ? 'text-up' : 'text-down'}`}>
          {formatSignedGbp(holding.unrealizedPnl)} ({formatSignedPct(holding.unrealizedPnlPct)}) {pnlWord}
        </div>
      </div>
      <Button variant="sell" className="min-h-[44px]" onClick={onSell} aria-label={`Sell ${holding.symbol}`}>
        Sell
      </Button>
    </li>
  );
}
