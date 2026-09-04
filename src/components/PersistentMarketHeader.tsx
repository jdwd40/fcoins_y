import { Coins } from 'lucide-react';
import { usePersistent } from '../context/PersistentContext.tsx';
import { useAuth } from '../context/AuthContext';
import { HowToPlay } from './HowToPlay.tsx';
import { formatCurrency } from '../services/transactionService.ts';

// Stage 11 primary market header: persistent-market identity only.
// No Apocalypse countdown, cycle meter, settlement status, or invented
// status chrome. Cash/rank appear only when already available from
// usePersistent — never invented here. HowToPlay stays discoverable.
export function PersistentMarketHeader() {
  const { user } = useAuth();
  const { account, myEntry, leaderboard } = usePersistent();

  const cash = account?.cash;
  const rank = myEntry?.rank;
  const boardSize = leaderboard?.entries.length;

  return (
    <section aria-label="Persistent market" className="border-b border-rule bg-paper-alt/40">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-3 sm:py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span
              className="w-9 h-9 rounded-lg bg-gold text-white grid place-items-center shadow-gold-glow shrink-0"
              aria-hidden="true"
            >
              <Coins className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="label">Coins</div>
              <div className="font-display font-bold text-ink text-lg sm:text-xl leading-tight truncate">
                Persistent market
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0">
            <HowToPlay />
            {user && cash !== undefined && (
              <div className="text-right">
                <div className="label">Cash</div>
                <div className="font-mono text-sm font-bold text-ink tnum" aria-label={`Cash ${formatCurrency(cash)}`}>
                  {formatCurrency(cash)}
                </div>
              </div>
            )}
            {user && rank !== undefined && (
              <div className="text-right">
                <div className="label">Rank</div>
                <div className="font-mono text-sm font-bold text-ink tnum">
                  #{rank}
                  {typeof boardSize === 'number' && boardSize > 0 ? (
                    <span className="text-ink-mute font-semibold"> / {boardSize}</span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
