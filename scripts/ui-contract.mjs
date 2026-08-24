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
const leaderboard = readFileSync(new URL('../src/components/LeaderboardPanel.tsx', import.meta.url), 'utf8');
const userMenu = readFileSync(new URL('../src/components/UserMenu.tsx', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../src/components/Profile.tsx', import.meta.url), 'utf8');
const gameService = readFileSync(new URL('../src/services/gameService.ts', import.meta.url), 'utf8');
const howToPlay = readFileSync(new URL('../src/components/HowToPlay.tsx', import.meta.url), 'utf8');
const resultsPanel = readFileSync(new URL('../src/components/ResultsPanel.tsx', import.meta.url), 'utf8');

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
// Network recovery: the browser's online event re-anchors server state
// immediately instead of waiting out the rest of the poll interval.
assert.match(gameContext, /window\.addEventListener\('online'/);
assert.match(gameContext, /window\.removeEventListener\('online'/);
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
assert.match(roundTrade, /isCoinCollapsed/);
assert.match(roundTrade, /aria-pressed/);

// --- Continuous game, one Cash balance (issue #10) ---------------------------
// No player-facing JOIN APOCALYPSE control or join-as-gameplay copy anywhere
// on the game surface; participation is ensured automatically per (user,
// cycle) through the idempotent endpoint.
assert.doesNotMatch(playerRound, /JOIN APOCALYPSE/);
assert.doesNotMatch(playerRound, /joinPending|\bjoin\b/);
assert.match(playerRound, /Sign in to play/); // logged-out route is sign-in UX, not a join gate
assert.match(playerRound, /Syncing your position/); // neutral loading, no fabricated Cash
assert.match(gameContext, /joinGame\(token\)/); // automatic ensure, not a button handler
assert.match(gameContext, /ensureAttemptRef/); // one attempt per (user, cycle)
assert.doesNotMatch(gameContext, /joinPending/);
assert.doesNotMatch(gameContext, /Sign in to join/);
// Exactly one gameplay balance, labelled Cash, derived ONLY from the
// server-owned participant / leaderboard row via the shared helper.
assert.match(gameLogic, /GAME_STARTING_CASH_LABEL = '£10,000'/);
assert.match(gameLogic, /export function displayRoundCash/);
assert.match(roundTrade, /displayRoundCash\(myEntry, myParticipant\)/);
assert.match(playerRound, /displayRoundCash\(myEntry, myParticipant\)/);
assert.match(playerRound, /Wallet className="w-3 h-3" \/> Cash/);
assert.doesNotMatch(roundTrade, /Round cash/);
assert.doesNotMatch(playerRound, /Round cash|round wallet/);
// No £1,000-era game copy on any player-facing surface.
for (const [name, text] of Object.entries({ gameLogic, roundTrade, playerRound, leaderboard, howToPlay, resultsPanel, profile, userMenu })) {
  assert.doesNotMatch(text, /£1,000/, `£1,000-era copy remains in ${name}`);
}
// Legacy users.funds is classic account data, never game money: it stays off
// the main nav and is explicitly quarantined in Profile copy.
assert.doesNotMatch(userMenu, /user\?\.funds/);
assert.match(profile, /historical account data only/);
assert.match(profile, /nothing here is spendable in the game/);
// Profitable-only completed leaderboards (backend #19): contract fields,
// win-condition copy and a legitimate empty board.
assert.match(gameService, /leaderboardEligible/);
assert.match(gameService, /totalResultCount/);
assert.match(gameLogic, /LEADERBOARD_RULE_COPY = `Finish above \$\{GAME_STARTING_CASH_LABEL\} to make the leaderboard\.`/);
assert.match(leaderboard, /LEADERBOARD_RULE_COPY/);
assert.match(resultsPanel, /leaderboardEligible/);
assert.match(resultsPanel, /No qualifiers/);

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

// --- Passive drain activity feed (backend #18, issue #11) -------------------
// The authenticated #18 player endpoint is consumed through the shared poll;
// the operator diagnostics API (#21) is never touched by the client.
assert.match(gameService, /export async function getMyRoundEconomy/);
assert.match(gameService, /\/game\/participant/);
assert.match(gameService, /export function parseCashEvent/);
assert.match(gameService, /export function parsePlayerRoundEconomy/);
assert.match(gameService, /'FEE' \| 'TAX' \| 'EVENT'/);
assert.doesNotMatch(gameService, /\/game\/diagnostics/);
// GameContext: economy sync rides the ONE existing poll (inFlight guard), the
// seen-set baselines on first sync so offline drains never re-toast, and a
// batch of new debits collapses into ONE combined toast.
assert.match(gameContext, /getMyRoundEconomy\(token, \{ limit: CASH_EVENT_FEED_LIMIT \}\)/);
assert.match(gameContext, /economySeenRef/);
assert.match(gameContext, /normalizeCashEvents\(events\)/);
assert.match(gameContext, /findNewCashEvents\(normalized, seen\)/);
assert.match(gameContext, /summariseDrainToast\(fresh\)/);
assert.match(gameContext, /setCashEventsError/);
// Only a participant for the LIVE apocalypse is adopted from the economy read.
assert.match(gameContext, /participantBelongsToCycle\(participant, liveId\)/);
// Shared pure helpers single-source the feed behaviour.
assert.match(gameLogic, /export const CASH_EVENT_TYPE_LABEL/);
assert.match(gameLogic, /export function normalizeCashEvents/);
assert.match(gameLogic, /export function formatCashEventAmount/);
assert.match(gameLogic, /export function findNewCashEvents/);
assert.match(gameLogic, /export function summariseDrainToast/);
assert.match(gameLogic, /export function formatActivityTimestamp/);
// The activity surface: source/type label, amount, human description and
// timestamp per row; trades are distinguished from passive drains in copy.
assert.match(playerRound, /Round activity/);
assert.match(playerRound, /CASH_EVENT_TYPE_LABEL\[event\.type\]/);
assert.match(playerRound, /formatCashEventAmount\(event\.amount\)/);
assert.match(playerRound, /event\.description/);
assert.match(playerRound, /formatActivityTimestamp\(event\.createdAt/);
assert.match(playerRound, /aria-live="polite"/);
assert.match(playerRound, /aria-label="Recent Cash drains"/);
assert.match(playerRound, /No drains yet this round/); // clean empty state
assert.match(playerRound, /Syncing round activity/); // neutral loading state
assert.match(playerRound, /Activity update failed/); // stale state keeps last good feed
assert.match(playerRound, /still authoritative/); // a feed failure never shakes Cash
assert.match(playerRound, /confirmed in the trade panel/); // drains ≠ trades
// Internal identifiers and ledger internals stay out of the primary UX.
assert.doesNotMatch(playerRound, /eventKey|event_key/);
assert.doesNotMatch(playerRound, /balanceBefore|balanceAfter/);
// How to Play reinforces the strategic rule: idling bleeds, trading counters.
assert.match(gameLogic, /doing nothing costs money/i);
assert.match(gameLogic, /beat the drain/i);
assert.match(gameLogic, /activity feed/i);

// Styling: game escalation + reduced-motion respect.
assert.match(styles, /--accent:\s*#7132f5/);
assert.match(styles, /font-family:\s*'Inter'/);
assert.doesNotMatch(styles, /fractalNoise/);
assert.match(styles, /apocalypse-meter/);
assert.match(styles, /prefers-reduced-motion/);
// Reduced-motion restraint is surface-wide: the infinite ticker scroll,
// flicker pulses, reveal entrances and spinner rotation all stand down,
// not just the apocalypse meter pulse.
const reducedMotion = styles.slice(styles.indexOf('prefers-reduced-motion'));
assert.match(reducedMotion, /\.animate-ticker[^{]*\{ animation: none !important;/);
assert.match(reducedMotion, /\.animate-flicker/);
assert.match(reducedMotion, /\.animate-reveal/);
assert.match(reducedMotion, /\.animate-spin/);
assert.match(reducedMotion, /scroll-behavior: auto/);
assert.match(styles, /coin-dead/);
assert.match(styles, /leaderboard-me/);

// --- HOW TO PLAY (issue #7) -------------------------------------------------
// Discoverable control in the persistent header; compact accessible dialog,
// never a forced tutorial. Copy is single-sourced from gameLogic.
assert.match(header, /HowToPlay/); // mounted in the persistent apocalypse header
assert.match(howToPlay, /How to play/); // visible, human-readable trigger label
assert.match(howToPlay, /aria-haspopup="dialog"/);
assert.match(howToPlay, /aria-expanded=\{open\}/);
// Dialog semantics + every close route: Escape, backdrop click, close button.
assert.match(howToPlay, /role="dialog"/);
assert.match(howToPlay, /aria-modal="true"/);
assert.match(howToPlay, /aria-labelledby="how-to-play-title"/);
assert.match(howToPlay, /id="how-to-play-title"/);
assert.match(howToPlay, /event\.key === 'Escape'/);
assert.match(howToPlay, /aria-label="Close how to play"/);
// Focus behaviour: focus enters the dialog on open, returns to the trigger on
// close, and Tab is trapped while open.
assert.match(howToPlay, /panel\?\.focus\(\)/);
assert.match(howToPlay, /triggerRef\.current\?\.focus\(\)/);
assert.match(howToPlay, /event\.key !== 'Tab'/);
// Content renders from the single source of truth; step numbers are
// decorative only (no information communicated purely by visual order).
assert.match(howToPlay, /HOW_TO_PLAY_STEPS\.map/);
assert.match(howToPlay, /aria-hidden="true"/);
assert.match(gameLogic, /export const HOW_TO_PLAY_STEPS/);
assert.match(gameLogic, /export const HOW_TO_PLAY_TITLE/);
assert.match(gameLogic, /HOW TO SURVIVE THE APOCALYPSE/);
// Narrow-layout usability: bottom-sheet on mobile, centred panel from sm up,
// scrollable with capped height.
assert.match(howToPlay, /items-end sm:items-center/);
assert.match(howToPlay, /rounded-t-2xl sm:rounded-2xl/);
assert.match(howToPlay, /max-h-\[92vh\] overflow-y-auto/);
// The trigger is styled and keyboard-visible.
assert.match(styles, /\.how-to-play-trigger/);
assert.match(styles, /\.how-to-play-trigger:focus-visible/);

// --- Results overlay auto-dismiss (issue #8) --------------------------------
// End-of-Apocalypse results dismiss themselves after 7s — the player never
// has to click to continue into the next round. The timer lifecycle is
// delegated to the shared, unit-tested helper and pinned to one cycle id.
assert.match(gameLogic, /RESULTS_AUTO_DISMISS_MS = 7000/);
assert.match(gameLogic, /export function scheduleResultsAutoDismiss/);
assert.match(resultsPanel, /scheduleResultsAutoDismiss\(completedCycleId/);
// Cleanup cancels the timer on unmount, result change and manual close —
// a stale timer can never dismiss a newer round's result.
assert.match(resultsPanel, /cancelled = true;\s*timer\.cancel\(\)/);
assert.match(resultsPanel, /cycleId !== completedCycleId/); // stale-cycle guard
// Manual close remains and dismisses immediately (backdrop + button).
assert.match(resultsPanel, /onClick=\{acknowledgeCompleted\}/);
assert.match(resultsPanel, /Face the next apocalypse/);
// The overlay stays an accessible dialog and tells the player no action is
// needed (plain copy, no animation, reduced-motion behaviour untouched).
assert.match(resultsPanel, /role="dialog"/);
assert.match(resultsPanel, /aria-label=\{`Final results for/);
assert.match(resultsPanel, /closes automatically/);
// Results + history rendering remain intact.
assert.match(resultsPanel, /getCycleResults\(completedCycleId\)/);
assert.match(resultsPanel, /getRecentLeaderboards/);
assert.match(resultsPanel, /The graveyard/);

// --- Core 7 final-results rank contract -------------------------------------
// GET /api/game/results/:cycleId returns the immutable settlement snapshot
// with backend-authoritative ranks over ALL participants (final_cash DESC,
// participant_id ASC). The overlay displays those ranks verbatim and never
// recomputes a final rank client-side (no gapless re-rank of qualifiers).
assert.match(resultsPanel, /displayRank=\{row\.rank\}/);
assert.doesNotMatch(resultsPanel, /index \+ 1/);
// Every immutable final row is shown in backend rank order — including
// non-qualifiers, which carry a clear off-board marker. Only the recent
// history boards are profitable-only.
assert.match(resultsPanel, /aria-label="Final results"/);
assert.match(resultsPanel, /Off board/);
assert.match(resultsPanel, /finalRows\.map\(\(row\) =>/);
// The legitimate zero-qualifier outcome keeps its own messaging.
assert.match(resultsPanel, /No qualifiers — nobody finished above the/);
// The player's own finish summary also reads the backend rank, not a
// recomputed position.
assert.match(resultsPanel, /#\{myResult\.rank\}/);

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
