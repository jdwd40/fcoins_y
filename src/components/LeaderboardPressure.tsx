import { Bot, Crown } from 'lucide-react';
import { usePersistent } from '../context/PersistentContext.tsx';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../services/transactionService.ts';
import { personalityLabel } from '../utils/gameLogic.ts';

// Stage 10B leaderboard pressure: the player's live persistent rank plus the
// leaders, visible in the main status area without overwhelming trading. The
// full board stays as the drill-down section below (LeaderboardPanel).
// Backend rank is authoritative; humans and bots share one board.
export function LeaderboardPressure() {
  const { user } = useAuth();
  const { leaderboard, myEntry } = usePersistent();

  const entries = leaderboard?.entries ?? [];
  const leaders = entries.slice(0, 3);
  const mineOutsideLeaders = myEntry && !leaders.some((entry) => entry.accountId === myEntry.accountId);
  const rows = mineOutsideLeaders ? [...leaders, myEntry] : leaders;

  return (
    <section aria-label="Leaderboard" className="paper-card px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="label">Leaderboard</div>
        <div className="font-mono text-xs text-ink tnum">
          {myEntry
            ? <>Your rank <strong>#{myEntry.rank}</strong> of {entries.length}</>
            : user
              ? (leaderboard === null ? 'Syncing your rank…' : 'Unranked')
              : `${entries.length} competitors`}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-ink-mute">
          {leaderboard !== null && leaderboard.worldId === null
            ? 'No active persistent world yet — the board fills when the market is provisioned.'
            : 'No competitors on the board yet — accounts appear as they are provisioned.'}
        </p>
      ) : (
        <ol className="divide-rule" aria-label="Top of the persistent leaderboard">
          {rows.map((entry) => {
            const mine = !!user && entry.userId === user.id;
            return (
              <li
                key={entry.accountId}
                className={`flex items-center gap-2 py-1.5 ${mine ? 'leaderboard-me px-2 -mx-2' : ''}`}
                aria-current={mine ? 'true' : undefined}
              >
                <span className="font-mono text-xs font-bold text-ink tnum w-7 shrink-0">
                  {entry.rank === 1 ? <Crown className="w-3.5 h-3.5 text-gold inline" aria-label="Leader" /> : `#${entry.rank}`}
                </span>
                <span className="font-display text-sm font-semibold text-ink truncate min-w-0 flex-1">
                  {entry.username}
                  {mine && <span className="label text-gold ml-2">You</span>}
                </span>
                {entry.isBot && (
                  <span className="chip shrink-0" title={`Bot${entry.personality ? ` · ${personalityLabel(entry.personality)}` : ''}`}>
                    <Bot className="w-3 h-3" /> {entry.personality ? personalityLabel(entry.personality) : 'BOT'}
                  </span>
                )}
                {entry.debt > 0 && (
                  <span className="font-mono text-[0.66rem] text-oxblood tnum shrink-0" title={`Debt ${formatCurrency(entry.debt)}`}>
                    debt
                  </span>
                )}
                <span className={`font-mono text-xs font-semibold tnum shrink-0 ${entry.netWorth < 0 ? 'text-oxblood' : 'text-ink'}`}>
                  {formatCurrency(entry.netWorth)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <a href="#leaderboard" className="label hover:text-gold transition-colors inline-block mt-2">
        ▸ Full board and account activity
      </a>
    </section>
  );
}
