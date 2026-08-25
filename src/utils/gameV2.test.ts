// V2-5 pure game-UI logic contract tests (mobile-first surface). Runs under
// plain Node (node --test); no DOM. These helpers are the single source the
// V2-5 components delegate to: escalation labels, Power display and preview,
// quick-buy quantity conversion and gating, and signal presentation.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  escalationBand,
  ESCALATION_BAND_LABEL,
  BUY_POWER_COST_DIVISOR,
  estimateBuyPowerCost,
  QUICK_BUY_NOTIONALS,
  quickBuyLabel,
  quantityForNotional,
  formatPowerRegenRate,
  powerSecondsToNextPoint,
  formatPowerNextHint,
  MAX_OPEN_POSITIONS,
  openLivePositionCount,
  quickBuyBlockReason,
  QUICK_BUY_BLOCK_LABEL,
  formatRecentChangePct,
  momentumArrow,
  archetypePersonality,
  formatTypicalProfile,
  formatSignedPct
} from './gameLogic.ts';
import type { QuickBuyGate } from './gameLogic.ts';

// --- Escalation bands (backend apocalypseVolatility vocabulary) --------------

test('escalation bands mirror the backend V2-3 boundaries', () => {
  assert.equal(escalationBand(0), 'NORMAL');
  assert.equal(escalationBand(39.9), 'NORMAL');
  assert.equal(escalationBand(40), 'ELEVATED');
  assert.equal(escalationBand(69.9), 'ELEVATED');
  assert.equal(escalationBand(70), 'HIGH');
  assert.equal(escalationBand(89.9), 'HIGH');
  assert.equal(escalationBand(90), 'EXTREME');
  assert.equal(escalationBand(100), 'EXTREME');
  // Out-of-range and malformed input resolves to the same safe defaults as
  // the backend (clamped; malformed -> NORMAL).
  assert.equal(escalationBand(-5), 'NORMAL');
  assert.equal(escalationBand(140), 'EXTREME');
  assert.equal(escalationBand(NaN), 'NORMAL');
  for (const band of ['NORMAL', 'ELEVATED', 'HIGH', 'EXTREME'] as const) {
    assert.match(ESCALATION_BAND_LABEL[band], new RegExp(`Escalation ${band}`));
  }
});

// --- Power preview (mirrors backend powerDomain.buyPowerCost) -----------------

test('the Power preview uses the shared V2 formula 1 + floor(notional / 125)', () => {
  assert.equal(BUY_POWER_COST_DIVISOR, 125);
  // The backend-documented ladder: £250 -> 3, £500 -> 5, £1,000 -> 9, £2,500 -> 21.
  assert.equal(estimateBuyPowerCost(250), 3);
  assert.equal(estimateBuyPowerCost(500), 5);
  assert.equal(estimateBuyPowerCost(1000), 9);
  assert.equal(estimateBuyPowerCost(2500), 21);
  assert.equal(estimateBuyPowerCost(1), 1);
  assert.equal(estimateBuyPowerCost(124.99), 1);
  assert.equal(estimateBuyPowerCost(125), 2);
  // No meaningful preview for non-positive/malformed notionals.
  assert.equal(estimateBuyPowerCost(0), 0);
  assert.equal(estimateBuyPowerCost(-50), 0);
  assert.equal(estimateBuyPowerCost(NaN), 0);
});

test('the quick-buy ladder is the V2-5 design with compact labels', () => {
  assert.deepEqual([...QUICK_BUY_NOTIONALS], [250, 500, 1000, 2500]);
  assert.equal(quickBuyLabel(250), '£250');
  assert.equal(quickBuyLabel(500), '£500');
  assert.equal(quickBuyLabel(1000), '£1K');
  assert.equal(quickBuyLabel(2500), '£2.5K');
});

// --- Notional -> quantity conversion -------------------------------------------

test('quantityForNotional converts at the displayed price, rounded DOWN to ledger precision', () => {
  // £500 at £250 per coin -> exactly 2.
  assert.equal(quantityForNotional(500, 250), 2);
  // £250 at £33.48 -> floors to 8dp and never exceeds the requested notional.
  const quantity = quantityForNotional(250, 33.48);
  if (quantity === null) assert.fail('expected a legal quantity');
  assert.ok(quantity * 33.48 <= 250);
  assert.ok((quantity + 1e-8) * 33.48 > 250 - 1e-6); // maximal 8dp quantity
  // Dead / zero / malformed prices yield no legal quantity.
  assert.equal(quantityForNotional(250, 0), null);
  assert.equal(quantityForNotional(250, -1), null);
  assert.equal(quantityForNotional(250, NaN), null);
  assert.equal(quantityForNotional(0, 10), null);
  // A huge price can make the 8dp-floored quantity zero — no trade.
  assert.equal(quantityForNotional(250, 3e10), null);
});

// --- Power regeneration display ---------------------------------------------------

test('the regen rate label comes from the server secondsPerPoint, never a hard-coded rate', () => {
  assert.equal(formatPowerRegenRate({ secondsPerPoint: 30 }), '+1 Power / 30s');
  assert.equal(formatPowerRegenRate({ secondsPerPoint: 120 }), '+1 Power / 120s');
});

test('the next-Power hint derives from the server nextPointAt and handles full/unknown', () => {
  const now = Date.parse('2026-08-20T10:15:00.000Z');
  const charging = { current: 87, max: 100, nextPointAt: '2026-08-20T10:15:12.000Z' };
  assert.equal(powerSecondsToNextPoint(charging, now), 12);
  assert.equal(formatPowerNextHint(charging, now), 'next +1 in 12s');
  // Clock skew clamps to zero rather than going negative.
  assert.equal(powerSecondsToNextPoint(charging, now + 60_000), 0);
  // Full Power has no next point.
  const full = { current: 100, max: 100, nextPointAt: null };
  assert.equal(powerSecondsToNextPoint(full, now), null);
  assert.equal(formatPowerNextHint(full, now), 'Power full');
  // A missing hint renders nothing rather than fabricating a countdown.
  const unknown = { current: 10, max: 100, nextPointAt: null };
  assert.equal(formatPowerNextHint(unknown, now), '');
});

// --- Open live positions -------------------------------------------------------------

test('open live positions count only quantity>0 holdings on live coins', () => {
  assert.equal(MAX_OPEN_POSITIONS, 3);
  const holdings = [
    { quantity: 2, currentPrice: 10 },   // live
    { quantity: 0.5, currentPrice: 0 },  // collapsed — slot freed
    { quantity: 0, currentPrice: 10 },   // dust/zero — not a position
    { quantity: 1, currentPrice: 33.48 } // live
  ];
  assert.equal(openLivePositionCount(holdings), 2);
  assert.equal(openLivePositionCount([]), 0);
});

// --- Quick-buy gating -----------------------------------------------------------------

const OPEN_GATE: QuickBuyGate = {
  authenticated: true,
  joined: true,
  lifecycle: 'ACTIVE',
  connection: 'live',
  collapsed: false,
  cash: 10000,
  power: 100,
  openPositions: 0,
  alreadyOwned: false,
  notional: 250,
  price: 10
};

test('a fully open gate allows the buy', () => {
  assert.equal(quickBuyBlockReason(OPEN_GATE), null);
});

test('lifecycle, connection and auth blocks surface in priority order', () => {
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, authenticated: false }), 'not-authenticated');
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, joined: false }), 'syncing');
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, lifecycle: 'SETTLING' }), 'settling');
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, lifecycle: 'COMPLETED' }), 'completed');
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, lifecycle: 'LOADING' }), 'loading');
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, connection: 'stale' }), 'stale');
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, connection: 'offline' }), 'stale');
});

test('a collapsed coin can never be quick-bought', () => {
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, collapsed: true }), 'collapsed');
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, price: 0 }), 'collapsed');
});

test('cash, Power and position limits gate per-notional', () => {
  // £2.5K notional against £1K cash.
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, notional: 2500, cash: 1000 }), 'insufficient-cash');
  // £2.5K costs 21 Power; 20 is not enough.
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, notional: 2500, power: 20 }), 'insufficient-power');
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, notional: 2500, power: 21 }), null);
  // Power view still syncing: never guess affordability.
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, power: null }), 'power-unknown');
  // A fourth distinct position is blocked; adding to an owned coin is not.
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, openPositions: 3 }), 'position-limit');
  assert.equal(quickBuyBlockReason({ ...OPEN_GATE, openPositions: 3, alreadyOwned: true }), null);
});

test('every block reason has an explicit player-facing label', () => {
  const reasons = [
    'not-authenticated', 'syncing', 'settling', 'completed', 'loading', 'stale',
    'collapsed', 'power-unknown', 'insufficient-cash', 'insufficient-power', 'position-limit'
  ] as const;
  for (const reason of reasons) {
    assert.ok(QUICK_BUY_BLOCK_LABEL[reason].length > 0, `missing label for ${reason}`);
  }
  assert.match(QUICK_BUY_BLOCK_LABEL['position-limit'], /3 open/);
});

// --- Signal presentation -----------------------------------------------------------------

test('movement is always explicit text with a sign and direction marker', () => {
  assert.equal(formatRecentChangePct(2.345), '+2.35%');
  assert.equal(formatRecentChangePct(-1.2), '-1.20%');
  assert.equal(formatRecentChangePct(0), '0.00%');
  assert.equal(formatRecentChangePct(null), '—');
  assert.equal(momentumArrow('UP'), '▲ UP');
  assert.equal(momentumArrow('DOWN'), '▼ DOWN');
  assert.equal(momentumArrow('FLAT'), '◆ FLAT');
});

test('archetype personality and typical profile render from public ranges', () => {
  assert.equal(archetypePersonality('MOON'), 'steady bread-and-butter cycles');
  assert.equal(archetypePersonality('UNKNOWN'), 'cyclical trader');
  assert.equal(
    formatTypicalProfile({ typicalCycleMinutes: [3, 5], typicalSwingPct: [8, 15] }),
    '~3–5 min cycles · ±8–15% swings'
  );
  assert.equal(formatTypicalProfile({ typicalCycleMinutes: null, typicalSwingPct: null }), '');
});

test('P&L percentage always carries an explicit sign', () => {
  assert.equal(formatSignedPct(13.63), '+13.6%');
  assert.equal(formatSignedPct(-2.44), '-2.4%');
  assert.equal(formatSignedPct(0), '+0.0%');
  assert.equal(formatSignedPct(null), '—');
});
