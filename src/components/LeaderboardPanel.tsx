import { Bot, Crown } from 'lucide-react';
import { usePersistent } from '../context/PersistentContext.tsx';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../services/transactionService.ts';
import { personalityLabel, PERSISTENT_LEADERBOARD_RULE_COPY } from '../utils/gameLogic.ts';

// Stage 10B persistent leaderboard: humans and bots ranked together by
// server-owned net worth. Backend rank is authoritative — never re-sort or
// recalculate in the browser. Bots carry a clear marker and their public
// personality; the signed-in human's row is highlighted. Debt is shown when
// outstanding; negative net worth is displayed and never filtered out.
export function LeaderboardPanel() {
  const { user } = useAuth();
  const { leaderboard, leaderboardError } = usePersistent();

  const entries = leaderboard?.entries ?? [];
  const emptyWorld = leaderboard !== null && leaderboard.worldId === null && entries.length === 0;

  return (
    <div className="paper-card overflow-hidden">
      <div className="px-5 py-4 border-b border-rule flex items-center justify-between">
        <div>
          <div className="label">Live leaderboard</div>
          <h3 className="font-display text-xl font-bold text-ink">Persistent market, ranked</h3>
        </div>
        {leaderboard?.worldId != null && (
          <span className="chip" title="Active persistent world">W{leaderboard.worldId}</span>
        )}
      </div>

      {leaderboardError && leaderboard === null ? (
        <div className="px-5 py-8 text-center">
          <div className="label text-oxblood mb-1">Leaderboard unavailable</div>
          <p className="text-sm text-ink-mute">{leaderboardError}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-ink-mute">
            {emptyWorld
              ? 'No active persistent world yet — the board fills when the market is provisioned.'
              : 'No competitors on the board yet — accounts appear as they are provisioned.'}
          </p>
        </div>
      ) : (
        <ol className="divide-rule" aria-label="Persistent leaderboard">
          {entries.map((entry) => {
            const mine = user && entry.userId === user.id;
            return (
              <li
                key={entry.accountId}
                className={`flex items-center gap-3 px-4 sm:px-5 py-3 ${mine ? 'bg-accent-soft leaderboard-me' : 'bg-card'}`}
                aria-current={mine ? 'true' : undefined}
              >
                <span className="font-mono text-sm font-bold text-ink tnum w-8 shrink-0">
                  {entry.rank === 1 ? <Crown className="w-4 h-4 text-gold inline" aria-label="Leader" /> : `#${entry.rank}`}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-display font-semibold text-ink truncate">{entry.username}</span>
                    {entry.isBot && (
                      <span className="chip shrink-0" title={`Bot${entry.personality ? ` · ${personalityLabel(entry.personality)}` : ''}`}>
                        <Bot className="w-3 h-3" /> BOT{entry.personality ? ` · ${personalityLabel(entry.personality)}` : ''}
                      </span>
                    )}
                    {mine && <span className="label text-gold shrink-0">You</span>}
                  </div>
                  {entry.debt > 0 && (
                    <div className="font-mono text-[0.66rem] text-oxblood tnum">debt {formatCurrency(entry.debt)}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-mono text-sm font-semibold tnum ${entry.netWorth < 0 ? 'text-oxblood' : 'text-ink'}`}>
                    {formatCurrency(entry.netWorth)}
                  </div>
                  <div className="font-mono text-[0.66rem] text-ink-mute tnum">net worth</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {leaderboardError && leaderboard !== null && (
        <p className="px-5 py-2 border-t border-rule text-[0.7rem] font-mono text-oxblood" role="status">
          Leaderboard update failed — showing the last synced board. {leaderboardError}
        </p>
      )}

      <p className="px-5 py-3 border-t border-rule text-[0.7rem] font-mono text-ink-mute leading-relaxed">
        {PERSISTENT_LEADERBOARD_RULE_COPY}
      </p>
    </div>
  );
}
