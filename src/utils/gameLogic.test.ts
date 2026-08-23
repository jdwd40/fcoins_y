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
  HOW_TO_PLAY_STEPS,
  GAME_STARTING_CASH_LABEL,
  displayRoundCash,
  LEADERBOARD_RULE_COPY,
  LEADERBOARD_BREAKEVEN_COPY,
  CASH_EVENT_TYPE_LABEL,
  formatCashEventAmount,
  formatAbsoluteTimestamp,
  formatActivityTimestamp,
  normalizeCashEvents,
  findNewCashEvents,
  summariseDrainToast
} from './gameLogic.ts';
import type { CashEvent, LeaderboardEntry, RoundParticipant } from '../services/gameService.ts';

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

// --- The one gameplay balance: Cash (issue #10) --------------------------------

test('the starting-cash label is £10,000 — single-sourced, never a £1,000 remnant', () => {
  assert.equal(GAME_STARTING_CASH_LABEL, '£10,000');
  assert.equal(HOW_TO_PLAY_STARTING_CASH, GAME_STARTING_CASH_LABEL);
  assert.match(LEADERBOARD_RULE_COPY, /£10,000/);
  assert.match(LEADERBOARD_BREAKEVEN_COPY, /£10,000/);
});

test('displayRoundCash: the live leaderboard row wins, the cached participant is the fallback', () => {
  assert.equal(displayRoundCash({ currentCash: 8123.45 }, { currentCash: 10000 }), 8123.45);
  assert.equal(displayRoundCash(null, { currentCash: 10000 }), 10000);
  // Neither synced yet: a loading zero, never a fabricated £10,000 presented
  // as authoritative — the panel renders its syncing state instead.
  assert.equal(displayRoundCash(null, null), 0);
});

test('regression #10: legacy users.funds (£325.09) is never Crypto Chaos spending power', () => {
  // Production fixture from the issue: the account carries legacy exchange
  // funds of £325.09 while the server-owned Apocalypse participant holds
  // £10,000.00 Cash. The derivation has NO user/funds input at all — the
  // £325.09 cannot leak into the game surface through this path.
  const legacyUser = { id: 1, funds: 325.09 };
  const participant = { ...PARTICIPANT, startingCash: 10000, currentCash: 10000 };
  const rendered = displayRoundCash(null, participant);
  assert.equal(rendered, 10000);
  assert.notEqual(rendered, legacyUser.funds);
  assert.notEqual(rendered, 325.09);
  // A drain-affected returning player: authoritative changed Cash wins over
  // any assumption that Cash is "still £10,000 because the UI just loaded".
  assert.equal(displayRoundCash(null, { ...participant, currentCash: 8432.10 }), 8432.10);
  // And legacy funds never rescue a missing participant either.
  assert.equal(displayRoundCash(null, null), 0);
});

test('the not-joined trade block is a syncing state, never a join instruction', () => {
  assert.equal(tradeBlockReason({ ...OPEN, joined: false }), 'not-joined');
  assert.match(TRADE_BLOCK_LABEL['not-joined'], /[Ss]yncing/);
  assert.doesNotMatch(TRADE_BLOCK_LABEL['not-joined'], /\bjoin\b/i);
});

// --- Leaderboard helpers (sections 9) --------------------------------------------------

const ENTRIES: LeaderboardEntry[] = [
  {
    rank: 1, participantId: 11, userId: 501, username: 'cool_bot', isBot: true,
    personality: 'reckless', joinedAt: '2026-08-20T10:00:05.000Z',
    currentCash: 10000, currentWealth: 12000, peakWealth: 12500
  },
  {
    rank: 2, participantId: 7, userId: 1, username: 'john_doe', isBot: false,
    personality: null, joinedAt: '2026-08-20T10:01:00.000Z',
    currentCash: 9750, currentWealth: 9990, peakWealth: 10010
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
  joinedAt: '2026-08-20T10:01:00.000Z', startingCash: 10000, currentCash: 9500,
  holdingsValue: 500, wealth: 10000, peakWealth: 10000, status: 'ACTIVE', finalCash: null,
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

// --- How to play (first-time instructions, issues #7 + #10) --------------------
// These tests pin the ACCURACY RULES of the onboarding copy, not just its
// shape: there is always an Apocalypse running, entry is automatic on sign-in
// (no JOIN gate), every Apocalypse starts at £10,000 Cash, collapse is
// permanent and unpredictable, passive drains are explained, bots know nothing
// the player doesn't, Cash is not exchange funds, and only a finish ABOVE
// £10,000 makes the leaderboard.

const ALL_STEPS_TEXT = HOW_TO_PLAY_STEPS.map((step) => `${step.title}\n${step.body}`).join('\n');
const stepById = (id: string) => {
  const step = HOW_TO_PLAY_STEPS.find((candidate) => candidate.id === id);
  assert.ok(step, `missing how-to-play step: ${id}`);
  return step;
};

test('how to play has the eight survival steps in order, each with real copy', () => {
  assert.deepEqual(
    HOW_TO_PLAY_STEPS.map((step) => step.id),
    ['enter', 'trade', 'clock', 'bag', 'drain', 'bots', 'cash', 'again']
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

test('entry is automatic: always a running Apocalypse, sign-in enters it, Cash starts at £10,000', () => {
  const enter = stepById('enter');
  assert.match(enter.body, /always an Apocalypse running/i);
  assert.match(enter.body, /automatically/i);
  assert.match(enter.body, /£10,000/);
  assert.equal(HOW_TO_PLAY_STARTING_CASH, '£10,000'); // single source, never a stray literal
  // The £10,000 is server-owned — never client-awarded.
  assert.match(enter.body, /server/i);
});

test('no manual join instructions survive anywhere in the how-to-play copy', () => {
  // No JOIN step, no join-as-gameplay language, no £1,000-era amounts.
  assert.ok(!HOW_TO_PLAY_STEPS.some((step) => step.id === 'join'));
  assert.doesNotMatch(ALL_STEPS_TEXT, /\bjoin\b/i);
  assert.doesNotMatch(ALL_STEPS_TEXT, /£1,000/);
});

test('Cash is clearly distinguished from legacy exchange account funds', () => {
  const enter = stepById('enter');
  assert.match(enter.body, /Cash/);
  assert.match(enter.body, /separate from your exchange account funds/i);
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

test('passive drains are explained: fees, taxes and events erode idle Cash; trading beats them', () => {
  // Issue #10 inverts the old "never advertise tax mechanics" rule: the
  // continuous game has real passive drains and players must be told.
  const drain = stepById('drain');
  assert.match(drain.body, /fees/i);
  assert.match(drain.body, /taxes/i);
  assert.match(drain.body, /events/i);
  assert.match(drain.body, /even if you do nothing/i);
  assert.match(drain.body, /trade/i);
  assert.match(stepById('trade').body, /beat the drains/i);
});

test('issue #11: the drain step reinforces the core rule and points at the activity feed', () => {
  // The strategic rule is stated verbatim: idling is a losing strategy and
  // trading is the counter. The feed is named so players know WHERE the
  // explanation of every Cash drop lives.
  const drain = stepById('drain');
  assert.match(drain.body, /doing nothing costs money/i);
  assert.match(drain.body, /beat the drain/i);
  assert.match(drain.body, /activity feed/i);
  // Copy stays accurate: debits carry source, amount and time.
  assert.match(drain.body, /source, amount and time/i);
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
  assert.match(cash.body, /score is the Cash/i);
  assert.match(cash.body, /final Cash decides the winner/i);
  assert.match(cash.body, /Peak wealth mid-round means nothing/i);
});

test('leaderboard qualification is profitable-only: above £10,000, exactly £10,000 does not qualify', () => {
  const cash = stepById('cash');
  assert.match(cash.body, /Finish above £10,000 to make the leaderboard\./);
  assert.match(cash.body, /Exactly £10,000 is break-even and does not qualify\./);
  // The same copy is single-sourced for the leaderboard/results surfaces.
  assert.equal(LEADERBOARD_RULE_COPY, 'Finish above £10,000 to make the leaderboard.');
  assert.equal(LEADERBOARD_BREAKEVEN_COPY, 'Exactly £10,000 is break-even and does not qualify.');
});

test('the next Apocalypse starts automatically and results are recorded', () => {
  const again = stepById('again');
  assert.match(again.body, /begins automatically/i);
  assert.match(again.body, /[Rr]esults are recorded/);
  assert.match(again.body, /£10,000/); // fresh server-owned Cash each round
});

test('no step exposes future collapse order or timing', () => {
  // The instructions must never leak which coin collapses next or when —
  // and the collapse step must say so explicitly.
  assert.doesNotMatch(ALL_STEPS_TEXT, /collapse order|collapse schedule|next (coin )?to collapse|will collapse (at|first|next)|collapses at \d/i);
  assert.match(stepById('bag').body, /nobody knows which coin goes next or when/i);
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

// --- Passive drain activity feed (backend #18 / issue #11) --------------------
// The feed explains Cash; it never computes it. These tests pin the rendering,
// ordering, dedupe, offline-return and notification behaviour of the ledger
// rows, plus the rule that authoritative Cash is never touched by the feed.

function cashEvent(overrides: Partial<CashEvent>): CashEvent {
  return {
    cashEventId: 1,
    type: 'FEE',
    amount: 2.5,
    balanceBefore: 10000,
    balanceAfter: 9997.5,
    description: 'Market upkeep fee',
    eventKey: 'fee:tick:1',
    createdAt: '2026-08-20T10:00:00.000Z',
    ...overrides
  };
}

test('every drain source has a plain player-facing label (no internal keys)', () => {
  assert.equal(CASH_EVENT_TYPE_LABEL.FEE, 'Fee');
  assert.equal(CASH_EVENT_TYPE_LABEL.TAX, 'Tax');
  assert.equal(CASH_EVENT_TYPE_LABEL.EVENT, 'Event');
  // Exactly the three backend ledger types — nothing else can reach the UI.
  assert.deepEqual(Object.keys(CASH_EVENT_TYPE_LABEL).sort(), ['EVENT', 'FEE', 'TAX']);
});

test('drain amounts always render as money out, 2-decimal GBP, never a credit', () => {
  assert.equal(formatCashEventAmount(2.5), '-£2.50');
  assert.equal(formatCashEventAmount(0), '-£0.00');
  assert.equal(formatCashEventAmount(1567.9), '-£1,567.90');
  // Even a malformed negative wire amount can never display as a gain.
  assert.equal(formatCashEventAmount(-2.5), '-£2.50');
});

test('activity timestamps are compact and relative, absolute beyond a week', () => {
  const now = Date.parse('2026-08-20T10:10:00.000Z');
  assert.equal(formatActivityTimestamp('2026-08-20T10:09:30.000Z', now), 'just now');
  assert.equal(formatActivityTimestamp('2026-08-20T10:05:00.000Z', now), '5m ago');
  assert.equal(formatActivityTimestamp('2026-08-20T10:09:59.000Z', now), 'just now');
  assert.equal(formatActivityTimestamp('2026-08-20T07:10:00.000Z', now), '3h ago');
  assert.equal(formatActivityTimestamp('2026-08-18T10:10:00.000Z', now), '2d ago');
  // Clock skew: a slightly-future server timestamp clamps, never "-1m ago".
  assert.equal(formatActivityTimestamp('2026-08-20T10:11:00.000Z', now), 'just now');
  const absolute = formatActivityTimestamp('2026-08-01T10:10:00.000Z', now);
  assert.match(absolute, /Aug/);
  assert.match(absolute, /2026/);
  // Invalid input never crashes a render.
  assert.equal(formatActivityTimestamp('not-a-date', now), '');
  assert.equal(formatAbsoluteTimestamp('not-a-date'), '');
});

test('feed ordering is newest-first by ledger id, regardless of payload order', () => {
  const events = normalizeCashEvents([
    cashEvent({ cashEventId: 40, type: 'EVENT', createdAt: '2026-08-20T10:05:00.000Z' }),
    cashEvent({ cashEventId: 42, type: 'FEE', createdAt: '2026-08-20T10:12:00.000Z' }),
    cashEvent({ cashEventId: 41, type: 'TAX', createdAt: '2026-08-20T10:08:00.000Z' })
  ]);
  assert.deepEqual(events.map((event) => event.cashEventId), [42, 41, 40]);
  assert.deepEqual(events.map((event) => event.type), ['FEE', 'TAX', 'EVENT']);
});

test('overlapping polls never duplicate a displayed debit', () => {
  const first = [cashEvent({ cashEventId: 42 }), cashEvent({ cashEventId: 41 })];
  const second = [cashEvent({ cashEventId: 43 }), cashEvent({ cashEventId: 42 }), cashEvent({ cashEventId: 41 })];
  // A buggy/duplicated payload carrying the same id twice collapses to one row.
  const merged = normalizeCashEvents([...second, ...first]);
  assert.deepEqual(merged.map((event) => event.cashEventId), [43, 42, 41]);
  assert.equal(new Set(merged.map((event) => event.cashEventId)).size, merged.length);
});

test('normalizeCashEvents is pure: the input array is neither mutated nor reordered', () => {
  const input = [cashEvent({ cashEventId: 2 }), cashEvent({ cashEventId: 1 }), cashEvent({ cashEventId: 2 })];
  const snapshot = JSON.parse(JSON.stringify(input));
  normalizeCashEvents(input);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(input.map((event) => event.cashEventId), [2, 1, 2]);
});

test('only genuinely new debits are reported between syncs (offline return is silent)', () => {
  // First sync baselines every existing event — nothing is "new".
  const baseline = normalizeCashEvents([cashEvent({ cashEventId: 42 }), cashEvent({ cashEventId: 41 })]);
  const seen = new Set(baseline.map((event) => event.cashEventId));
  assert.deepEqual(findNewCashEvents(baseline, seen), []);
  // The next poll carries one fresh debit; only that one is reported.
  const next = normalizeCashEvents([
    cashEvent({ cashEventId: 43, type: 'TAX', amount: 5 }),
    cashEvent({ cashEventId: 42 }),
    cashEvent({ cashEventId: 41 })
  ]);
  const fresh = findNewCashEvents(next, seen);
  assert.deepEqual(fresh.map((event) => event.cashEventId), [43]);
});

test('one combined toast per sync — a batch never becomes a notification stack', () => {
  assert.equal(summariseDrainToast([]), '');
  assert.equal(
    summariseDrainToast([cashEvent({ type: 'FEE', amount: 2.5 })]),
    'Fee drained £2.50 from your Cash'
  );
  assert.equal(
    summariseDrainToast([cashEvent({ type: 'TAX', amount: 12 })]),
    'Tax drained £12.00 from your Cash'
  );
  assert.equal(
    summariseDrainToast([cashEvent({ type: 'EVENT', amount: 25 })]),
    'Event drained £25.00 from your Cash'
  );
  // Several debits landing together: one sentence, total + source breakdown.
  assert.equal(
    summariseDrainToast([
      cashEvent({ cashEventId: 1, type: 'FEE', amount: 2.5 }),
      cashEvent({ cashEventId: 2, type: 'FEE', amount: 2.5 }),
      cashEvent({ cashEventId: 3, type: 'TAX', amount: 2.5 })
    ]),
    'New drains: £7.50 across 3 charges (2 fees, 1 tax)'
  );
  assert.equal(
    summariseDrainToast([
      cashEvent({ cashEventId: 1, type: 'EVENT', amount: 10 }),
      cashEvent({ cashEventId: 2, type: 'EVENT', amount: 10 })
    ]),
    'New drains: £20.00 across 2 charges (2 events)'
  );
});

test('offline return: the feed explains the loss but Cash is never derived from it', () => {
  // The browser was closed while the server debited £1,567.90 in three rows.
  // On return the authoritative participant says £8,432.10 — and even though
  // the feed rows happen to sum to exactly the difference, the Cash figure
  // comes ONLY from the participant/leaderboard, never from the feed.
  const events = normalizeCashEvents([
    cashEvent({ cashEventId: 91, type: 'FEE', amount: 500 }),
    cashEvent({ cashEventId: 92, type: 'TAX', amount: 1000 }),
    cashEvent({ cashEventId: 93, type: 'EVENT', amount: 67.9 })
  ]);
  const feedSum = events.reduce((sum, event) => sum + event.amount, 0);
  assert.equal(Math.round(feedSum * 100) / 100, 1567.9);
  const participant = { currentCash: 8432.1 };
  assert.equal(displayRoundCash(null, participant), 8432.1);
  // And when the authoritative figure DISAGREES with any feed arithmetic
  // (trades also move Cash, so it usually does), the feed still loses.
  assert.equal(displayRoundCash(null, { currentCash: 9000 }), 9000);
  assert.notEqual(displayRoundCash(null, { currentCash: 9000 }), 10000 - feedSum);
  // The leaderboard row stays the preferred authoritative source.
  assert.equal(displayRoundCash({ currentCash: 8432.1 }, { currentCash: 9999 }), 8432.1);
});
