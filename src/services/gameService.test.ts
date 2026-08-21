// REST client contract tests for gameService. No UI rendering assertions —
// the fetch contract only. Runs under plain Node (node --test); fetch is
// stubbed on globalThis.
import test from 'node:test';
import assert from 'node:assert/strict';

import { API_BASE_URL, resolveApiBaseUrl } from './apiConfig.ts';
import {
  GameApiError,
  getGameState,
  parseGameState,
  joinGame,
  buyGameTrade,
  sellGameTrade,
  getLiveLeaderboard,
  getCycleResults,
  getRecentLeaderboards,
  parseLiveLeaderboard,
  parseCycleResults,
  parseRecentLeaderboards,
  isSettlementBusyError
} from './gameService.ts';
import type { GameState, RoundParticipant, LiveLeaderboard, CycleResults } from './gameService.ts';
import { SessionExpiredError } from './transactionService.ts';

const VALID_STATE: GameState = {
  apocalypseId: 'APOC-0001',
  status: 'ACTIVE',
  startTime: '2026-08-20T10:00:00.000Z',
  endTime: '2026-08-20T10:30:00.000Z',
  durationMs: 1_800_000,
  remainingMs: 900_000,
  apocalypsePercent: 50,
  serverTime: '2026-08-20T10:15:00.000Z'
};

const VALID_PARTICIPANT: RoundParticipant = {
  participantId: 7,
  cycleId: 1,
  apocalypseId: 'APOC-0001',
  userId: 1,
  isBot: false,
  joinedAt: '2026-08-20T10:01:00.000Z',
  startingCash: 1000,
  currentCash: 1000,
  holdingsValue: 0,
  wealth: 1000,
  peakWealth: 1000,
  status: 'ACTIVE',
  finalCash: null,
  holdings: []
};

const VALID_BOARD: LiveLeaderboard = {
  cycleId: 'APOC-0001',
  status: 'ACTIVE',
  startTime: '2026-08-20T10:00:00.000Z',
  endTime: '2026-08-20T10:30:00.000Z',
  apocalypsePercent: 42.5,
  remainingMs: 1_035_000,
  serverTime: '2026-08-20T10:12:45.000Z',
  entries: [
    {
      rank: 1, participantId: 11, userId: 501, username: 'cool_conservative_bot',
      isBot: true, personality: 'conservative', joinedAt: '2026-08-20T10:00:05.000Z',
      currentCash: 1000, currentWealth: 1000, peakWealth: 1000
    },
    {
      rank: 2, participantId: 7, userId: 1, username: 'john_doe',
      isBot: false, personality: null, joinedAt: '2026-08-20T10:01:00.000Z',
      currentCash: 750.5, currentWealth: 990.25, peakWealth: 1010
    }
  ]
};

const VALID_RESULTS: CycleResults = {
  cycleId: 'APOC-0001',
  status: 'COMPLETED',
  startTime: '2026-08-20T10:00:00.000Z',
  endTime: '2026-08-20T10:30:00.000Z',
  settledAt: '2026-08-20T10:30:00.500Z',
  resultCount: 2,
  results: [
    {
      rank: 1, participantId: 11, cycleId: 'APOC-0001', userId: 501,
      username: 'cool_conservative_bot', isBot: true, personality: 'conservative',
      finalCash: 1000, peakWealth: 1000, startingCash: 1000, netProfit: 0,
      joinedAt: '2026-08-20T10:00:05.000Z', tradeCount: 0, buyCount: 0, sellCount: 0,
      settledAt: '2026-08-20T10:30:00.500Z'
    },
    {
      rank: 2, participantId: 7, cycleId: 'APOC-0001', userId: 1,
      username: 'john_doe', isBot: false, personality: null,
      finalCash: 750.5, peakWealth: 1010, startingCash: 1000, netProfit: -249.5,
      joinedAt: '2026-08-20T10:01:00.000Z', tradeCount: 1, buyCount: 1, sellCount: 0,
      settledAt: '2026-08-20T10:30:00.500Z'
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

test('constructs the correct /game/state URL from the API base', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => { seen = args; return jsonResponse(VALID_STATE); });
  try {
    await getGameState();
  } finally {
    restore();
  }
  assert.equal(seen?.url, `${API_BASE_URL}/game/state`);
  assert.equal(seen?.url, 'https://jdwd40.com/api-2/api/game/state'); // default base
  assert.equal(seen?.init?.method, 'GET');
});

test('VITE_API_BASE_URL behavior: blank/absent falls back, configured is trimmed', () => {
  assert.equal(resolveApiBaseUrl(undefined), 'https://jdwd40.com/api-2/api');
  assert.equal(resolveApiBaseUrl(''), 'https://jdwd40.com/api-2/api');
  assert.equal(resolveApiBaseUrl('   '), 'https://jdwd40.com/api-2/api');
  assert.equal(resolveApiBaseUrl('http://localhost:3000/api'), 'http://localhost:3000/api');
  assert.equal(resolveApiBaseUrl('  http://localhost:3000/api/  '), 'http://localhost:3000/api');
  assert.equal(resolveApiBaseUrl('http://localhost:3000/api///'), 'http://localhost:3000/api');
});

test('returns the camelCase contract on a successful response', async () => {
  const restore = stubFetch(async () => jsonResponse(VALID_STATE));
  try {
    const state = await getGameState();
    assert.deepEqual(state, VALID_STATE);
    // camelCase keys exactly; no snake_case leakage. Milestone 1: no seed —
    // the cycle seed is internal-only on the backend (it determines future
    // collapses and bot moves) and is never part of the parsed contract.
    assert.deepEqual(Object.keys(state).sort(), [
      'apocalypseId', 'apocalypsePercent', 'durationMs', 'endTime',
      'remainingMs', 'serverTime', 'startTime', 'status'
    ]);
  } finally {
    restore();
  }
});

test('a legacy/non-conforming payload carrying a seed has it stripped at the boundary', async () => {
  const restore = stubFetch(async () =>
    jsonResponse({ ...VALID_STATE, seed: '3cf1c63ae4d5b38047e9028d88f7500b' })
  );
  try {
    const state = await getGameState();
    assert.equal('seed' in state, false);
    assert.deepEqual(state, VALID_STATE);
  } finally {
    restore();
  }
});

test('accepts the Core 6 lifecycle statuses on game state', () => {
  assert.equal(parseGameState({ ...VALID_STATE, status: 'SETTLING' }).status, 'SETTLING');
  assert.equal(parseGameState({ ...VALID_STATE, status: 'COMPLETED' }).status, 'COMPLETED');
});

test('rejects on non-2xx responses with the backend message surfaced', async () => {
  for (const status of [400, 404, 500, 503]) {
    const restore = stubFetch(async () => jsonResponse({ msg: 'nope' }, status));
    try {
      await assert.rejects(
        () => getGameState(),
        (err: unknown) => {
          assert.ok(err instanceof GameApiError);
          assert.equal((err as GameApiError).status, status);
          assert.equal(err.message, 'nope');
          return true;
        }
      );
    } finally {
      restore();
    }
  }
});

test('401 maps to SessionExpiredError on any endpoint', async () => {
  const restore = stubFetch(async () => jsonResponse({ msg: 'Token expired' }, 401));
  try {
    await assert.rejects(() => getGameState(), (err: unknown) => err instanceof SessionExpiredError);
  } finally {
    restore();
  }
});

test('rejects when the 200 body is not valid JSON', async () => {
  const restore = stubFetch(async () => new Response('<html>oops</html>', { status: 200 }));
  try {
    await assert.rejects(() => getGameState(), /malformed/);
  } finally {
    restore();
  }
});

test('rejects malformed/invalid contract payloads', () => {
  assert.throws(() => parseGameState(null), /expected a JSON object/);
  assert.throws(() => parseGameState('ACTIVE'), /expected a JSON object/);
  // snake_case legacy shape is not the contract.
  assert.throws(() => parseGameState({ apocalypse_id: 'APOC-0001' }), /apocalypseId/);
  assert.throws(() => parseGameState({ ...VALID_STATE, remainingMs: '900000' }), /remainingMs/);
  assert.throws(() => parseGameState({ ...VALID_STATE, apocalypsePercent: Number.NaN }), /apocalypsePercent/);
  assert.throws(() => parseGameState({ ...VALID_STATE, status: 'PAUSED' }), /unknown status/);
  // Milestone 1: no seed is required — and none is retained — in the parsed
  // contract.
  const parsed = parseGameState(VALID_STATE);
  assert.equal('seed' in parsed, false);
});

test('forwards AbortSignal to fetch and propagates cancellation', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => {
    seen = args;
    const signal = args.init?.signal;
    if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    return jsonResponse(VALID_STATE);
  });
  try {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => getGameState(controller.signal), /abort/i);
    assert.equal(seen?.init?.signal, controller.signal);
  } finally {
    restore();
  }
});

test('a fetch-level abort during flight rejects the call', async () => {
  const restore = stubFetch(async (args) => new Promise<Response>((_resolve, reject) => {
    args.init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    });
  }));
  try {
    const controller = new AbortController();
    const pending = getGameState(controller.signal);
    controller.abort();
    await assert.rejects(() => pending, /abort/i);
  } finally {
    restore();
  }
});

test('a network failure rejects with a clear connection error', async () => {
  const restore = stubFetch(async () => { throw new TypeError('fetch failed'); });
  try {
    await assert.rejects(() => getGameState(), /Network failure/);
  } finally {
    restore();
  }
});

// --- Core 4: join ---------------------------------------------------------

test('joinGame posts to /game/join with the bearer token and parses £1,000 participant state', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => {
    seen = args;
    return jsonResponse({ status: 'success', data: { participant: VALID_PARTICIPANT } });
  });
  try {
    const participant = await joinGame('token-abc');
    assert.equal(seen?.url, `${API_BASE_URL}/game/join`);
    assert.equal(seen?.init?.method, 'POST');
    assert.equal((seen?.init?.headers as Record<string, string>).Authorization, 'Bearer token-abc');
    assert.equal(participant.startingCash, 1000);
    assert.equal(participant.currentCash, 1000);
    assert.equal(participant.apocalypseId, 'APOC-0001');
  } finally {
    restore();
  }
});

test('repeated joinGame calls return the same participant (server idempotency contract)', async () => {
  let calls = 0;
  const restore = stubFetch(async () => {
    calls += 1;
    return jsonResponse({ status: 'success', data: { participant: VALID_PARTICIPANT } });
  });
  try {
    const first = await joinGame('token-abc');
    const second = await joinGame('token-abc');
    assert.equal(calls, 2);
    assert.equal(first.participantId, second.participantId);
    assert.equal(second.startingCash, 1000); // never another £1,000
  } finally {
    restore();
  }
});

// --- Core 4: round trades --------------------------------------------------

const TRADE_RESULT = {
  transaction: { roundTransactionId: 3, type: 'BUY', coinId: 2, quantity: 5, price: 10, totalAmount: 50 },
  participant: { ...VALID_PARTICIPANT, currentCash: 950, wealth: 1000, holdingsValue: 50 },
  peakWealth: 1000
};

for (const [side, fn, path] of [
  ['buy', buyGameTrade, '/game/trades/buy'],
  ['sell', sellGameTrade, '/game/trades/sell']
] as const) {
  test(`${side} posts cycleId + coin_id + amount and returns refreshed participant state`, async () => {
    let seen: FetchArgs | undefined;
    const restore = stubFetch(async (args) => {
      seen = args;
      return jsonResponse({ status: 'success', message: `Round ${side} completed successfully`, data: TRADE_RESULT }, 201);
    });
    try {
      const result = await fn('token-abc', { cycleId: 'APOC-0001', coinId: 2, amount: 5 });
      assert.equal(seen?.url, `${API_BASE_URL}${path}`);
      assert.deepEqual(JSON.parse(String(seen?.init?.body)), { cycleId: 'APOC-0001', coin_id: 2, amount: 5 });
      assert.equal((seen?.init?.headers as Record<string, string>).Authorization, 'Bearer token-abc');
      assert.equal(result.participant.currentCash, 950);
      assert.equal(result.transaction.coinId, 2);
    } finally {
      restore();
    }
  });
}

test('a stale-cycle 409 rejection carries the backend message and status', async () => {
  const restore = stubFetch(async () =>
    jsonResponse({ status: 'error', message: 'Apocalypse cycle APOC-0001 is no longer active. Fetch GET /api/game/state for the current round.' }, 409)
  );
  try {
    await assert.rejects(
      () => buyGameTrade('token-abc', { cycleId: 'APOC-0001', coinId: 2, amount: 5 }),
      (err: unknown) => {
        assert.ok(err instanceof GameApiError);
        assert.equal(err.status, 409);
        assert.match(err.message, /no longer active/);
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('a collapsed-coin 400 rejection carries the backend message', async () => {
  const restore = stubFetch(async () =>
    jsonResponse({ status: 'error', message: 'Coin DOGE has collapsed to £0 in this apocalypse cycle and cannot be purchased.' }, 400)
  );
  try {
    await assert.rejects(
      () => buyGameTrade('token-abc', { cycleId: 'APOC-0001', coinId: 2, amount: 5 }),
      /collapsed to £0/
    );
  } finally {
    restore();
  }
});

test('an expired session maps 401 to SessionExpiredError', async () => {
  const restore = stubFetch(async () => jsonResponse({ msg: 'Token expired' }, 401));
  try {
    await assert.rejects(() => joinGame('dead-token'), (err: unknown) => {
      assert.ok(err instanceof SessionExpiredError);
      return true;
    });
  } finally {
    restore();
  }
});

// --- Core 6: leaderboard ----------------------------------------------------

test('getLiveLeaderboard parses humans and bots together, bot at rank 1 included', async () => {
  const restore = stubFetch(async () => jsonResponse({ status: 'success', data: VALID_BOARD }));
  try {
    const board = await getLiveLeaderboard();
    assert.equal(board.cycleId, 'APOC-0001');
    assert.equal(board.entries[0].rank, 1);
    assert.equal(board.entries[0].isBot, true);
    assert.equal(board.entries[0].personality, 'conservative');
    assert.equal(board.entries[1].isBot, false);
    assert.equal(board.entries[1].personality, null);
  } finally {
    restore();
  }
});

test('the deliberate settlement 409 is recognised as a lifecycle state', async () => {
  const restore = stubFetch(async () =>
    jsonResponse({ status: 'error', message: 'No live apocalypse cycle is currently available: the previous round is still settling.' }, 409)
  );
  try {
    await assert.rejects(
      () => getLiveLeaderboard(),
      (err: unknown) => {
        assert.ok(isSettlementBusyError(err));
        assert.ok(err instanceof GameApiError && /still settling/.test(err.message));
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('leaderboard parser rejects malformed entries', () => {
  assert.throws(() => parseLiveLeaderboard(null), /JSON object/);
  assert.throws(() => parseLiveLeaderboard({ ...VALID_BOARD, entries: 'nope' }), /entries/);
  assert.throws(
    () => parseLiveLeaderboard({ ...VALID_BOARD, entries: [{ ...VALID_BOARD.entries[0], currentWealth: 'rich' }] }),
    /currentWealth/
  );
  assert.throws(
    () => parseLiveLeaderboard({ ...VALID_BOARD, entries: [{ ...VALID_BOARD.entries[0], isBot: 'yes' }] }),
    /isBot/
  );
});

// --- Core 6: results ---------------------------------------------------------

test('getCycleResults fetches the immutable snapshot for a completed cycle', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => { seen = args; return jsonResponse({ status: 'success', data: VALID_RESULTS }); });
  try {
    const results = await getCycleResults('APOC-0001');
    assert.equal(seen?.url, `${API_BASE_URL}/game/results/APOC-0001`);
    assert.equal(results.status, 'COMPLETED');
    assert.equal(results.resultCount, 2);
    assert.equal(results.results[0].rank, 1);
    assert.equal(results.results[0].isBot, true); // a bot may genuinely win
    assert.equal(results.results[1].netProfit, -249.5);
    assert.equal(results.results[1].tradeCount, 1);
  } finally {
    restore();
  }
});

test('results for a non-completed cycle reject with the 409 contract', async () => {
  const restore = stubFetch(async () =>
    jsonResponse({ status: 'error', message: 'Apocalypse cycle APOC-0002 is ACTIVE, not COMPLETED.' }, 409)
  );
  try {
    await assert.rejects(() => getCycleResults('APOC-0002'), /not COMPLETED/);
  } finally {
    restore();
  }
});

test('unknown results cycle rejects with 404', async () => {
  const restore = stubFetch(async () =>
    jsonResponse({ status: 'error', message: 'Unknown apocalypse cycle APOC-9999.' }, 404)
  );
  try {
    await assert.rejects(() => getCycleResults('APOC-9999'), (err: unknown) => {
      assert.ok(err instanceof GameApiError && err.status === 404);
      return true;
    });
  } finally {
    restore();
  }
});

test('cycle results parser rejects non-COMPLETED payloads and bad rows', () => {
  assert.throws(() => parseCycleResults({ ...VALID_RESULTS, status: 'ACTIVE' }), /COMPLETED/);
  assert.throws(() => parseCycleResults(null), /JSON object/);
  assert.throws(
    () => parseCycleResults({ ...VALID_RESULTS, results: [{ ...VALID_RESULTS.results[0], netProfit: 'up' }] }),
    /netProfit/
  );
});

// --- Core 6: recent leaderboards ----------------------------------------------

test('getRecentLeaderboards passes a bounded limit and parses the list', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => {
    seen = args;
    return jsonResponse({ status: 'success', data: { limit: 5, count: 1, leaderboards: [VALID_RESULTS] } });
  });
  try {
    const recent = await getRecentLeaderboards(5);
    assert.equal(seen?.url, `${API_BASE_URL}/game/leaderboards/recent?limit=5`);
    assert.equal(recent.count, 1);
    assert.equal(recent.leaderboards[0].cycleId, 'APOC-0001');
  } finally {
    restore();
  }
});

test('recent leaderboards parser rejects malformed payloads', () => {
  assert.throws(() => parseRecentLeaderboards({}), /limit/);
  assert.throws(() => parseRecentLeaderboards({ limit: 5, count: 0, leaderboards: {} }), /leaderboards/);
});
