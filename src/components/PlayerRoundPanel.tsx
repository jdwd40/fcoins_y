import { Swords, TrendingUp, Wallet, Package } from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../services/transactionService.ts';
import { revalueHoldings, livePriceMapFromCoins, formatQuantity } from '../utils/gameLogic.ts';
import type { Coin } from '../types';

// Player round dashboard: the Core 4 round wallet — ROUND CASH, holdings
// value, live wealth and peak for the CURRENT apocalypse only. Legacy
// account funds (users.funds) are never presented here; they belong to the
// legacy exchange profile and are not playable apocalypse money.
export function PlayerRoundPanel({ coins, onAuthRequest }: { coins: Coin[]; onAuthRequest: () => void }) {
  const { user } = useAuth();
  const { joined, myEntry, myParticipant, join, joinPending, lifecycle, gameState } = useGame();

  if (!user) {
    return (
      <div className="paper-card p-6 text-center">
        <div className="label mb-2">This round</div>
        <h3 className="font-display text-2xl font-bold text-ink mb-3">Join the apocalypse</h3>
        <p className="text-sm text-ink-dim mb-5">
          Sign in and enter the current round with £1,000.00 round cash.
        </p>
        <button onClick={onAuthRequest} className="btn-gold w-full">
          Sign in to play
        </button>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="paper-card p-6 text-center">
        <div className="label mb-2 text-gold">This round · {gameState?.apocalypseId ?? '…'}</div>
        <h3 className="font-display text-2xl font-bold text-ink mb-3">Join apocalypse</h3>
        <p className="text-sm text-ink-dim mb-1">
          Every competitor starts with <strong className="text-ink">£1,000.00</strong> round cash.
        </p>
        <p className="text-xs text-ink-mute mb-5">
          Join at any point in the round — late entry is full entry. Same stake, same leaderboard.
        </p>
        <button
          onClick={() => void join()}
          disabled={joinPending || lifecycle === 'SETTLING'}
          className="btn-gold w-full"
        >
          <Swords className="w-3.5 h-3.5" />
          {joinPending ? 'Joining…' : lifecycle === 'SETTLING' ? 'Market frozen…' : 'JOIN APOCALYPSE'}
        </button>
      </div>
    );
  }

  // Live cash/wealth/peak come from the public leaderboard (server truth);
  // per-coin holdings come from the cached authoritative participant and are
  // re-priced against the live market list (dead coins value at £0).
  const livePrices = livePriceMapFromCoins(coins);
  const holdings = myParticipant?.holdings ?? [];
  const holdingsValue = revalueHoldings(holdings, livePrices);
  const roundCash = myEntry?.currentCash ?? myParticipant?.currentCash ?? 0;
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
          <div className="label mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> Round cash</div>
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
    </div>
  );
}
