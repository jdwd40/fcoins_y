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
  getPersistentTransactions,
  parsePersistentAccount,
  parsePersistentAccountResponse,
  parsePersistentTradeResult,
  parsePersistentTransaction,
  parsePersistentTransactionsResponse,
  sellPersistentTrade
} from './persistentService.ts';
import type { PersistentAccount, PersistentTransaction } from './persistentService.ts';
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
