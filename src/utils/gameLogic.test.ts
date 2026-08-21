// Pure game-UI logic contract tests (Crypto Chaos Core 7). Runs under plain
// Node (node --test); no DOM. These functions are the single source the
// components delegate to, so behaviour-level guarantees live here.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  anchorFromState,
  displayRemainingMs,
  formatCountdown,
  connectionState,
  STALE_AFTER_MS,
  meterPhase,
  METER_PHASE_LABEL,
  lifecycleFromState,
  isCoinCollapsed,
  tradeBlockReason,
  TRADE_BLOCK_LABEL,
  findMyEntry,
  participantCacheKey,
  revalueHoldings,
  livePriceMapFromCoins,
  detectCompletedCycle,
  participantBelongsToCycle,
  formatSignedGbp,
  personalityLabel,
  countLivingCoins
} from './gameLogic.ts';
import type { LeaderboardEntry, RoundParticipant } from '../services/gameService.ts';

// --- Countdown authority (sections 2) --------------------------------------

const STATE_FRAGMENT = { remainingMs: 600_000, serverTime: '2026-08-21T10:00:00.000Z' };

test('the display countdown is derived from server state at sync time', () => {
  const anchor = anchorFromState(STATE_FRAGMENT, 1_000_000);
  assert.equal(displayRemainingMs(anchor, 1_000_000), 600_000);
  assert.equal(displayRemainingMs(anchor, 1_030_000), 570_000); // 30s elapsed
  assert.equal(displayRemainingMs(anchor, 1_700_000), 0); // clamped, never negative
});

test('sleep/background time counts against the countdown (real elapsed time)', () => {
  const anchor = anchorFromState(STATE_FRAGMENT, 1_000_000);
  // Laptop slept for an hour: the round legitimately advanced.
  assert.equal(displayRemainingMs(anchor, 1_000_000 + 3_600_000), 0);
});

test('resync re-anchors and corrects drift automatically', () => {
  const first = anchorFromState(STATE_FRAGMENT, 1_000_000);
  // Local display drifted: server says 540s remain at the next sync.
  const second = anchorFromState({ ...STATE_FRAGMENT, remainingMs: 540_000 }, 1_090_000);
  assert.notEqual(displayRemainingMs(first, 1_090_000), 540_000); // drift visible on old anchor
  assert.equal(displayRemainingMs(second, 1_090_000), 540_000); // corrected instantly
  assert.equal(displayRemainingMs(second, 1_090_000 + 10_000), 530_000);
});

test('a null anchor yields zero rather than a confident lie', () => {
  assert.equal(displayRemainingMs(null, Date.now()), 0);
});

test('formatCountdown renders mm:ss and h:mm:ss', () => {
  assert.equal(formatCountdown(0), '00:00');
  assert.equal(formatCountdown(59_000), '00:59');
  assert.equal(formatCountdown(60_000), '01:00');
  assert.equal(formatCountdown(517_000), '08:37');
  assert.equal(formatCountdown(3_599_000), '59:59');
  assert.equal(formatCountdown(3_600_000), '1:00:00');
  assert.equal(formatCountdown(-5000), '00:00');
});

// --- Stale/offline (sections 22) --------------------------------------------

test('connection state: live -> stale -> never-synced offline', () => {
  const t = 10_000_000;
  assert.equal(connectionState(t, t), 'live');
  assert.equal(connectionState(t, t + STALE_AFTER_MS), 'live');
  assert.equal(connectionState(t, t + STALE_AFTER_MS + 1), 'stale');
  assert.equal(connectionState(null, t), 'offline');
});

// --- Apocalypse meter (section 3) --------------------------------------------

test('meter phases escalate with the backend apocalypse percent', () => {
  assert.equal(meterPhase(0), 'CALM');
  assert.equal(meterPhase(49.9), 'CALM');
  assert.equal(meterPhase(50), 'UNSTABLE');
  assert.equal(meterPhase(69.9), 'UNSTABLE');
  assert.equal(meterPhase(70), 'DANGEROUS'); // Core 3 collapse window boundary
  assert.equal(meterPhase(89.9), 'DANGEROUS');
  assert.equal(meterPhase(90), 'EXTREME');
  assert.equal(meterPhase(100), 'EXTREME');
  assert.equal(meterPhase(120), 'EXTREME'); // clamped
  assert.equal(meterPhase(-5), 'CALM'); // clamped
  for (const phase of ['CALM', 'UNSTABLE', 'DANGEROUS', 'EXTREME'] as const) {
    assert.ok(METER_PHASE_LABEL[phase].length > 0);
  }
});

// --- Lifecycle (sections 1, 10) ------------------------------------------------

test('lifecycle: SETTLING wins over raw status, loading without state is LOADING', () => {
  assert.equal(lifecycleFromState(null, false, true), 'LOADING');
  assert.equal(lifecycleFromState('ACTIVE', false, false), 'ACTIVE');
  assert.equal(lifecycleFromState('ACTIVE', true, false), 'SETTLING'); // leaderboard 409 signal
  assert.equal(lifecycleFromState('SETTLING', false, false), 'SETTLING');
  assert.equal(lifecycleFromState('COMPLETED', false, false), 'COMPLETED');
});

// --- Collapsed coins (sections 4, 5) ----------------------------------------------

test('collapsed detection: exactly £0 (formatted or numeric) is dead', () => {
  assert.equal(isCoinCollapsed(0), true);
  assert.equal(isCoinCollapsed('0.00'), true);
  assert.equal(isCoinCollapsed('£0.00'), true);
  assert.equal(isCoinCollapsed(0.01), false);
  assert.equal(isCoinCollapsed('£1,234.56'), false);
});

test('living-coin counting drives header copy', () => {
  const coins = [
    { current_price: '£10.00' },
    { current_price: '£0.00' },
    { current_price: 25.5 }
  ];
  assert.equal(countLivingCoins(coins), 2);
});

// --- Trade gate (sections 5, 7, 8, 10) ----------------------------------------------

const OPEN = {
  lifecycle: 'ACTIVE',
  connection: 'live',
  joined: true,
  coinCollapsed: false,
  authenticated: true
} as const;

test('ACTIVE + joined + live connection permits trading', () => {
  assert.equal(tradeBlockReason({ ...OPEN }), null);
});

test('every blocking state produces its specific user-facing reason', () => {
  assert.equal(tradeBlockReason({ ...OPEN, authenticated: false }), 'not-authenticated');
  assert.equal(tradeBlockReason({ ...OPEN, joined: false }), 'not-joined');
  assert.equal(tradeBlockReason({ ...OPEN, lifecycle: 'SETTLING' }), 'settling');
  assert.equal(tradeBlockReason({ ...OPEN, lifecycle: 'COMPLETED' }), 'completed');
  assert.equal(tradeBlockReason({ ...OPEN, lifecycle: 'LOADING' }), 'loading');
  assert.equal(tradeBlockReason({ ...OPEN, connection: 'stale' }), 'stale');
  assert.equal(tradeBlockReason({ ...OPEN, connection: 'offline' }), 'stale');
  assert.equal(tradeBlockReason({ ...OPEN, coinCollapsed: true }), 'coin-collapsed');
  for (const reason of ['not-authenticated', 'not-joined', 'settling', 'completed', 'loading', 'stale', 'coin-collapsed'] as const) {
    assert.ok(TRADE_BLOCK_LABEL[reason].length > 0);
  }
});

test('SETTLING blocks trading even when everything else is healthy', () => {
  assert.equal(tradeBlockReason({ ...OPEN, lifecycle: 'SETTLING' }), 'settling');
});

test('a stale connection blocks trading on potentially outdated state', () => {
  assert.equal(tradeBlockReason({ ...OPEN, connection: 'stale' }), 'stale');
});

// --- Leaderboard helpers (sections 9) --------------------------------------------------

const ENTRIES: LeaderboardEntry[] = [
  {
    rank: 1, participantId: 11, userId: 501, username: 'cool_bot', isBot: true,
    personality: 'reckless', joinedAt: '2026-08-20T10:00:05.000Z',
    currentCash: 1000, currentWealth: 1200, peakWealth: 1250
  },
  {
    rank: 2, participantId: 7, userId: 1, username: 'john_doe', isBot: false,
    personality: null, joinedAt: '2026-08-20T10:01:00.000Z',
    currentCash: 750, currentWealth: 990, peakWealth: 1010
  }
];

test('findMyEntry locates the signed-in human, whoever leads (bots can be #1)', () => {
  const mine = findMyEntry(ENTRIES, 1);
  assert.equal(mine?.username, 'john_doe');
  assert.equal(mine?.rank, 2);
  assert.equal(ENTRIES[0].isBot, true); // the leader is a bot — allowed
  assert.equal(findMyEntry(ENTRIES, 999), null);
  assert.equal(findMyEntry(ENTRIES, null), null);
  assert.equal(findMyEntry(undefined, 1), null);
});

// --- Round state cache + live revaluation (sections 7, 13) -------------------------------

const PARTICIPANT: RoundParticipant = {
  participantId: 7, cycleId: 1, apocalypseId: 'APOC-0001', userId: 1, isBot: false,
  joinedAt: '2026-08-20T10:01:00.000Z', startingCash: 1000, currentCash: 500,
  holdingsValue: 500, wealth: 1000, peakWealth: 1000, status: 'ACTIVE', finalCash: null,
  holdings: [
    { coinId: 2, symbol: 'DOGE', quantity: 10, currentPrice: 50, currentValue: 500 },
    { coinId: 3, symbol: 'DEAD', quantity: 4, currentPrice: 0, currentValue: 0 }
  ]
};

test('participant cache keys are per-cycle so round state never crosses apocalypses', () => {
  assert.notEqual(participantCacheKey('APOC-0001'), participantCacheKey('APOC-0002'));
  assert.equal(participantCacheKey('APOC-0001'), 'cc_participant_APOC-0001');
});

test('holdings revalue against live prices; dead coins contribute exactly £0', () => {
  const live = livePriceMapFromCoins([
    { coin_id: 2, current_price: '£40.00' }, // dropped from 50
    { coin_id: 3, current_price: '£0.00' }
  ]);
  assert.equal(revalueHoldings(PARTICIPANT.holdings, live), 400); // 10*40 + 4*0
});

test('a coin missing from the live list values at £0 (never an optimistic guess)', () => {
  assert.equal(revalueHoldings(PARTICIPANT.holdings, new Map()), 0);
});

// --- Cycle transitions (sections 11, 13) -------------------------------------------------

test('a cycle id change marks the previous apocalypse completed exactly once', () => {
  assert.equal(detectCompletedCycle('APOC-0001', 'APOC-0002'), 'APOC-0001');
  assert.equal(detectCompletedCycle('APOC-0001', 'APOC-0001'), null);
  assert.equal(detectCompletedCycle(null, 'APOC-0001'), null);
  assert.equal(detectCompletedCycle('APOC-0001', null), null);
});

test('successor cycle invalidates the previous round participant state', () => {
  assert.equal(participantBelongsToCycle(PARTICIPANT, 'APOC-0001'), true);
  assert.equal(participantBelongsToCycle(PARTICIPANT, 'APOC-0002'), false); // join state again
  assert.equal(participantBelongsToCycle(null, 'APOC-0002'), false);
});

// --- Presentation ---------------------------------------------------------------------

test('signed GBP and personality labels render results readably', () => {
  assert.equal(formatSignedGbp(250.5), '+£250.50');
  assert.equal(formatSignedGbp(-249.5), '-£249.50');
  assert.equal(personalityLabel('dip_buyer'), 'Dip Buyer');
  assert.equal(personalityLabel(null), null);
});
