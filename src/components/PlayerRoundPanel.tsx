import { TrendingUp, Wallet, Package, History } from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../services/transactionService.ts';
import {
  revalueHoldings,
  livePriceMapFromCoins,
  formatQuantity,
  displayRoundCash,
  GAME_STARTING_CASH_LABEL,
  CASH_EVENT_TYPE_LABEL,
  formatCashEventAmount,
  formatActivityTimestamp,
  formatAbsoluteTimestamp
} from '../utils/gameLogic.ts';
import type { CashEventType } from '../services/gameService.ts';
import type { Coin } from '../types';

// Source accent per drain type. The LABEL carries the meaning (colour alone
// never does); these only reinforce it.
const CASH_EVENT_TYPE_CLASS: Record<CashEventType, string> = {
  FEE: 'text-gold',
  TAX: 'text-oxblood',
  EVENT: 'text-ink'
};

// Player round dashboard (issue #10): the ONE gameplay balance — Cash — plus
// holdings value, live wealth and peak for the CURRENT apocalypse only. Cash
// comes only from the server-owned participant / live leaderboard row
// (displayRoundCash); legacy account funds (users.funds) are never presented
// here — they belong to the classic exchange profile and are not playable
// apocalypse money. Participation is automatic: there is no JOIN control,
// and while the participant syncs the panel says so instead of fabricating
// the £10,000 start.
export function PlayerRoundPanel({ coins, onAuthRequest }: { coins: Coin[]; onAuthRequest: () => void }) {
  const { user } = useAuth();
  const { joined, myEntry, myParticipant, lifecycle, gameState, cashEvents, cashEventsError } = useGame();

  if (!user) {
    return (
      <div className="paper-card p-6 text-center">
        <div className="label mb-2">This round</div>
        <h3 className="font-display text-2xl font-bold text-ink mb-3">Sign in to play</h3>
        <p className="text-sm text-ink-dim mb-5">
          An Apocalypse is always running. Sign in and your {GAME_STARTING_CASH_LABEL} Cash
          is waiting in the current round — no entry button, no lobby.
        </p>
        <button onClick={onAuthRequest} className="btn-gold w-full">
          Sign in to play
        </button>
      </div>
    );
  }

  if (!joined) {
    // Authenticated but the server-owned participant for this cycle has not
    // synced yet (initial load, rollover hand-off, settling window). Neutral
    // loading state: never fabricate Cash, never show a previous cycle.
    return (
      <div className="paper-card p-6 text-center">
        <div className="label mb-2 text-gold">This round · {gameState?.apocalypseId ?? '…'}</div>
        <h3 className="font-display text-2xl font-bold text-ink mb-3">
          {lifecycle === 'SETTLING' ? 'Market frozen…' : 'Syncing your position…'}
        </h3>
        <p className="text-sm text-ink-dim mb-1">
          {lifecycle === 'SETTLING'
            ? 'Calculating the damage — the next Apocalypse starts automatically.'
            : `Reading your ${GAME_STARTING_CASH_LABEL} starting Cash from the server.`}
        </p>
        <p className="text-xs text-ink-mute">
          Participation is automatic — there is nothing to press.
        </p>
      </div>
    );
  }

  // Live cash/wealth/peak come from the public leaderboard (server truth);
  // per-coin holdings come from the cached authoritative participant and are
  // re-priced against the live market list (dead coins value at £0).
  const livePrices = livePriceMapFromCoins(coins);
  const holdings = myParticipant?.holdings ?? [];
  const holdingsValue = revalueHoldings(holdings, livePrices);
  const roundCash = displayRoundCash(myEntry, myParticipant);
  const wealth = myEntry?.currentWealth ?? roundCash + holdingsValue;
  const peak = myEntry?.peakWealth ?? myParticipant?.peakWealth ?? wealth;

  return (
    <div className="paper-card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-rule">
        <div>
          <div className="label">This round · {gameState?.apocalypseId ?? ''}</div>
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
          <div className="numeral text-ink text-2xl tnum">{formatCurrency(roundCash)}</div>
        </div>
        <div>
          <div className="label mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Wealth</div>
          <div className="numeral text-2xl tnum text-gold">{formatCurrency(wealth)}</div>
        </div>
        <div>
          <div className="label mb-1">Holdings value</div>
          <div className="font-mono text-sm text-ink tnum">{formatCurrency(holdingsValue)}</div>
        </div>
        <div>
          <div className="label mb-1">Peak wealth</div>
          <div className="font-mono text-sm text-ink-dim tnum">{formatCurrency(peak)}</div>
        </div>
      </div>

      <div>
        <div className="label mb-2 flex items-center gap-1"><Package className="w-3 h-3" /> Round holdings</div>
        {holdings.length === 0 ? (
          <p className="text-xs text-ink-mute">No positions yet — the apocalypse rewards the brave.</p>
        ) : (
          <div className="divide-rule border border-rule rounded-lg overflow-hidden">
            {holdings.map((holding) => {
              const livePrice = livePrices.get(holding.coinId) ?? 0;
              const dead = !(livePrice > 0);
              return (
                <div key={holding.coinId} className="flex items-center justify-between px-3 py-2 bg-card">
                  <span className={`font-mono text-xs font-semibold ${dead ? 'text-oxblood' : 'text-ink'}`}>
                    {holding.symbol}
                    {dead && <span className="ml-2 text-oxblood">DEAD</span>}
                  </span>
                  <span className="font-mono text-xs text-ink-dim tnum">
                    {formatQuantity(holding.quantity)} · {dead ? '£0.00' : formatCurrency(holding.quantity * livePrice)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Issue #11: passive-drain activity. Explains WHY Cash moved — the
          ledger rows are never summed into a balance; the Cash figure above
          stays the single authoritative number. Trades are deliberately not
          listed here (no player trade-history contract exists); the copy
          keeps the two kinds of cash movement distinct. */}
      <div className="mt-4 pt-4 border-t border-rule">
        <div className="label mb-1 flex items-center gap-1"><History className="w-3 h-3" /> Round activity</div>
        <p className="text-[0.7rem] text-ink-mute mb-2">
          Server fees, taxes and events that drained your Cash. Your own buys and sells are confirmed in the trade panel.
        </p>
        {cashEventsError && (
          <p className="text-[0.7rem] text-oxblood mb-2" role="status">
            Activity update failed — showing the last synced drains. Your Cash above is still authoritative.
          </p>
        )}
        {cashEvents === null ? (
          !cashEventsError && (
            <p className="text-xs text-ink-mute">Syncing round activity…</p>
          )
        ) : cashEvents.length === 0 ? (
          <p className="text-xs text-ink-mute">
            No drains yet this round — fees, taxes and events will appear here as the server applies them.
          </p>
        ) : (
          <ul
            className="divide-rule border border-rule rounded-lg overflow-hidden"
            aria-live="polite"
            aria-label="Recent Cash drains"
          >
            {cashEvents.map((event) => (
              <li key={event.cashEventId} className="px-3 py-2 bg-card">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-mono text-[0.65rem] font-bold uppercase tracking-wider ${CASH_EVENT_TYPE_CLASS[event.type]}`}>
                    {CASH_EVENT_TYPE_LABEL[event.type]}
                  </span>
                  <span className="font-mono text-xs font-semibold text-oxblood tnum">
                    {formatCashEventAmount(event.amount)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-0.5">
                  <span className="text-xs text-ink-dim">{event.description}</span>
                  <time
                    dateTime={event.createdAt}
                    title={formatAbsoluteTimestamp(event.createdAt)}
                    className="text-[0.65rem] text-ink-mute whitespace-nowrap shrink-0"
                  >
                    {formatActivityTimestamp(event.createdAt, Date.now())}
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
