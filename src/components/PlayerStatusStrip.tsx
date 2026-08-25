import { useEffect, useState } from 'react';
import { Wallet, Zap, Trophy, Package } from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../services/transactionService.ts';
import {
  displayRoundCash,
  formatPowerNextHint,
  formatPowerRegenRate,
  openLivePositionCount,
  GAME_STARTING_CASH_LABEL,
  MAX_OPEN_POSITIONS
} from '../utils/gameLogic.ts';

// V2-5 player status strip: the money-and-Power truth of the CURRENT round at
// a glance. Cash is the dominant figure (server-owned participant / live
// leaderboard row only — legacy account funds never appear here). Power, its
// regeneration rate and next-point hint come from the server's own Power
// view; rank comes from the live leaderboard; open positions use the V2-2
// live-position rule. Signing-in and syncing states are explicit and never
// fabricate the £10,000 starting Cash.
export function PlayerStatusStrip({ onAuthRequest }: { onAuthRequest: () => void }) {
  const { user } = useAuth();
  const { joined, myEntry, myParticipant, lifecycle, gameState } = useGame();

  // Display-only 1s tick: the next-Power hint is DERIVED from the server's
  // nextPointAt; this never counts Power itself.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!user) {
    return (
      <section aria-label="Your round" className="paper-card p-5 text-center">
        <div className="label mb-2">Your round</div>
        <h2 className="font-display text-2xl font-bold text-ink mb-2">Sign in to play</h2>
        <p className="text-sm text-ink-dim mb-5">
          An Apocalypse is always running. Sign in and your {GAME_STARTING_CASH_LABEL} Cash
          is waiting in the current round — no entry button, no lobby.
        </p>
        <button onClick={onAuthRequest} className="btn-gold w-full tap-target">
          Sign in to play
        </button>
      </section>
    );
  }

  if (!joined) {
    // Authenticated but the server-owned participant for this cycle has not
    // synced yet. Neutral loading state: never fabricate Cash, Power or rank.
    return (
      <section aria-label="Your round" className="paper-card p-5 text-center">
        <div className="label mb-2 text-gold">Your round · {gameState?.apocalypseId ?? '…'}</div>
        <h2 className="font-display text-2xl font-bold text-ink mb-2">
          {lifecycle === 'SETTLING' ? 'Market frozen…' : 'Syncing your position…'}
        </h2>
        <p className="text-sm text-ink-dim mb-1">
          {lifecycle === 'SETTLING'
            ? 'Calculating the damage — the next Apocalypse starts automatically.'
            : `Reading your ${GAME_STARTING_CASH_LABEL} starting Cash from the server.`}
        </p>
        <p className="text-xs text-ink-mute">Participation is automatic — there is nothing to press.</p>
      </section>
    );
  }

  const roundCash = displayRoundCash(myEntry, myParticipant);
  const power = myParticipant?.power ?? null;
  const holdings = myParticipant?.holdings ?? [];
  const openPositions = openLivePositionCount(holdings);
  const wealth = myEntry?.currentWealth ?? myParticipant?.wealth ?? roundCash;

  return (
    <section aria-label="Your round" className="paper-card p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="label mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> Cash</div>
          {/* The dominant money figure: current round Cash. Fluid on narrow
              phones (player-cash-figure) so a large balance never pushes
              Wealth off the strip; full size from sm up. */}
          <div className="numeral player-cash-figure text-ink sm:text-5xl tnum" aria-label={`Cash ${formatCurrency(roundCash)}`}>
            {formatCurrency(roundCash)}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="label mb-1">Wealth</div>
          <div className="numeral text-xl tnum text-gold">{formatCurrency(wealth)}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="stat-cell" aria-label={power ? `Power ${power.current} of ${power.max}` : 'Power syncing'}>
          <div className="label mb-1 flex items-center gap-1"><Zap className="w-3 h-3" /> Power</div>
          {power ? (
            <>
              <div className="font-mono text-base font-bold text-ink tnum">
                {power.current}<span className="text-ink-mute font-normal">/{power.max}</span>
              </div>
              <div className="text-xs text-ink-mute tnum">{formatPowerRegenRate(power)}</div>
              <div className="text-xs text-ink-dim tnum" aria-live="off">
                {formatPowerNextHint(power, now)}
              </div>
            </>
          ) : (
            <div className="text-xs text-ink-mute">Syncing Power…</div>
          )}
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

        <div className="stat-cell" aria-label={`${openPositions} of ${MAX_OPEN_POSITIONS} positions open`}>
          <div className="label mb-1 flex items-center gap-1"><Package className="w-3 h-3" /> Positions</div>
          <div className="font-mono text-base font-bold text-ink tnum">
            {openPositions}<span className="text-ink-mute font-normal">/{MAX_OPEN_POSITIONS}</span>
          </div>
          <div className="text-xs text-ink-mute">open</div>
        </div>
      </div>
    </section>
  );
}
