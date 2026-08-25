import { Bot, Crown } from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../services/transactionService.ts';
import { personalityLabel } from '../utils/gameLogic.ts';

// V2-5 leaderboard pressure: the player's live rank plus the leaders,
// visible in the main status area without overwhelming trading. The full
// board stays as the drill-down section below (existing LeaderboardPanel).
// Humans and bots share one board; bots carry a marker and public
// personality, and the signed-in human's row is highlighted.
export function LeaderboardPressure() {
  const { user } = useAuth();
  const { leaderboard, myEntry, settling, lifecycle } = useGame();

  if (settling || lifecycle === 'SETTLING') {
    return (
      <section aria-label="Leaderboard" className="paper-card px-4 py-3">
        <div className="label text-oxblood">Leaderboard · market frozen — calculating the damage…</div>
      </section>
    );
  }

  const entries = leaderboard?.entries ?? [];
  const leaders = entries.slice(0, 3);
  const mineOutsideLeaders = myEntry && !leaders.some((entry) => entry.participantId === myEntry.participantId);
  const rows = mineOutsideLeaders ? [...leaders, myEntry] : leaders;

  return (
    <section aria-label="Leaderboard" className="paper-card px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="label">Leaderboard</div>
        <div className="font-mono text-xs text-ink tnum">
          {myEntry
            ? <>Your rank <strong>#{myEntry.rank}</strong> of {entries.length}</>
            : user
              ? 'Syncing your rank…'
              : `${entries.length} competitors`}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-ink-mute">No competitors on the board yet — the round fills it automatically.</p>
      ) : (
        <ol className="divide-rule" aria-label="Top of the live leaderboard">
          {rows.map((entry) => {
            const mine = !!user && entry.userId === user.id;
            return (
              <li
                key={entry.participantId}
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
                <span className="font-mono text-xs font-semibold text-ink tnum shrink-0">{formatCurrency(entry.currentWealth)}</span>
              </li>
            );
          })}
        </ol>
      )}

      <a href="#leaderboard" className="label hover:text-gold transition-colors inline-block mt-2">
        ▸ Full board, history and results
      </a>
    </section>
  );
}
