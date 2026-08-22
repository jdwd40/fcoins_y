import { useEffect, useState } from 'react';
import { Skull, Bot, Crown, History, RefreshCw } from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { useAuth } from '../context/AuthContext';
import {
  getCycleResults,
  getRecentLeaderboards
} from '../services/gameService.ts';
import type { CycleResults, RecentLeaderboards, ResultRow } from '../services/gameService.ts';
import { formatCurrency } from '../services/transactionService.ts';
import {
  formatSignedGbp,
  personalityLabel,
  scheduleResultsAutoDismiss
} from '../utils/gameLogic.ts';

function ResultRowItem({ row, mine }: { row: ResultRow; mine: boolean }) {
  const profit = row.netProfit >= 0;
  return (
    <li className={`flex items-center gap-3 px-4 py-2.5 ${mine ? 'leaderboard-me' : ''}`}>
      <span className="font-mono text-sm font-bold text-ink tnum w-8 shrink-0">
        {row.rank === 1 ? <Crown className="w-4 h-4 text-gold inline" aria-label="Winner" /> : `#${row.rank}`}
      </span>
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <span className="font-display font-semibold text-ink truncate">{row.username}</span>
        {row.isBot && (
          <span className="chip shrink-0">
            <Bot className="w-3 h-3" /> BOT{row.personality ? ` · ${personalityLabel(row.personality)}` : ''}
          </span>
        )}
        {mine && <span className="label text-gold shrink-0">You</span>}
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-sm font-semibold text-ink tnum">{formatCurrency(row.finalCash)}</div>
        <div className={`font-mono text-[0.66rem] tnum ${profit ? 'text-verdigris' : 'text-oxblood'}`}>
          {formatSignedGbp(row.netProfit)}
        </div>
      </div>
      <div className="hidden sm:block text-right shrink-0 font-mono text-[0.66rem] text-ink-mute tnum w-24">
        {row.tradeCount} trades · peak {formatCurrency(row.peakWealth)}
      </div>
    </li>
  );
}

// End-of-round results experience: shown when the live cycle id changes
// (Core 6 transition detection). Reads the immutable snapshot from
// GET /api/game/results/:cycleId — never recalculated client-side.
export function ResultsOverlay() {
  const { user } = useAuth();
  const { completedCycleId, acknowledgeCompleted } = useGame();
  const [results, setResults] = useState<CycleResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!completedCycleId) return;
    let cancelled = false;
    setResults(null);
    setError(null);
    getCycleResults(completedCycleId)
      .then((data) => { if (!cancelled) setResults(data); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Results unavailable');
      });
    return () => { cancelled = true; };
  }, [completedCycleId]);

  // Auto-dismiss (issue #8): the results overlay is a pause, not a wall —
  // Crypto Chaos never waits for a click. Exactly one timer per completed
  // cycle, bound to that cycle id; the effect cleanup cancels it on unmount,
  // on cycle transition and on manual close (acknowledgeCompleted nulls
  // completedCycleId, re-running this effect). A stale timer therefore can
  // never dismiss a newer round's result, and dismissal just reveals the
  // live successor round, which keeps polling underneath the whole time.
  useEffect(() => {
    if (!completedCycleId) return;
    let cancelled = false;
    const timer = scheduleResultsAutoDismiss(completedCycleId, (cycleId) => {
      if (cancelled || cycleId !== completedCycleId) return;
      acknowledgeCompleted();
    });
    return () => {
      cancelled = true;
      timer.cancel();
    };
  }, [completedCycleId, acknowledgeCompleted]);

  if (!completedCycleId) return null;

  const myResult = results?.results.find((row) => user && row.userId === user.id) ?? null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-label={`Final results for ${completedCycleId}`}>
      <div className="flex min-h-screen items-end sm:items-center justify-center p-0 sm:p-6">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={acknowledgeCompleted} aria-hidden="true" />
        <div className="relative w-full max-w-3xl bg-card border border-rule rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[94vh] overflow-y-auto">
          <div className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <Skull className="w-8 h-8 text-oxblood mx-auto mb-3" />
              <div className="label text-oxblood mb-1">Final reckoning</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink">
                {completedCycleId.replace('APOC-', 'APOCALYPSE ')} has ended
              </h2>
              <p className="text-sm text-ink-mute mt-2">Immutable results. The ledger does not lie.</p>
            </div>

            {error && (
              <div className="border-l-2 border-oxblood bg-paper-alt p-4 mb-4" role="alert">
                <p className="font-mono text-xs text-oxblood">{error}</p>
              </div>
            )}

            {!results && !error && (
              <div className="text-center py-10 label animate-flicker">Reading the ruins…</div>
            )}

            {results && results.results.length === 0 && (
              <p className="text-center text-sm text-ink-mute py-6">
                Nobody dared this apocalypse. The coins died alone.
              </p>
            )}

            {results && results.results.length > 0 && (
              <ol className="divide-rule border border-rule rounded-xl overflow-hidden mb-5" aria-label="Final results">
                {results.results.map((row) => (
                  <ResultRowItem key={row.participantId} row={row} mine={!!user && row.userId === user.id} />
                ))}
              </ol>
            )}

            {myResult && (
              <p className="text-center text-sm text-ink-dim mb-5">
                You finished <strong className="text-ink">#{myResult.rank}</strong> with{' '}
                <strong className="text-ink">{formatCurrency(myResult.finalCash)}</strong>{' '}
                (<span className={myResult.netProfit >= 0 ? 'text-verdigris' : 'text-oxblood'}>
                  {formatSignedGbp(myResult.netProfit)}
                </span>).
              </p>
            )}

            <button onClick={acknowledgeCompleted} className="btn-gold w-full">
              Face the next apocalypse
            </button>
            <p className="mt-3 text-center label text-ink-mute">
              The next apocalypse is already running — this closes automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Lightweight recent-rounds history (GET /api/game/leaderboards/recent).
// Small panel, not a statistics platform.
export function RecentResultsPanel() {
  const { user } = useAuth();
  const { resultsVersion } = useGame();
  const [recent, setRecent] = useState<RecentLeaderboards | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRecentLeaderboards(5)
      .then((data) => { if (!cancelled) { setRecent(data); setError(null); } })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'History unavailable');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [resultsVersion]); // refetch whenever a round completes

  return (
    <div className="paper-card overflow-hidden">
      <div className="px-5 py-4 border-b border-rule flex items-center justify-between">
        <div>
          <div className="label">Recent apocalypses</div>
          <h3 className="font-display text-xl font-bold text-ink">The graveyard</h3>
        </div>
        <History className="w-4 h-4 text-ink-mute" />
      </div>

      {loading && !recent && <div className="px-5 py-6 label animate-flicker">Digging…</div>}
      {error && (
        <div className="px-5 py-4 flex items-center gap-2" role="alert">
          <span className="font-mono text-xs text-oxblood">{error}</span>
          <RefreshCw className="w-3 h-3 text-ink-mute" />
        </div>
      )}
      {recent && recent.leaderboards.length === 0 && (
        <p className="px-5 py-6 text-sm text-ink-mute">No completed apocalypses yet. History starts soon.</p>
      )}
      {recent && recent.leaderboards.length > 0 && (
        <ul className="divide-rule">
          {recent.leaderboards.map((board) => {
            const winner = board.results[0] ?? null;
            const mine = board.results.find((row) => user && row.userId === user.id) ?? null;
            return (
              <li key={board.cycleId} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-bold text-ink">{board.cycleId}</div>
                  <div className="font-mono text-[0.66rem] text-ink-mute">
                    {board.resultCount} competitor{board.resultCount === 1 ? '' : 's'}
                    {board.settledAt && ` · settled ${new Date(board.settledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </div>
                {winner && (
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs text-ink">
                      <Crown className="w-3 h-3 text-gold inline mr-1" />
                      {winner.username}
                      {winner.isBot && <Bot className="w-3 h-3 inline ml-1 text-ink-mute" aria-label="Bot winner" />}
                    </div>
                    <div className="font-mono text-[0.66rem] text-ink-mute tnum">{formatCurrency(winner.finalCash)}</div>
                  </div>
                )}
                {mine && (
                  <span className="chip shrink-0">You #{mine.rank}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
