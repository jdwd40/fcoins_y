import { Bot, Crown } from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../services/transactionService.ts';
import { personalityLabel, LEADERBOARD_RULE_COPY, LEADERBOARD_BREAKEVEN_COPY } from '../utils/gameLogic.ts';

// Live leaderboard (Core 6): humans and bots ranked together by current
// wealth. Bots carry a clear marker and their public personality — no
// strategy internals. The signed-in human's row is highlighted; a bot at #1
// is simply the leader. The win condition (backend #19: only a final Cash
// ABOVE the £10,000 start qualifies) is stated under the board.
export function LeaderboardPanel() {
  const { user } = useAuth();
  const { leaderboard, settling, lifecycle } = useGame();

  const entries = leaderboard?.entries ?? [];

  return (
    <div className="paper-card overflow-hidden">
      <div className="px-5 py-4 border-b border-rule flex items-center justify-between">
        <div>
          <div className="label">Live leaderboard</div>
          <h3 className="font-display text-xl font-bold text-ink">Survivors, ranked</h3>
        </div>
        {leaderboard && <span className="chip">{leaderboard.cycleId}</span>}
      </div>

      {settling || lifecycle === 'SETTLING' ? (
        <div className="px-5 py-8 text-center">
          <div className="label text-oxblood mb-1">Market frozen</div>
          <p className="font-display text-lg text-ink">Calculating the damage…</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-ink-mute">
            No competitors on the board yet — the next Apocalypse fills it automatically.
          </p>
        </div>
      ) : (
        <ol className="divide-rule" aria-label="Live leaderboard">
          {entries.map((entry) => {
            const mine = user && entry.userId === user.id;
            return (
              <li
                key={entry.participantId}
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
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-semibold text-ink tnum">{formatCurrency(entry.currentWealth)}</div>
                  <div className="font-mono text-[0.66rem] text-ink-mute tnum">peak {formatCurrency(entry.peakWealth)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="px-5 py-3 border-t border-rule text-[0.7rem] font-mono text-ink-mute leading-relaxed">
        {LEADERBOARD_RULE_COPY} {LEADERBOARD_BREAKEVEN_COPY}
      </p>
    </div>
  );
}
