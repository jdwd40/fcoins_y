import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const chart = readFileSync(new URL('../src/components/PriceChart.tsx', import.meta.url), 'utf8');
const header = readFileSync(new URL('../src/components/ApocalypseHeader.tsx', import.meta.url), 'utf8');
const gameContext = readFileSync(new URL('../src/context/GameContext.tsx', import.meta.url), 'utf8');
const gameLogic = readFileSync(new URL('../src/utils/gameLogic.ts', import.meta.url), 'utf8');
const roundTrade = readFileSync(new URL('../src/components/RoundTradePanel.tsx', import.meta.url), 'utf8');
const playerRound = readFileSync(new URL('../src/components/PlayerRoundPanel.tsx', import.meta.url), 'utf8');

// --- Core Crypto Chaos surface ------------------------------------------
assert.match(app, /Crypto Chaos/);
assert.match(app, /Virtual GBP/);
assert.match(app, /Market Overview/);
assert.match(app, /Markets/);
assert.match(app, /ApocalypseHeader/);
assert.match(app, /PlayerRoundPanel/);
assert.match(app, /LeaderboardPanel/);
assert.match(app, /ResultsOverlay/);
assert.match(app, /GameProvider/);

// Persistent apocalypse header: identity, countdown, meter, phase, stale state.
assert.match(header, /progressbar/);
assert.match(header, /aria-valuenow/);
assert.match(header, /Connection stale/);
assert.match(header, /Backend unavailable/);
assert.match(header, /formatCountdown/);
assert.match(header, /meterPhase/);

// Central polling with focus/visibility resync; no per-component game timers.
assert.match(gameContext, /GAME_POLL_INTERVAL_MS/);
assert.match(gameContext, /visibilitychange/);
assert.match(gameContext, /window\.addEventListener\('focus'/);
assert.match(gameContext, /localStorage/); // participant cache
// Milestone 1: the participant cache key carries the authenticated user
// identity AND the apocalypse id — no cross-account round-state leakage.
assert.match(gameLogic, /cc_participant_\$\{userId\}_\$\{apocalypseId\}/);
assert.match(gameLogic, /parsed\.userId !== userId/);
assert.match(gameContext, /readCachedParticipant\(localStorage, userId, currentId\)/);
assert.match(gameContext, /setMyParticipant\(null\)/); // cleared on identity change

// Round trading carries the authoritative cycle id and never fakes success.
assert.match(roundTrade, /trade\(side, coin\.coin_id, amountValue\)/);
assert.match(roundTrade, /tradeBlockReason/);
assert.match(roundTrade, /Round cash/);
assert.match(roundTrade, /isCoinCollapsed/);
assert.match(roundTrade, /aria-pressed/);

// Fractional coin quantities (backend migration 012, DECIMAL(18,8)): the
// trade panel validates entry through the shared contract parser (never
// integer-only, never silently rounded), the confirmation shows the exact
// fractional quantity, and holdings render without rounding to a whole coin.
assert.match(gameLogic, /TRADE_QUANTITY_MAX_DECIMALS = 8/);
assert.match(gameLogic, /export function parseTradeQuantity/);
assert.match(gameLogic, /export function formatQuantity/);
assert.match(roundTrade, /parseTradeQuantity\(amount\)/);
assert.match(roundTrade, /formatQuantity\(amountValue\)/); // confirmation + toast
assert.match(roundTrade, /formatQuantity\(heldQuantity\)/); // sell-all + held display
assert.match(roundTrade, /inputMode="decimal"/); // mobile decimal keypad
assert.doesNotMatch(roundTrade, /step="1"/);
assert.doesNotMatch(roundTrade, /parseInt\(amount/);
assert.match(playerRound, /formatQuantity\(holding\.quantity\)/);
assert.doesNotMatch(playerRound, /holding\.quantity\.toFixed\(0\)/);

// Minimum notional (backend GAME_MIN_TRADE_VALUE): sub-penny trades are
// blocked client-side with the backend's message, and the backend's
// authoritative rejection still surfaces verbatim via GameApiError.
assert.match(gameLogic, /TRADE_MIN_VALUE = 0\.01/);
assert.match(gameLogic, /export function minTradeValueError/);
assert.match(roundTrade, /minTradeValueError\(total, currentPrice\)/);
assert.match(roundTrade, /err\.message/); // GameApiError surfaces server text

// Styling: game escalation + reduced-motion respect.
assert.match(styles, /--accent:\s*#7132f5/);
assert.match(styles, /font-family:\s*'Inter'/);
assert.doesNotMatch(styles, /fractalNoise/);
assert.match(styles, /apocalypse-meter/);
assert.match(styles, /prefers-reduced-motion/);
assert.match(styles, /coin-dead/);
assert.match(styles, /leaderboard-me/);

assert.match(html, /<title>Crypto Chaos · CoinX Apocalypse Exchange<\/title>/);
assert.match(html, /family=Inter/);

assert.match(chart, /24H/);
assert.match(chart, /7D/);
assert.match(chart, /30D/);
assert.match(chart, /ALL/);
assert.match(chart, /aria-pressed/);
assert.match(chart, /role="group"/);

// --- Centralised API base ------------------------------------------------
// No source file outside services/apiConfig.ts may hard-code the deployed
// API origin (test fixtures asserting the default are the only exception).
const SRC = new URL('../src', import.meta.url).pathname;
const violations = [];
for (const entry of readdirSync(SRC, { recursive: true })) {
  const file = join(SRC, entry.toString());
  if (!statSync(file).isFile() || !/\.(ts|tsx)$/.test(file)) continue;
  if (/apiConfig\.ts$/.test(file)) continue;
  if (/\.test\.ts$/.test(file)) continue; // contract fixtures pin the default
  const text = readFileSync(file, 'utf8');
  if (text.includes('jdwd40.com')) violations.push(entry.toString());
}
assert.deepEqual(violations, [], `hard-coded API origin outside apiConfig.ts: ${violations.join(', ')}`);

console.log('Crypto Chaos UI contract passed');
