// Persistent-market Stage 6: REST client contract tests for
// persistentService — the ONLY client the new gameplay uses for
// buy/sell/account/portfolio/transaction flows. Runs under plain Node
// (node --test); fetch is stubbed on globalThis.
//
// The load-bearing assertions of this suite:
//   * request shapes are exactly { coin_id, quantity } — no price (the
//     server owns execution prices), no user_id (the token owns the
//     account), and NO Apocalypse/cycle identifier anywhere;
//   * responses are validated at the boundary, including loud rejection of
//     any leaked cycle identifier (the persistent contract is world-scoped);
//   * the unprovisioned account and empty-history states are first-class
//     results, never errors.
import test from 'node:test';
import assert from 'node:assert/strict';

import { API_BASE_URL } from './apiConfig.ts';
import {
  buyPersistentTrade,
  getPersistentAccount,
  getPersistentLeaderboard,
  getPersistentSignals,
  getPersistentTransactions,
  parsePersistentAccount,
  parsePersistentAccountResponse,
  parsePersistentLeaderboard,
  parsePersistentLeaderboardEntry,
  parsePersistentMarketSignals,
  parsePersistentTradeResult,
  parsePersistentTransaction,
  parsePersistentTransactionsResponse,
  sellPersistentTrade
} from './persistentService.ts';
import type {
  PersistentAccount,
  PersistentLeaderboard,
  PersistentTransaction
} from './persistentService.ts';
import { GameApiError } from './gameService.ts';
import { SessionExpiredError } from './transactionService.ts';

const TOKEN = 'test-token';

const VALID_HOLDING = {
  coinId: 2,
  symbol: 'JDC',
  quantity: 0.004,
  costBasis: 10,
  averageEntryPrice: 2500,
  currentPrice: 2500,
  currentValue: 10,
  unrealizedPnl: 0,
  unrealizedPnlPct: 0
};

const VALID_ACCOUNT: PersistentAccount = {
  accountId: 3,
  worldId: 1,
  userId: 1,
  startingCash: 10000,
  cash: 9990,
  debt: 0,
  provisionedAt: '2026-08-31T10:00:00.000Z',
  holdings: [VALID_HOLDING],
  holdingsValue: 10,
  wealth: 10000,
  netWealth: 10000
};

const VALID_TRANSACTION: PersistentTransaction = {
  persistentTransactionId: 41,
  type: 'BUY',
  coinId: 2,
  symbol: 'JDC',
  quantity: 0.004,
  price: 2500,
  totalAmount: 10,
  createdAt: '2026-08-31T10:05:00.000Z'
};

const VALID_TRADE_RESULT = {
  transaction: {
    persistentTransactionId: 42,
    type: 'SELL',
    coinId: 2,
    quantity: 0.002,
    price: 2500,
    totalAmount: 5
  },
  account: VALID_ACCOUNT
};


const VALID_LEADERBOARD_ENTRY = {
  rank: 1,
  accountId: 12,
  userId: 1,
  username: 'player',
  isBot: false,
  personality: null,
  cash: 9000,
  holdingsValue: 90,
  debt: 0,
  netWorth: 9090
};

const VALID_LEADERBOARD: PersistentLeaderboard = {
  worldId: 1,
  serverTime: '2026-09-04T17:00:00.000Z',
  entries: [
    VALID_LEADERBOARD_ENTRY,
    {
      rank: 2,
      accountId: 7,
      userId: 501,
      username: 'cool_conservative_bot',
      isBot: true,
      personality: 'conservative',
      cash: 8000,
      holdingsValue: 500,
      debt: 1000,
      netWorth: 7500
    },
    {
      rank: 3,
      accountId: 9,
      userId: 502,
      username: 'broke_bot',
      isBot: true,
      personality: 'dip_buyer',
      cash: 100,
      holdingsValue: 0,
      debt: 10000,
      netWorth: -9900
    }
  ]
};

type FetchArgs = { url: string; init?: RequestInit };

function stubFetch(impl: (args: FetchArgs) => Promise<Response>): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    impl({ url: String(input), init })) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function envelope(data: unknown): { status: 'success'; data: unknown } {
  return { status: 'success', data };
}

// --- URL / request shapes -----------------------------------------------------

test('account read hits /persistent/account with the bearer token and no body', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => { seen = args; return jsonResponse(envelope({ provisioned: false })); });
  try {
    await getPersistentAccount(TOKEN);
  } finally {
    restore();
  }
  assert.equal(seen?.url, `${API_BASE_URL}/persistent/account`);
  assert.equal(seen?.init?.method, 'GET');
  const headers = seen?.init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(seen?.init?.body, undefined);
});

test('transactions read hits /persistent/transactions, with the limit only when supplied', async () => {
  const seen: string[] = [];
  const restore = stubFetch(async (args) => {
    seen.push(args.url);
    return jsonResponse(envelope({ provisioned: true, transactions: [VALID_TRANSACTION] }));
  });
  try {
    await getPersistentTransactions(TOKEN);
    await getPersistentTransactions(TOKEN, { limit: 25 });
  } finally {
    restore();
  }
  assert.equal(seen[0], `${API_BASE_URL}/persistent/transactions`);
  assert.equal(seen[1], `${API_BASE_URL}/persistent/transactions?limit=25`);
});

test('buy request is exactly { coin_id, quantity } — no price, no user id, no cycle id', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => { seen = args; return jsonResponse(envelope(VALID_TRADE_RESULT), 201); });
  try {
    await buyPersistentTrade(TOKEN, { coinId: 2, quantity: 0.004 });
  } finally {
    restore();
  }
  assert.equal(seen?.url, `${API_BASE_URL}/persistent/trades/buy`);
  assert.equal(seen?.init?.method, 'POST');
  const headers = seen?.init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(headers['Content-Type'], 'application/json');
  // The wire body carries ONLY the two contract keys.
  assert.deepEqual(JSON.parse(String(seen?.init?.body)), { coin_id: 2, quantity: 0.004 });
});

test('sell request is exactly { coin_id, quantity } — no price, no user id, no cycle id', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => { seen = args; return jsonResponse(envelope(VALID_TRADE_RESULT), 201); });
  try {
    await sellPersistentTrade(TOKEN, { coinId: 7, quantity: 3 });
  } finally {
    restore();
  }
  assert.equal(seen?.url, `${API_BASE_URL}/persistent/trades/sell`);
  assert.equal(seen?.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(seen?.init?.body)), { coin_id: 7, quantity: 3 });
});

// --- Response parsing ----------------------------------------------------------

test('unprovisioned account is a first-class result, never an error', async () => {
  const restore = stubFetch(async () => jsonResponse(envelope({ provisioned: false })));
  try {
    const result = await getPersistentAccount(TOKEN);
    assert.deepEqual(result, { provisioned: false });
  } finally {
    restore();
  }
});

test('provisioned account parses the full server-owned state', async () => {
  const restore = stubFetch(async () => jsonResponse(envelope({ provisioned: true, ...VALID_ACCOUNT })));
  try {
    const result = await getPersistentAccount(TOKEN);
    assert.equal(result.provisioned, true);
    if (result.provisioned) {
      assert.equal(result.cash, 9990);
      assert.equal(result.wealth, 10000);
      assert.equal(result.holdings.length, 1);
      assert.equal(result.holdings[0].symbol, 'JDC');
    }
  } finally {
    restore();
  }
});

test('trade result parses the transaction and the post-trade account', async () => {
  const restore = stubFetch(async () => jsonResponse(envelope(VALID_TRADE_RESULT), 201));
  try {
    const result = await buyPersistentTrade(TOKEN, { coinId: 2, quantity: 0.002 });
    assert.equal(result.transaction.type, 'SELL');
    assert.equal(result.transaction.price, 2500); // reported by the server
    assert.equal(result.account.cash, 9990);
  } finally {
    restore();
  }
});

test('transactions response parses rows and the provisioned flag', async () => {
  const restore = stubFetch(async () =>
    jsonResponse(envelope({ provisioned: true, transactions: [VALID_TRANSACTION] })));
  try {
    const result = await getPersistentTransactions(TOKEN, { limit: 50 });
    assert.equal(result.provisioned, true);
    assert.equal(result.transactions.length, 1);
    assert.equal(result.transactions[0].persistentTransactionId, 41);
  } finally {
    restore();
  }
});

// --- Absence of Apocalypse/cycle dependency -------------------------------------

test('a leaked cycle identifier in any persistent payload fails loudly', () => {
  assert.throws(
    () => parsePersistentAccountResponse({ provisioned: true, ...VALID_ACCOUNT, apocalypseId: 'APOC-0001' }),
    /never carry apocalypseId/
  );
  assert.throws(
    () => parsePersistentAccount({ ...VALID_ACCOUNT, cycleId: 3 }),
    /never carry cycleId/
  );
  assert.throws(
    () => parsePersistentTradeResult({ ...VALID_TRADE_RESULT, transaction: { ...VALID_TRADE_RESULT.transaction, cycleId: 9 } }),
    /never carry cycleId/
  );
  assert.throws(
    () => parsePersistentTransaction({ ...VALID_TRANSACTION, apocalypse_id: 'APOC-0001' }),
    /never carry apocalypse_id/
  );
  assert.throws(
    () => parsePersistentTransactionsResponse({ provisioned: true, transactions: [], cycleId: 'APOC-0001' }),
    /never carry cycleId/
  );
});

// --- Boundary validation ---------------------------------------------------------

test('malformed account payloads fail loudly at the boundary', () => {
  assert.throws(() => parsePersistentAccountResponse(null), /expected a JSON object/);
  assert.throws(() => parsePersistentAccountResponse({}), /provisioned must be a boolean/);
  assert.throws(
    () => parsePersistentAccountResponse({ provisioned: true, ...VALID_ACCOUNT, cash: '9990' }),
    /cash must be a finite number/
  );
  assert.throws(
    () => parsePersistentAccountResponse({ provisioned: true, ...VALID_ACCOUNT, holdings: {} }),
    /holdings must be an array/
  );
  assert.throws(
    () => parsePersistentAccount({ ...VALID_ACCOUNT, holdings: [{ ...VALID_HOLDING, quantity: '0.004' }] }),
    /quantity must be a finite number/
  );
});

test('malformed trade and transaction payloads fail loudly at the boundary', () => {
  assert.throws(() => parsePersistentTradeResult({ transaction: null, account: VALID_ACCOUNT }), /transaction must be an object/);
  assert.throws(
    () => parsePersistentTradeResult({ transaction: { ...VALID_TRADE_RESULT.transaction, type: 'HOLD' }, account: VALID_ACCOUNT }),
    /unknown transaction type/
  );
  assert.throws(
    () => parsePersistentTransactionsResponse({ provisioned: true, transactions: [{ ...VALID_TRANSACTION, type: 'AIRDROP' }] }),
    /unknown type/
  );
  assert.throws(
    () => parsePersistentTransaction({ ...VALID_TRANSACTION, createdAt: '' }),
    /createdAt must be a non-empty string/
  );
});

// --- Error envelopes ---------------------------------------------------------------

test('401 maps to SessionExpiredError on every endpoint', async () => {
  const restore = stubFetch(async () => jsonResponse({ msg: 'Token expired' }, 401));
  try {
    await assert.rejects(getPersistentAccount(TOKEN), SessionExpiredError);
    await assert.rejects(getPersistentTransactions(TOKEN), SessionExpiredError);
    await assert.rejects(buyPersistentTrade(TOKEN, { coinId: 1, quantity: 1 }), SessionExpiredError);
    await assert.rejects(sellPersistentTrade(TOKEN, { coinId: 1, quantity: 1 }), SessionExpiredError);
  } finally {
    restore();
  }
});

test('domain rejections surface the backend message and HTTP status verbatim', async () => {
  const restore = stubFetch(async () =>
    jsonResponse({ status: 'error', message: 'Insufficient persistent cash. You need £50.00 but have £10.00.' }, 400));
  try {
    await assert.rejects(
      buyPersistentTrade(TOKEN, { coinId: 1, quantity: 5 }),
      (err: unknown) => {
        assert.ok(err instanceof GameApiError);
        assert.equal((err as GameApiError).status, 400);
        assert.equal((err as GameApiError).message, 'Insufficient persistent cash. You need £50.00 but have £10.00.');
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('a non-JSON body is a malformed-response error, not a crash', async () => {
  const restore = stubFetch(async () => new Response('<html>oops</html>', { status: 200 }));
  try {
    await assert.rejects(getPersistentAccount(TOKEN), /malformed response/);
  } finally {
    restore();
  }
});

test('a network failure is a readable error, never a fabricated account', async () => {
  const restore = stubFetch(async () => { throw new TypeError('fetch failed'); });
  try {
    await assert.rejects(getPersistentAccount(TOKEN), /Network failure/);
  } finally {
    restore();
  }
});

// --- Stage 10B: persistent leaderboard -----------------------------------------

test('leaderboard read hits /persistent/leaderboard with no auth header and no body', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => { seen = args; return jsonResponse(envelope(VALID_LEADERBOARD)); });
  try {
    await getPersistentLeaderboard();
  } finally {
    restore();
  }
  assert.equal(seen?.url, `${API_BASE_URL}/persistent/leaderboard`);
  assert.equal(seen?.init?.method ?? 'GET', 'GET');
  const headers = seen?.init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, undefined);
  assert.equal(seen?.init?.body, undefined);
});

test('leaderboard parses humans, bots, personality, debt and negative net worth', async () => {
  const restore = stubFetch(async () => jsonResponse(envelope(VALID_LEADERBOARD)));
  try {
    const board = await getPersistentLeaderboard();
    assert.equal(board.worldId, 1);
    assert.equal(board.entries.length, 3);
    assert.equal(board.entries[0].username, 'player');
    assert.equal(board.entries[0].isBot, false);
    assert.equal(board.entries[1].isBot, true);
    assert.equal(board.entries[1].personality, 'conservative');
    assert.equal(board.entries[1].debt, 1000);
    assert.equal(board.entries[2].netWorth, -9900);
    assert.equal(board.entries[2].rank, 3);
  } finally {
    restore();
  }
});

test('leaderboard preserves backend order — out-of-order ranks are not re-sorted', () => {
  // Fixture deliberately lists rank 3 before rank 1 to prove the client
  // never re-orders by netWorth or rank.
  const outOfOrder = {
    worldId: 1,
    serverTime: '2026-09-04T17:00:00.000Z',
    entries: [
      { ...VALID_LEADERBOARD_ENTRY, rank: 3, accountId: 30, userId: 3, username: 'third', netWorth: 100 },
      { ...VALID_LEADERBOARD_ENTRY, rank: 1, accountId: 10, userId: 1, username: 'first', netWorth: 9999 },
      { ...VALID_LEADERBOARD_ENTRY, rank: 2, accountId: 20, userId: 2, username: 'second', netWorth: 5000 }
    ]
  };
  const board = parsePersistentLeaderboard(outOfOrder);
  assert.deepEqual(board.entries.map((e) => e.rank), [3, 1, 2]);
  assert.deepEqual(board.entries.map((e) => e.username), ['third', 'first', 'second']);
  assert.deepEqual(board.entries.map((e) => e.accountId), [30, 10, 20]);
});

test('empty board with worldId null is a first-class safe result', () => {
  const board = parsePersistentLeaderboard({
    worldId: null,
    serverTime: '2026-09-04T17:00:00.000Z',
    entries: []
  });
  assert.equal(board.worldId, null);
  assert.deepEqual(board.entries, []);
});

test('a leaked cycle identifier in a leaderboard payload fails loudly', () => {
  assert.throws(
    () => parsePersistentLeaderboard({ ...VALID_LEADERBOARD, cycleId: 'APOC-0001' }),
    /never carry cycleId/
  );
  assert.throws(
    () => parsePersistentLeaderboardEntry({ ...VALID_LEADERBOARD_ENTRY, apocalypseId: 'APOC-0001' }),
    /never carry apocalypseId/
  );
});

test('malformed leaderboard payloads fail loudly at the boundary', () => {
  assert.throws(() => parsePersistentLeaderboard(null), /expected a JSON object/);
  assert.throws(
    () => parsePersistentLeaderboard({ worldId: 1, serverTime: '2026-09-04T17:00:00.000Z', entries: {} }),
    /entries must be an array/
  );
  assert.throws(
    () => parsePersistentLeaderboardEntry({ ...VALID_LEADERBOARD_ENTRY, netWorth: 'rich' }),
    /netWorth must be a finite number/
  );
  assert.throws(
    () => parsePersistentLeaderboardEntry({ ...VALID_LEADERBOARD_ENTRY, isBot: 'yes' }),
    /isBot must be a boolean/
  );
  assert.throws(
    () => parsePersistentLeaderboard({ worldId: '1', serverTime: '2026-09-04T17:00:00.000Z', entries: [] }),
    /worldId must be null or a finite number/
  );
});

// --- Stage 11 signals parser and fetch tests ---------------------------------

const VALID_COIN = {
  coinId: 7,
  name: 'Zeta',
  symbol: 'ZTA',
  currentPrice: 42.5,
  dead: false,
  status: 'ALIVE',
  archetype: 'DEGEN',
  recentChangePct: -1.25,
  momentum: 'DOWN'
};

const VALID_SIGNALS = {
  serverTime: '2026-09-05T10:00:00.000Z',
  worldId: 3,
  director: { regime: 'volatile', intensity: 0.8 },
  coins: [VALID_COIN]
};

const NO_WORLD_SIGNALS = {
  serverTime: '2026-09-05T10:00:00.000Z',
  worldId: null,
  director: null,
  coins: []
};

test('parser accepts real contract and no-world response', () => {
  const s = parsePersistentMarketSignals(VALID_SIGNALS);
  assert.equal(s.serverTime, '2026-09-05T10:00:00.000Z');
  assert.equal(s.worldId, 3);
  assert.deepEqual(s.director, { regime: 'volatile', intensity: 0.8 });
  assert.equal(s.coins.length, 1);
  assert.equal(s.coins[0].coinId, 7);
  assert.equal(s.coins[0].status, 'ALIVE');
  assert.equal(s.coins[0].archetype, 'DEGEN');
  assert.equal(s.coins[0].momentum, 'DOWN');
  assert.equal(s.coins[0].currentPrice, 42.5);
  assert.equal(s.coins[0].dead, false);

  const nw = parsePersistentMarketSignals(NO_WORLD_SIGNALS);
  assert.equal(nw.worldId, null);
  assert.equal(nw.director, null);
  assert.deepEqual(nw.coins, []);
});

test('malformed status/archetype/momentum, dead/nonzero and dead/recent mismatch reject; unknown forbidden fields reject', () => {
  assert.throws(() => parsePersistentMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_COIN, status: 'ZOMBIE' }] }), /unknown status/);
  assert.throws(() => parsePersistentMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_COIN, archetype: 'FOO' }] }), /unknown archetype/);
  assert.throws(() => parsePersistentMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_COIN, momentum: 'SIDE' }] }), /unknown momentum/);
  // DEAD price nonzero
  assert.throws(() => parsePersistentMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_COIN, dead: true, status: 'DEAD', currentPrice: 10 }] }), /currentPrice exactly 0/);
  // dead must agree with the persisted status in both directions
  assert.throws(() => parsePersistentMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_COIN, dead: true, status: 'ALIVE' }] }), /dead.*status|status.*dead/i);
  assert.throws(() => parsePersistentMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_COIN, dead: false, status: 'DEAD', currentPrice: 0, recentChangePct: null, momentum: 'FLAT' }] }), /dead.*status|status.*dead/i);
  // DEAD recent nonzero
  assert.throws(() => parsePersistentMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_COIN, dead: true, status: 'DEAD', currentPrice: 0, recentChangePct: 5 }] }), /recentChangePct null/);
  // DEAD momentum not FLAT (also set recent null to reach the check)
  assert.throws(() => parsePersistentMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_COIN, dead: true, status: 'DEAD', currentPrice: 0, recentChangePct: null, momentum: 'UP' }] }), /momentum FLAT/);
  // unknown field
  assert.throws(() => parsePersistentMarketSignals({ ...VALID_SIGNALS, foo: 1 }), /unknown field foo/);
  assert.throws(() => parsePersistentMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_COIN, cycleId: 'x' }] }), /unknown field|never carry/);
  assert.throws(() => parsePersistentMarketSignals({ ...VALID_SIGNALS, director: { regime: 'x', intensity: 1, secret: 9 } }), /unknown field director.secret/);
});

test('getPersistentSignals calls exactly /persistent/signals (public, no token)', async () => {
  let calledUrl = '';
  const restore = stubFetch(async (args: {url?: string}) => {
    calledUrl = (args && args.url) || String(args);
    return jsonResponse(envelope(VALID_SIGNALS));
  });
  try {
    const res = await getPersistentSignals();
    assert.ok(calledUrl.includes('/persistent/signals'), `got ${calledUrl}`);
    assert.equal(res.coins[0].symbol, 'ZTA');
  } finally {
    restore();
  }
});
