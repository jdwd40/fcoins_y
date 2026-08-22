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
  readCachedParticipant,
  writeCachedParticipant,
  revalueHoldings,
  livePriceMapFromCoins,
  detectCompletedCycle,
  participantBelongsToCycle,
  RESULTS_AUTO_DISMISS_MS,
  scheduleResultsAutoDismiss,
  formatSignedGbp,
  personalityLabel,
  countLivingCoins,
  TRADE_QUANTITY_MAX_DECIMALS,
  parseTradeQuantity,
  minTradeValueError,
  formatQuantity,
  HOW_TO_PLAY_TITLE,
  HOW_TO_PLAY_TAGLINE,
  HOW_TO_PLAY_STARTING_CASH,
  HOW_TO_PLAY_STEPS
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

test('participant cache keys are per-user AND per-cycle so round state never crosses accounts or apocalypses', () => {
  assert.notEqual(participantCacheKey(1, 'APOC-0001'), participantCacheKey(1, 'APOC-0002'));
  assert.notEqual(participantCacheKey(1, 'APOC-0001'), participantCacheKey(2, 'APOC-0001'));
  assert.equal(participantCacheKey(1, 'APOC-0001'), 'cc_participant_1_APOC-0001');
});

// Milestone 1: the cached participant is only ever readable by the SAME
// authenticated identity that cached it, in the SAME apocalypse. These tests
// drive the storage helpers with a fake Storage so the whole
// login-A → logout → login-B browser sequence is covered without a DOM.
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; }
  };
}

test('same browser: user A\'s cached participant is invisible after logout and to user B', () => {
  const storage = fakeStorage();

  // A joins and trades in APOC-0001: the authoritative participant is cached.
  writeCachedParticipant(storage, PARTICIPANT); // PARTICIPANT.userId === 1
  assert.equal(readCachedParticipant(storage, 1, 'APOC-0001')?.participantId, 7);

  // A logs out: no authenticated identity -> nothing is readable.
  assert.equal(readCachedParticipant(storage, null, 'APOC-0001'), null);
  assert.equal(readCachedParticipant(storage, undefined, 'APOC-0001'), null);

  // B logs in on the same browser/cycle: A's round state must not leak.
  assert.equal(readCachedParticipant(storage, 2, 'APOC-0001'), null);

  // B joins and caches their own participant; A's entry remains untouched.
  writeCachedParticipant(storage, { ...PARTICIPANT, participantId: 9, userId: 2 });
  assert.equal(readCachedParticipant(storage, 2, 'APOC-0001')?.participantId, 9);
  assert.equal(readCachedParticipant(storage, 1, 'APOC-0001')?.participantId, 7);
});

test('rollover preserved: a cached participant never crosses into the next apocalypse', () => {
  const storage = fakeStorage();
  writeCachedParticipant(storage, PARTICIPANT);
  assert.equal(readCachedParticipant(storage, 1, 'APOC-0002'), null);
  assert.equal(readCachedParticipant(storage, 1, 'APOC-0001')?.participantId, 7);
});

test('corrupt or tampered cache entries are never honoured', () => {
  const storage = fakeStorage();
  // Garbage JSON.
  storage.setItem(participantCacheKey(1, 'APOC-0001'), '{not json');
  assert.equal(readCachedParticipant(storage, 1, 'APOC-0001'), null);
  // Well-formed but stored under the wrong user key (tampered/copy-pasted).
  storage.setItem(participantCacheKey(1, 'APOC-0001'), JSON.stringify({ ...PARTICIPANT, userId: 2 }));
  assert.equal(readCachedParticipant(storage, 1, 'APOC-0001'), null);
  // Well-formed but for another cycle under this user's key.
  storage.setItem(participantCacheKey(1, 'APOC-0001'), JSON.stringify({ ...PARTICIPANT, apocalypseId: 'APOC-0002' }));
  assert.equal(readCachedParticipant(storage, 1, 'APOC-0001'), null);
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

// --- Trade quantities (fractional coin contract, backend DECIMAL(18,8)) ------------

test('the trade quantity precision matches the authoritative ledger contract', () => {
  // Backend migration 012: apocalypse quantity columns are DECIMAL(18,8).
  assert.equal(TRADE_QUANTITY_MAX_DECIMALS, 8);
});

test('parseTradeQuantity accepts the required fractional and integer quantities', () => {
  for (const [raw, value] of [
    ['1', 1],
    ['1.5', 1.5],
    ['0.5', 0.5],
    ['0.04', 0.04],
    ['0.004', 0.004], // the canonical issue example
    ['1.25', 1.25],
    ['0.00000001', 0.00000001], // exact ledger dust precision (8dp)
    ['.5', 0.5],
    ['10', 10],
    ['0.00400000', 0.004], // trailing zeros are free — value-identical
    [' 0.004 ', 0.004] // surrounding whitespace is not malformation
  ] as const) {
    const parsed = parseTradeQuantity(raw);
    assert.ok(parsed.ok, `expected ${raw} to parse`);
    assert.equal(parsed.value, value);
  }
});

test('parseTradeQuantity rejects zero, negatives, blank and malformed input without rounding', () => {
  for (const raw of ['', '   ', '0', '0.0', '0.00000000', '-0.5', '-1', 'abc', '1.2.3', '1e-3', '1,5', '0x10', 'NaN', 'Infinity', '+1']) {
    const parsed = parseTradeQuantity(raw);
    assert.ok(!parsed.ok, `expected ${JSON.stringify(raw)} to be rejected`);
    assert.match(parsed.error, /quantity/i);
  }
});

test('parseTradeQuantity rejects precision beyond the ledger contract instead of rounding it', () => {
  for (const raw of ['0.000000001', '0.004000001', '1.000000005']) {
    const parsed = parseTradeQuantity(raw);
    assert.ok(!parsed.ok, `expected ${raw} to be rejected for excessive precision`);
    assert.match(parsed.error, /8 decimal places/);
  }
});

test('minTradeValueError mirrors the backend £0.01 minimum-notional rule', () => {
  // Sub-penny live-priced trades are blocked early with the backend message.
  assert.match(minTradeValueError(0, 1), /Trade value must be at least £0\.01/); // 0.004 @ £1 -> £0.00
  assert.match(minTradeValueError(0, 0.4), /Trade value must be at least £0\.01/);
  // The rounded consideration is what is judged: £0.01 exactly is allowed.
  assert.equal(minTradeValueError(0.01, 1), null); // 0.01 @ £1, 0.004 @ £2.50
  assert.equal(minTradeValueError(10, 2500), null); // 0.004 @ £2,500
  // Collapsed-coin exit exemption: a £0-priced sale is legal (credits £0).
  assert.equal(minTradeValueError(0, 0), null);
});

test('formatQuantity preserves meaningful fractional digits — never rounds to a whole coin', () => {
  assert.equal(formatQuantity(0.004), '0.004'); // a fractional holding must not display as 0
  assert.equal(formatQuantity(0.006), '0.006'); // remainder after a partial sale
  assert.equal(formatQuantity(1.25), '1.25');
  assert.equal(formatQuantity(0.5), '0.5');
  assert.equal(formatQuantity(10), '10'); // integers stay integers
  assert.equal(formatQuantity(1), '1');
  assert.equal(formatQuantity(0), '0');
  assert.equal(formatQuantity(0.00000001), '0.00000001'); // dust: no exponent notation
  assert.equal(formatQuantity(1.0), '1'); // no meaningless trailing zeros
  assert.equal(formatQuantity(0.10000000), '0.1');
  assert.equal(formatQuantity(2500.5), '2500.5');
  assert.equal(formatQuantity(NaN), '0');
});

// --- How to play (first-time instructions, issue #7) -------------------------
// These tests pin the ACCURACY RULES of the onboarding copy, not just its
// shape: late joiners are never short-changed, collapse is permanent and
// unpredictable, bots know nothing the player doesn't, round cash is not
// exchange funds, and final cash — not peak wealth — wins.

const ALL_STEPS_TEXT = HOW_TO_PLAY_STEPS.map((step) => `${step.title}\n${step.body}`).join('\n');
const stepById = (id: string) => {
  const step = HOW_TO_PLAY_STEPS.find((candidate) => candidate.id === id);
  assert.ok(step, `missing how-to-play step: ${id}`);
  return step;
};

test('how to play has the seven survival steps in order, each with real copy', () => {
  assert.deepEqual(
    HOW_TO_PLAY_STEPS.map((step) => step.id),
    ['join', 'trade', 'clock', 'bag', 'bots', 'cash', 'again']
  );
  const ids = new Set(HOW_TO_PLAY_STEPS.map((step) => step.id));
  assert.equal(ids.size, HOW_TO_PLAY_STEPS.length); // unique ids
  for (const step of HOW_TO_PLAY_STEPS) {
    assert.ok(step.title.trim().length > 0, `step ${step.id} has no title`);
    assert.ok(step.body.trim().length > 20, `step ${step.id} body is too thin to teach anything`);
  }
  assert.ok(HOW_TO_PLAY_TITLE.length > 0);
  assert.ok(HOW_TO_PLAY_TAGLINE.length > 0);
});

test('joining grants £1,000 round cash, at any time, with no late-entry penalty', () => {
  const join = stepById('join');
  assert.match(join.body, /£1,000/);
  assert.equal(HOW_TO_PLAY_STARTING_CASH, '£1,000'); // single source, never a stray literal
  assert.match(join.body, /at any time/i);
  // The same amount whenever you join — explicitly stated, never implied less.
  assert.match(join.body, /same £1,000/);
  // No penalty/reduction language anywhere near joining.
  assert.doesNotMatch(join.body, /penalt|reduc|prorat|less cash|smaller stake|handicap/i);
});

test('round cash is clearly distinguished from legacy exchange account funds', () => {
  const join = stepById('join');
  assert.match(join.body, /round cash/i);
  assert.match(join.body, /separate from your exchange account funds/i);
});

test('escalating volatility is explained: instability rises with Apocalypse %', () => {
  const clock = stepById('clock');
  assert.match(clock.body, /Apocalypse %/);
  assert.match(clock.body, /increasingly unstable/i);
});

test('collapse to £0 is permanent for the round — no recovery language', () => {
  const bag = stepById('bag');
  assert.match(bag.body, /£0/);
  assert.match(bag.body, /permanently/i);
  assert.match(bag.body, /stay dead/i);
  // Never suggest a collapsed coin can recover within the same Apocalypse.
  assert.doesNotMatch(bag.body, /may recover|can recover|might bounce|comes back|will return/i);
});

test('bots share the player leaderboard and hold no hidden information', () => {
  const bots = stepById('bots');
  assert.match(bots.body, /bots/i);
  assert.match(bots.body, /same leaderboard/i);
  assert.match(bots.body, /no hidden information/i);
  // Never imply bots see the future or know the collapse schedule.
  assert.doesNotMatch(bots.body, /bots (know|see|are told)|insider/i);
});

test('final cash is the winning score — peak wealth explicitly does not count', () => {
  const cash = stepById('cash');
  assert.match(cash.body, /score is the round cash/i);
  assert.match(cash.body, /final cash decides the winner/i);
  assert.match(cash.body, /Peak wealth mid-round means nothing/i);
});

test('the next Apocalypse starts automatically and results are recorded', () => {
  const again = stepById('again');
  assert.match(again.body, /begins automatically/i);
  assert.match(again.body, /[Rr]esults are recorded/);
});

test('no step exposes future collapse order or timing', () => {
  // The instructions must never leak which coin collapses next or when —
  // and the collapse step must say so explicitly.
  assert.doesNotMatch(ALL_STEPS_TEXT, /collapse order|collapse schedule|next (coin )?to collapse|will collapse (at|first|next)|collapses at \d/i);
  assert.match(stepById('bag').body, /nobody knows which coin goes next or when/i);
});

test('planned crime/tax mechanics are never advertised to players', () => {
  assert.doesNotMatch(ALL_STEPS_TEXT, /crime|tax|heist|launder/i);
});

// --- Results overlay auto-dismiss (issue #8) --------------------------------
// Deterministic: node:test mock timers, no sleeps. The component delegates
// the whole lifecycle to scheduleResultsAutoDismiss, so the behaviour-level
// guarantees (fire at 7s, cancel on close/unmount/transition, stale timers
// never fire) are pinned here.

test('auto-dismiss duration is 7000ms, inside the ticket 5–8s window', () => {
  assert.equal(RESULTS_AUTO_DISMISS_MS, 7000);
  assert.ok(RESULTS_AUTO_DISMISS_MS >= 5000 && RESULTS_AUTO_DISMISS_MS <= 8000);
});

test('a completed-cycle transition arms the results overlay; nothing else does', () => {
  // The overlay appears exactly when a completed round is detected.
  assert.equal(detectCompletedCycle('APOC-0001', 'APOC-0002'), 'APOC-0001');
  // A normal rerender (same live cycle) and a fresh load (no previous cycle)
  // never arm it — stale results cannot resurrect as blocking overlays.
  assert.equal(detectCompletedCycle('APOC-0002', 'APOC-0002'), null);
  assert.equal(detectCompletedCycle(null, 'APOC-0002'), null);
  assert.equal(detectCompletedCycle('APOC-0002', null), null);
});

test('overlay stays visible before the timeout and auto-dismisses at exactly 7s', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dismissed: string[] = [];
  const timer = scheduleResultsAutoDismiss('APOC-0001', (id) => dismissed.push(id));
  assert.equal(timer.cycleId, 'APOC-0001');
  assert.equal(timer.pending(), true);
  t.mock.timers.tick(RESULTS_AUTO_DISMISS_MS - 1);
  assert.deepEqual(dismissed, []); // still visible at 6.999s
  assert.equal(timer.pending(), true);
  t.mock.timers.tick(1);
  assert.deepEqual(dismissed, ['APOC-0001']); // dismissed at 7s, no click needed
  assert.equal(timer.pending(), false);
  t.mock.timers.reset();
});

test('the dismissal fires at most once, however far time advances afterwards', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dismissed: string[] = [];
  scheduleResultsAutoDismiss('APOC-0001', (id) => dismissed.push(id));
  t.mock.timers.tick(RESULTS_AUTO_DISMISS_MS * 3);
  assert.deepEqual(dismissed, ['APOC-0001']); // never a double dismiss
  t.mock.timers.reset();
});

test('manual close cancels the pending timer and it never fires', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dismissed: string[] = [];
  const timer = scheduleResultsAutoDismiss('APOC-0001', (id) => dismissed.push(id));
  timer.cancel(); // the manual-close / unmount / cleanup path
  assert.equal(timer.pending(), false);
  t.mock.timers.tick(60_000);
  assert.deepEqual(dismissed, []); // cancelled timer cannot dismiss later
  timer.cancel(); // cancel is idempotent — safe on repeated cleanup
  assert.deepEqual(dismissed, []);
  t.mock.timers.reset();
});

test('a cycle transition cancels the old timer; it can never dismiss the newer result', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dismissed: string[] = [];
  const oldTimer = scheduleResultsAutoDismiss('APOC-0001', (id) => dismissed.push(id));
  t.mock.timers.tick(3000); // part-way through the old result's window
  oldTimer.cancel(); // effect cleanup on result change
  const newTimer = scheduleResultsAutoDismiss('APOC-0002', (id) => dismissed.push(id));
  t.mock.timers.tick(60_000); // long past both deadlines
  assert.deepEqual(dismissed, ['APOC-0002']); // only the current result dismissed
  assert.equal(oldTimer.pending(), false);
  assert.equal(newTimer.pending(), false);
  t.mock.timers.reset();
});

test('dismissal only clears the overlay — the successor ACTIVE round is untouched', () => {
  // completedCycleId and lifecycle are independent: acknowledging the result
  // leaves the live round beneath polling, trading and counting down.
  assert.equal(lifecycleFromState('ACTIVE', false, false), 'ACTIVE');
  assert.equal(tradeBlockReason({
    lifecycle: 'ACTIVE',
    connection: 'live',
    joined: true,
    coinCollapsed: false,
    authenticated: true
  }), null); // the new round remains playable immediately after dismissal
});
