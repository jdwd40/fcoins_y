import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const app = read('src/App.tsx');
const persistentContext = read('src/context/PersistentContext.tsx');
const persistentService = read('src/services/persistentService.ts');
const logic = read('src/utils/persistentGameLogic.ts');
const marketGrid = read('src/components/GameMarketGrid.tsx');
const tradePanel = read('src/components/PersistentTradePanel.tsx');
const monitor = read('src/components/ApocalypseMonitor.tsx');

assert.match(app, /<PersistentProvider>/);
assert.match(app, /PlayerActivityPanel/);
assert.doesNotMatch(app, /PlayerRoundPanel/);
assert.doesNotMatch(app, /GameProvider|GameContext|ApocalypseHeader|ResultsOverlay|RoundTradePanel/);
assert.match(app, /path="\/internal\/apocalypse-monitor"/);

for (const source of [persistentContext, persistentService, marketGrid, tradePanel]) {
  assert.doesNotMatch(source, /\/game\/(?:state|join|trades|leaderboard|market-signals)/);
}
assert.match(persistentService, /\/persistent\/signals/);
assert.match(persistentService, /\/persistent\/account/);
assert.match(persistentService, /\/persistent\/trades\/buy/);
assert.match(persistentService, /\/persistent\/trades\/sell/);

assert.match(persistentService, /coin_id:\s*coinId,\s*quantity/);
assert.doesNotMatch(tradePanel, /joinGame|joinRound/);

assert.match(logic, /HOW TO PLAY THE PERSISTENT MARKET/);
assert.match(logic, /runs continuously/i);
assert.doesNotMatch(logic, /JOIN APOCALYPSE|30-minute|settling/i);
assert.match(logic, /TRADE_QUANTITY_MAX_DECIMALS = 8/);
assert.match(logic, /QUICK_BUY_NOTIONALS/);

assert.match(monitor, /monitorService/);
assert.doesNotMatch(monitor, /usePersistent|PersistentContext/);

for (const retiredPath of [
  'src/context/GameContext.tsx',
  'src/services/gameService.ts',
  'src/components/ApocalypseHeader.tsx',
  'src/components/ResultsPanel.tsx',
  'src/components/RoundTradePanel.tsx',
  'src/components/BuyForm.tsx',
  'src/components/SellForm.tsx',
  'src/components/DebugUserInfo.tsx',
  'src/components/PlayerRoundPanel.tsx'
]) {
  assert.equal(existsSync(new URL(`../${retiredPath}`, import.meta.url)), false, `${retiredPath} must stay retired`);
}

console.log('UI contract passed: persistent player shell isolated; historical monitor retained.');
