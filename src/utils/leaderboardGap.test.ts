import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { describeLeaderboardGap, gapToEntryAbove, topEntriesWithSelf } from './leaderboardGap.ts';
import type { PersistentLeaderboardEntry } from '../services/persistentService.ts';

function entry(rank: number, netWorth: number, over: Partial<PersistentLeaderboardEntry> = {}): PersistentLeaderboardEntry {
  return {
    rank,
    accountId: rank,
    userId: rank * 100,
    username: `player${rank}`,
    isBot: false,
    personality: null,
    cash: netWorth,
    holdingsValue: 0,
    debt: 0,
    netWorth,
    ...over
  };
}

const entries = [entry(1, 12000), entry(2, 10500), entry(3, 9800), entry(4, 5000)];

describe('gapToEntryAbove', () => {
  it('reports the gap to the entry directly above', () => {
    const gap = gapToEntryAbove(entries, entries[2]);
    assert.deepEqual(gap, { aheadRank: 2, aheadUsername: 'player2', gap: 700 });
  });
  it('is null for the leader and for absent players', () => {
    assert.equal(gapToEntryAbove(entries, entries[0]), null);
    assert.equal(gapToEntryAbove(entries, entry(9, 100)), null);
    assert.equal(gapToEntryAbove(entries, null), null);
  });
  it('handles negative net worth honestly', () => {
    const board = [entry(1, 100), entry(2, -50)];
    const gap = gapToEntryAbove(board, board[1]);
    assert.equal(gap?.gap, 150);
  });
});

describe('describeLeaderboardGap', () => {
  it('states the gap to the entry above', () => {
    const gap = gapToEntryAbove(entries, entries[2]);
    if (!gap) throw new Error('expected a gap');
    assert.equal(describeLeaderboardGap(gap), '£700.00 behind #2 (player2)');
  });
  it('says "Level with" when the gap is exactly zero — never "£0.00 behind"', () => {
    const board = [entry(1, 12000), entry(2, 9800), entry(3, 9800)];
    const gap = gapToEntryAbove(board, board[2]);
    if (!gap) throw new Error('expected a gap');
    assert.equal(gap.gap, 0);
    assert.equal(describeLeaderboardGap(gap), 'Level with #2 (player2)');
    assert.doesNotMatch(describeLeaderboardGap(gap), /behind|£0\.00/);
  });
});

describe('topEntriesWithSelf', () => {
  it('returns the top N in backend order', () => {
    assert.deepEqual(topEntriesWithSelf(entries, null, 3).map((e) => e.rank), [1, 2, 3]);
  });
  it('appends the player when outside the top N', () => {
    assert.deepEqual(topEntriesWithSelf(entries, entries[3], 3).map((e) => e.rank), [1, 2, 3, 4]);
  });
  it('does not duplicate the player when already in the top N', () => {
    assert.deepEqual(topEntriesWithSelf(entries, entries[1], 3).map((e) => e.rank), [1, 2, 3]);
  });
});
