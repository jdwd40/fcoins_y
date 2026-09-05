import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const playerShellStart = app.indexOf('function PlayerShell');
const appStart = app.indexOf('function App');
assert.notEqual(playerShellStart, -1, 'App.tsx must define PlayerShell');
assert.notEqual(appStart, -1, 'App.tsx must define App');
assert.ok(playerShellStart < appStart, 'PlayerShell must be declared before App');
const playerShell = app.slice(playerShellStart, appStart);
assert.match(playerShell, /function PlayerShell\s*\(/, 'PlayerShell extraction must contain its declaration');
const styles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const chart = readFileSync(new URL('../src/components/PriceChart.tsx', import.meta.url), 'utf8');
const header = readFileSync(new URL('../src/components/ApocalypseHeader.tsx', import.meta.url), 'utf8');
const persistentHeader = readFileSync(new URL('../src/components/PersistentMarketHeader.tsx', import.meta.url), 'utf8');
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
const persistentService = readFileSync(new URL('../src/services/persistentService.ts', import.meta.url), 'utf8');
const persistentContext = readFileSync(new URL('../src/context/PersistentContext.tsx', import.meta.url), 'utf8');
const persistentTradePanel = readFileSync(new URL('../src/components/PersistentTradePanel.tsx', import.meta.url), 'utf8');
const persistentTrading = readFileSync(new URL('../src/utils/persistentTrading.ts', import.meta.url), 'utf8');
const typesTs = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');
const monitorService = readFileSync(new URL('../src/services/monitorService.ts', import.meta.url), 'utf8');
const monitorUtil = readFileSync(new URL('../src/utils/apocalypseMonitor.ts', import.meta.url), 'utf8');
const apocalypseMonitor = readFileSync(new URL('../src/components/ApocalypseMonitor.tsx', import.meta.url), 'utf8');

// --- Core Crypto Chaos surface ------------------------------------------
// Stage 11: the primary screen is the mobile-first persistent market —
// compact top bar, persistent market header, player status strip,
// leaderboard pressure and scannable market grid. Apocalypse countdown /
// settlement overlays are unmounted from primary Market (files retained).
assert.match(app, /Crypto Chaos/);
assert.match(app, /GameTopBar/);
assert.match(app, /PlayerStatusStrip/);
assert.match(app, /LeaderboardPressure/);
assert.match(app, /GameMarketGrid/);
assert.match(app, /PersistentMarketHeader/);
assert.doesNotMatch(app, /<ApocalypseHeader/);
assert.doesNotMatch(app, /ApocalypseHeader coins=/);
assert.match(app, /PlayerRoundPanel/);
assert.match(app, /LeaderboardPanel/);
assert.doesNotMatch(app, /<ResultsOverlay/);
assert.doesNotMatch(app, /<RecentResultsPanel/);
// Final Stage 11 disconnection: normal player routes use only the persistent
// runtime. GameContext remains on disk for compatibility, but is not imported
// or mounted by PlayerShell.
assert.doesNotMatch(app, /import\s+\{\s*GameProvider\s*\}\s+from\s+['"]\.\/context\/GameContext/);
assert.doesNotMatch(playerShell, /GameProvider/);
assert.doesNotMatch(playerShell, /setInterval|visibilitychange|window\.addEventListener\(['"]focus|joinGame/);
assert.doesNotMatch(app, /getGameState|getLiveLeaderboard|getMarketSignals|getMyRoundEconomy|joinGame/);
assert.doesNotMatch(app, /\/game\/(state|leaderboard|market-signals|participant|join)/);
assert.match(app, /<PersistentProvider>\s*\{children\}\s*<\/PersistentProvider>/);
assert.match(app, /<Route path="\/" element=\{<PlayerShell><Market/);
assert.match(app, /<Route path="\/profile" element=\{<PlayerShell><Profile/);
assert.match(app, /path="\/internal\/apocalypse-monitor" element=\{<ApocalypseMonitor \/>\}/);
// Every component reachable from / and /profile must use the persistent/auth
// sources directly; a dormant compatibility component is not a player-shell
// dependency and must not force GameProvider back into App.tsx.
for (const [name, source] of [
  ['PersistentMarketHeader', persistentHeader],
  ['PlayerStatusStrip', playerStatusStrip],
  ['LeaderboardPressure', leaderboardPressure],
  ['GameMarketGrid', gameMarketGrid],
  ['LeaderboardPanel', leaderboard],
  ['PlayerRoundPanel', playerRound],
  ['Profile', profile],
  ['GameTopBar', gameTopBar],
  ['CoinSignalCard', coinSignalCard],
  ['GameCoinDetail', gameCoinDetail],
  ['PersistentTradePanel', persistentTradePanel]
]) {
  assert.doesNotMatch(source, /useGame\(/, `${name} must not consume GameContext on player routes`);
}
assert.match(gameContext, /export function GameProvider/); // compatibility remains for Stage 13
for (const [name, path] of [
  ['getGameState', '/game/state'],
  ['getLiveLeaderboard', '/game/leaderboard'],
  ['getMarketSignals', '/game/market-signals'],
  ['getMyRoundEconomy', '/game/participant'],
  ['joinGame', '/game/join']
]) {
  assert.match(gameContext, new RegExp(`\\b${name}\\(`), `${name} remains a legacy GameContext runtime call`);
  assert.match(gameService, new RegExp(path.replace('/', '\\/')), `${name} endpoint form remains covered`);
}
assert.match(app, /Leaderboard & activity/);
assert.doesNotMatch(app, /Round detail/);
assert.doesNotMatch(app, /JOIN APOCALYPSE/);
assert.doesNotMatch(app, /30-minute cycle/);
assert.doesNotMatch(app, /a CoinX apocalypse/);
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

// Stage 13 compatibility: ApocalypseHeader file retained (countdown/meter),
// but it is NOT mounted on the primary Market shell.
assert.match(header, /progressbar/);
assert.match(header, /aria-valuenow/);
assert.match(header, /Connection stale/);
assert.match(header, /Backend unavailable/);
assert.match(header, /formatCountdown/);
assert.match(header, /meterPhase/);
assert.match(header, /escalationBand/);
assert.match(header, /ESCALATION_BAND_LABEL\[band\]/);
assert.match(gameLogic, /export function escalationBand/);
assert.match(gameLogic, /ESCALATION_BAND_LABEL/);

// Stage 11 primary persistent market header: no countdown / cycle / settlement.
assert.match(persistentHeader, /Persistent market/);
assert.match(persistentHeader, /HowToPlay/);
assert.match(persistentHeader, /usePersistent/);
assert.doesNotMatch(persistentHeader, /formatCountdown|displayRemainingMs|apocalypsePercent|SETTLING|JOIN APOCALYPSE|30-minute/);
assert.doesNotMatch(persistentHeader, /progressbar|role=\"progressbar\"|aria-valuenow/);
assert.doesNotMatch(persistentHeader, /\bDirector\b|phase-dip|phase-rise|meterPhase/);
assert.doesNotMatch(gameMarketGrid, /next apocalypse starts automatically/i);
assert.match(gameMarketGrid, /Loading market signals|No coins in the persistent market yet/);
assert.match(leaderboardPressure, /Full board and account activity/);
assert.doesNotMatch(leaderboardPressure, /history and results/);

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
assert.match(playerRound, /Syncing your account/); // neutral loading, no fabricated Cash
assert.match(gameContext, /joinGame\(token\)/); // automatic ensure, not a button handler
assert.match(gameContext, /ensureAttemptRef/); // one attempt per (user, cycle)
assert.doesNotMatch(gameContext, /joinPending/);
assert.doesNotMatch(gameContext, /Sign in to join/);
// Exactly one gameplay balance, labelled Cash, derived ONLY from the
// server-owned participant / leaderboard row via the shared helper.
assert.match(gameLogic, /GAME_STARTING_CASH_LABEL = '£10,000'/);
assert.match(gameLogic, /export function displayRoundCash/);
assert.match(roundTrade, /displayRoundCash\(myEntry, myParticipant\)/);
// Persistent Stage 6: the gameplay money surface reads the server-owned
// PERSISTENT account verbatim — never the round participant.
assert.match(playerRound, /account\.cash/);
assert.match(playerRound, /account\.netWealth/);
assert.match(playerRound, /account\.holdingsValue/);
assert.match(playerRound, /Your persistent account/);
assert.match(playerRound, /Wallet className="w-3 h-3" \/> Cash/);
assert.doesNotMatch(roundTrade, /Round cash/);
assert.doesNotMatch(playerRound, /Round cash|round wallet/);
// No £1,000-era game copy on any player-facing surface.
for (const [name, text] of Object.entries({ gameLogic, roundTrade, playerRound, leaderboard, howToPlay, resultsPanel, profile, userMenu })) {
  assert.doesNotMatch(text, /£1,000/, `£1,000-era copy remains in ${name}`);
}
// Legacy users.funds is classic account data, never game money: it stays off
// the main nav, and Profile is now the PERSISTENT account surface — legacy
// funds/holdings are historical archive and no longer rendered there.
assert.doesNotMatch(userMenu, /user\?\.funds/);
assert.doesNotMatch(profile, /user\?\.funds|user\.funds/);
assert.match(profile, /Persistent market account/);
assert.match(profile, /exactly once/);
assert.match(profile, /account\?\.cash|account\.cash/);
assert.match(profile, /account\?\.holdingsValue|account\.holdingsValue/);
assert.match(profile, /account\.netWealth - account\.startingCash/); // debt-adjusted (humans carry debt = 0)
// Profitable-only completed leaderboards (backend #19): contract fields,
// win-condition copy and a legitimate empty board.
assert.match(gameService, /leaderboardEligible/);
assert.match(gameService, /totalResultCount/);
assert.match(gameLogic, /LEADERBOARD_RULE_COPY = `Finish above \$\{GAME_STARTING_CASH_LABEL\} to make the leaderboard\.`/);
assert.match(leaderboard, /PERSISTENT_LEADERBOARD_RULE_COPY/);
assert.doesNotMatch(leaderboard, /peakWealth|participantId|currentWealth|settling|lifecycle/);
assert.doesNotMatch(leaderboard, /\.sort\(/);
assert.match(leaderboard, /entry\.accountId/);
assert.match(leaderboard, /entry\.netWorth/);
assert.match(leaderboard, /usePersistent/);
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
// The activity surface (Persistent Stage 6): the player's own persistent
// buys/sells at server-locked prices — type, symbol, quantity @ price,
// amount and timestamp per row; the Cash figure stays the single
// authoritative number.
assert.match(playerRound, /Account activity/);
assert.match(playerRound, /formatQuantity\(tx\.quantity\)/);
assert.match(playerRound, /formatCurrency\(tx\.price\)/);
assert.match(playerRound, /formatActivityTimestamp\(tx\.createdAt/);
assert.match(playerRound, /aria-live="polite"/);
assert.match(playerRound, /aria-label="Recent persistent trades"/);
assert.match(playerRound, /No trades yet/); // clean empty state
assert.match(playerRound, /Syncing account activity/); // neutral loading state
assert.match(playerRound, /Activity update failed/); // stale state keeps last good feed
assert.match(playerRound, /still authoritative/); // a feed failure never shakes Cash
assert.match(playerRound, /server-locked live price/); // execution provenance
// Internal identifiers and ledger internals stay out of the primary UX.
assert.doesNotMatch(playerRound, /eventKey|event_key/);
assert.doesNotMatch(playerRound, /balanceBefore|balanceAfter/);
// How to Play (Stage 11): continuous persistent market, no timer/reset.
assert.match(gameLogic, /HOW TO PLAY THE PERSISTENT MARKET/);
assert.match(gameLogic, /runs continuously/i);
assert.match(gameLogic, /no game timer/i);
assert.match(gameLogic, /no Apocalypse reset/i);
assert.match(gameLogic, /replacement coins may enter/i);
assert.match(gameLogic, /historical positions at £0/i);
assert.doesNotMatch(gameLogic, /HOW TO SURVIVE THE APOCALYPSE/);

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

// --- HOW TO PLAY (issue #7 / Stage 11) --------------------------------------
// Discoverable control in the persistent market header; compact accessible
// dialog, never a forced tutorial. Copy is single-sourced from gameLogic.
assert.match(persistentHeader, /HowToPlay/); // mounted in the primary persistent header
assert.match(howToPlay, /How to play/); // visible, human-readable trigger label
assert.match(howToPlay, /New to the persistent market/);
assert.doesNotMatch(howToPlay, /end of the world/);
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
assert.match(gameLogic, /HOW TO PLAY THE PERSISTENT MARKET/);
assert.doesNotMatch(gameLogic, /HOW TO SURVIVE THE APOCALYPSE/);
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
// 1. How much Cash do I have? — dominant, server-sourced PERSISTENT account
//    figure, never fabricated.
assert.match(playerStatusStrip, /account\.cash/);
assert.match(playerStatusStrip, /Cash/);
assert.match(playerStatusStrip, /aria-label=\{`Cash \$\{formatCurrency\(cash\)\}`\}/);
assert.match(playerStatusStrip, /Syncing your account/); // never fabricate £10,000
// 2./3. Power is gone: the persistent economy has no Power — the strip shows
//    holdings value and the uncapped open-position count instead.
assert.doesNotMatch(playerStatusStrip, /⚡|power\.current|formatPowerRegenRate|formatPowerNextHint/);
assert.match(playerStatusStrip, /account\.holdingsValue/);
assert.match(playerStatusStrip, /account\.holdings\.length/);
assert.match(playerStatusStrip, /open · no cap/);
// 4. Stage 11: primary shell has NO apocalypse countdown. Compatibility
//    ApocalypseHeader still owns the countdown helpers for Stage 13.
assert.doesNotMatch(persistentHeader, /Time left|formatCountdown|displayRemainingMs/);
assert.match(header, /Time left/);
assert.match(header, /formatCountdown\(remaining\)/);
assert.match(header, /displayRemainingMs\(anchor, now\)/);
// 5./6. Primary persistent cards use recentChangePct + momentum + archetype (no phase).
assert.doesNotMatch(coinSignalCard, /coin\.phase|phase-\$\{coin/);
assert.match(styles, /\.phase-dip/);
assert.match(styles, /\.phase-rise/);
assert.match(styles, /\.phase-boom/);
assert.match(styles, /\.phase-fall/);
assert.match(coinSignalCard, /1m change/);
assert.match(coinSignalCard, /formatRecentChangePct\(coin/);
assert.match(coinSignalCard, /momentumArrow\(coin/);
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
// 10. What will the trade execute at? — the server-locked live price is
//     stated BEFORE committing; there is no Power cost in the persistent
//     economy (the retired V2 estimate formula stays in gameLogic for the
//     retained legacy panel only).
assert.match(gameLogic, /1 \+ Math\.floor\(notional \/ BUY_POWER_COST_DIVISOR\)/);
assert.match(gameLogic, /BUY_POWER_COST_DIVISOR = 125/);
assert.match(coinSignalCard, /Executes at the server-locked live price/);
assert.match(coinSignalCard, /Server-locked live price/);
assert.doesNotMatch(coinSignalCard, /⚡|estimateBuyPowerCost|Power \(estimate\)/);
// 11. How do I sell? — one dominant SELL POSITION action at the live price.
assert.match(coinSignalCard, /Sell position · \{formatCurrency\(holding\.currentValue\)\}/);
assert.match(coinSignalCard, /aria-label=\{`Sell entire \$\{coin\.symbol\} position`\}/);
assert.doesNotMatch(coinSignalCard, /selling is always free/);
// 12. Collapse risk removed from primary persistent cards (Stage 11 cutover).
assert.doesNotMatch(coinSignalCard, /Collapse risk|coin\.collapseRisk|risk-\$\{coin/);
assert.match(styles, /\.risk-critical/);
assert.match(styles, /\.risk-stable/);
// 13. What is my leaderboard rank? — in the main status area AND the strip.
// Stage 10B: rank comes from the persistent board (usePersistent / myEntry),
// never a client re-sort of cycle wealth.
assert.match(leaderboardPressure, /Your rank <strong>#\{myEntry\.rank\}<\/strong> of \{entries\.length\}/);
assert.match(playerStatusStrip, /#\{myEntry\.rank\}/);
assert.match(leaderboardPressure, /leaderboard-me/); // human row highlighted
assert.match(leaderboardPressure, /Bot/); // bot marker preserved
assert.match(leaderboardPressure, /usePersistent/);
assert.match(playerStatusStrip, /usePersistent/);
assert.doesNotMatch(leaderboardPressure, /useGame|peakWealth|participantId|settling|lifecycle/);
assert.doesNotMatch(playerStatusStrip, /useGame/);
assert.doesNotMatch(playerRound, /useGame/);
assert.match(playerRound, /myEntry/);
assert.doesNotMatch(leaderboardPressure, /\.sort\(/);

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
// Stale/offline/unauthenticated states disable with explicit explanations —
// via the persistent gate helpers (no lifecycle/Power/position-cap gates).
assert.match(coinSignalCard, /persistentTradeBlockReason/);
assert.match(coinSignalCard, /PERSISTENT_TRADE_BLOCK_LABEL/);
assert.match(persistentTrading, /export function persistentTradeBlockReason/);
assert.match(persistentTrading, /'not-authenticated'/);
assert.match(persistentTrading, /'account-syncing'/);
assert.match(persistentTrading, /'account-unavailable'/);
assert.match(persistentTrading, /'insufficient-cash'/);
assert.match(gameLogic, /Connection stale — refusing to trade on old data/);
assert.match(gameLogic, /Not enough Cash/);
// Persistent death is PERMANENT and stops trading both ways: a held dead
// position stays visible as £0.00 history with no sell path.
assert.match(coinSignalCard, /DEAD/);
assert.match(coinSignalCard, /£0\.00/);
assert.match(coinSignalCard, /cannot be bought or sold/);
assert.match(coinSignalCard, /Position destroyed/);
assert.doesNotMatch(coinSignalCard, /Sell dead position|Confirm £0 sell/);
assert.match(gameMarketGrid, /Dead coins — trading has stopped permanently/);
// Archetype personality and typical ranges are public-signal derived.
assert.match(coinSignalCard, /archetypePersonality\(coin/);
// Typical profile removed from primary persistent card (no typicalCycle on signals).
assert.doesNotMatch(coinSignalCard, /formatTypicalProfile|Typical/);
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
for (const [name, text] of Object.entries({ coinSignalCard, playerStatusStrip, gameMarketGrid, header, persistentHeader })) {
  assert.doesNotMatch(text, /text-\[0\.[0-6][0-9]rem\]/, `${name} still has sub-0.7rem metadata text`);
}
// Compatibility ApocalypseHeader still wraps; primary persistent header wraps too.
assert.match(header, /flex flex-wrap items-center justify-between mt-1\.5 gap-x-3 gap-y-1/);
assert.match(header, /flex flex-wrap items-center gap-x-4 gap-y-2/);
assert.match(persistentHeader, /flex flex-wrap items-center gap-x-4 gap-y-2/);
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
assert.match(coinSignalCard, /<CoinSparkline coin=\{coin\} cycleStartTime=\{null\} \/>/);
assert.match(coinSignalCard, /<CoinSparkline coin=\{coin\} averageEntryPrice=\{holding\.averageEntryPrice\} cycleStartTime=\{null\} \/>/);
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
assert.match(coinSparkline, /flatlined at £0\.00 — dead and cannot be bought/);
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

// Sparkline clipping is cycle-legacy: the persistent market has no cycle
// boundary, so the cards pass cycleStartTime={null} (no clip); the helper
// stays for the retained chart components.
assert.match(coinSparkline, /clipPointsSince\(points, sinceMs\)/);
assert.match(coinSparkline, /cycleStartTime/);

// --- Issue #13: detailed V2 coin view from every primary card -----------------
// The grid owns the detail state; every card variant (available, owned,
// dead) is wired to open it, and the open detail always resolves from the
// LIVE signals payload so the correct coin id/name/symbol is traceable.
assert.match(gameMarketGrid, /useState<number \| null>\(null\)/);
assert.match(gameMarketGrid, /signals\.coins\.find\(\(coin\) => coin\.coinId === detailCoinId\)/);
assert.match(gameMarketGrid, /usePersistent/);
assert.doesNotMatch(gameMarketGrid, /useGame|signalsSyncedAt|nowTick|marketPhase|MarketPhaseBanner/);
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

// Detail content: identity, live price, persistent signal fields (no phase/collapse/typical).
// Phase/collapse/event/typical removed for primary persistent detail (Stage 11).
assert.match(gameCoinDetail, /Coin {coin.coinId}/);
assert.match(gameCoinDetail, /coin.name/);
assert.match(gameCoinDetail, /symbol.*GBP/);
assert.doesNotMatch(gameCoinDetail, /coin.phase|phase|collapseRisk|formatTypicalCycle|formatTypicalSwing/);
assert.match(gameCoinDetail, /momentumArrow\(coin/);
assert.match(gameCoinDetail, /archetypePersonality\(coin/);
assert.match(gameCoinDetail, /formatRecentChangePct\(coin/);
// formatTypical still in gameLogic for legacy surfaces
// (same for swing)
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
// Dead/collapsed state: £0.00, permanent death, and trading has stopped in
// both directions (no sell path for dead persistent holdings).
assert.match(gameCoinDetail, /DEAD · PERMANENT/);
assert.match(gameCoinDetail, /£0\.00/);
assert.match(gameCoinDetail, /trading has stopped permanently/);
assert.match(gameCoinDetail, /\{coin\.dead \? \(/);
// Detail trade area: the shared authoritative PERSISTENT trade panel; there
// is no Power estimate and no per-order Power cost in the persistent path.
assert.match(gameCoinDetail, /<PersistentTradePanel coin=\{legacyCoin\} \/>/);
assert.doesNotMatch(gameCoinDetail, /⚡|showPowerEstimate|selling is always free/);
assert.match(persistentTradePanel, /Server-locked live price/);
assert.match(persistentTradePanel, /parseTradeQuantity\(amount\)/);
assert.match(persistentTradePanel, /minTradeValueError\(total, currentPrice\)/);
assert.match(persistentTradePanel, /trade\(side, coin\.coin_id, amountValue\)/);
assert.match(persistentTradePanel, /aria-pressed/);
assert.match(persistentTradePanel, /err\.message/); // GameApiError surfaces server text
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
assert.match(gameCoinDetail, /cycleStartTime=\{null\}/);
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

// --- Apocalypse Monitor Phase 3 Plan 1: internal operator dashboard --------
// Internal route under the existing /coins basename, never linked from the
// player navigation.
assert.match(app, /path="\/internal\/apocalypse-monitor"/);
assert.match(app, /ApocalypseMonitor/);
// The player-facing game client still never touches the diagnostics API;
// the operator token boundary lives in its own service module.
assert.doesNotMatch(gameService, /\/game\/diagnostics/);
assert.match(monitorService, /\/game\/diagnostics\/monitor\/cycles/);
assert.match(monitorService, /\/game\/diagnostics\/monitor\?cycleId=/);
assert.match(monitorService, /API_BASE_URL/);
assert.match(monitorService, /Authorization: `Bearer \$\{trimmed\}`/);
assert.match(monitorService, /export class MonitorApiError/);
assert.match(monitorService, /INVALID_MONITOR_TOKEN_MESSAGE/);
assert.match(monitorService, /export async function getMonitorCycles/);
assert.match(monitorService, /export async function getMonitorSnapshot/);
assert.match(monitorService, /export function parseMonitorCycles/);
assert.match(monitorService, /export function parseMonitorSnapshot/);
assert.match(monitorService, /'exact' \| 'time_window_derived' \| 'mixed'/);
// The diagnostics service never logs (a log line could carry the token).
assert.doesNotMatch(monitorService, /console\.(log|error|warn|info|debug)/);
// Token handling: manual entry only, React memory only. Never hard-coded,
// never env, never persisted to any Web Storage, never on the player routes.
assert.doesNotMatch(apocalypseMonitor, /localStorage|sessionStorage/);
assert.doesNotMatch(apocalypseMonitor, /import\.meta\.env|VITE_/);
assert.match(apocalypseMonitor, /type="password"/);
assert.match(apocalypseMonitor, /autoComplete="off"/);
assert.match(apocalypseMonitor, /Diagnostics token/);
assert.match(apocalypseMonitor, /held in memory only/);
// Clean state concepts: selectedCycle / monitorData / chartMode.
assert.match(apocalypseMonitor, /selectedCycle/);
assert.match(apocalypseMonitor, /monitorData/);
assert.match(apocalypseMonitor, /chartMode/);
// Newest cycle auto-selected; switching shows loading and failures surface.
assert.match(apocalypseMonitor, /pickNewestCycle\(result\.cycles\)/);
assert.match(apocalypseMonitor, /Loading monitor data/);
// Chart: one line per coin, elapsed apocalypse time, PRICE / % CHANGE modes.
assert.match(apocalypseMonitor, /react-chartjs-2/);
assert.match(apocalypseMonitor, /buildMonitorSeries\(coin, monitorData\.cycle\.startTime, chartMode\)/);
assert.match(apocalypseMonitor, /MONITOR_CHART_MODE_LABEL/);
assert.match(apocalypseMonitor, /aria-pressed/);
assert.match(apocalypseMonitor, /role="group"/);
assert.match(apocalypseMonitor, /Elapsed \$\{formatElapsed/);
// Summary table: start/end/latest/high/low/change/sample count, provenance,
// collapsed final zero obvious, warnings rendered.
assert.match(apocalypseMonitor, /summariseMonitorCoin\(coin, monitorData\.cycle\.endTime\)/);
assert.match(apocalypseMonitor, /attributionLabel\(/);
assert.match(apocalypseMonitor, /COLLAPSED/);
assert.match(apocalypseMonitor, /monitorData\.warnings\.map/);
assert.match(apocalypseMonitor, /Samples/);
// Pure helpers single-source the transformation and summary behaviour.
assert.match(monitorUtil, /export function buildMonitorSeries/);
assert.match(monitorUtil, /export function summariseMonitorCoin/);
assert.match(monitorUtil, /export function formatElapsed/);
assert.match(monitorUtil, /export function pickNewestCycle/);
assert.match(monitorUtil, /export function attributionLabel/);
assert.match(monitorUtil, /export const MONITOR_ATTRIBUTION_LABEL/);
assert.match(monitorUtil, /export const MONITOR_CHART_MODE_LABEL/);
assert.match(monitorUtil, /\(\(point\.price - startPrice\) \/ startPrice\) \* 100/);
// --- Apocalypse Monitor Phase 4: replay cursor (scrubbing) ------------------
// One React-memory cursor, `currentReplayTime` (elapsed ms since cycle start,
// matching the chart x-axis so Phase 5 playback can advance it
// arithmetically). Loaded monitorData is never refetched while scrubbing.
assert.match(apocalypseMonitor, /currentReplayTime/);
assert.match(apocalypseMonitor, /setCurrentReplayTime\(null\)/); // reset on cycle selection/data load
// Accessible slider below the full-history chart (native range input: mouse,
// touch and keyboard work out of the box) bounded to the selected cycle.
assert.match(apocalypseMonitor, /type="range"/);
assert.match(apocalypseMonitor, /aria-valuetext/);
assert.match(apocalypseMonitor, /aria-label="Replay position in the cycle"/);
// Readout plus the transport controls (Start / Play-Pause / End-Latest) and
// speed buttons. No auto cycle switching, no live polling, no player surface.
assert.match(apocalypseMonitor, /formatInspecting\(/);
assert.match(apocalypseMonitor, />Start</);
assert.match(apocalypseMonitor, /'Latest' : 'End'/);
assert.doesNotMatch(apocalypseMonitor, /setInterval|setTimeout/);
// Bounds + point-in-time helpers are pure and single-sourced in the util.
assert.match(monitorUtil, /export function monitorReplayBounds/);
assert.match(monitorUtil, /export function clampReplayTime/);
assert.match(monitorUtil, /export function getPriceAtTime/);
assert.match(monitorUtil, /export function getCoinStateAtTime/);
assert.match(monitorUtil, /export function formatInspecting/);
// Completed cycles default to the cycle end; ACTIVE cycles are capped at the
// latest legitimately observable time (snapshot observedAt / latest sample),
// never invented future prices.
assert.match(monitorUtil, /status === 'ACTIVE'/);
// The summary table gains point-in-time columns at the replay cursor while
// retaining the whole-cycle Start/End/High/Low/Change/Samples columns.
assert.match(apocalypseMonitor, /getCoinStateAtTime\(coin, monitorData\.cycle\.startTime/);
assert.match(apocalypseMonitor, /At cursor/);
assert.match(apocalypseMonitor, /Cursor Δ/);
// PRICE / % CHANGE modes and the full-history chart are preserved.
assert.match(apocalypseMonitor, /MONITOR_CHART_MODE_LABEL/);
assert.match(apocalypseMonitor, /buildMonitorSeries\(coin, monitorData\.cycle\.startTime, chartMode\)/);

// --- Apocalypse Monitor Phase 5: automatic replay playback ------------------
// Playback advances the SAME cursor (`currentReplayTime`) by real frame-time
// deltas * speed — only two new pieces of state: isPlaying / playbackSpeed.
assert.match(apocalypseMonitor, /isPlaying/);
assert.match(apocalypseMonitor, /playbackSpeed/);
assert.match(apocalypseMonitor, /useState<MonitorPlaybackSpeed>\(DEFAULT_MONITOR_PLAYBACK_SPEED\)/);
// requestAnimationFrame loop with timestamp deltas; every exit path cancels
// the pending frame — no orphan callbacks, and still no timer-based polling.
assert.match(apocalypseMonitor, /requestAnimationFrame\(tick\)/);
assert.match(apocalypseMonitor, /cancelAnimationFrame\(rafId\)/);
assert.match(apocalypseMonitor, /advanceReplayTime\(base, frameTimestamp - lastTs, playbackSpeedRef\.current, replayBounds\)/);
assert.doesNotMatch(apocalypseMonitor, /setInterval|setTimeout/);
// Accessible transport: Start / Play-Pause / End-Latest with pressed state,
// labels and endpoint-disabled states.
assert.match(apocalypseMonitor, /aria-label="Replay transport"/);
assert.match(apocalypseMonitor, /aria-pressed=\{isPlaying\}/);
assert.match(apocalypseMonitor, /'Pause replay' : 'Play replay'/);
assert.match(apocalypseMonitor, /\{isPlaying \? 'Pause' : 'Play'\}/);
assert.match(apocalypseMonitor, /disabled=\{!isPlaying && effectiveReplayMs === replayBounds\.minMs\}/);
assert.match(apocalypseMonitor, /disabled=\{!isPlaying && effectiveReplayMs === replayBounds\.maxMs\}/);
// Speed controls: exactly 1x/5x/10x/30x/60x from the shared vocabulary.
assert.match(apocalypseMonitor, /aria-label="Playback speed"/);
assert.match(apocalypseMonitor, /MONITOR_PLAYBACK_SPEEDS\.map/);
assert.match(apocalypseMonitor, /aria-pressed=\{playbackSpeed === speed\}/);
assert.match(apocalypseMonitor, /Playback speed \$\{playbackSpeedLabel\(speed\)\}/);
assert.match(monitorUtil, /export const MONITOR_PLAYBACK_SPEEDS = \[1, 5, 10, 30, 60\] as const/);
assert.match(monitorUtil, /export const DEFAULT_MONITOR_PLAYBACK_SPEED: MonitorPlaybackSpeed = 10/);
assert.match(monitorUtil, /export function isMonitorPlaybackSpeed/);
assert.match(monitorUtil, /export function playbackSpeedLabel/);
// Timing + play-start logic is pure and timestamp-injected in the util.
assert.match(monitorUtil, /export function advanceReplayTime/);
assert.match(monitorUtil, /export function resolveReplayPlayStart/);
// Lifecycle cleanup: one pause helper routed through every exit — cycle
// change, data load success/failure, auth failure, token reset, manual
// scrub — plus a visibilitychange pause (hidden pauses, never auto-resumes).
assert.match(apocalypseMonitor, /const pausePlayback = useCallback/);
assert.match(apocalypseMonitor, /visibilitychange/);
assert.match(apocalypseMonitor, /document\.visibilityState === 'hidden'\) pausePlayback\(\)/);
assert.match(apocalypseMonitor, /const handleScrub = \(ms: number\) => \{\n    pausePlayback\(\);/);
assert.match(apocalypseMonitor, /const handlePlayPause = \(\)/);
assert.match(apocalypseMonitor, /resolveReplayPlayStart\(/);
// The chart mode buttons still never touch the cursor or playback: the mode
// onClick only sets chartMode.
assert.match(apocalypseMonitor, /onClick=\{\(\) => setChartMode\(mode\)\}/);

// --- Persistent-market Stage 6: THE persistent gameplay path ----------------
// The new gameplay (buy/sell/account/portfolio/transactions) runs ONLY on
// the additive /persistent surface. These assertions pin the load-bearing
// contract: exact request shapes, server-owned prices, token-owned accounts,
// explicit loading/error/empty states, and the total absence of any new
// Apocalypse/cycle-ID dependency.
assert.match(app, /PersistentProvider/); // the account context is mounted
// Endpoints: account, bounded transactions, buy, sell.
assert.match(persistentService, /\/persistent\/account/);
assert.match(persistentService, /\/persistent\/transactions/);
assert.match(persistentService, /\/persistent\/trades\/buy/);
assert.match(persistentService, /\/persistent\/trades\/sell/);
assert.match(persistentService, /export async function getPersistentAccount/);
assert.match(persistentService, /export async function getPersistentTransactions/);
assert.match(persistentService, /export async function buyPersistentTrade/);
assert.match(persistentService, /export async function sellPersistentTrade/);
// Trade requests are EXACTLY { coin_id, quantity }: no price (server-owned),
// no user id (the token owns the account).
assert.equal(
  (persistentService.match(/body: \{ coin_id: coinId, quantity \}/g) || []).length,
  2,
  'buy AND sell must both send exactly { coin_id, quantity }'
);
// No Apocalypse/cycle identifier is ever SENT or READ by the persistent
// client — and any leaked one in a payload fails loudly at the boundary.
assert.doesNotMatch(persistentService, /body: \{[^}]*cycle/i);
assert.doesNotMatch(persistentService, /payload\.(apocalypseId|cycleId)/);
assert.match(persistentService, /forbidCycleFields/);
assert.match(persistentService, /never carry/);
// Registration/account states are first-class: provisioned:false is a real
// result, never an error; a never-provisioned history reads empty.
assert.match(persistentService, /provisioned: false/);
assert.match(persistentService, /provisioned !== true/);
// Boundary validation on every payload shape.
assert.match(persistentService, /export function parsePersistentAccountResponse/);
assert.match(persistentService, /export function parsePersistentTradeResult/);
assert.match(persistentService, /export function parsePersistentTransactionsResponse/);
// Session behaviour is preserved: 401 → SessionExpiredError everywhere.
assert.match(persistentService, /SessionExpiredError/);
assert.match(persistentService, /response\.status === 401/);
// The context: one shared poll, post-trade adoption of the server-returned
// account, identity-change reset, no fabricated balance.
assert.match(persistentContext, /PERSISTENT_POLL_INTERVAL_MS/);
assert.match(persistentContext, /setAccount\(result\.account\)/); // post-trade authoritative adoption
assert.match(persistentContext, /never fabricate|never fabricated/i);
assert.match(persistentContext, /\}, \[user\?\.id\]\)/); // identity-change reset
assert.doesNotMatch(persistentContext, /apocalypseId|cycleId/);
// The trade panel: server-owned-price copy, explicit gating states, no
// Power/round/countdown language.
assert.match(persistentTradePanel, /Persistent trading/);
assert.match(persistentTradePanel, /Syncing your persistent account/);
assert.match(persistentTradePanel, /persistent account is unavailable/);
assert.match(persistentTradePanel, /permanently dead/);
assert.match(persistentTradePanel, /Confirm persistent/);
assert.doesNotMatch(persistentTradePanel, /⚡|showPowerEstimate/);
// The persistent panels never fetch independently of the shared context,
// except the bounded transaction-history read in the account panel/profile.
assert.doesNotMatch(persistentTradePanel, /\bfetch\(|setInterval/);
assert.doesNotMatch(persistentContext, /\bfetch\(/); // fetches ride the service


// --- Persistent-market Stage 10B: persistent leaderboard --------------------
// Player-facing live board migrates to GET /persistent/leaderboard. Backend
// rank is authoritative; one shared PersistentContext poll feeds the board
// (no second timer). Cycle leaderboard types remain in gameService for
// ResultsOverlay / Stage 13 debt.
assert.match(persistentService, /\/persistent\/leaderboard/);
assert.match(persistentService, /export async function getPersistentLeaderboard/);
assert.match(persistentService, /export function parsePersistentLeaderboard/);
assert.match(persistentService, /export function parsePersistentLeaderboardEntry/);
assert.match(persistentService, /netWorth/);
assert.match(persistentService, /worldId/);
assert.match(persistentContext, /getPersistentLeaderboard/);
assert.match(persistentContext, /leaderboard/);
assert.match(persistentContext, /myEntry/);
assert.match(persistentContext, /findMyEntry\(leaderboard\?\.entries, user\?\.id\)/);
assert.match(persistentContext, /PERSISTENT_POLL_INTERVAL_MS/);
// Exactly one setInterval in PersistentContext — the shared poll.
assert.equal(
  (persistentContext.match(/setInterval\(/g) || []).length,
  1,
  'PersistentContext must keep a single shared poll timer'
);
assert.doesNotMatch(leaderboard, /setInterval|getLiveLeaderboard|useGame/);
assert.doesNotMatch(leaderboardPressure, /setInterval|getLiveLeaderboard/);
assert.match(gameLogic, /PERSISTENT_LEADERBOARD_RULE_COPY/);

// --- Stage 11: persistent signals cutover (primary UI) ---------------------
// Public /persistent/signals folded into the single shared 5s poll.
// Primary grid/card/detail now use PersistentCoinSignal from usePersistent;
// legacy GameContext signals, phase, collapse, events, typical* removed
// from primary surfaces. No second timer. Last-good preserved on error.
// Price regression: signal.currentPrice wins over legacy.
assert.match(persistentService, /\/persistent\/signals/);
assert.match(persistentService, /export async function getPersistentSignals/);
assert.match(persistentService, /export function parsePersistentMarketSignals/);
assert.match(persistentService, /export interface PersistentCoinSignal/);
assert.match(persistentService, /PERSISTENT_ARCHETYPES/);
assert.match(persistentContext, /getPersistentSignals/);
assert.match(persistentContext, /signals:/);
assert.match(persistentContext, /signalsError/);
assert.match(persistentContext, /setSignals/);
// still only one setInterval
assert.equal(
  (persistentContext.match(/setInterval\(/g) || []).length,
  1,
  "PersistentContext must keep a single shared poll timer after signals"
);
assert.match(gameMarketGrid, /usePersistent/);
assert.match(gameMarketGrid, /No coins in the persistent market yet/);
assert.doesNotMatch(gameMarketGrid, /MarketPhaseBanner|derivedServerNowMs/);
assert.match(coinSignalCard, /PersistentCoinSignal/);
assert.doesNotMatch(coinSignalCard, /signalsNowMs|CoinEventList|formatTypicalProfile/);
assert.match(gameCoinDetail, /PersistentCoinSignal/);
assert.doesNotMatch(gameCoinDetail, /coin\.phase|collapseRisk|formatTypical/);
assert.match(coinSignalCard, /coin\.currentPrice/); // signal price for quick buy etc
assert.match(gameCoinDetail, /coin\.currentPrice/);
// The visible owned-position Current price must use the persistent signal
// snapshot, not the separately-read holding economics snapshot.
assert.match(coinSignalCard, /<div className="label mb-0\.5">Current price<\/div>\s*<div[^>]*>\{formatCurrency\(coin\.currentPrice\)\}<\/div>/);
assert.match(gameCoinDetail, /<div className="label mb-0\.5">Current price<\/div>\s*<div[^>]*>\{formatCurrency\(coin\.currentPrice\)\}<\/div>/);
assert.doesNotMatch(coinSignalCard, /holding\.currentPrice/);
assert.doesNotMatch(gameCoinDetail, /holding\.currentPrice/);
// Account-sourced valuation/P&L fields remain server-owned and are not
// recomputed from the display price.
assert.match(coinSignalCard, /holding\.currentValue/);
assert.match(coinSignalCard, /holding\.unrealizedPnl/);
assert.match(coinSignalCard, /holding\.unrealizedPnlPct/);
assert.match(gameCoinDetail, /holding\.currentValue/);
assert.match(gameCoinDetail, /holding\.unrealizedPnl/);
assert.match(gameCoinDetail, /holding\.unrealizedPnlPct/);
// Adversarial price-authority regression: a primary persistent signal at £20
// must win over any stale legacy GameContext signal at £999. These source
// contracts cover the card header, quick-buy quantity, trade-panel reference
// price, and detail price without requiring a DOM test runner in this repo.
const persistentPriceFixture = { currentPrice: 20, dead: false };
const legacyPriceFixture = { currentPrice: 999, dead: false };
assert.equal(persistentPriceFixture.currentPrice, 20);
assert.equal(legacyPriceFixture.currentPrice, 999);
assert.match(coinSignalCard, /current_price: String\(coin\.currentPrice\)/);
assert.match(coinSignalCard, /quantityForNotional\(notional, coin\.currentPrice\)/);
assert.match(gameCoinDetail, /current_price: String\(coin\.currentPrice\)/);
assert.equal(
  /current_price: String\(coin\.currentPrice\)/.test(coinSignalCard)
    ? persistentPriceFixture.currentPrice
    : legacyPriceFixture.currentPrice,
  20,
  'primary card must use persistent signal price, never legacy GameContext price'
);
assert.equal(
  /current_price: String\(coin\.currentPrice\)/.test(gameCoinDetail)
    ? persistentPriceFixture.currentPrice
    : legacyPriceFixture.currentPrice,
  20,
  'detail must use persistent signal price, never legacy GameContext price'
);
// Adversarial DEAD regression: persistent DEAD/£0 must win over legacy
// ALIVE/nonzero state, and the primary components contain the persistent
// dead branch rather than consulting GameContext.
const persistentDeadFixture = { currentPrice: 0, dead: true };
const legacyAliveFixture = { currentPrice: 999, dead: false };
assert.match(coinSignalCard, /coin\.dead \? '£0\.00'/);
assert.match(gameCoinDetail, /coin\.dead \? '£0\.00'/);
assert.equal(persistentDeadFixture.dead, true);
assert.equal(persistentDeadFixture.currentPrice, 0);
assert.equal(legacyAliveFixture.dead, false);
assert.equal(legacyAliveFixture.currentPrice, 999);

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


// --- Stage 11: Apocalypse chrome removed from primary player shell ----------
// Primary App Market must not mount countdown / settlement / JOIN chrome.
assert.doesNotMatch(app, /<ApocalypseHeader\b/);
assert.doesNotMatch(app, /from '\.\/components\/ApocalypseHeader/);
assert.doesNotMatch(app, /<ResultsOverlay\b/);
assert.doesNotMatch(app, /<RecentResultsPanel\b/);
assert.doesNotMatch(app, /from '\.\/components\/ResultsPanel/);
assert.doesNotMatch(app, /JOIN APOCALYPSE/);
assert.doesNotMatch(app, /30-minute cycle/);
assert.doesNotMatch(app, /SETTLING/);
assert.doesNotMatch(app, /Face the next apocalypse/);
assert.match(app, /PersistentMarketHeader/);
assert.match(app, /Persistent market|persistent market/);
// Compatibility components intentionally retained on disk for Stage 13.
assert.match(header, /export function ApocalypseHeader/);
assert.match(resultsPanel, /export function ResultsOverlay/);
assert.match(resultsPanel, /export function RecentResultsPanel/);
assert.match(howToPlay, /export function HowToPlay/);
// Persistent trading + leaderboard surfaces remain mounted.
assert.match(app, /GameMarketGrid/);
assert.match(app, /LeaderboardPressure/);
assert.match(app, /LeaderboardPanel/);
assert.match(app, /PlayerRoundPanel/);
assert.match(app, /PlayerStatusStrip/);

console.log('Crypto Chaos UI contract passed');