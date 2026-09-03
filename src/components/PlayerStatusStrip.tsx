import { Wallet, TrendingUp, Trophy, Package } from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { usePersistent } from '../context/PersistentContext.tsx';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../services/transactionService.ts';
import { GAME_STARTING_CASH_LABEL } from '../utils/gameLogic.ts';

// Persistent-market Stage 6 player status strip: the money truth of the
// player's PERSISTENT account at a glance. Cash and Wealth are the
// server-owned persistent figures only — legacy account funds and round
// participants never appear here. There is no Power and no position cap in
// the persistent economy, so those cells are gone; open positions are the
// count of live persistent holdings. Rank still reads the retained legacy
// live leaderboard (Stage 10 replaces it with the persistent board).
// Signing-in and syncing states are explicit and never fabricate the
// £10,000 starting Cash.
export function PlayerStatusStrip({ onAuthRequest }: { onAuthRequest: () => void }) {
  const { user } = useAuth();
  const { myEntry } = useGame();
  const { account, synced, provisioned, accountError, syncNow } = usePersistent();

  if (!user) {
    return (
      <section aria-label="Your account" className="paper-card p-5 text-center">
        <div className="label mb-2">Your account</div>
        <h2 className="font-display text-2xl font-bold text-ink mb-2">Sign in to play</h2>
        <p className="text-sm text-ink-dim mb-5">
          The persistent market never ends. Sign in and your {GAME_STARTING_CASH_LABEL} Cash
          account is waiting — no entry button, no lobby, no countdown.
        </p>
        <button onClick={onAuthRequest} className="btn-gold w-full tap-target">
          Sign in to play
        </button>
      </section>
    );
  }

  if (!synced) {
    // Authenticated but the persistent account has not synced yet. Neutral
    // loading state: never fabricate Cash, wealth or rank.
    return (
      <section aria-label="Your account" className="paper-card p-5 text-center">
        <div className="label mb-2 text-gold">Your account</div>
        <h2 className="font-display text-2xl font-bold text-ink mb-2">Syncing your account…</h2>
        <p className="text-sm text-ink-dim mb-1">
          Reading your {GAME_STARTING_CASH_LABEL} persistent Cash from the server.
        </p>
        <p className="text-xs text-ink-mute">Your account is automatic — there is nothing to press.</p>
      </section>
    );
  }

  if (accountError !== null && account === null) {
    return (
      <section aria-label="Your account" className="paper-card p-5 text-center">
        <div className="label mb-2 text-oxblood">Your account · unavailable</div>
        <p className="text-sm text-ink-dim mb-4">{accountError}</p>
        <button onClick={() => void syncNow()} className="btn-ink">Retry</button>
      </section>
    );
  }

  if (!provisioned || account === null) {
    // A real state: the account row does not exist yet. It provisions
    // idempotently at registration / first trade — never fabricate the
    // balance client-side.
    return (
      <section aria-label="Your account" className="paper-card p-5 text-center">
        <div className="label mb-2 text-gold">Your account</div>
        <h2 className="font-display text-2xl font-bold text-ink mb-2">Provisioning…</h2>
        <p className="text-sm text-ink-dim mb-1">
          Your {GAME_STARTING_CASH_LABEL} persistent Cash account is being provisioned by the server — once, idempotently.
        </p>
        <p className="text-xs text-ink-mute">Place any trade or wait a moment; there is nothing to press.</p>
      </section>
    );
  }

  const cash = account.cash;
  const wealth = account.netWealth;
  const holdingsValue = account.holdingsValue;
  const openPositions = account.holdings.length;

  return (
    <section aria-label="Your account" className="paper-card p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="label mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> Cash</div>
          {/* The dominant money figure: persistent account Cash. Fluid on
              narrow phones (player-cash-figure) so a large balance never
              pushes Wealth off the strip; full size from sm up. */}
          <div className="numeral player-cash-figure text-ink sm:text-5xl tnum" aria-label={`Cash ${formatCurrency(cash)}`}>
            {formatCurrency(cash)}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="label mb-1">Wealth</div>
          <div className="numeral text-xl tnum text-gold">{formatCurrency(wealth)}</div>
        </div>
      </div>

      {accountError !== null && (
        <p className="text-xs text-oxblood mb-2" role="status">
          Account update failed — showing the last synced balance. {accountError}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="stat-cell" aria-label={`Holdings value ${formatCurrency(holdingsValue)}`}>
          <div className="label mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Holdings</div>
          <div className="font-mono text-base font-bold text-ink tnum">{formatCurrency(holdingsValue)}</div>
          <div className="text-xs text-ink-mute">live value</div>
        </div>

        <div className="stat-cell" aria-label={myEntry ? `Leaderboard rank ${myEntry.rank}` : 'Rank syncing'}>
          <div className="label mb-1 flex items-center gap-1"><Trophy className="w-3 h-3" /> Rank</div>
          {myEntry ? (
            <>
              <div className="font-mono text-base font-bold text-ink tnum">#{myEntry.rank}</div>
              <div className="text-xs text-ink-mute tnum">live board</div>
            </>
          ) : (
            <div className="text-xs text-ink-mute">Syncing rank…</div>
          )}
        </div>

        <div className="stat-cell" aria-label={`${openPositions} open positions`}>
          <div className="label mb-1 flex items-center gap-1"><Package className="w-3 h-3" /> Positions</div>
          <div className="font-mono text-base font-bold text-ink tnum">{openPositions}</div>
          <div className="text-xs text-ink-mute">open · no cap</div>
        </div>
      </div>
    </section>
  );
}
