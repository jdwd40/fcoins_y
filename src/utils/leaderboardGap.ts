// After-Hours Exchange: leaderboard standing helpers.
//
// Backend rank and order are authoritative — these helpers only READ the
// backend-ordered entries to describe the signed-in player's standing. They
// never re-sort and never recompute a rank.

import type { PersistentLeaderboardEntry } from '../services/persistentService.ts';
import { formatCurrency } from '../services/transactionService.ts';

export interface LeaderboardGap {
  /** Backend rank of the entry directly above the player. */
  aheadRank: number;
  aheadUsername: string;
  /** Difference of the two backend netWorth values (always >= 0 here). */
  gap: number;
}

/** The gap to the entry directly above `mine` in backend order, or null when
 *  the player leads the board (or is not on it). */
export function gapToEntryAbove(
  entries: PersistentLeaderboardEntry[],
  mine: PersistentLeaderboardEntry | null
): LeaderboardGap | null {
  if (!mine) return null;
  const index = entries.findIndex((entry) => entry.accountId === mine.accountId);
  if (index <= 0) return null; // leading (index 0) or absent (-1)
  const ahead = entries[index - 1];
  return {
    aheadRank: ahead.rank,
    aheadUsername: ahead.username,
    gap: Math.round((ahead.netWorth - mine.netWorth) * 100) / 100
  };
}

/** Player-facing standing sentence. A zero gap means the player is LEVEL
 *  with the entry above — never "£0.00 behind". */
export function describeLeaderboardGap(gap: LeaderboardGap): string {
  if (gap.gap === 0) return `Level with #${gap.aheadRank} (${gap.aheadUsername})`;
  return `${formatCurrency(gap.gap)} behind #${gap.aheadRank} (${gap.aheadUsername})`;
}

/** Backend-order slice for a "top N plus you" peek. The player's row is
 *  appended when outside the top N; rank values stay verbatim. */
export function topEntriesWithSelf(
  entries: PersistentLeaderboardEntry[],
  mine: PersistentLeaderboardEntry | null,
  count = 3
): PersistentLeaderboardEntry[] {
  const top = entries.slice(0, count);
  if (mine && !top.some((entry) => entry.accountId === mine.accountId)) {
    return [...top, mine];
  }
  return top;
}
