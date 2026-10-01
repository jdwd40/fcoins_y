import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ============================================================================
// Crypto Chaos UI contract — After-Hours Exchange (UI overhaul 2026-10-01)
//
// Migration of the pre-overhaul contract. Every BEHAVIOURAL/data-integrity
// assertion survived, re-pointed at the new files. Assertions that pinned
// deleted presentation files or old visual tokens were replaced by
// equivalent assertions about the new design (recorded in the overhaul
// report's contract-migration table).
// ============================================================================

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const app = read('src/App.tsx');
const styles = read('src/index.css');
const html = read('index.html');
const pkg = read('package.json');
const tailwind = read('tailwind.config.js');

// Kept legacy/state files
const gameContext = read('src/context/GameContext.tsx');
const gameLogic = read('src/utils/gameLogic.ts');
const gameService = read('src/services/gameService.ts');
const monitorService = read('src/services/monitorService.ts');
const monitorUtil = read('src/utils/apocalypseMonitor.ts');
const apocalypseMonitor = read('src/components/ApocalypseMonitor.tsx');

// Persistent runtime
const persistentService = read('src/services/persistentService.ts');
const persistentContext = read('src/context/PersistentContext.tsx');
const persistentTrading = read('src/utils/persistentTrading.ts');
const persistentCountdown = read('src/utils/persistentCountdown.ts');
const runtimeCopy = read('src/utils/persistentRuntimeCopy.ts');

// New design layer
const dialog = read('src/components/ui/Dialog.tsx');
const delta = read('src/components/ui/Delta.tsx');
const price = read('src/components/ui/Price.tsx');
const coinAvatar = read('src/components/ui/CoinAvatar.tsx');
const badge = read('src/components/ui/Badge.tsx');
const button = read('src/components/ui/Button.tsx');
const tradeTicket = read('src/components/TradeTicket.tsx');
const appShell = read('src/components/shell/AppShell.tsx');
const topBar = read('src/components/shell/TopBar.tsx');
const worldStrip = read('src/components/shell/WorldStrip.tsx');
const bottomTabBar = read('src/components/shell/BottomTabBar.tsx');
const authDialog = read('src/components/shell/AuthDialog.tsx');
const tradeSheet = read('src/components/shell/TradeSheet.tsx');
const howToPlayDialog = read('src/components/shell/HowToPlayDialog.tsx');
const shellServices = read('src/components/shell/shellServices.ts');
const freshnessPill = read('src/components/FreshnessPill.tsx');
const toastContext = read('src/context/ToastContext.tsx');
const marketPage = read('src/pages/MarketPage.tsx');
const coinPage = read('src/pages/CoinPage.tsx');
const portfolioPage = read('src/pages/PortfolioPage.tsx');
const leaderboardPage = read('src/pages/LeaderboardPage.tsx');
const worldPage = read('src/pages/WorldPage.tsx');
const notFoundPage = read('src/pages/NotFoundPage.tsx');

// Charts / sparklines (kept logic, restyled)
const chart = read('src/components/PriceChart.tsx');
const marketValueChart = read('src/components/MarketValueChart.tsx');
const marketHistoryChartUtil = read('src/utils/marketHistoryChart.ts');
const sparklineUtil = read('src/utils/sparkline.ts');
const priceHistoryService = read('src/services/priceHistoryService.ts');
const coinSparkline = read('src/components/CoinSparkline.tsx');
const useCoinSparkline = read('src/hooks/useCoinSparkline.ts');

// New pure helpers
const formatPriceUtil = read('src/utils/formatPrice.ts');
const coinIdentity = read('src/utils/coinIdentity.ts');
const deltaUtil = read('src/utils/delta.ts');
const priceFlashUtil = read('src/utils/priceFlash.ts');
const marketBoard = read('src/utils/marketBoard.ts');
const worldEvents = read('src/utils/worldEvents.ts');
const leaderboardGap = read('src/utils/leaderboardGap.ts');
const transactionGroups = read('src/utils/transactionGroups.ts');
const regimeCopy = read('src/utils/regimeCopy.ts');
const typesTs = read('src/types.ts');
const formatModifierPctUtil = read('src/utils/formatModifierPct.ts');
const useFetchHook = read('src/hooks/useFetch.ts');

// ============================================================================
// Route table and provider topology
// ============================================================================
assert.match(app, /basename="\/coins"/, 'router basename stays /coins');
assert.match(app, /<PersistentProvider>\s*\{children\}\s*<\/PersistentProvider>/, 'PersistentProvider wraps player routes');
assert.match(app, /AuthProvider/);
assert.match(app, /ToastProvider/);
// PlayerShell declared before App and contains no GameProvider / timers.
const playerShellStart = app.indexOf('function PlayerShell');
const appStart = app.indexOf('function App');
assert.notEqual(playerShellStart, -1, 'App.tsx must define PlayerShell');
assert.ok(playerShellStart < appStart, 'PlayerShell must be declared before App');
const playerShell = app.slice(playerShellStart, appStart);
assert.doesNotMatch(playerShell, /GameProvider/);
assert.doesNotMatch(playerShell, /setInterval|visibilitychange|window\.addEventListener\(['"]focus|joinGame/);
assert.doesNotMatch(app, /import\s+\{\s*GameProvider\s*\}\s+from\s+['"]\.\/context\/GameContext/);
assert.doesNotMatch(app, /getGameState|getLiveLeaderboard|getMarketSignals|getMyRoundEconomy|joinGame/);
assert.doesNotMatch(app, /\/game\/(state|leaderboard|market-signals|participant|join)/);
// New route table.
assert.match(app, /<Route index element=\{<MarketPage \/>\} \/>/);
assert.match(app, /path="\/coin\/:coinId"/);
assert.match(app, /path="\/portfolio"/);
assert.match(app, /path="\/profile" element=\{<Navigate to="\/portfolio" replace \/>\} \/>/, '/profile redirects to /portfolio');
assert.match(app, /path="\/leaderboard"/);
assert.match(app, /path="\/world"/);
assert.match(app, /<Route path="\*" element=\{<NotFoundPage \/>\} \/>/);
assert.match(app, /path="\/internal\/apocalypse-monitor"/);
// The monitor mounts WITHOUT the player providers (declared before the
// PlayerShell layout route).
assert.ok(
  app.indexOf('path="/internal/apocalypse-monitor"') < app.indexOf('<PlayerShell>'),
  'monitor route must be declared outside the player layout route'
);
// Lazy routes: Coin, World and monitor are React.lazy so chart.js leaves the
// main chunk.
assert.match(app, /lazy\(\(\) =>\s*import\('\.\/pages\/CoinPage\.tsx'\)/);
assert.match(app, /lazy\(\(\) =>\s*import\('\.\/pages\/WorldPage\.tsx'\)/);
assert.match(app, /lazy\(\(\) =>\s*import\('\.\/components\/ApocalypseMonitor\.tsx'\)/);
assert.match(app, /<Suspense/);
// Scroll to top on route change lives in the shell.
assert.match(appShell, /window\.scrollTo\(0, 0\)/);
assert.match(appShell, /useLocation/);
// Per-page titles.
for (const [name, source, title] of [
  ['marketPage', marketPage, 'Market · Crypto Chaos'],
  ['coinPage', coinPage, '· Crypto Chaos'],
  ['portfolioPage', portfolioPage, 'Portfolio · Crypto Chaos'],
  ['leaderboardPage', leaderboardPage, 'Leaderboard · Crypto Chaos'],
  ['worldPage', worldPage, 'World · Crypto Chaos'],
  ['notFoundPage', notFoundPage, 'Not found · Crypto Chaos']
]) {
  assert.match(source, /usePageTitle\(/, `${name} sets document.title`);
  assert.match(source, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${name} title copy`);
}

// ============================================================================
// Legacy state code stays on disk (retirement is a separate plan item)
// ============================================================================
assert.match(gameContext, /export function GameProvider/);
assert.match(gameContext, /GAME_POLL_INTERVAL_MS/);
for (const [name, pathRe] of [
  ['getGameState', /\/game\/state/],
  ['getLiveLeaderboard', /\/game\/leaderboard/],
  ['getMarketSignals', /\/game\/market-signals/],
  ['getMyRoundEconomy', /\/game\/participant/],
  ['joinGame', /\/game\/join/]
]) {
  assert.match(gameContext, new RegExp(`\\b${name}\\(`), `${name} remains a legacy GameContext runtime call`);
  assert.match(gameService, pathRe, `${name} endpoint form remains covered`);
}
assert.match(gameLogic, /cc_participant_\$\{userId\}_\$\{apocalypseId\}/);
assert.match(gameLogic, /parsed\.userId !== userId/);
assert.match(gameContext, /readCachedParticipant\(localStorage, userId, currentId\)/);
assert.match(gameContext, /setMyParticipant\(null\)/);

// ============================================================================
// gameLogic: shared pure contracts (unchanged behaviour)
// ============================================================================
assert.match(gameLogic, /TRADE_QUANTITY_MAX_DECIMALS = 8/);
assert.match(gameLogic, /export function parseTradeQuantity/);
assert.match(gameLogic, /export function formatQuantity/);
assert.match(gameLogic, /TRADE_MIN_VALUE = 0\.01/);
assert.match(gameLogic, /export function minTradeValueError/);
assert.match(gameLogic, /QUICK_BUY_NOTIONALS: readonly number\[\] = \[250, 500, 1000, 2500\]/);
assert.match(gameLogic, /£2\.5K/);
assert.match(gameLogic, /export function quantityForNotional/);
assert.match(gameLogic, /GAME_STARTING_CASH_LABEL = '£10,000'/);
assert.match(gameLogic, /export function displayRoundCash/);
assert.match(gameLogic, /export function escalationBand/);
assert.match(gameLogic, /ESCALATION_BAND_LABEL/);
assert.match(gameLogic, /▲ UP/);
assert.match(gameLogic, /▼ DOWN/);
assert.match(gameLogic, /ARCHETYPE_PERSONALITY/);
assert.match(gameLogic, /export function findMyEntry/);
assert.match(gameLogic, /RESULTS_AUTO_DISMISS_MS = 7000/);
assert.match(gameLogic, /export function scheduleResultsAutoDismiss/);
assert.match(gameLogic, /export const CASH_EVENT_TYPE_LABEL/);
assert.match(gameLogic, /export function normalizeCashEvents/);
assert.match(gameLogic, /export function findNewCashEvents/);
assert.match(gameLogic, /export function summariseDrainToast/);
assert.match(gameLogic, /export function formatActivityTimestamp/);
assert.match(gameLogic, /export function formatAbsoluteTimestamp/);
assert.match(gameLogic, /export function formatSignedGbp/);
assert.match(gameLogic, /export function formatSignedPct/);
assert.match(gameLogic, /export function personalityLabel/);
assert.match(gameLogic, /PERSISTENT_LEADERBOARD_RULE_COPY/);
assert.match(gameLogic, /reading the dip → rise → boom → fall cycle on the price chart is core gameplay/);
// How to play copy: continuous persistent market, no timer/reset.
assert.match(gameLogic, /HOW TO PLAY THE PERSISTENT MARKET/);
assert.match(gameLogic, /runs continuously/i);
assert.match(gameLogic, /no game timer/i);
assert.match(gameLogic, /no Apocalypse reset/i);
assert.match(gameLogic, /replacement coins may enter/i);
assert.match(gameLogic, /historical positions at £0/i);
assert.doesNotMatch(gameLogic, /HOW TO SURVIVE THE APOCALYPSE/);
assert.match(gameLogic, /export const HOW_TO_PLAY_STEPS/);
assert.match(gameLogic, /export const HOW_TO_PLAY_TITLE/);
// No £1,000-era game copy anywhere on player-facing sources.
for (const [name, text] of Object.entries({
  gameLogic, marketPage, coinPage, portfolioPage, leaderboardPage, worldPage, topBar, tradeTicket, authDialog
})) {
  assert.doesNotMatch(text, /£1,000/, `£1,000-era copy remains in ${name}`);
}

// ============================================================================
// gameService: legacy service contracts remain intact
// ============================================================================
assert.match(gameService, /leaderboardEligible/);
assert.match(gameService, /totalResultCount/);
assert.match(gameService, /export async function getMyRoundEconomy/);
assert.match(gameService, /export function parseCashEvent/);
assert.match(gameService, /export function parsePlayerRoundEconomy/);
assert.match(gameService, /'FEE' \| 'TAX' \| 'EVENT'/);
assert.doesNotMatch(gameService, /\/game\/diagnostics/);
assert.match(gameService, /export async function getMarketSignals/);
assert.match(gameService, /export function parseMarketSignals/);
assert.match(gameService, /'DIP' \| 'RISE' \| 'BOOM' \| 'FALL' \| 'DEAD'/);
assert.match(gameService, /export interface PowerState/);
assert.match(gameService, /nextPointAt/);
assert.match(gameService, /unrealizedPnlPct/);
assert.match(gameLogic, /LEADERBOARD_RULE_COPY = `Finish above \$\{GAME_STARTING_CASH_LABEL\} to make the leaderboard\.`/);

// ============================================================================
// Persistent service: wire contract (the load-bearing data integrity)
// ============================================================================
assert.match(persistentService, /\/persistent\/account/);
assert.match(persistentService, /\/persistent\/transactions/);
assert.match(persistentService, /\/persistent\/trades\/buy/);
assert.match(persistentService, /\/persistent\/trades\/sell/);
assert.match(persistentService, /\/persistent\/leaderboard/);
assert.match(persistentService, /\/persistent\/signals/);
assert.match(persistentService, /\/persistent\/runtime/);
assert.match(persistentService, /export async function getPersistentAccount/);
assert.match(persistentService, /export async function getPersistentTransactions/);
assert.match(persistentService, /export async function buyPersistentTrade/);
assert.match(persistentService, /export async function sellPersistentTrade/);
assert.match(persistentService, /export async function getPersistentLeaderboard/);
assert.match(persistentService, /export async function getPersistentSignals/);
assert.match(persistentService, /export async function getPersistentRuntime/);
// Trade requests are EXACTLY { coin_id, quantity }: no price, no user id.
assert.equal(
  (persistentService.match(/body: \{ coin_id: coinId, quantity \}/g) || []).length,
  2,
  'buy AND sell must both send exactly { coin_id, quantity }'
);
assert.doesNotMatch(persistentService, /body: \{[^}]*cycle/i);
assert.doesNotMatch(persistentService, /payload\.(apocalypseId|cycleId)/);
assert.match(persistentService, /forbidCycleFields/);
assert.match(persistentService, /never carry/);
assert.match(persistentService, /provisioned: false/);
assert.match(persistentService, /provisioned !== true/);
assert.match(persistentService, /export function parsePersistentAccountResponse/);
assert.match(persistentService, /export function parsePersistentTradeResult/);
assert.match(persistentService, /export function parsePersistentTransactionsResponse/);
assert.match(persistentService, /export function parsePersistentLeaderboard/);
assert.match(persistentService, /export function parsePersistentLeaderboardEntry/);
assert.match(persistentService, /export function parsePersistentMarketSignals/);
assert.match(persistentService, /export function parsePersistentRuntime/);
assert.match(persistentService, /export interface PersistentCoinSignal/);
assert.match(persistentService, /PERSISTENT_ARCHETYPES/);
assert.match(persistentService, /PERSISTENT_DECISION_SUMMARY_CODES/);
assert.match(persistentService, /GENESIS_NORMAL/);
assert.match(persistentService, /OTHER_SAFE/);
assert.match(persistentService, /netWorth/);
assert.match(persistentService, /worldId/);
assert.match(persistentService, /SessionExpiredError/);
assert.match(persistentService, /response\.status === 401/);
// Leaderboard order is authoritative — parser preserves backend order.
assert.match(persistentService, /never re-sort/);

// ============================================================================
// PersistentContext: ONE shared poll, identity gate, no fabrication
// ============================================================================
assert.match(persistentContext, /PERSISTENT_POLL_INTERVAL_MS/);
assert.equal(
  (persistentContext.match(/setInterval\(/g) || []).length,
  1,
  'PersistentContext must keep a single shared poll timer'
);
assert.match(persistentContext, /Promise\.allSettled/);
assert.match(persistentContext, /getPersistentLeaderboard/);
assert.match(persistentContext, /getPersistentSignals/);
assert.match(persistentContext, /getPersistentRuntime/);
assert.match(persistentContext, /findMyEntry\(leaderboard\?\.entries, user\?\.id\)/);
assert.match(persistentContext, /runtimeResult/);
assert.match(persistentContext, /signalsResult/);
assert.match(persistentContext, /setRuntimeError/);
assert.match(persistentContext, /signalsError/);
// Additive freshness timestamp for the Live pill.
assert.match(persistentContext, /signalsSyncedAt/);
assert.match(persistentContext, /setSignalsSyncedAt\(Date\.now\(\)\)/);
assert.match(persistentContext, /runtimeSyncedAt/);
assert.match(persistentContext, /directorUnavailable/);
assert.match(persistentContext, /RUNTIME_STALE_AFTER_MS/);
assert.match(persistentContext, /3 \* PERSISTENT_POLL_INTERVAL_MS/);
// Post-trade adoption of the authoritative account with the identity gate.
assert.match(persistentContext, /setAccount\(result\.account\)/);
assert.match(
  persistentContext,
  /setAccount\(result\.account\);\s*\n\s*setProvisioned\(true\);\s*\n\s*setSynced\(true\);/
);
assert.match(persistentContext, /shouldApplyAccount/);
assert.match(persistentContext, /\}, \[user\?\.id\]\)/, 'identity-change reset');
assert.match(persistentContext, /never fabricate|never fabricated/i);
assert.doesNotMatch(persistentContext, /apocalypseId|cycleId/);
assert.doesNotMatch(persistentContext, /\bfetch\(/, 'context fetches ride the service');
// trade() returns the parsed server result so the receipt is verbatim.
assert.match(persistentContext, /Promise<PersistentTradeResult>/);
assert.match(persistentContext, /await syncNow\(\);\s*\n\s*return result;/);

// ============================================================================
// TradeTicket: the consolidated trade surface
// ============================================================================
// Request carries no client price — only side/coinId/quantity through the
// context trade() (which posts { coin_id, quantity }).
assert.match(tradeTicket, /trade\(side, coinId, quantity\)/);
assert.doesNotMatch(tradeTicket, /\bfetch\(|setInterval/);
// Quantity contract: shared parser, 8dp, never rounded, decimal keypad.
assert.match(tradeTicket, /parseTradeQuantity\(amount\)/);
assert.match(tradeTicket, /inputMode="decimal"/);
assert.doesNotMatch(tradeTicket, /step="1"/);
assert.doesNotMatch(tradeTicket, /parseInt\(amount/);
assert.match(tradeTicket, /formatQuantity\(quantity\)/);
assert.match(tradeTicket, /formatQuantity\(heldQuantity\)/);
// Minimum notional client mirror.
assert.match(tradeTicket, /minTradeValueError\(estimatedTotal, currentPrice\)/);
// Quick-buy chips ride the shared ladder + notional→quantity conversion.
assert.match(tradeTicket, /QUICK_BUY_NOTIONALS\.map/);
assert.match(tradeTicket, /quantityForNotional\(notional, currentPrice\)/);
// Explicit gating with reasons (synced-but-unprovisioned can still BUY).
assert.match(tradeTicket, /persistentTradeBlockReason/);
assert.match(tradeTicket, /PERSISTENT_TRADE_BLOCK_LABEL/);
assert.match(tradeTicket, /synced,\s*provisioned,\s*accountError/);
assert.match(persistentTrading, /export function persistentTradeBlockReason/);
assert.match(persistentTrading, /'not-authenticated'/);
assert.match(persistentTrading, /'account-syncing'/);
assert.match(persistentTrading, /'account-unavailable'/);
assert.match(persistentTrading, /'insufficient-cash'/);
assert.match(persistentTrading, /provisioned: boolean/);
assert.match(persistentTrading, /gate\.synced && !gate\.provisioned/);
// The syncing branch keys on !synced alone — unprovisioned falls through.
assert.match(tradeTicket, /if \(!synced\) \{/);
assert.doesNotMatch(tradeTicket, /!synced \|\| \(account === null/);
assert.match(tradeTicket, /provisioned/);
// Confirm-before-trade for every path (quick-buy and sell-all included).
assert.match(tradeTicket, /stage: 'review'/);
assert.match(tradeTicket, /Review \{side === 'BUY' \? 'buy' : 'sell'\} order/);
assert.match(tradeTicket, /Confirm \{side === 'BUY' \? 'buy' : 'sell'\}/);
assert.match(tradeTicket, /startReview\(heldQuantity\)/, 'sell-all goes through review');
// Server rejection verbatim; session expiry path; pending blocks resubmit.
assert.match(tradeTicket, /err\.message/);
assert.match(tradeTicket, /SessionExpiredError/);
assert.match(tradeTicket, /handleSessionExpired/);
assert.match(tradeTicket, /disabled=\{pending\}/);
// Estimate wording: executes at the server-locked live price.
assert.match(tradeTicket, /Executes at the server-locked live price/);
assert.match(tradeTicket, /Server-locked live price/);
// Dead coin: no trade path, permanent-death copy with £0.00.
assert.match(tradeTicket, /trading has stopped permanently/);
assert.match(tradeTicket, /£0\.00/);
// Receipt renders the SERVER transaction.
assert.match(tradeTicket, /stage: 'receipt'/);
assert.match(tradeTicket, /stage\.result\.transaction/);
assert.match(tradeTicket, /result\.account\.cash/);
// BUY uses the up colour + Buy/Bought words; SELL the down colour + Sell/Sold.
assert.match(tradeTicket, /variant=\{side === 'BUY' \? 'buy' : 'sell'\}/);
assert.match(tradeTicket, /Bought/);
assert.match(tradeTicket, /Sold/);
// Unit prices at 4dp precision.
assert.match(tradeTicket, /formatPrice\(currentPrice\)/);
assert.match(tradeTicket, /formatPrice\(tx\.price\)/);
// No fabricated starting Cash anywhere on the trade path.
for (const [name, text] of Object.entries({
  persistentContext, tradeTicket, persistentTrading, marketPage
})) {
  assert.doesNotMatch(text, /10000|10_000/, `${name} must not fabricate the £10,000 starting Cash`);
}

// ============================================================================
// Design tokens and global CSS (After-Hours Exchange)
// ============================================================================
assert.match(styles, /--bg:\s*#090a10/, 'dark bg token');
assert.match(styles, /--surface:\s*#12131c/, 'dark surface token');
assert.match(styles, /--brand:\s*#4cc9ff/, 'dark brand token');
assert.match(styles, /--on-brand:\s*#04121a/);
assert.match(styles, /--up:\s*#3ee6a5/, 'up token');
assert.match(styles, /--down:\s*#ff5d73/, 'down token');
assert.match(styles, /--director:\s*#b48cff/, 'director violet');
assert.match(styles, /--golden:\s*#ffcf4a/);
assert.match(styles, /--demon:\s*#ff7a45/);
assert.match(styles, /--warn:\s*#ffb547/);
// Light theme tokens.
assert.match(styles, /--bg:\s*#f5f6fb/, 'light bg token');
// Correction pass: every light semantic token used for small text must hold
// ≥4.5:1 on BOTH --surface (#ffffff) and --bg (#f5f6fb).
assert.match(styles, /--brand:\s*#0869a3/, 'light brand token (5.90/5.47:1)');
assert.match(styles, /--up:\s*#08774f/, 'light up token (5.58/5.17:1)');
assert.match(styles, /--down:\s*#c22f47/, 'light down token (5.54/5.13:1)');
assert.match(styles, /--director:\s*#7446e0/, 'light director token (5.68/5.27:1)');
assert.match(styles, /--golden:\s*#8a6100/, 'light golden token (5.54/5.13:1)');
assert.match(styles, /--demon:\s*#b44415/, 'light demon token (5.56/5.15:1)');
assert.match(styles, /--warn:\s*#965a00/, 'light warn token (5.59/5.18:1)');
// Typography: Space Grotesk display, Inter UI, JetBrains Mono numbers.
assert.match(tailwind, /Space Grotesk/);
assert.match(tailwind, /JetBrains Mono/);
assert.match(styles, /font-family: 'Inter'/);
assert.match(styles, /font-variant-numeric: tabular-nums/);
// Min text 12px: the shared label is exactly 0.75rem.
assert.match(styles, /\.label,\s*\n\s*\.label-ink \{[\s\S]*?font-size: 0\.75rem/);
// Focus ring on every interactive element.
assert.match(styles, /:focus-visible \{[\s\S]*?outline: 2px solid var\(--brand\)/);
// Tap targets.
assert.match(styles, /\.tap-target \{ min-height: 44px; \}/);
assert.match(styles, /\.tap-target-lg \{ min-height: 48px;/);
// Overflow guards.
assert.match(styles, /overflow-x: clip/);
assert.match(styles, /img, svg, video, canvas \{ max-width: 100%; \}/);
assert.match(styles, /min-width: 0;/);
// Reduced motion: flashes, pulses, shimmer and transitions stand down.
const reducedMotion = styles.slice(styles.indexOf('prefers-reduced-motion'));
assert.match(reducedMotion, /\.price-flash-up, \.price-flash-down, \.live-dot, \.skeleton \{ animation: none !important; \}/);
assert.match(reducedMotion, /scroll-behavior: auto/);
// Price flash keyframes exist (600ms tint).
assert.match(styles, /@keyframes price-flash-up/);
assert.match(styles, /@keyframes price-flash-down/);
// World strip scrolls inside itself.
assert.match(styles, /\.world-strip-scroll \{/);
assert.match(styles, /\.world-strip-scroll > \* \{ flex: none; \}/);
// Bottom tab bar: 56px + safe-area inset.
assert.match(styles, /\.tabbar \{[\s\S]*?padding-bottom: env\(safe-area-inset-bottom, 0px\)/);
assert.match(styles, /\.tabbar-tab \{[\s\S]*?min-height: 56px/);
// No old visual tokens survive.
assert.doesNotMatch(styles, /--accent:\s*#7132f5/);
assert.doesNotMatch(styles, /apocalypse-meter/);
assert.doesNotMatch(styles, /phase-dip/);
assert.doesNotMatch(styles, /fractalNoise/);
assert.doesNotMatch(styles, /ledger-grid/);
assert.doesNotMatch(styles, /ornament/);

// ============================================================================
// index.html shell
// ============================================================================
assert.match(html, /<title>Crypto Chaos · Fantasy Coin Market<\/title>/);
assert.match(html, /Crypto Chaos is a persistent fantasy coin market game played with virtual GBP only\./);
assert.match(html, /theme-color" content="#090a10"/);
assert.match(html, /rel="icon" type="image\/svg\+xml" href="favicon\.svg"/);
assert.match(html, /family=Inter/);
assert.match(html, /Space\+Grotesk:wght@600;700/);
assert.match(html, /JetBrains\+Mono/);
assert.match(html, /<base href="\/coins\/">/);
// Theme class set before paint (dark default, localStorage toggle kept).
assert.match(html, /localStorage\.getItem\('theme'\)/);
assert.match(html, /class="dark"/);

// ============================================================================
// Dialog primitive: the one accessible overlay
// ============================================================================
assert.match(dialog, /role="dialog"/);
assert.match(dialog, /aria-modal="true"/);
assert.match(dialog, /aria-labelledby=\{titleId\}/);
assert.match(dialog, /event\.key === 'Escape'/);
assert.match(dialog, /onClick=\{onClose\}/, 'backdrop click closes');
assert.match(dialog, /event\.key !== 'Tab'/, 'focus trap');
assert.match(dialog, /panel\?\.focus\(\)/, 'initial focus');
assert.match(dialog, /opener\.isConnected/, 'focus restore guarded by isConnected');
assert.match(dialog, /document\.body\.style\.overflow = 'hidden'/, 'body scroll lock');
assert.match(dialog, /items-end sm:items-center/, 'bottom sheet on phones, centred panel ≥640px');
assert.match(dialog, /rounded-t-2xl sm:rounded-2xl/);
assert.match(dialog, /max-h-\[92vh\] overflow-y-auto/);
assert.match(dialog, /aria-label="Close dialog"/);

// ============================================================================
// Delta / Price / CoinAvatar primitives
// ============================================================================
assert.match(delta, /deltaParts\(pct\)/);
// Correction pass: role="text" is not a valid ARIA role and an aria-label
// alongside the sr-only sentence double-announces. The Delta span carries NO
// role and NO aria-label; the visible glyph/value are aria-hidden and the
// sr-only sentence is the single accessible text.
assert.doesNotMatch(delta, /role="text"/, 'role="text" is not a valid ARIA role');
assert.doesNotMatch(delta, /aria-label/, 'no aria-label duplicate alongside the sr-only sentence');
assert.match(delta, /<span className="sr-only">\{a11y\}<\/span>/, 'direction has one sr-only accessible text');
assert.match(delta, /aria-hidden="true"/, 'glyph is decorative alongside text');
assert.match(deltaUtil, /DELTA_GLYPH/);
assert.match(deltaUtil, /up: '▲'/);
assert.match(deltaUtil, /down: '▼'/);
assert.match(price, /formatPrice\(value\)/);
assert.match(price, /priceFlashDirection\(previousRef\.current, value\)/);
assert.match(priceFlashUtil, /export function priceFlashDirection/);
assert.match(coinAvatar, /coinHue\(/);
assert.match(coinIdentity, /export function coinHue/);
assert.match(badge, /tone/);
assert.match(formatPriceUtil, /export function formatPrice/);
// formatPrice rule: >= £1 → 2dp, < £1 → 4dp, 0 → £0.00.
assert.match(formatPriceUtil, /value\.toFixed\(4\)/);
assert.match(formatPriceUtil, /'£0\.00'/);

// ============================================================================
// Shell: top bar, world strip, bottom tab bar, footer
// ============================================================================
assert.match(topBar, /Crypto Chaos/);
assert.match(topBar, /aria-label="Primary"/);
for (const label of ['Market', 'Portfolio', 'Leaderboard', 'World']) {
  assert.match(topBar, new RegExp(`label: '${label}'`), `top bar nav: ${label}`);
}
// NavLink supplies aria-current="page" when active; bottom bar too.
assert.match(topBar, /NavLink/);
assert.match(bottomTabBar, /NavLink/);
assert.match(bottomTabBar, /tabbar-tab/);
assert.match(bottomTabBar, /md:hidden/);
for (const label of ['Market', 'Portfolio', 'Ranks', 'World']) {
  assert.match(bottomTabBar, new RegExp(`label: '${label}'`), `bottom tab: ${label}`);
}
// Signed-out affordances; signed-in account chip + menu.
assert.match(topBar, /Sign in/);
assert.match(topBar, /Create account/);
assert.match(topBar, /account\.cash/);
assert.match(topBar, /account\.netWealth/);
assert.match(topBar, /aria-haspopup="menu"/);
assert.match(topBar, /role="menu"/);
assert.match(topBar, /Sign out/);
assert.match(topBar, /How to play/);
assert.match(topBar, /theme/i);
// World strip: Director chip, climate chip, Golden/Demon links, event count,
// freshness pill, World link.
assert.match(worldStrip, /DirectorModeChip/);
assert.match(worldStrip, /regimeLabel\(regime\)/);
assert.match(worldStrip, /Golden · \{golden\.symbol\}/);
assert.match(worldStrip, /Demon · \{demon\.symbol\}/);
assert.match(worldStrip, /activeEventCount\(runtime\)/);
assert.match(worldStrip, /FreshnessPill/);
assert.match(worldStrip, /World ›/);
assert.match(worldStrip, /world-strip-scroll/);
// Freshness pill: live vs reconnecting.
assert.match(freshnessPill, /Live · \{secondsAgo\}s ago/);
assert.match(freshnessPill, /Reconnecting…/);
assert.match(freshnessPill, /signalsSyncedAt/);
assert.match(freshnessPill, /15000/);
// Footer disclaimer.
assert.match(appShell, /Virtual GBP only · No real cryptocurrency, deposits, withdrawals or financial services/);
assert.match(appShell, /fantasy market for friends and family/);
// Content clears the fixed tab bar.
assert.match(appShell, /pb-24 md:pb-10/);

// ============================================================================
// Auth dialog
// ============================================================================
assert.match(authDialog, /role="tablist"/);
assert.match(authDialog, /aria-selected/);
assert.match(authDialog, /label htmlFor="auth-email"/);
assert.match(authDialog, /label htmlFor="auth-password"/);
assert.match(authDialog, /label htmlFor="auth-username"/);
assert.match(authDialog, /autoComplete="email"/);
assert.match(authDialog, /autoComplete=\{isLogin \? 'current-password' : 'new-password'\}/);
assert.match(authDialog, /autoComplete="username"/);
assert.match(authDialog, /at least 6 characters/);
assert.match(authDialog, /aria-label=\{showPassword \? 'Hide password' : 'Show password'\}/);
assert.match(authDialog, /aria-pressed=\{showPassword\}/);
assert.match(authDialog, /role="alert"/);
assert.match(authDialog, /clearError\(\)/, 'switching tabs clears the error');

// ============================================================================
// How to play
// ============================================================================
assert.match(howToPlayDialog, /HOW_TO_PLAY_STEPS\.map/);
assert.match(howToPlayDialog, /HOW_TO_PLAY_TAGLINE/);
assert.match(howToPlayDialog, /New to the market\?/);
assert.match(howToPlayDialog, /aria-hidden="true"/, 'step numbers decorative');
// Reachable from the account menu, the hero and the World page.
assert.match(topBar, /openHowToPlay/);
assert.match(marketPage, /openHowToPlay/);
assert.match(worldPage, /openHowToPlay/);
assert.match(shellServices, /openHowToPlay/);
assert.match(appShell, /HowToPlayDialog/);

// ============================================================================
// Market page
// ============================================================================
assert.match(marketPage, /filterBoardCoins/);
assert.match(marketPage, /sortBoardCoins/);
assert.match(marketPage, /topMovers/);
assert.match(marketPage, /aria-label="Filter coins"/);
assert.match(marketPage, /aria-pressed/);
// Skeleton while signals are null; neutral empty state; inline error.
assert.match(marketPage, /signals === null \?/);
assert.match(marketPage, /No coins in the market yet/);
assert.match(marketPage, /Market update failed — showing the last update/);
// Dead coins: collapsed Graveyard, not tradeable.
assert.match(marketPage, /Graveyard · \{deadCoins\.length\} dead coin/);
assert.match(marketPage, /trading has stopped permanently/);
assert.match(marketPage, /Dead · £0\.00/);
// Trade affordance opens the shared sheet.
assert.match(marketPage, /openTrade\(coin\.coinId/);
// Whole phone card navigates via a real link; Trade is a separate control.
assert.match(marketPage, /className="absolute inset-0/);
assert.match(marketPage, /pointer-events-auto/);
// Account summary: server figures verbatim, never fabricated.
assert.match(marketPage, /account\.netWealth/);
assert.match(marketPage, /account\.cash/);
assert.match(marketPage, /account\.holdingsValue/);
assert.match(marketPage, /#\{myEntry\.rank\}/);
assert.match(marketPage, /Syncing your account…/);
assert.match(marketPage, /Your account is unavailable/);
// Signed-out hero CTA copy only (never a rendered balance).
assert.match(marketPage, /Start with £10,000 virtual cash/);
// Right rail: leaderboard peek (backend rank verbatim), events, activity.
assert.match(marketPage, /topEntriesWithSelf/);
assert.match(marketPage, /#\{entry\.rank\}/);
assert.match(marketPage, /soonestEndingEvents\(collectActiveEvents\(runtime\), 5\)/);
assert.match(marketPage, /usePersistentTransactions\(5\)/);
// Sparklines on the board.
assert.match(marketPage, /<CoinSparkline coin=\{coin\} cycleStartTime=\{null\} \/>/);
// Phone cards use the compact sparkline (no caption, 28px) so cards stay ~100px.
assert.match(marketPage, /<CoinSparkline coin=\{coin\} cycleStartTime=\{null\} compact \/>/);
assert.match(coinSparkline, /compact\?: boolean/);
assert.match(coinSparkline, /sparkline-svg-compact/);
// Price flash + Delta on the board.
assert.match(marketPage, /<Price value=\{coin\.currentPrice\} flash/);
assert.match(marketPage, /<Delta pct=\{coin\.recentChangePct\}/);

// ============================================================================
// Coin page
// ============================================================================
assert.match(coinPage, /useParams/);
assert.match(coinPage, /signals\.coins\.find\(\(c\) => c\.coinId === coinId\)/);
assert.match(coinPage, /This coin is not on the board/, 'unknown id not-found state');
assert.match(coinPage, /signals === null/, 'loading skeleton until signals arrive');
// Hero: identity + archetype badge + plain personality + role badges.
assert.match(coinPage, /archetypePersonality\(coin\.archetype\)/);
assert.match(coinPage, /Golden/);
assert.match(coinPage, /Demon/);
assert.match(coinPage, /momentumArrow\(coin\.momentum\)/);
// Dead tombstone: permanent, £0.00, no trade controls.
assert.match(coinPage, /Dead · trading stopped permanently · holdings worth £0\.00/);
assert.match(coinPage, /!coin\.dead && \(/, 'trade controls gated on alive');
// Chart: existing ranges/clamp/abort/sanitise + avg entry marker.
assert.match(coinPage, /COIN_CHART_RANGES_UI: readonly TimeRange\[\] = \['5M', '10M', '30M', '1H', '2H'\]/);
assert.match(coinPage, /averageEntryPrice=\{owned && holding \? holding\.averageEntryPrice : null\}/);
assert.match(coinPage, /cycleStartTime=\{null\}/);
assert.match(coinPage, /sparklineRangeForCoin\(coin\)/);
// Events panel with plain explanation + progress bars.
assert.match(coinPage, /Events nudge this coin's price while active/);
assert.match(coinPage, /eventProgress\(event, serverNowMs\)/);
assert.match(coinPage, /activeNetModifierPct|netPct/);
// Position card: server holding fields verbatim.
assert.match(coinPage, /holding\.quantity/);
assert.match(coinPage, /holding\.averageEntryPrice/);
assert.match(coinPage, /holding\.costBasis/);
assert.match(coinPage, /holding\.currentValue/);
assert.match(coinPage, /formatSignedGbp\(holding\.unrealizedPnl\)/);
assert.match(coinPage, /formatSignedPct\(holding\.unrealizedPnlPct\)/);
assert.match(coinPage, /profit|loss/);
// Catalogue stats: one /coins/:id read, hides on failure.
assert.match(coinPage, /useCoinCatalogue\(coinId\)/);
assert.match(coinPage, /<CoinStats coinId=\{coin\.coinId\} \/>/);
// Mobile sticky action bar opens the sheet per side; desktop inline ticket.
assert.match(coinPage, /openTrade\(coin\.coinId, 'BUY'\)/);
assert.match(coinPage, /openTrade\(coin\.coinId, 'SELL'\)/);
assert.match(coinPage, /hidden lg:block/);
assert.match(coinPage, /<TradeTicket coinId=\{coin\.coinId\} \/>/);
// Unit prices at formatPrice precision.
assert.match(coinPage, /formatPrice\(holding\.averageEntryPrice\)/);
// Back link to Market.
assert.match(coinPage, /to="\/"/);

// ============================================================================
// Portfolio page
// ============================================================================
assert.match(portfolioPage, /Sign in to see your portfolio/, 'signed-out prompt');
// Header figures: server semantics verbatim.
assert.match(portfolioPage, /account\.netWealth - account\.startingCash/, 'overall P/L vs starting cash');
assert.match(portfolioPage, /reduce\(\(sum, h\) => sum \+ h\.unrealizedPnl, 0\)/, 'unrealised P&L sums server per-holding figures');
assert.match(portfolioPage, /account\.cash \+ account\.holdingsValue/);
// Holdings: sortable, server fields, dead grouped as worth £0.
assert.match(portfolioPage, /holdingsSort/);
assert.match(portfolioPage, /Dead holdings — worth £0\.00/);
assert.match(portfolioPage, /openTrade\(holding\.coinId, 'SELL'\)/);
// Transactions: full ledger, filters, day grouping, word badges, refresh.
assert.match(portfolioPage, /usePersistentTransactions\(100\)/);
assert.match(portfolioPage, /groupTransactionsByDay/);
assert.match(portfolioPage, /▲ Buy/);
assert.match(portfolioPage, /▼ Sell/);
assert.match(portfolioPage, /formatPrice\(tx\.price\)/);
assert.match(portfolioPage, /No trades yet/);
assert.match(portfolioPage, /aria-label="Refresh transactions"/);
assert.match(portfolioPage, /aria-live="polite"/);

// ============================================================================
// Leaderboard page — backend rank verbatim
// ============================================================================
assert.doesNotMatch(leaderboardPage, /\.sort\(/, 'no client re-sort of the board');
assert.doesNotMatch(leaderboardPage, /index \+ 1/, 'no recomputed ranks');
assert.match(leaderboardPage, /#\{entry\.rank\}/);
assert.match(leaderboardPage, /PERSISTENT_LEADERBOARD_RULE_COPY/);
assert.match(leaderboardPage, /personalityLabel/);
assert.match(leaderboardPage, /Bot/);
assert.match(leaderboardPage, /aria-current/);
assert.match(leaderboardPage, /Bot loan/);
assert.match(leaderboardPage, /gapToEntryAbove\(entries, myEntry\)/);
assert.match(leaderboardPage, /describeLeaderboardGap\(gap\)/, 'gap copy comes from the shared helper');
assert.match(leaderboardPage, /leaderboard-me/);
assert.match(leaderboardPage, /entry\.netWorth < 0/, 'negative net worth rendered honestly');
assert.match(leaderboardGap, /ahead\.netWorth - mine\.netWorth/, 'gap is a difference of two backend netWorth values');
assert.match(leaderboardGap, /entries\.slice\(0, count\)/, 'peek preserves backend order');
// Tie copy: a zero gap is "Level with #N (name)", never "£0.00 behind".
assert.match(leaderboardGap, /export function describeLeaderboardGap/);
assert.match(leaderboardGap, /Level with #\$\{gap\.aheadRank\}/);
assert.match(leaderboardGap, /behind #\$\{gap\.aheadRank\}/);
assert.doesNotMatch(leaderboardPage, /£0\.00 behind/);

// ============================================================================
// World page
// ============================================================================
assert.match(worldPage, /directorModeExplanation\(director\.mode\)/);
assert.match(worldPage, /Upward pressure/);
assert.match(worldPage, /Downward pressure/);
assert.match(worldPage, /aria-valuenow=\{Math\.round\(director\.intensity \* 100\)\}/, 'intensity meter 0–100%');
assert.match(worldPage, /regimeCopy\(regime\)/);
assert.match(worldPage, /regimeLabel\(regime\)/);
assert.match(regimeCopy, /GOLDEN_AGE/);
assert.match(regimeCopy, /RECESSION/);
assert.match(regimeCopy, /\?\? regime/, 'unknown regime shows the raw word');
assert.match(worldPage, /No golden coin right now/);
assert.match(worldPage, /No demon coin right now/);
assert.match(worldPage, /Expires in \{timeLeft\}/);
assert.match(worldPage, /soonestEndingEvents\(collectActiveEvents\(runtime\)/);
assert.match(worldPage, /decisionSummaryCopy\(decision\.summaryCode\)/);
assert.match(worldPage, /<MarketValueChart refreshTrigger=\{0\} \/>/);
// Live events: 8 soonest-ending by default with an aria-expanded toggle, and
// a two-column grid on >=1024px so the list is not a wall of rows.
assert.match(worldPage, /EVENTS_INITIAL_COUNT = 8/);
assert.match(worldPage, /events\.slice\(0, EVENTS_INITIAL_COUNT\)/);
assert.match(worldPage, /Show all \$\{events\.length\} events/);
assert.match(worldPage, /aria-expanded=\{showAllEvents\}/);
assert.match(worldPage, /lg:grid-cols-2/);
// Market pulse feeds only while this page is mounted, at 10s intervals.
assert.match(worldPage, /\/market\/stats`, 10000/);
assert.match(worldPage, /\/market\/status`, 10000/);
assert.match(worldPage, /TICK_TYPE_COPY/);
assert.match(worldPage, /STRONG_BOOM/);
assert.match(runtimeCopy, /Market running normally/);
assert.match(runtimeCopy, /GENESIS_NORMAL/);
assert.match(persistentCountdown, /export function remainingMs/);
assert.match(persistentCountdown, /Ended — updating/);

// ============================================================================
// Charts: range caps, clamping, sanitise, abort, a11y — unchanged behaviour
// ============================================================================
assert.match(chart, /COIN_CHART_RANGES/);
assert.match(chart, /clampCoinChartRange/);
assert.match(chart, /clampCoinChartRange\(initialRange \?\? primaryRanges\[0\]/);
assert.doesNotMatch(chart, /value: '24H'/);
assert.doesNotMatch(chart, /value: '7D'/);
assert.doesNotMatch(chart, /value: '30D'/);
assert.doesNotMatch(chart, /value: 'ALL'/);
assert.match(chart, /aria-pressed/);
assert.match(chart, /role="group"/);
assert.match(chart, /aria-label="Select a longer chart time range"/);
assert.match(chart, /clipPointsSince\(result\.points \|\| \[\], sinceMs\)/);
assert.match(chart, /cycleStartTime\?: string \| null/);
assert.match(chart, /entryMarkerVisible/);
assert.match(chart, /secondaryRanges/);
assert.match(chart, /filter: \(tooltipItem/, 'the entry marker is never a tooltip value');
assert.match(chart, /Your average entry/);
assert.match(chart, /apiRangeForCoinChart/);
assert.match(chart, /windowChartPoints/);
assert.match(chart, /\$\{API_BASE\}\/coins\/\$\{coinId\}\/price-history\?range=\$\{apiRange\}/);
assert.doesNotMatch(chart, /market\/price-history/);
assert.match(chart, /abort\(\)/, 'stale chart requests are aborted');
// Unit-price formatting moved to the shared 4dp rule.
assert.match(chart, /formatPrice/);
// Theme-aware colours from CSS variables.
assert.match(chart, /readChartTheme/);
// Additive prop hides the duplicated big price when a hero already shows it.
assert.match(chart, /showCurrentPrice\?: boolean/);
assert.match(chart, /showCurrentPrice = true/);
assert.match(coinPage, /showCurrentPrice=\{false\}/, 'coin hero owns the big live price');
assert.match(marketValueChart, /readChartTheme/);
assert.match(marketValueChart, /MARKET_CHART_RANGES/);
assert.match(marketValueChart, /sanitizeMarketHistoryPoints/);
assert.match(marketValueChart, /apiRangeForMarketChart/);
assert.match(
  marketValueChart,
  /import \{[\s\S]*apiRangeForMarketChart[\s\S]*\} from '\.\.\/utils\/marketHistoryChart\.ts'/
);
assert.match(marketValueChart, /chartTimeUnitForRange/);
assert.match(marketValueChart, /clampMarketChartRange/);
assert.doesNotMatch(marketValueChart, /value: '24H'/);
assert.doesNotMatch(marketValueChart, /value: 'ALL'/);
assert.match(marketValueChart, /aria-pressed/);
assert.match(marketHistoryChartUtil, /'10M'/);
assert.match(marketHistoryChartUtil, /'30M'/);
assert.match(marketHistoryChartUtil, /'1H'/);
assert.match(marketHistoryChartUtil, /'2H'/);
assert.match(marketHistoryChartUtil, /'5M'/);
assert.match(marketHistoryChartUtil, /'12H'/);
assert.match(marketHistoryChartUtil, /export const COIN_CHART_RANGES/);
assert.match(marketHistoryChartUtil, /RANGE_MS/);
assert.match(marketHistoryChartUtil, /export function sanitizeMarketHistoryPoints/);
assert.match(marketHistoryChartUtil, /export const MARKET_CHART_RANGES[\s\S]*?\] as const/);
const marketRangesDecl = marketHistoryChartUtil.match(/export const MARKET_CHART_RANGES[\s\S]*?\] as const/)?.[0] ?? '';
assert.doesNotMatch(marketRangesDecl, /24H|7D|30D|ALL/);
assert.match(typesTs, /'5M' \| '10M' \| '30M' \| '1H' \| '2H' \| '24H' \| '7D' \| '30D' \| 'ALL'/);

// ============================================================================
// Sparklines: compact SVG, shared cache, no per-card fetch/timer
// ============================================================================
assert.doesNotMatch(coinSparkline, /chart\.js|react-chartjs-2/);
assert.match(coinSparkline, /<svg/);
assert.match(coinSparkline, /role="img"/);
assert.match(coinSparkline, /aria-label=\{ariaLabel\}/);
assert.match(coinSparkline, /describeSparkline/);
assert.match(coinSparkline, /preserveAspectRatio="none"/);
assert.match(coinSparkline, /vectorEffect="non-scaling-stroke"/);
assert.doesNotMatch(coinSparkline, /<(XAxis|YAxis|Legend|Axis)\b/);
assert.match(coinSparkline, /Loading price history/);
assert.match(coinSparkline, /Price history unavailable — trading is unaffected/);
assert.match(coinSparkline, /No recent history yet/);
assert.match(coinSparkline, /flatlined at £0\.00 — dead and cannot be bought/);
assert.match(coinSparkline, /deadFlatlinePath/);
assert.match(coinSparkline, /clipPointsSince\(points, sinceMs\)/);
assert.match(coinSparkline, /cycleStartTime/);
assert.doesNotMatch(coinSparkline, /\bfetch\(|setInterval/);
assert.match(sparklineUtil, /export function sparklineRangeForCoin/);
assert.match(sparklineUtil, /SPARKLINE_CYCLES_TARGET = 3/);
assert.match(sparklineUtil, /ARCHETYPE_MAX_CYCLE_MINUTES/);
assert.match(sparklineUtil, /export function toSparklineSeries/);
assert.match(sparklineUtil, /export function clipPointsSince/);
assert.match(sparklineUtil, /export function buildSparklinePath/);
assert.match(sparklineUtil, /export function entryMarkerY/);
assert.match(sparklineUtil, /export function deadFlatlinePath/);
assert.match(sparklineUtil, /export function describeSparkline/);
assert.match(sparklineUtil, /export function entryMarkerVisible/);
assert.match(priceHistoryService, /\/coins\/\$\{entry\.coinId\}\/price-history\?range=\$\{entry\.range\}/);
assert.match(priceHistoryService, /HISTORY_CACHE_TTL_MS = 10_000/);
assert.match(priceHistoryService, /HISTORY_REFRESH_MS = 12_000/);
assert.match(priceHistoryService, /entry\.inflight !== null/);
assert.match(priceHistoryService, /entry\.inflight\?\.abort\(\)/);
assert.match(priceHistoryService, /Stale-response guard/);
assert.match(priceHistoryService, /stale-while-revalidate/);
assert.doesNotMatch(priceHistoryService, /market\/price-history/);
assert.match(useCoinSparkline, /useSyncExternalStore/);
assert.match(useCoinSparkline, /coinPriceHistory\.subscribe/);
assert.doesNotMatch(useCoinSparkline, /\bfetch\(|setInterval/);
assert.match(styles, /\.sparkline-svg \{[\s\S]*?height: 44px/);
assert.match(styles, /\.sparkline-up path \{ stroke: var\(--up\)/);
assert.match(styles, /\.sparkline-down path \{ stroke: var\(--down\)/);
assert.match(styles, /\.sparkline-entry \{/);
assert.match(styles, /\.sparkline-state \{/);
// Sparkline direction classes are built via template literals in
// CoinSparkline (`sparkline-${direction}`), so the colour rules MUST sit
// OUTSIDE any @layer: inside a layer Tailwind tree-shakes classes the
// content scan never sees and the SVG path's stroke computes to none.
// (Correction pass finding: sparklines rendered no line.)
function cssLayerBodyEnd(src, layerName) {
  const open = src.indexOf(`@layer ${layerName} {`);
  if (open === -1) return -1;
  let depth = 0;
  for (let i = src.indexOf('{', open); i < src.length; i++) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}
for (const layerName of ['base', 'components', 'utilities']) {
  const end = cssLayerBodyEnd(styles, layerName);
  assert.ok(end !== -1, `@layer ${layerName} must exist in index.css`);
  const body = styles.slice(styles.indexOf(`@layer ${layerName} {`), end);
  assert.doesNotMatch(body, /\.sparkline-(up|down|flat|change-up|change-down|change-flat)\b/,
    `sparkline direction rules must not live inside @layer ${layerName}`);
}
assert.match(styles, /\.sparkline-change-up \{ color: var\(--up\)/);
assert.match(styles, /\.sparkline-svg-compact \{ height: 28px; \}/);

// ============================================================================
// New pure helpers + their tests are wired into test:unit
// ============================================================================
assert.match(marketBoard, /export function filterBoardCoins/);
assert.match(marketBoard, /export function sortBoardCoins/);
assert.match(marketBoard, /export function topMovers/);
assert.match(worldEvents, /export function collectActiveEvents/);
assert.match(worldEvents, /export function soonestEndingEvents/);
assert.match(worldEvents, /export function eventProgress/);
assert.match(leaderboardGap, /export function gapToEntryAbove/);
assert.match(leaderboardGap, /export function topEntriesWithSelf/);
assert.match(transactionGroups, /export function groupTransactionsByDay/);
assert.match(regimeCopy, /export const REGIME_COPY/);
assert.match(coinIdentity, /export function coinHue/);
assert.match(deltaUtil, /export function deltaParts/);
assert.match(priceFlashUtil, /export function priceFlashDirection/);
for (const testFile of [
  'formatPrice.test.ts',
  'coinIdentity.test.ts',
  'delta.test.ts',
  'priceFlash.test.ts',
  'marketBoard.test.ts',
  'worldEvents.test.ts',
  'formatModifierPct.test.ts',
  'leaderboardGap.test.ts',
  'transactionGroups.test.ts',
  'regimeCopy.test.ts'
]) {
  assert.ok(pkg.includes(`src/utils/${testFile}`), `test:unit must include ${testFile}`);
}

// ============================================================================
// Apocalypse Monitor (internal operator tool) — unchanged logic
// ============================================================================
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
assert.doesNotMatch(monitorService, /console\.(log|error|warn|info|debug)/);
assert.doesNotMatch(apocalypseMonitor, /localStorage|sessionStorage/);
assert.doesNotMatch(apocalypseMonitor, /import\.meta\.env|VITE_/);
assert.match(apocalypseMonitor, /type="password"/);
assert.match(apocalypseMonitor, /autoComplete="off"/);
assert.match(apocalypseMonitor, /Diagnostics token/);
assert.match(apocalypseMonitor, /held in memory only/);
assert.match(apocalypseMonitor, /selectedCycle/);
assert.match(apocalypseMonitor, /monitorData/);
assert.match(apocalypseMonitor, /chartMode/);
assert.match(apocalypseMonitor, /pickNewestCycle\(result\.cycles\)/);
assert.match(apocalypseMonitor, /Loading monitor data/);
assert.match(apocalypseMonitor, /react-chartjs-2/);
assert.match(apocalypseMonitor, /buildMonitorSeries\(coin, monitorData\.cycle\.startTime, chartMode\)/);
assert.match(apocalypseMonitor, /MONITOR_CHART_MODE_LABEL/);
assert.match(apocalypseMonitor, /aria-pressed/);
assert.match(apocalypseMonitor, /role="group"/);
assert.match(apocalypseMonitor, /Elapsed \$\{formatElapsed/);
assert.match(apocalypseMonitor, /summariseMonitorCoin\(coin, monitorData\.cycle\.endTime\)/);
assert.match(apocalypseMonitor, /attributionLabel\(/);
assert.match(apocalypseMonitor, /COLLAPSED/);
assert.match(apocalypseMonitor, /monitorData\.warnings\.map/);
assert.match(apocalypseMonitor, /Samples/);
assert.match(monitorUtil, /export function buildMonitorSeries/);
assert.match(monitorUtil, /export function summariseMonitorCoin/);
assert.match(monitorUtil, /export function formatElapsed/);
assert.match(monitorUtil, /export function pickNewestCycle/);
assert.match(monitorUtil, /export function attributionLabel/);
assert.match(monitorUtil, /export const MONITOR_ATTRIBUTION_LABEL/);
assert.match(monitorUtil, /export const MONITOR_CHART_MODE_LABEL/);
assert.match(monitorUtil, /\(\(point\.price - startPrice\) \/ startPrice\) \* 100/);
// Replay cursor + playback.
assert.match(apocalypseMonitor, /currentReplayTime/);
assert.match(apocalypseMonitor, /setCurrentReplayTime\(null\)/);
assert.match(apocalypseMonitor, /type="range"/);
assert.match(apocalypseMonitor, /aria-valuetext/);
assert.match(apocalypseMonitor, /aria-label="Replay position in the cycle"/);
assert.match(apocalypseMonitor, /formatInspecting\(/);
assert.match(apocalypseMonitor, />Start</);
assert.match(apocalypseMonitor, /'Latest' : 'End'/);
assert.doesNotMatch(apocalypseMonitor, /setInterval|setTimeout/);
assert.match(monitorUtil, /export function monitorReplayBounds/);
assert.match(monitorUtil, /export function clampReplayTime/);
assert.match(monitorUtil, /export function getPriceAtTime/);
assert.match(monitorUtil, /export function getCoinStateAtTime/);
assert.match(monitorUtil, /export function formatInspecting/);
assert.match(monitorUtil, /status === 'ACTIVE'/);
assert.match(apocalypseMonitor, /getCoinStateAtTime\(coin, monitorData\.cycle\.startTime/);
assert.match(apocalypseMonitor, /At cursor/);
assert.match(apocalypseMonitor, /Cursor Δ/);
assert.match(apocalypseMonitor, /isPlaying/);
assert.match(apocalypseMonitor, /playbackSpeed/);
assert.match(apocalypseMonitor, /useState<MonitorPlaybackSpeed>\(DEFAULT_MONITOR_PLAYBACK_SPEED\)/);
assert.match(apocalypseMonitor, /requestAnimationFrame\(tick\)/);
assert.match(apocalypseMonitor, /cancelAnimationFrame\(rafId\)/);
assert.match(apocalypseMonitor, /advanceReplayTime\(base, frameTimestamp - lastTs, playbackSpeedRef\.current, replayBounds\)/);
assert.match(apocalypseMonitor, /aria-label="Replay transport"/);
assert.match(apocalypseMonitor, /aria-pressed=\{isPlaying\}/);
assert.match(apocalypseMonitor, /'Pause replay' : 'Play replay'/);
assert.match(apocalypseMonitor, /\{isPlaying \? 'Pause' : 'Play'\}/);
assert.match(apocalypseMonitor, /disabled=\{!isPlaying && effectiveReplayMs === replayBounds\.minMs\}/);
assert.match(apocalypseMonitor, /disabled=\{!isPlaying && effectiveReplayMs === replayBounds\.maxMs\}/);
assert.match(apocalypseMonitor, /aria-label="Playback speed"/);
assert.match(apocalypseMonitor, /MONITOR_PLAYBACK_SPEEDS\.map/);
assert.match(apocalypseMonitor, /aria-pressed=\{playbackSpeed === speed\}/);
assert.match(apocalypseMonitor, /Playback speed \$\{playbackSpeedLabel\(speed\)\}/);
assert.match(monitorUtil, /export const MONITOR_PLAYBACK_SPEEDS = \[1, 5, 10, 30, 60\] as const/);
assert.match(monitorUtil, /export const DEFAULT_MONITOR_PLAYBACK_SPEED: MonitorPlaybackSpeed = 10/);
assert.match(monitorUtil, /export function isMonitorPlaybackSpeed/);
assert.match(monitorUtil, /export function playbackSpeedLabel/);
assert.match(monitorUtil, /export function advanceReplayTime/);
assert.match(monitorUtil, /export function resolveReplayPlayStart/);
assert.match(apocalypseMonitor, /const pausePlayback = useCallback/);
assert.match(apocalypseMonitor, /visibilitychange/);
assert.match(apocalypseMonitor, /document\.visibilityState === 'hidden'\) pausePlayback\(\)/);
assert.match(apocalypseMonitor, /const handleScrub = \(ms: number\) => \{\n    pausePlayback\(\);/);
assert.match(apocalypseMonitor, /const handlePlayPause = \(\)/);
assert.match(apocalypseMonitor, /resolveReplayPlayStart\(/);
assert.match(apocalypseMonitor, /onClick=\{\(\) => setChartMode\(mode\)\}/);

// ============================================================================
// Toasts: aria-live region
// ============================================================================
assert.match(toastContext, /role=\{toast\.type === 'error' \? 'alert' : 'status'\}/);
assert.match(toastContext, /aria-label="Dismiss notification"/);
assert.match(toastContext, /aria-label="Notifications"/);
// Positioned bottom-centre above the tab bar on phones, top-right on desktop.
assert.match(toastContext, /bottom-\[calc\(64px\+env\(safe-area-inset-bottom,0px\)\)\]/);
assert.match(toastContext, /sm:top-4 sm:right-4/);

// ============================================================================
// Presentational pages never fetch raw or run their own timers
// (the world page's /market/stats + /market/status reads go through the
// shared useFetch hook, mounted only on that page at 10s cadence; the
// portfolio/activity ledger reads ride usePersistentTransactions).
// ============================================================================
for (const [name, text] of Object.entries({ marketPage, coinPage, leaderboardPage, worldPage, portfolioPage })) {
  assert.doesNotMatch(text, /\bfetch\(/, `${name} must not fetch independently`);
  assert.doesNotMatch(text, /setInterval/, `${name} must not run its own timer`);
}
assert.doesNotMatch(tradeSheet, /\bfetch\(|setInterval/);

// ============================================================================
// Centralised API base: no hard-coded production origin outside apiConfig
// ============================================================================
const SRC = new URL('../src', import.meta.url).pathname;
const violations = [];
for (const entry of readdirSync(SRC, { recursive: true })) {
  const file = join(SRC, entry.toString());
  if (!statSync(file).isFile() || !/\.(ts|tsx)$/.test(file)) continue;
  if (/apiConfig\.ts$/.test(file)) continue;
  if (/\.test\.ts$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  if (text.includes('jdwd40.com')) violations.push(entry.toString());
}
assert.deepEqual(violations, [], `hard-coded API origin outside apiConfig.ts: ${violations.join(', ')}`);

// ============================================================================
// Deleted legacy presentation files stay deleted
// ============================================================================
for (const gone of [
  'src/components/GameTopBar.tsx',
  'src/components/UserMenu.tsx',
  'src/components/ThemeToggle.tsx',
  'src/components/PersistentMarketHeader.tsx',
  'src/components/PersistentDirectorPanel.tsx',
  'src/components/PlayerStatusStrip.tsx',
  'src/components/LeaderboardPressure.tsx',
  'src/components/LeaderboardPanel.tsx',
  'src/components/PlayerRoundPanel.tsx',
  'src/components/GameMarketGrid.tsx',
  'src/components/CoinSignalCard.tsx',
  'src/components/GameCoinDetail.tsx',
  'src/components/CoinsList.tsx',
  'src/components/CoinDetail.tsx',
  'src/components/MarketStats.tsx',
  'src/components/MarketStatus.tsx',
  'src/components/Modal.tsx',
  'src/components/Toast.tsx',
  'src/components/Profile.tsx',
  'src/components/AuthForms.tsx',
  'src/components/PersistentTradePanel.tsx',
  'src/components/ApocalypseHeader.tsx',
  'src/components/BuyForm.tsx',
  'src/components/SellForm.tsx',
  'src/components/DebugUserInfo.tsx',
  'src/components/ResultsPanel.tsx',
  'src/components/RoundTradePanel.tsx',
  'src/components/HowToPlay.tsx',
  'src/types/index.ts'
]) {
  assert.ok(!existsSync(new URL(`../${gone}`, import.meta.url)), `${gone} must stay deleted`);
}

// ============================================================================
// AuthContext: no credential/token/response logging anywhere in auth
// ============================================================================
const authContext = read('src/context/AuthContext.tsx');
assert.doesNotMatch(authContext, /console\.(log|error|warn|info|debug)/, 'AuthContext must not log');

// ============================================================================
// Correction pass (2026-10-01) — controller review findings
// ============================================================================
// Event/modifier percentages render via the shared 1dp formatter everywhere.
assert.match(formatModifierPctUtil, /export function formatModifierPct/);
assert.match(formatModifierPctUtil, /<0\.1/);
assert.match(formatModifierPctUtil, /toFixed\(1\)/);
for (const [name, text] of Object.entries({ marketPage, coinPage, worldPage })) {
  assert.match(text, /formatModifierPct\(event\.modifierPct, kind\)/, `${name} formats event modifiers via formatModifierPct`);
  assert.doesNotMatch(text, /Math\.abs\(event\.modifierPct\)/, `${name} must not render raw modifierPct`);
}
assert.match(coinPage, /formatModifierPct\(netPct/, 'coin page net modifier uses formatModifierPct');

// useFetch: the initial fetch of each effect run is never throttled (the
// 500ms throttle is for interval ticks; StrictMode remount must not wait
// for the 10s poll to show the first Market pulse values).
assert.match(useFetchHook, /lastFetchTimeRef\.current = 0;/, 'effect start resets the throttle');

// No nested interactive elements: never <Link ...><Button ...> — ButtonLink
// (an <a> styled as a button) is the only allowed pattern.
assert.match(button, /export function ButtonLink/);
for (const page of [marketPage, coinPage, portfolioPage, leaderboardPage, worldPage, notFoundPage]) {
  assert.doesNotMatch(page, /<Link[^>]*>\s*<Button/, 'no <Link><Button> nesting in pages');
}
{
  const linkButtonViolations = [];
  for (const dir of ['../src/pages', '../src/components']) {
    const root = new URL(dir, import.meta.url).pathname;
    for (const entry of readdirSync(root, { recursive: true })) {
      const file = join(root, entry.toString());
      if (!statSync(file).isFile() || !/\.tsx$/.test(file)) continue;
      if (/<Link[^>]*>[^<]*<Button[\s>]/.test(readFileSync(file, 'utf8'))) {
        linkButtonViolations.push(`${dir}/${entry}`);
      }
    }
  }
  assert.deepEqual(linkButtonViolations, [], `nested <Link><Button>: ${linkButtonViolations.join(', ')}`);
}

// Phone top bar: compact cash in the account button <640px, username kept in
// the aria-label and the open menu.
assert.match(topBar, /compactCash/);
assert.match(topBar, /sm:hidden font-mono text-sm font-semibold tnum/);
assert.match(topBar, /Signed in as/);

// Player copy: no developer telemetry wording in player-visible text.
assert.doesNotMatch(tradeTicket, /idempotently/i);
assert.doesNotMatch(marketPage, /is provisioned|provisions with/i);
assert.doesNotMatch(portfolioPage, /provisions your starting/i);
assert.doesNotMatch(leaderboardPage, /are provisioned|market is provisioned/i);
assert.match(gameLogic, /Players and bots share one board/);
assert.doesNotMatch(gameLogic, /Backend rank is authoritative/);

// DIRECTOR_MODE_META lives in a plain .ts module (react-refresh clean).
const directorModeMeta = read('src/components/directorModeMeta.ts');
assert.match(directorModeMeta, /export const DIRECTOR_MODE_META/);
assert.doesNotMatch(read('src/components/DirectorModeChip.tsx'), /export const DIRECTOR_MODE_META/);

console.log('Crypto Chaos UI contract passed');
