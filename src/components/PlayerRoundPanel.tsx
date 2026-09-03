import { useEffect, useRef, useState } from 'react';
import { TrendingUp, Wallet, Package, History } from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { usePersistent } from '../context/PersistentContext.tsx';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, SessionExpiredError } from '../services/transactionService.ts';
import { getPersistentTransactions } from '../services/persistentService.ts';
import type { PersistentTransaction } from '../services/persistentService.ts';
import {
  formatQuantity,
  formatAbsoluteTimestamp,
  formatActivityTimestamp,
  GAME_STARTING_CASH_LABEL
} from '../utils/gameLogic.ts';

// How many recent ledger rows the activity list keeps (the backend read is
// bounded; pinned explicitly so the list depth is a UI decision).
const ACTIVITY_LIMIT = 20;

// Persistent-market Stage 6 account panel (replaces the round dashboard as
// the gameplay money surface): THE persistent account — Cash, holdings at
// server-published live value, and server-owned wealth — plus the player's
// recent persistent ledger activity (their own buys and sells at the
// server-locked execution prices).
//
// Deliberately absent: peak wealth (there are no seasons), round
// enrolment, Power, and the FEE/TAX/EVENT drain feed (the persistent
// economy has no such drains; trades are the only cash movement). The
// legacy account funds (users.funds) never appear here. The account is
// automatic: there is no JOIN control, and while it syncs the panel says
// so instead of fabricating the £10,000 start.
export function PlayerRoundPanel({ onAuthRequest }: { onAuthRequest: () => void }) {
  const { user, getAuthToken, handleSessionExpired } = useAuth();
  const { myEntry } = useGame();
  const { account, synced, provisioned, lastSyncAt } = usePersistent();

  const [activity, setActivity] = useState<PersistentTransaction[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const activityInFlight = useRef(false);

  // Activity feed: re-read the bounded ledger whenever the account resyncs
  // (a poll or a committed trade). A read failure keeps the last good feed
  // and marks it stale — it never wipes or fabricates history.
  useEffect(() => {
    if (!user || !provisioned) {
      setActivity(null);
      setActivityError(null);
      return;
    }
    if (activityInFlight.current) return;
    const token = getAuthToken();
    if (!token) return;
    activityInFlight.current = true;
    getPersistentTransactions(token, { limit: ACTIVITY_LIMIT })
      .then((result) => {
        setActivity(result.transactions);
        setActivityError(null);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          handleSessionExpired();
          setActivity(null);
          setActivityError(null);
        } else {
          setActivityError(err instanceof Error ? err.message : 'Activity unavailable');
        }
      })
      .finally(() => {
        activityInFlight.current = false;
      });
    // lastSyncAt bumps on every successful account sync — the feed follows
    // the same cadence without a second timer.
  }, [user, provisioned, lastSyncAt, getAuthToken, handleSessionExpired]);

  if (!user) {
    return (
      <div className="paper-card p-6 text-center">
        <div className="label mb-2">Your account</div>
        <h3 className="font-display text-2xl font-bold text-ink mb-3">Sign in to play</h3>
        <p className="text-sm text-ink-dim mb-5">
          The persistent market never ends. Sign in and your {GAME_STARTING_CASH_LABEL} Cash
          account is waiting — no entry button, no lobby.
        </p>
        <button onClick={onAuthRequest} className="btn-gold w-full">
          Sign in to play
        </button>
      </div>
    );
  }

  if (!synced || !provisioned || account === null) {
    // Authenticated but the persistent account has not synced/provisioned
    // yet. Neutral loading state: never fabricate Cash or history.
    return (
      <div className="paper-card p-6 text-center">
        <div className="label mb-2 text-gold">Your account</div>
        <h3 className="font-display text-2xl font-bold text-ink mb-3">Syncing your account…</h3>
        <p className="text-sm text-ink-dim mb-1">
          Reading your {GAME_STARTING_CASH_LABEL} persistent Cash from the server.
        </p>
        <p className="text-xs text-ink-mute">
          Your account is automatic — there is nothing to press.
        </p>
      </div>
    );
  }

  // Cash, holdings value and wealth are the server-owned persistent figures
  // verbatim; holdings are valued by the server at live prices (dead coins
  // value at £0).
  const holdings = account.holdings;

  return (
    <div className="paper-card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-rule">
        <div>
          <div className="label">Your persistent account</div>
          <h3 className="font-display text-xl font-bold text-ink">Your position</h3>
        </div>
        {myEntry && (
          <span className="chip" aria-label={`Current rank ${myEntry.rank}`}>
            #{myEntry.rank}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="label mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> Cash</div>
          <div className="numeral text-ink text-2xl tnum">{formatCurrency(account.cash)}</div>
        </div>
        <div>
          <div className="label mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Wealth</div>
          <div className="numeral text-2xl tnum text-gold">{formatCurrency(account.netWealth)}</div>
        </div>
        <div>
          <div className="label mb-1">Holdings value</div>
          <div className="font-mono text-sm text-ink tnum">{formatCurrency(account.holdingsValue)}</div>
        </div>
        <div>
          <div className="label mb-1">Open positions</div>
          <div className="font-mono text-sm text-ink-dim tnum">{holdings.length}</div>
        </div>
      </div>

      <div>
        <div className="label mb-2 flex items-center gap-1"><Package className="w-3 h-3" /> Persistent holdings</div>
        {holdings.length === 0 ? (
          <p className="text-xs text-ink-mute">No positions yet — the persistent market rewards the patient.</p>
        ) : (
          <div className="divide-rule border border-rule rounded-lg overflow-hidden">
            {holdings.map((holding) => {
              const dead = !(holding.currentPrice > 0);
              return (
                <div key={holding.coinId} className="flex items-center justify-between px-3 py-2 bg-card">
                  <span className={`font-mono text-xs font-semibold ${dead ? 'text-oxblood' : 'text-ink'}`}>
                    {holding.symbol}
                    {dead && <span className="ml-2 text-oxblood">DEAD</span>}
                  </span>
                  <span className="font-mono text-xs text-ink-dim tnum">
                    {formatQuantity(holding.quantity)} · {dead ? '£0.00' : formatCurrency(holding.currentValue)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Persistent activity: the player's OWN buys and sells at the
          server-locked execution prices. The Cash figure above stays the
          single authoritative number; the ledger explains it. */}
      <div className="mt-4 pt-4 border-t border-rule">
        <div className="label mb-1 flex items-center gap-1"><History className="w-3 h-3" /> Account activity</div>
        <p className="text-[0.7rem] text-ink-mute mb-2">
          Your persistent buys and sells, newest first — every execution at the server-locked live price.
        </p>
        {activityError && (
          <p className="text-[0.7rem] text-oxblood mb-2" role="status">
            Activity update failed — showing the last synced history. Your Cash above is still authoritative.
          </p>
        )}
        {activity === null ? (
          !activityError && (
            <p className="text-xs text-ink-mute">Syncing account activity…</p>
          )
        ) : activity.length === 0 ? (
          <p className="text-xs text-ink-mute">
            No trades yet — your buys and sells will appear here as they execute.
          </p>
        ) : (
          <ul
            className="divide-rule border border-rule rounded-lg overflow-hidden"
            aria-live="polite"
            aria-label="Recent persistent trades"
          >
            {activity.map((tx) => (
              <li key={tx.persistentTransactionId} className="px-3 py-2 bg-card">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-mono text-[0.65rem] font-bold uppercase tracking-wider ${tx.type === 'BUY' ? 'text-verdigris' : 'text-oxblood'}`}>
                    {tx.type === 'BUY' ? '▲ Buy' : '▼ Sell'} {tx.symbol}
                  </span>
                  <span className="font-mono text-xs font-semibold text-ink tnum">
                    {formatCurrency(tx.totalAmount)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-0.5">
                  <span className="text-xs text-ink-dim">
                    {formatQuantity(tx.quantity)} @ {formatCurrency(tx.price)}
                  </span>
                  <time
                    dateTime={tx.createdAt}
                    title={formatAbsoluteTimestamp(tx.createdAt)}
                    className="text-[0.65rem] text-ink-mute whitespace-nowrap shrink-0"
                  >
                    {formatActivityTimestamp(tx.createdAt, Date.now())}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
