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
const gameTopBar = readFileSync(new URL('../src/components/GameTopBar.tsx', import.meta.url), 'utf8');
const playerStatusStrip = readFileSync(new URL('../src/components/PlayerStatusStrip.tsx', import.meta.url), 'utf8');
const leaderboardPressure = readFileSync(new URL('../src/components/LeaderboardPressure.tsx', import.meta.url), 'utf8');
const gameMarketGrid = readFileSync(new URL('../src/components/GameMarketGrid.tsx', import.meta.url), 'utf8');
const coinSignalCard = readFileSync(new URL('../src/components/CoinSignalCard.tsx', import.meta.url), 'utf8');
const sparklineUtil = readFileSync(new URL('../src/utils/sparkline.ts', import.meta.url), 'utf8');
const priceHistoryService = readFileSync(new URL('../src/services/priceHistoryService.ts', import.meta.url), 'utf8');
const coinSparkline = readFileSync(new URL('../src/components/CoinSparkline.tsx', import.meta.url), 'utf8');
const useCoinSparkline = readFileSync(new URL('../src/hooks/useCoinSparkline.ts', import.meta.url), 'utf8');
const gameCoinDetail = readFileSync(new URL('../src/components/GameCoinDetail.tsx', import.meta.url), 'utf8');
const typesTs = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');

// --- Core Crypto Chaos surface ------------------------------------------
// V2-5: the primary screen is the mobile-first game — compact top bar,
// apocalypse status header, player status strip, leaderboard pressure and
// scannable market grid. The historical market detail survives below as the
// drill-down surface.
assert.match(app, /Crypto Chaos/);
assert.match(app, /GameTopBar/);
assert.match(app, /PlayerStatusStrip/);
assert.match(app, /LeaderboardPressure/);
assert.match(app, /GameMarketGrid/);
assert.match(app, /ApocalypseHeader/);
assert.match(app, /PlayerRoundPanel/);
assert.match(app, /LeaderboardPanel/);
assert.match(app, /ResultsOverlay/);
assert.match(app, /GameProvider/);
assert.match(gameTopBar, /Virtual GBP/);
assert.match(gameTopBar, /UserMenu/); // auth access preserved above the game
// No dense desktop navigation above the gameplay.
assert.doesNotMatch(gameTopBar, /<nav/);
// Historical market drill-down surfaces preserved as secondary.
assert.match(app, /Historical market drill-down/);
assert.match(app, /aria-label="Historical market drill-down"/);
assert.doesNotMatch(app, /Classic exchange · drill-down/);
assert.doesNotMatch(app, /aria-label="Classic exchange"/);
assert.doesNotMatch(app, /The original exchange view/);
assert.doesNotMatch(app, /Secondary: classic exchange surfaces/);
assert.match(app, /CoinsList/);
assert.match(app, /MarketValueChart/);
assert.match(app, /id="markets"/);
assert.match(app, /Profile/); // profile route preserved

// Persistent apocalypse header: identity, countdown, meter, phase, stale state.
assert.match(header, /progressbar/);
assert.match(header, /aria-valuenow/);
assert.match(header, /Connection stale/);
assert.match(header, /Backend unavailable/);
assert.match(header, /formatCountdown/);
assert.match(header, /meterPhase/);
// V2-3/V2-5: the escalation label uses the backend's shared band vocabulary.
assert.match(header, /escalationBand/);
assert.match(header, /ESCALATION_BAND_LABEL\[band\]/);
assert.match(gameLogic, /export function escalationBand/);
assert.match(gameLogic, /ESCALATION_BAND_LABEL/);

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

// --- V2-5: real backend contracts on the wire --------------------------------
// Market signals: typed parser, envelope unwrap and the exact public route;
// the hidden-information fields (seed/future timing) are never required.
assert.match(gameService, /export async function getMarketSignals/);
assert.match(gameService, /\/game\/market-signals/);
assert.match(gameService, /export function parseMarketSignals/);
assert.match(gameService, /'DIP' \| 'RISE' \| 'BOOM' \| 'FALL' \| 'DEAD'/);
assert.match(gameService, /'STABLE' \| 'SHAKY' \| 'DANGER' \| 'CRITICAL' \| 'DEAD'/);
// Participant V2 fields: Power view and holding economics are hard contracts.
assert.match(gameService, /export interface PowerState/);
assert.match(gameService, /nextPointAt/);
assert.match(gameService, /secondsPerPoint/);
assert.match(gameService, /costBasis/);
assert.match(gameService, /averageEntryPrice/);
assert.match(gameService, /unrealizedPnlPct/);
// Market signals ride the ONE shared poll; adopted only for the live cycle.
assert.match(gameContext, /getMarketSignals\(\)/);
assert.match(gameContext, /payload\.apocalypseId === liveId/);
assert.match(gameContext, /setSignalsError/);
// No independent fetching or per-card timers anywhere on the game surface.
for (const [name, text] of Object.entries({ coinSignalCard, gameMarketGrid, leaderboardPressure })) {
  assert.doesNotMatch(text, /\bfetch\(/, `${name} must not fetch independently`);
  assert.doesNotMatch(text, /setInterval/, `${name} must not run its own timer`);
}

// --- V2-5: the 13-answer readability gate -------------------------------------
// 1. How much Cash do I have? — dominant, server-sourced, never fabricated.
assert.match(playerStatusStrip, /displayRoundCash\(myEntry, myParticipant\)/);
assert.match(playerStatusStrip, /Cash/);
assert.match(playerStatusStrip, /aria-label=\{`Cash \$\{formatCurrency\(roundCash\)\}`\}/);
assert.match(playerStatusStrip, /Syncing your position/); // never fabricate £10,000
// 2. How much Power do I have?
assert.match(playerStatusStrip, /power\.current/);
assert.match(playerStatusStrip, /\{power\.max\}/);
// 3. When does Power regenerate? — server rate + next-point hint.
assert.match(playerStatusStrip, /formatPowerRegenRate\(power\)/);
assert.match(playerStatusStrip, /formatPowerNextHint\(power, now\)/);
assert.match(gameLogic, /\+1 Power \/ \$\{seconds\}s/);
assert.match(gameLogic, /next \+1 in \$\{seconds\}s/);
assert.match(gameLogic, /Power full/);
// 4. How long until the apocalypse ends? — server-anchored countdown.
assert.match(header, /Time left/);
assert.match(header, /formatCountdown\(remaining\)/);
assert.match(header, /displayRemainingMs\(anchor, now\)/);
// 5./6. Which coins are dipping / rising / booming? — explicit phase chips.
assert.match(coinSignalCard, /phase-\$\{coin\.phase\.toLowerCase\(\)\}/);
assert.match(styles, /\.phase-dip/);
assert.match(styles, /\.phase-rise/);
assert.match(styles, /\.phase-boom/);
assert.match(styles, /\.phase-fall/);
assert.match(coinSignalCard, /1m change/);
assert.match(coinSignalCard, /formatRecentChangePct\(coin\.recentChangePct\)/);
assert.match(coinSignalCard, /momentumArrow\(coin\.momentum\)/);
assert.match(gameLogic, /▲ UP/);
assert.match(gameLogic, /▼ DOWN/);
// 7. What do I currently own? — owned cards lead the grid.
assert.match(coinSignalCard, /your position/);
assert.match(gameMarketGrid, /Owned positions lead/);
// 8. Am I making or losing money on each position? — explicit P&L £ + %.
assert.match(coinSignalCard, /Avg entry/);
assert.match(coinSignalCard, /Current price/);
assert.match(coinSignalCard, /Position value/);
assert.match(coinSignalCard, /formatSignedGbp\(holding\.unrealizedPnl\)/);
assert.match(coinSignalCard, /formatSignedPct\(holding\.unrealizedPnlPct\)/);
assert.match(coinSignalCard, /pnlWord/); // "profit" / "loss" in words
// 9. How do I buy? — the quick-buy ladder with the V2-5 amounts.
assert.match(coinSignalCard, /quick-buy-grid/);
assert.match(coinSignalCard, /QUICK_BUY_NOTIONALS\.map/);
assert.match(gameLogic, /QUICK_BUY_NOTIONALS: readonly number\[\] = \[250, 500, 1000, 2500\]/);
assert.match(gameLogic, /£2\.5K/);
// 10. What will that buy cost in Power? — visible estimate BEFORE committing,
//     the shared V2 formula, labelled as an estimate.
assert.match(gameLogic, /1 \+ Math\.floor\(notional \/ BUY_POWER_COST_DIVISOR\)/);
assert.match(gameLogic, /BUY_POWER_COST_DIVISOR = 125/);
assert.match(coinSignalCard, /⚡\{powerCost\} est\./);
assert.match(coinSignalCard, /estimated \$\{powerCost\} Power/);
assert.match(coinSignalCard, /server confirms the final cost/);
// 11. How do I sell? — one dominant SELL POSITION action; selling is free.
assert.match(coinSignalCard, /Sell position · \{formatCurrency\(holding\.currentValue\)\}/);
assert.match(coinSignalCard, /aria-label=\{`Sell entire \$\{coin\.symbol\} position`\}/);
assert.match(coinSignalCard, /0 — selling is always free/);
// 12. Which positions are dangerous? — the collapse-risk chip, in words.
assert.match(coinSignalCard, /Collapse risk/);
assert.match(coinSignalCard, /risk-\$\{coin\.collapseRisk\.toLowerCase\(\)\}/);
assert.match(styles, /\.risk-critical/);
assert.match(styles, /\.risk-stable/);
// 13. What is my leaderboard rank? — in the main status area AND the strip.
assert.match(leaderboardPressure, /Your rank <strong>#\{myEntry\.rank\}<\/strong> of \{entries\.length\}/);
assert.match(playerStatusStrip, /#\{myEntry\.rank\}/);
assert.match(leaderboardPressure, /leaderboard-me/); // human row highlighted
assert.match(leaderboardPressure, /Bot/); // bot marker preserved

// --- V2-5: trade safety on the new surface ------------------------------------
// Quick buys convert notional -> quantity at the displayed price (the backend
// trade endpoint takes quantity); the server stays authoritative.
assert.match(gameLogic, /export function quantityForNotional/);
assert.match(coinSignalCard, /quantityForNotional\(notional, coin\.currentPrice\)/);
assert.match(coinSignalCard, /trade\('BUY', coin\.coinId, quantity\)/);
assert.match(coinSignalCard, /trade\('SELL', coin\.coinId, holding\.quantity\)/);
// Financial actions are confirmed first; server rejections render verbatim.
assert.match(coinSignalCard, /Confirm quick buy/);
assert.match(coinSignalCard, /Confirm sale/);
assert.match(coinSignalCard, /err\.message/);
// Stale/offline/limit states disable with explicit explanations.
assert.match(coinSignalCard, /quickBuyBlockReason/);
assert.match(coinSignalCard, /QUICK_BUY_BLOCK_LABEL/);
assert.match(gameLogic, /Connection stale — refusing to trade on old data/);
assert.match(gameLogic, /Not enough Cash/);
assert.match(gameLogic, /Not enough Power/);
assert.match(gameLogic, /Position limit reached/);
// Dead coins: £0.00, DEAD/COLLAPSED, no BUY; a held dead position stays
// visible with the existing £0 sell path.
assert.match(coinSignalCard, /DEAD · COLLAPSED/);
assert.match(coinSignalCard, /£0\.00/);
assert.match(coinSignalCard, /cannot be bought/);
assert.match(coinSignalCard, /Sell dead position for £0\.00/);
assert.match(coinSignalCard, /Confirm £0 sell/);
assert.match(gameMarketGrid, /Collapsed this apocalypse — dead coins cannot be bought/);
// Archetype personality and typical ranges are public-signal derived.
assert.match(coinSignalCard, /archetypePersonality\(coin\.archetype\)/);
assert.match(coinSignalCard, /formatTypicalProfile\(coin\)/);
assert.match(gameLogic, /ARCHETYPE_PERSONALITY/);

// --- V2-5: mobile-first CSS -----------------------------------------------------
// Single-column phone composition first; columns only arrive with width.
assert.match(styles, /\.game-grid \{\s*display: grid;\s*grid-template-columns: 1fr;/);
assert.match(styles, /@media \(min-width: 640px\) \{\s*\.game-grid \{ grid-template-columns: repeat\(2/);
// Comfortable tap targets on primary actions (44px minimum).
assert.match(styles, /\.tap-target \{ min-height: 44px; \}/);
assert.match(styles, /\.tap-target-lg \{ min-height: 48px;/);
assert.match(styles, /\.quick-buy-btn \{/);
assert.match(styles, /min-height: 52px;/);
// No horizontal overflow at 360–412px: the shell, cards and media are all
// contained, with a hard overflow guard.
assert.match(styles, /\.game-shell/);
assert.match(styles, /overflow-x: clip/);
assert.match(styles, /img, svg, video, canvas \{ max-width: 100%; \}/);
assert.match(styles, /min-width: 0;/);
// The V2-5 surface introduces no new animation (reduced-motion surface-wide
// restraint stays exactly as it was).
const v25Css = styles.slice(styles.indexOf('V2-5 mobile-first game surface'));
assert.doesNotMatch(v25Css, /@keyframes/);
assert.doesNotMatch(v25Css, /animation:/);

// --- Issue #14: narrow-phone readability (360–430px portrait) ----------------
// Metadata and controls step UP below the sm breakpoint — never shrunk to
// fit. Every rule lives in one narrow-only media block so desktop/tablet
// rendering is byte-identical.
assert.match(styles, /@media \(max-width: 639\.98px\)/);
const narrowCss = styles.slice(styles.indexOf('@media (max-width: 639.98px)'));
assert.match(narrowCss, /\.label, \.label-ink \{ font-size: 0\.75rem;/);
assert.match(narrowCss, /\.signal-chip \{ font-size: 0\.72rem;/);
assert.match(narrowCss, /\.quick-buy-power \{ font-size: 0\.72rem;/); // was 9.9px
assert.match(narrowCss, /\.quick-buy-btn \{ min-height: 56px;/);
assert.match(narrowCss, /\.btn-gold, \.btn-ink, \.btn-oxblood \{ min-height: 44px;/);
assert.match(narrowCss, /\.how-to-play-trigger \{ min-height: 44px;/);
// The dominant Cash figure is fluid on phones so it can never push Wealth
// off the strip; the row may wrap instead of overflowing.
assert.match(narrowCss, /\.player-cash-figure \{ font-size: clamp\(/);
assert.match(playerStatusStrip, /player-cash-figure/);
assert.match(playerStatusStrip, /flex flex-wrap items-end justify-between/);
// No sub-12px metadata survives on the V2 game surface components.
for (const [name, text] of Object.entries({ coinSignalCard, playerStatusStrip, gameMarketGrid, header })) {
  assert.doesNotMatch(text, /text-\[0\.[0-6][0-9]rem\]/, `${name} still has sub-0.7rem metadata text`);
}
// Header metadata rows wrap onto extra lines instead of overflowing.
assert.match(header, /flex flex-wrap items-center justify-between mt-1\.5 gap-x-3 gap-y-1/);
assert.match(header, /flex flex-wrap items-center gap-x-4 gap-y-2/);
// Secondary grid chrome yields to the primary scan at narrow widths.
assert.match(gameMarketGrid, /chip hidden sm:inline-flex/);
// Confirmation rows keep label/value separated at narrow widths.
assert.match(coinSignalCard, /flex justify-between gap-2/);
assert.match(roundTrade, /flex justify-between gap-2/);

assert.match(html, /<title>Crypto Chaos · CoinX Apocalypse Exchange<\/title>/);
assert.match(html, /family=Inter/);

assert.match(chart, /24H/);
assert.match(chart, /7D/);
assert.match(chart, /30D/);
assert.match(chart, /ALL/);
assert.match(chart, /aria-pressed/);
assert.match(chart, /role="group"/);

// --- Issue #12: compact dip→boom→dip sparklines on the V2 cards ----------------
// Every card variant carries the sparkline: live cards fetch through the
// shared service; dead cards get a deterministic flatline and never fetch.
assert.match(coinSignalCard, /<CoinSparkline coin=\{coin\} cycleStartTime=\{gameState\?\.startTime \?\? null\} \/>/);
assert.match(coinSignalCard, /<CoinSparkline coin=\{coin\} averageEntryPrice=\{holding\.averageEntryPrice\} cycleStartTime=\{gameState\?\.startTime \?\? null\} \/>/);
assert.match(coinSignalCard, /<DeadCoinSparkline symbol=\{coin\.symbol\} \/>/);
// No heavyweight chart library is instantiated on compact cards.
assert.doesNotMatch(coinSparkline, /chart\.js|react-chartjs-2/);
assert.doesNotMatch(coinSignalCard, /chart\.js|react-chartjs-2/);
// Tiny SVG implementation with an accessible text equivalent; no axes,
// legend or technical-analysis clutter.
assert.match(coinSparkline, /<svg/);
assert.match(coinSparkline, /role="img"/);
assert.match(coinSparkline, /aria-label=\{ariaLabel\}/);
assert.match(coinSparkline, /describeSparkline/);
assert.match(coinSparkline, /preserveAspectRatio="none"/);
assert.match(coinSparkline, /vectorEffect="non-scaling-stroke"/);
assert.doesNotMatch(coinSparkline, /<(XAxis|YAxis|Legend|Axis)\b/);
// Loading/empty/error states are compact text rows — trading stays visible.
assert.match(coinSparkline, /Loading price history/);
assert.match(coinSparkline, /Price history unavailable — trading is unaffected/);
assert.match(coinSparkline, /No recent history yet/);
// Dead presentation never implies recovery or buyability.
assert.match(coinSparkline, /flatlined at £0\.00 — collapsed and cannot be bought/);
assert.match(coinSparkline, /deadFlatlinePath/);
// The window mapping and geometry are pure, documented helpers.
assert.match(sparklineUtil, /export function sparklineRangeForCoin/);
assert.match(sparklineUtil, /SPARKLINE_CYCLES_TARGET = 3/);
assert.match(sparklineUtil, /ARCHETYPE_MAX_CYCLE_MINUTES/);
assert.match(sparklineUtil, /export function toSparklineSeries/);
assert.match(sparklineUtil, /export function clipPointsSince/);
assert.match(sparklineUtil, /export function buildSparklinePath/);
assert.match(sparklineUtil, /export function entryMarkerY/);
assert.match(sparklineUtil, /export function deadFlatlinePath/);
assert.match(sparklineUtil, /export function describeSparkline/);
// The central service uses the authoritative per-coin endpoint only (never
// the aggregate market history), dedupes concurrent requests, caches for the
// backend's 10s TTL, refreshes on one shared ~12s cadence, aborts on
// unmount, and keeps the last good line on refresh failures.
assert.match(priceHistoryService, /\/coins\/\$\{entry\.coinId\}\/price-history\?range=\$\{entry\.range\}/);
assert.match(priceHistoryService, /HISTORY_CACHE_TTL_MS = 10_000/);
assert.match(priceHistoryService, /HISTORY_REFRESH_MS = 12_000/);
assert.match(priceHistoryService, /entry\.inflight !== null/); // dedupe guard
assert.match(priceHistoryService, /entry\.inflight\?\.abort\(\)/); // unmount safety
assert.match(priceHistoryService, /Stale-response guard/);
assert.match(priceHistoryService, /stale-while-revalidate/);
assert.doesNotMatch(priceHistoryService, /market\/price-history/);
// Cards bind through the hook — no per-card fetch or timer anywhere.
assert.match(useCoinSparkline, /useSyncExternalStore/);
assert.match(useCoinSparkline, /coinPriceHistory\.subscribe/);
assert.doesNotMatch(coinSparkline, /\bfetch\(|setInterval/);
assert.doesNotMatch(useCoinSparkline, /\bfetch\(|setInterval/);
// Sparkline styles: fixed compact height, full width, direction colours and
// the dashed average-entry marker; no new animation on the V2-5 surface.
assert.match(styles, /\.coin-sparkline/);
assert.match(styles, /\.sparkline-svg \{[\s\S]*?height: 44px/);
assert.match(styles, /\.sparkline-up path \{ stroke: var\(--verdigris\)/);
assert.match(styles, /\.sparkline-down path \{ stroke: var\(--oxblood\)/);
assert.match(styles, /\.sparkline-entry \{/);
assert.match(styles, /\.sparkline-state \{/);

// Sparkline points are clipped to the LIVE apocalypse start — prices reset
// to a persisted baseline at every cycle boundary, so a trailing window must
// never render the previous round's dead regime as current movement.
assert.match(coinSparkline, /clipPointsSince\(points, sinceMs\)/);
assert.match(coinSparkline, /cycleStartTime/);

// --- Issue #13: detailed V2 coin view from every primary card -----------------
// The grid owns the detail state; every card variant (available, owned,
// dead) is wired to open it, and the open detail always resolves from the
// LIVE signals payload so the correct coin id/name/symbol is traceable.
assert.match(gameMarketGrid, /useState<number \| null>\(null\)/);
assert.match(gameMarketGrid, /signals\.coins\.find\(\(coin\) => coin\.coinId === detailCoinId\)/);
assert.match(gameMarketGrid, /import \{ Modal \} from '\.\/Modal\.tsx';/);
assert.match(gameMarketGrid, /import \{ GameCoinDetail \} from '\.\/GameCoinDetail\.tsx';/);
assert.match(gameMarketGrid, /<Modal isOpen=\{detailCoin !== null\} onClose=\{\(\) => setDetailCoinId\(null\)\}>/);
assert.match(gameMarketGrid, /<GameCoinDetail/);
// Both the active grid and the collapsed grid wire the same opener.
assert.equal(
  (gameMarketGrid.match(/onOpenDetail=\{\(\) => setDetailCoinId\(coin\.coinId\)\}/g) || []).length,
  2,
  'active AND dead card lists must both open the detail'
);
assert.match(coinSignalCard, /onOpenDetail: \(\) => void;/);
// All three card variants (dead / owned / available) activate the detail.
assert.equal(
  (coinSignalCard.match(/onClick=\{handleCardClick\}/g) || []).length,
  3,
  'every primary card variant must open the detail from non-trade areas'
);
// Trade-area isolation: the delegation guard ignores every interactive
// element, so BUY/SELL/confirm/cancel/custom-amount taps and nested
// RoundTradePanel controls can never open the detail — and the detail
// gesture can never fire a trade.
assert.match(coinSignalCard, /target\.closest\('button, a, input, select, textarea, \[role="button"\]'\)/);
// Keyboard/AT route: a real, labelled button with visible focus styling.
assert.match(coinSignalCard, /aria-label=\{`Open \$\{coin\.name\} details`\}/);
assert.match(coinSignalCard, /card-detail-trigger/);
assert.match(styles, /\.card-detail-trigger \{/);
assert.match(styles, /\.card-detail-trigger:focus-visible/);
// Practical touch target: the narrow media block keeps the Details control
// at a >=44px minimum height with readable text.
assert.match(styles, /\.card-detail-trigger \{ min-height: 44px;/);

// Detail content: identity, live price, full V2 signal set and typical
// ranges — all public, already-happened data.
assert.match(gameCoinDetail, /Coin \{coin\.coinId\}/);
assert.match(gameCoinDetail, /<h2[^>]*>\s*\{coin\.name\}\s*<\/h2>/);
assert.match(gameCoinDetail, /\{coin\.symbol\}\/GBP/);
assert.match(gameCoinDetail, /phase-\$\{coin\.phase\.toLowerCase\(\)\}/);
assert.match(gameCoinDetail, /momentumArrow\(coin\.momentum\)/);
assert.match(gameCoinDetail, /archetypePersonality\(coin\.archetype\)/);
assert.match(gameCoinDetail, /risk-\$\{coin\.collapseRisk\.toLowerCase\(\)\}/);
assert.match(gameCoinDetail, /formatRecentChangePct\(coin\.recentChangePct\)/);
assert.match(gameCoinDetail, /formatTypicalCycle\(coin\)/);
assert.match(gameCoinDetail, /formatTypicalSwing\(coin\)/);
assert.match(gameLogic, /export function formatTypicalCycle/);
assert.match(gameLogic, /export function formatTypicalSwing/);
// Owned economics: server-owned holding fields rendered verbatim.
assert.match(gameCoinDetail, /Your position/);
assert.match(gameCoinDetail, /Avg entry/);
assert.match(gameCoinDetail, /Cost basis/);
assert.match(gameCoinDetail, /Position value/);
assert.match(gameCoinDetail, /holding\.averageEntryPrice/);
assert.match(gameCoinDetail, /holding\.costBasis/);
assert.match(gameCoinDetail, /holding\.currentValue/);
assert.match(gameCoinDetail, /formatSignedGbp\(holding\.unrealizedPnl\)/);
assert.match(gameCoinDetail, /formatSignedPct\(holding\.unrealizedPnlPct\)/);
// Dead/collapsed state: £0.00, explicitly non-buyable, and the alive trade
// panel is never rendered for a dead coin (only the owned £0 sell path).
assert.match(gameCoinDetail, /DEAD · COLLAPSED/);
assert.match(gameCoinDetail, /£0\.00/);
assert.match(gameCoinDetail, /cannot be bought/);
assert.match(gameCoinDetail, /\{coin\.dead \? \(/);
// Detail trade area: the shared authoritative RoundTradePanel with the
// per-order Power cost estimate; selling is explicitly free.
assert.match(gameCoinDetail, /<RoundTradePanel coin=\{legacyCoin\} showPowerEstimate \/>/);
assert.match(gameCoinDetail, /⚡ Power \{power\.current\}\/\{power\.max\}/);
assert.match(gameCoinDetail, /selling is always free/);
assert.match(roundTrade, /showPowerEstimate\?: boolean/);
assert.match(roundTrade, /estimateBuyPowerCost\(total\)/);
assert.match(roundTrade, /⚡0 — selling is always free/);
assert.match(roundTrade, /server confirms the final cost/);
// The detail rides the shared context — no independent fetch, timer, or
// second charting library (Chart.js only inside the existing PriceChart).
assert.doesNotMatch(gameCoinDetail, /\bfetch\(|setInterval/);
assert.doesNotMatch(gameCoinDetail, /chart\.js|react-chartjs-2/);
// No future price, next peak, future phase timestamp, hidden collapse
// time/order, seed, or predictive target anywhere on the detail surface.
assert.doesNotMatch(gameCoinDetail, /seed|nextPeak|next_peak|collapseTime|collapse_time|futurePrice|predictive/i);
// Narrow-friendly layout: stat cells (min-width: 0) in a wrapping grid.
assert.match(gameCoinDetail, /grid grid-cols-2 sm:grid-cols-3 gap-2/);
assert.match(gameCoinDetail, /stat-cell/);
// Copy framing: cycle recognition is core gameplay; no stale "Classic
// exchange" wording on the scoped detail surface.
assert.doesNotMatch(gameCoinDetail, /Classic exchange/i);
assert.match(gameLogic, /reading the dip → rise → boom → fall cycle on the price chart is core gameplay/);

// Detail chart: short cycle windows first-class with the archetype-aware
// default; longer windows only as a secondary group; the SAME #12 cycle
// clip and entry-marker rule; the authoritative per-coin endpoint only.
assert.match(gameCoinDetail, /DETAIL_PRIMARY_RANGES: readonly TimeRange\[\] = \['10M', '30M', '1H', '2H'\]/);
assert.match(gameCoinDetail, /DETAIL_SECONDARY_RANGES: readonly TimeRange\[\] = \['24H', '7D', '30D', 'ALL'\]/);
assert.match(gameCoinDetail, /initialRange = sparklineRangeForCoin\(coin\)/);
assert.match(gameCoinDetail, /cycleStartTime=\{gameState\?\.startTime \?\? null\}/);
assert.match(gameCoinDetail, /averageEntryPrice=\{owned && holding \? holding\.averageEntryPrice : null\}/);
assert.match(typesTs, /'10M' \| '30M' \| '1H' \| '2H' \| '24H' \| '7D' \| '30D' \| 'ALL'/);
assert.match(chart, /clipPointsSince\(result\.points \|\| \[\], sinceMs\)/);
assert.match(chart, /cycleStartTime\?: string \| null/);
assert.match(chart, /entryMarkerVisible/);
assert.match(chart, /secondaryRanges/);
assert.match(chart, /aria-label="Select a longer chart time range"/);
assert.match(chart, /filter: \(tooltipItem/); // the entry marker is never a tooltip value
assert.match(chart, /Your average entry/);
assert.match(chart, /\$\{API_BASE\}\/coins\/\$\{coinId\}\/price-history\?range=\$\{range\}/);
assert.doesNotMatch(chart, /market\/price-history/);
assert.match(sparklineUtil, /export function entryMarkerVisible/);
// The classic modal chart defaults are unchanged (24H first, long ranges).
assert.match(chart, /initialRange \?\? primaryRanges\[0\]/);

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
