import { useState } from 'react';
import { Bot, Crown, User as UserIcon } from 'lucide-react';
import { usePersistent } from '../context/PersistentContext.tsx';
import { usePageTitle } from '../hooks/usePageTitle.ts';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { formatCurrency } from '../services/transactionService.ts';
import { personalityLabel, PERSISTENT_LEADERBOARD_RULE_COPY } from '../utils/gameLogic.ts';
import { describeLeaderboardGap, gapToEntryAbove } from '../utils/leaderboardGap.ts';

// Leaderboard: podium for the top three, then the full ranked list in
// BACKEND ORDER (no client re-sort, no rank recomputation — filters only
// hide rows).

type BoardFilterId = 'all' | 'players' | 'bots';

export function LeaderboardPage() {
  usePageTitle('Leaderboard · Crypto Chaos');
  const { leaderboard, leaderboardError, myEntry } = usePersistent();
  const [filter, setFilter] = useState<BoardFilterId>('all');

  const entries = leaderboard?.entries ?? [];
  const visible = entries.filter((entry) =>
    filter === 'all' ? true : filter === 'bots' ? entry.isBot : !entry.isBot
  );
  const podium = entries.slice(0, 3);
  const gap = gapToEntryAbove(entries, myEntry);

  return (
    <div className="game-shell py-4 sm:py-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">Leaderboard</h1>
        <p className="text-sm text-ink-mute mt-1">{PERSISTENT_LEADERBOARD_RULE_COPY}</p>
      </div>

      {myEntry && (
        <Card className="p-4 sm:p-5 leaderboard-me" aria-label="Your standing">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="label mb-1">Your standing</div>
              <div className="font-mono text-2xl font-bold text-ink tnum">
                #{myEntry.rank} <span className="text-ink-mute text-base font-normal">of {entries.length}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-semibold text-ink tnum">{formatCurrency(myEntry.netWorth)}</div>
              {gap && (
                <div className="text-xs text-ink-mute font-mono tnum">
                  {describeLeaderboardGap(gap)}
                </div>
              )}
              {!gap && myEntry.rank === 1 && (
                <div className="text-xs text-golden font-semibold">You lead the board</div>
              )}
            </div>
          </div>
        </Card>
      )}

      {leaderboardError && leaderboard === null ? (
        <EmptyState title="Leaderboard unavailable" body={leaderboardError} />
      ) : leaderboard === null ? (
        <Card className="p-5"><Skeleton lines={6} className="h-5" /></Card>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No competitors on the board yet"
          body={leaderboard.worldId === null
            ? 'No active world yet — the board fills once the market is running.'
            : 'Accounts appear as players make their first trade.'}
        />
      ) : (
        <>
          {/* Podium: backend rank verbatim */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Top three">
            {podium.map((entry) => (
              <Card
                key={entry.accountId}
                className={`p-3 sm:p-4 text-center ${entry.rank === 1 ? 'border-golden/60' : ''}`}
              >
                {entry.rank === 1 && <Crown className="w-5 h-5 text-golden mx-auto mb-1" aria-label="Leader" />}
                <div className="font-mono text-lg font-bold text-ink tnum">#{entry.rank}</div>
                <div className="font-semibold text-ink truncate text-sm mt-1">{entry.username}</div>
                <div className="text-xs text-ink-mute">
                  {entry.isBot ? `Bot${entry.personality ? ` · ${personalityLabel(entry.personality)}` : ''}` : 'Player'}
                </div>
                <div className={`font-mono text-sm tnum mt-1 ${entry.netWorth < 0 ? 'text-down' : 'text-ink'}`}>
                  {formatCurrency(entry.netWorth)}
                </div>
              </Card>
            ))}
          </div>

          <div className="flex gap-1.5" role="group" aria-label="Filter leaderboard">
            {([['all', 'All'], ['players', 'Players'], ['bots', 'Bots']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={`chip min-h-[36px] ${filter === id ? 'border-brand text-brand bg-accent-soft' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden">
            <ol className="divide-rule" aria-label="Full leaderboard">
              {visible.map((entry) => {
                const mine = myEntry?.accountId === entry.accountId;
                return (
                  <li
                    key={entry.accountId}
                    className={`flex items-center gap-3 px-4 py-3 ${mine ? 'leaderboard-me' : ''}`}
                    aria-current={mine ? 'true' : undefined}
                  >
                    <span className="font-mono text-sm font-bold text-ink-mute tnum w-9 shrink-0">#{entry.rank}</span>
                    <span className="shrink-0 text-ink-mute" aria-hidden="true">
                      {entry.isBot ? <Bot className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-ink truncate">{entry.username}</span>
                        {entry.isBot && (
                          <Badge tone="neutral" className="shrink-0">
                            Bot{entry.personality ? ` · ${personalityLabel(entry.personality)}` : ''}
                          </Badge>
                        )}
                        {mine && <Badge tone="brand" className="shrink-0">You</Badge>}
                      </div>
                      <div className="text-xs text-ink-mute font-mono tnum mt-0.5">
                        cash {formatCurrency(entry.cash)} · holdings {formatCurrency(entry.holdingsValue)}
                        {entry.debt > 0 && <span className="text-down"> · Bot loan {formatCurrency(entry.debt)}</span>}
                      </div>
                    </div>
                    <span className={`font-mono text-sm font-semibold tnum shrink-0 ${entry.netWorth < 0 ? 'text-down' : 'text-ink'}`}>
                      {formatCurrency(entry.netWorth)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
          {leaderboardError && (
            <p className="text-xs text-warn" role="status">
              Leaderboard update failed — showing the last synced board. {leaderboardError}
            </p>
          )}
        </>
      )}
    </div>
  );
}
