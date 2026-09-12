import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARCHETYPE_PERSONALITY,
  GAME_STARTING_CASH_LABEL,
  HOW_TO_PLAY_STEPS,
  HOW_TO_PLAY_TAGLINE,
  HOW_TO_PLAY_TITLE,
  PERSISTENT_LEADERBOARD_RULE_COPY,
  QUICK_BUY_NOTIONALS,
  archetypePersonality,
  findMyEntry,
  formatActivityTimestamp,
  formatQuantity,
  formatRecentChangePct,
  formatSignedGbp,
  formatSignedPct,
  isCoinCollapsed,
  minTradeValueError,
  momentumArrow,
  parseTradeQuantity,
  quantityForNotional,
  quickBuyLabel
} from './persistentGameLogic.ts';

test('persistent copy has no Apocalypse lifecycle or join instruction', () => {
  const copy = `${HOW_TO_PLAY_TITLE}\n${HOW_TO_PLAY_TAGLINE}\n${HOW_TO_PLAY_STEPS.map((step) => `${step.title}\n${step.body}`).join('\n')}`;
  assert.match(copy, /runs continuously/i);
  assert.doesNotMatch(copy, /apocalypse|join (?:the )?(?:game|round)/i);
  // Lobby / join / countdown may appear only as negated framing, never as a required flow.
  assert.match(copy, /no lobby/i);
  assert.match(copy, /no countdown/i);
  assert.doesNotMatch(copy, /\b(?:must|should|need to)\s+join\b/i);
  assert.doesNotMatch(copy, /\bwait for (?:the )?countdown\b/i);
  assert.equal(GAME_STARTING_CASH_LABEL, '£10,000');
  assert.match(PERSISTENT_LEADERBOARD_RULE_COPY, /net worth/i);
});

test('persistent coin and leaderboard helpers use current contracts', () => {
  assert.equal(isCoinCollapsed('£0.00'), true);
  assert.equal(isCoinCollapsed(0), true);
  assert.equal(isCoinCollapsed('£1,234.56'), false);
  assert.deepEqual(findMyEntry([{ userId: 1, rank: 2 }], 1), { userId: 1, rank: 2 });
  assert.equal(findMyEntry([{ userId: 1 }], 2), null);
  assert.equal(findMyEntry(undefined, 1), null);
  assert.equal(formatSignedGbp(-12.5), '-£12.50');
  assert.equal(formatSignedGbp(3), '+£3.00');
  assert.equal(formatSignedPct(2.345), '+2.3%');
  assert.equal(formatSignedPct(-0.4), '-0.4%');
  assert.equal(formatSignedPct(null), '—');
});

test('formatRecentChangePct, momentumArrow, and archetypePersonality stay display-only', () => {
  assert.equal(formatRecentChangePct(1.234), '+1.23%');
  assert.equal(formatRecentChangePct(-0.5), '-0.50%');
  assert.equal(formatRecentChangePct(null), '—');
  assert.equal(momentumArrow('UP'), '▲ UP');
  assert.equal(momentumArrow('DOWN'), '▼ DOWN');
  assert.equal(momentumArrow('FLAT'), '◆ FLAT');
  assert.equal(archetypePersonality('DEGEN'), ARCHETYPE_PERSONALITY.DEGEN);
  assert.equal(archetypePersonality('UNKNOWN'), 'cyclical trader');
});

test('trade quantity validation preserves the eight-decimal ledger contract', () => {
  assert.deepEqual(parseTradeQuantity('0.004'), { ok: true, value: 0.004 });
  assert.equal(parseTradeQuantity('0.000000001').ok, false);
  assert.equal(parseTradeQuantity('-1').ok, false);
  assert.equal(parseTradeQuantity('').ok, false);
  assert.equal(formatQuantity(1.23000000), '1.23');
  assert.match(minTradeValueError(0, 1) ?? '', /at least £0\.01/);
  assert.equal(minTradeValueError(0, 0), null);
  assert.equal(minTradeValueError(1, 1), null);
});

test('quick-buy conversion rounds down and never fabricates a trade', () => {
  assert.deepEqual(QUICK_BUY_NOTIONALS, [250, 500, 1000, 2500]);
  assert.equal(quickBuyLabel(2500), '£2.5K');
  assert.equal(quantityForNotional(500, 250), 2);
  assert.equal(quantityForNotional(250, 0), null);
  const quantity = quantityForNotional(250, 33.48);
  assert.ok(quantity !== null && quantity * 33.48 <= 250);
});

test('activity timestamps remain compact and deterministic', () => {
  const now = Date.parse('2026-08-20T10:10:00.000Z');
  assert.equal(formatActivityTimestamp('2026-08-20T10:05:00.000Z', now), '5m ago');
  assert.equal(formatActivityTimestamp('not-a-date', now), '');
});
