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
  getMyRoundEconomy,
  getMarketSignals,
  parseLiveLeaderboard,
  parseCycleResults,
  parseMarketSignals,
  parseRecentLeaderboards,
  parseCashEvent,
  parsePlayerRoundEconomy,
  parseRoundParticipant,
  isSettlementBusyError
} from './gameService.ts';
import type { GameState, PowerState, RoundHolding, RoundParticipant, LiveLeaderboard, CycleResults } from './gameService.ts';
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

const VALID_POWER: PowerState = {
  current: 87,
  max: 100,
  regenMsPerPoint: 30000,
  secondsPerPoint: 30,
  nextPointAt: '2026-08-20T10:15:12.000Z',
  storedPower: 86,
  powerUpdatedAt: '2026-08-20T10:14:42.000Z',
  asOf: '2026-08-20T10:15:00.000Z'
};

const VALID_HOLDING: RoundHolding = {
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

const VALID_PARTICIPANT: RoundParticipant = {
  participantId: 7,
  cycleId: 1,
  apocalypseId: 'APOC-0001',
  userId: 1,
  isBot: false,
  joinedAt: '2026-08-20T10:01:00.000Z',
  startingCash: 10000,
  currentCash: 10000,
  holdingsValue: 0,
  wealth: 10000,
  peakWealth: 10000,
  status: 'ACTIVE',
  finalCash: null,
  power: VALID_POWER,
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
      currentCash: 10000, currentWealth: 10000, peakWealth: 10000
    },
    {
      rank: 2, participantId: 7, userId: 1, username: 'john_doe',
      isBot: false, personality: null, joinedAt: '2026-08-20T10:01:00.000Z',
      currentCash: 9750.5, currentWealth: 9990.25, peakWealth: 10010
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
      finalCash: 10500, peakWealth: 11000, startingCash: 10000, netProfit: 500,
      leaderboardEligible: true, // backend #19: finalCash > startingCash
      joinedAt: '2026-08-20T10:00:05.000Z', tradeCount: 2, buyCount: 1, sellCount: 1,
      settledAt: '2026-08-20T10:30:00.500Z'
    },
    {
      rank: 2, participantId: 7, cycleId: 'APOC-0001', userId: 1,
      username: 'john_doe', isBot: false, personality: null,
      finalCash: 9750.5, peakWealth: 10010, startingCash: 10000, netProfit: -249.5,
      leaderboardEligible: false, // a losing finish is recorded, not ranked on the board
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

test('clamps out-of-range timing fields to the documented contract at the boundary', () => {
  // remainingMs is documented as clamped >= 0: a server that has just rolled
  // past endTime can never push the countdown negative.
  assert.equal(parseGameState({ ...VALID_STATE, remainingMs: -5_000 }).remainingMs, 0);
  // apocalypsePercent is documented as clamped to 0..100: a transient
  // out-of-range value can never blow the meter width / aria-valuenow.
  assert.equal(parseGameState({ ...VALID_STATE, apocalypsePercent: 104.7 }).apocalypsePercent, 100);
  assert.equal(parseGameState({ ...VALID_STATE, apocalypsePercent: -1 }).apocalypsePercent, 0);
  // In-range values pass through untouched.
  const inRange = parseGameState(VALID_STATE);
  assert.equal(inRange.remainingMs, VALID_STATE.remainingMs);
  assert.equal(inRange.apocalypsePercent, VALID_STATE.apocalypsePercent);
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

// --- Core 4: participation ensure (no player-facing join, issue #10) -----------

test('joinGame posts to /game/join with the bearer token and parses £10,000 participant state', async () => {
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
    assert.equal(participant.startingCash, 10000);
    assert.equal(participant.currentCash, 10000);
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
    assert.equal(second.startingCash, 10000); // never another £10,000
  } finally {
    restore();
  }
});

// --- Core 4: round trades --------------------------------------------------

const TRADE_RESULT = {
  transaction: { roundTransactionId: 3, type: 'BUY', coinId: 2, quantity: 5, price: 10, totalAmount: 50 },
  participant: { ...VALID_PARTICIPANT, currentCash: 9950, wealth: 10000, holdingsValue: 50 },
  peakWealth: 10000
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
      assert.equal(result.participant.currentCash, 9950);
      assert.equal(result.transaction.coinId, 2);
    } finally {
      restore();
    }
  });
}

test('fractional round trades send the exact decimal quantity — never integer-truncated or rounded', async () => {
  const FRACTIONAL_RESULT = {
    transaction: { roundTransactionId: 4, type: 'BUY', coinId: 2, quantity: 0.004, price: 2500, totalAmount: 10 },
    participant: {
      ...VALID_PARTICIPANT,
      currentCash: 9990,
      holdingsValue: 10,
      wealth: 10000,
      holdings: [{ ...VALID_HOLDING }]
    },
    peakWealth: 10000
  };
  for (const [side, fn, path] of [
    ['buy', buyGameTrade, '/game/trades/buy'],
    ['sell', sellGameTrade, '/game/trades/sell']
  ] as const) {
    let seen: FetchArgs | undefined;
    const restore = stubFetch(async (args) => {
      seen = args;
      return jsonResponse({ status: 'success', message: `Round ${side} completed successfully`, data: FRACTIONAL_RESULT }, 201);
    });
    try {
      const result = await fn('token-abc', { cycleId: 'APOC-0001', coinId: 2, amount: 0.004 });
      assert.equal(seen?.url, `${API_BASE_URL}${path}`);
      // The wire body carries the exact fractional quantity: 0.004, not 0 or 1.
      assert.deepEqual(JSON.parse(String(seen?.init?.body)), { cycleId: 'APOC-0001', coin_id: 2, amount: 0.004 });
      // The fractional response parses without precision loss.
      assert.equal(result.transaction.quantity, 0.004);
      assert.equal(result.transaction.totalAmount, 10);
      assert.equal(result.participant.holdings[0].quantity, 0.004);
    } finally {
      restore();
    }
  }
});

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
    // Backend #19: every row carries its explicit eligibility — the client
    // never reverse-engineers the profitable-only rule from amounts.
    assert.equal(results.results[0].leaderboardEligible, true);
    assert.equal(results.results[1].leaderboardEligible, false);
  } finally {
    restore();
  }
});

test('an exactly-break-even £10,000 finish parses as NOT leaderboard-eligible', async () => {
  const breakEven = {
    ...VALID_RESULTS,
    resultCount: 1,
    results: [{
      ...VALID_RESULTS.results[0],
      rank: 1, finalCash: 10000, netProfit: 0, leaderboardEligible: false
    }]
  };
  const restore = stubFetch(async () => jsonResponse({ status: 'success', data: breakEven }));
  try {
    const results = await getCycleResults('APOC-0001');
    assert.equal(results.results[0].finalCash, 10000);
    assert.equal(results.results[0].leaderboardEligible, false); // £10,000 exactly never qualifies
    assert.equal(results.results.filter((row) => row.leaderboardEligible).length, 0); // legit empty board
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
  // Backend #19 contract: the eligibility flag is REQUIRED on every row — a
  // payload without it (or a non-boolean one) fails loudly at the boundary.
  const missingFlag = { ...VALID_RESULTS.results[0] } as Record<string, unknown>;
  delete missingFlag.leaderboardEligible;
  assert.throws(() => parseCycleResults({ ...VALID_RESULTS, results: [missingFlag] }), /leaderboardEligible/);
  assert.throws(
    () => parseCycleResults({ ...VALID_RESULTS, results: [{ ...VALID_RESULTS.results[0], leaderboardEligible: 'yes' }] }),
    /leaderboardEligible/
  );
});

// --- Core 6: recent leaderboards ----------------------------------------------

test('getRecentLeaderboards passes a bounded limit and parses the list', async () => {
  let seen: FetchArgs | undefined;
  // Backend #19: boards carry only qualifying rows (gapless re-rank) plus
  // totalResultCount — everyone who finished, including non-qualifiers.
  const QUALIFIED_BOARD = {
    ...VALID_RESULTS,
    resultCount: 1,
    totalResultCount: 2,
    results: [VALID_RESULTS.results[0]]
  };
  const restore = stubFetch(async (args) => {
    seen = args;
    return jsonResponse({ status: 'success', data: { limit: 5, count: 1, leaderboards: [QUALIFIED_BOARD] } });
  });
  try {
    const recent = await getRecentLeaderboards(5);
    assert.equal(seen?.url, `${API_BASE_URL}/game/leaderboards/recent?limit=5`);
    assert.equal(recent.count, 1);
    assert.equal(recent.leaderboards[0].cycleId, 'APOC-0001');
    assert.equal(recent.leaderboards[0].resultCount, 1);
    assert.equal(recent.leaderboards[0].totalResultCount, 2);
    assert.equal(recent.leaderboards[0].results[0].leaderboardEligible, true);
  } finally {
    restore();
  }
});

test('a completed apocalypse with zero qualifiers parses as a legitimate empty leaderboard', async () => {
  const EMPTY_BOARD = { ...VALID_RESULTS, resultCount: 0, totalResultCount: 2, results: [] };
  const restore = stubFetch(async () =>
    jsonResponse({ status: 'success', data: { limit: 5, count: 1, leaderboards: [EMPTY_BOARD] } })
  );
  try {
    const recent = await getRecentLeaderboards(5);
    assert.equal(recent.leaderboards[0].resultCount, 0);
    assert.equal(recent.leaderboards[0].totalResultCount, 2);
    assert.deepEqual(recent.leaderboards[0].results, []); // not an error
  } finally {
    restore();
  }
});

test('recent leaderboards parser rejects malformed payloads', () => {
  assert.throws(() => parseRecentLeaderboards({}), /limit/);
  assert.throws(() => parseRecentLeaderboards({ limit: 5, count: 0, leaderboards: {} }), /leaderboards/);
  // totalResultCount is optional (absent from the per-cycle results
  // endpoint) but must be a finite number when present.
  assert.throws(
    () => parseRecentLeaderboards({ limit: 5, count: 1, leaderboards: [{ ...VALID_RESULTS, totalResultCount: 'two' }] }),
    /totalResultCount/
  );
});

// --- Backend #18 / fcoins_y #11: player round economy (Cash + cash events) ----

const VALID_CASH_EVENTS = [
  {
    cashEventId: 42, type: 'FEE', amount: 2.5,
    balanceBefore: 10000, balanceAfter: 9997.5,
    description: 'Market upkeep fee', eventKey: 'fee:tick:12',
    createdAt: '2026-08-20T10:12:00.000Z'
  },
  {
    cashEventId: 41, type: 'TAX', amount: 5,
    balanceBefore: 10005, balanceAfter: 10000,
    description: 'Idle wealth tax', eventKey: 'tax:tick:4',
    createdAt: '2026-08-20T10:08:00.000Z'
  },
  {
    cashEventId: 40, type: 'EVENT', amount: 25,
    balanceBefore: 10030, balanceAfter: 10005,
    description: 'Exchange hack hits every balance', eventKey: 'event:3',
    createdAt: '2026-08-20T10:05:00.000Z'
  }
] as const;

test('getMyRoundEconomy fetches /game/participant with the bearer token + limit and parses participant + cash events', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => {
    seen = args;
    return jsonResponse({ status: 'success', data: { participant: VALID_PARTICIPANT, cashEvents: VALID_CASH_EVENTS } });
  });
  try {
    const economy = await getMyRoundEconomy('token-abc', { limit: 20 });
    assert.equal(seen?.url, `${API_BASE_URL}/game/participant?limit=20`);
    assert.equal(seen?.init?.method, 'GET');
    assert.equal((seen?.init?.headers as Record<string, string>).Authorization, 'Bearer token-abc');
    // Authoritative participant comes through untouched.
    assert.equal(economy.participant.participantId, VALID_PARTICIPANT.participantId);
    assert.equal(economy.participant.currentCash, 10000);
    // All three drain sources parse with their full ledger shape.
    assert.deepEqual(economy.cashEvents.map((event) => event.type), ['FEE', 'TAX', 'EVENT']);
    assert.equal(economy.cashEvents[0].amount, 2.5);
    assert.equal(economy.cashEvents[0].balanceAfter, 9997.5);
    assert.equal(economy.cashEvents[0].description, 'Market upkeep fee');
    assert.equal(economy.cashEvents[2].createdAt, '2026-08-20T10:05:00.000Z');
  } finally {
    restore();
  }
});

test('getMyRoundEconomy without a limit sends no query string (server default applies)', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => {
    seen = args;
    return jsonResponse({ status: 'success', data: { participant: VALID_PARTICIPANT, cashEvents: [] } });
  });
  try {
    const economy = await getMyRoundEconomy('token-abc');
    assert.equal(seen?.url, `${API_BASE_URL}/game/participant`);
    assert.deepEqual(economy.cashEvents, []); // empty feed is legitimate, not an error
  } finally {
    restore();
  }
});

test('an offline-return economy payload parses: lower authoritative Cash plus the historical debits that explain it', async () => {
  // The browser was closed while the server drained Cash from 10,000 to
  // 8,432.10. On return ONE response carries both the authoritative figure
  // and the executed FEE/TAX/EVENT rows explaining the loss.
  const drainedParticipant = { ...VALID_PARTICIPANT, currentCash: 8432.1, wealth: 8432.1 };
  const drains = [
    { cashEventId: 91, type: 'FEE', amount: 500, balanceBefore: 10000, balanceAfter: 9500, description: 'Market upkeep fee', eventKey: 'fee:tick:1', createdAt: '2026-08-20T09:00:00.000Z' },
    { cashEventId: 92, type: 'TAX', amount: 1000, balanceBefore: 9500, balanceAfter: 8500, description: 'Idle wealth tax', eventKey: 'tax:tick:1', createdAt: '2026-08-20T09:30:00.000Z' },
    { cashEventId: 93, type: 'EVENT', amount: 67.9, balanceBefore: 8500, balanceAfter: 8432.1, description: 'Liquidity crisis', eventKey: 'event:9', createdAt: '2026-08-20T09:45:00.000Z' }
  ];
  const restore = stubFetch(async () =>
    jsonResponse({ status: 'success', data: { participant: drainedParticipant, cashEvents: drains } })
  );
  try {
    const economy = await getMyRoundEconomy('token-abc');
    assert.equal(economy.participant.currentCash, 8432.1); // server truth, not a feed sum
    assert.equal(economy.cashEvents.length, 3);
    assert.equal(economy.cashEvents[2].balanceAfter, 8432.1); // ledger explains the landing figure
  } finally {
    restore();
  }
});

test('cash event parser rejects non-ledger types, malformed rows and snake_case payloads', () => {
  assert.throws(() => parseCashEvent(null), /JSON object/);
  // Only executed FEE/TAX/EVENT rows exist; anything else fails loudly.
  assert.throws(() => parseCashEvent({ ...VALID_CASH_EVENTS[0], type: 'ADJUSTMENT' }), /unknown type/);
  assert.throws(() => parseCashEvent({ ...VALID_CASH_EVENTS[0], type: 'BUY' }), /unknown type/);
  assert.throws(() => parseCashEvent({ ...VALID_CASH_EVENTS[0], amount: '2.50' }), /amount/);
  assert.throws(() => parseCashEvent({ ...VALID_CASH_EVENTS[0], balanceAfter: Number.NaN }), /balanceAfter/);
  assert.throws(() => parseCashEvent({ ...VALID_CASH_EVENTS[0], description: '' }), /description/);
  assert.throws(() => parseCashEvent({ ...VALID_CASH_EVENTS[0], createdAt: 12345 }), /createdAt/);
  // snake_case legacy shape is not the contract.
  assert.throws(() => parseCashEvent({ cash_event_id: 1, type: 'FEE' }), /cashEventId/);
});

test('player round economy parser rejects malformed envelopes', () => {
  assert.throws(() => parsePlayerRoundEconomy(null), /JSON object/);
  assert.throws(
    () => parsePlayerRoundEconomy({ participant: VALID_PARTICIPANT, cashEvents: 'nope' }),
    /cashEvents/
  );
  assert.throws(
    () => parsePlayerRoundEconomy({ participant: { participantId: 7 }, cashEvents: [] }),
    /participant/
  );
  // A single bad row fails the whole read — no partial feed.
  assert.throws(
    () => parsePlayerRoundEconomy({ participant: VALID_PARTICIPANT, cashEvents: [{ cashEventId: 1 }] }),
    /cash event/
  );
});

test('an invalid-limit 400 carries the backend message verbatim', async () => {
  const restore = stubFetch(async () =>
    jsonResponse({ status: 'error', message: 'Invalid limit. Please provide an integer between 1 and 100.' }, 400)
  );
  try {
    await assert.rejects(
      () => getMyRoundEconomy('token-abc', { limit: 500 }),
      (err: unknown) => {
        assert.ok(err instanceof GameApiError);
        assert.equal(err.status, 400);
        assert.match(err.message, /Invalid limit/);
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('an expired session on the economy endpoint maps 401 to SessionExpiredError', async () => {
  const restore = stubFetch(async () => jsonResponse({ msg: 'Token expired' }, 401));
  try {
    await assert.rejects(
      () => getMyRoundEconomy('dead-token'),
      (err: unknown) => err instanceof SessionExpiredError
    );
  } finally {
    restore();
  }
});

// --- V2-2: participant Power + holding economics ------------------------------

test('participant parser preserves the V2 Power view and holding economics', () => {
  const participant = parseRoundParticipant({
    ...VALID_PARTICIPANT,
    holdings: [{ ...VALID_HOLDING, costBasis: 741, averageEntryPrice: 7.41, currentValue: 842, unrealizedPnl: 101, unrealizedPnlPct: 13.6 }]
  });
  assert.deepEqual(participant.power, VALID_POWER);
  const holding = participant.holdings[0];
  assert.equal(holding.costBasis, 741);
  assert.equal(holding.averageEntryPrice, 7.41);
  assert.equal(holding.currentValue, 842);
  assert.equal(holding.unrealizedPnl, 101);
  assert.equal(holding.unrealizedPnlPct, 13.6);
});

test('participant parser accepts a full-Power null nextPointAt and null P&L fields', () => {
  const participant = parseRoundParticipant({
    ...VALID_PARTICIPANT,
    power: { ...VALID_POWER, current: 100, nextPointAt: null },
    holdings: [{ ...VALID_HOLDING, costBasis: 0, averageEntryPrice: null, unrealizedPnl: 0, unrealizedPnlPct: null }]
  });
  assert.equal(participant.power.nextPointAt, null);
  assert.equal(participant.holdings[0].averageEntryPrice, null);
  assert.equal(participant.holdings[0].unrealizedPnlPct, null);
});

test('participant parser rejects a missing or malformed Power block (not a V2 participant)', () => {
  const withoutPower = { ...VALID_PARTICIPANT } as Record<string, unknown>;
  delete withoutPower.power;
  assert.throws(() => parseRoundParticipant(withoutPower), /power/);
  assert.throws(() => parseRoundParticipant({ ...VALID_PARTICIPANT, power: { current: 10 } }), /max/);
  assert.throws(
    () => parseRoundParticipant({ ...VALID_PARTICIPANT, power: { ...VALID_POWER, nextPointAt: 42 } }),
    /nextPointAt/
  );
});

test('participant parser rejects holdings missing the V2 economics fields', () => {
  const legacyHolding = { coinId: 2, symbol: 'JDC', quantity: 1, currentPrice: 10, currentValue: 10 };
  assert.throws(
    () => parseRoundParticipant({ ...VALID_PARTICIPANT, holdings: [legacyHolding] }),
    /costBasis/
  );
  assert.throws(
    () => parseRoundParticipant({ ...VALID_PARTICIPANT, holdings: [{ ...VALID_HOLDING, unrealizedPnl: 'up' }] }),
    /unrealizedPnl/
  );
});

// --- V2-1/V2-3: public market signals -----------------------------------------

const VALID_SIGNALS = {
  apocalypseId: 'APOC-0001',
  apocalypsePercent: 42.5,
  serverTime: '2026-08-20T10:12:45.000Z',
  coins: [
    {
      coinId: 2, name: 'NovaCash', symbol: 'NVC', archetype: 'MOON',
      currentPrice: 1.42, recentChangePct: 2.35, phase: 'RISE', momentum: 'UP',
      typicalCycleMinutes: [3, 5], typicalSwingPct: [8, 15],
      collapseRisk: 'STABLE', dead: false
    },
    {
      coinId: 3, name: 'Byteon', symbol: 'BYT', archetype: 'RUG',
      currentPrice: 0, recentChangePct: null, phase: 'DEAD', momentum: 'FLAT',
      typicalCycleMinutes: null, typicalSwingPct: null,
      collapseRisk: 'DEAD', dead: true
    }
  ]
};

test('getMarketSignals fetches the public signals envelope and parses live + dead coins', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => {
    seen = args;
    return jsonResponse({ status: 'success', data: VALID_SIGNALS });
  });
  try {
    const signals = await getMarketSignals();
    assert.equal(seen?.url, `${API_BASE_URL}/game/market-signals`);
    assert.equal(seen?.init?.method, 'GET');
    assert.equal(signals.apocalypseId, 'APOC-0001');
    assert.equal(signals.coins.length, 2);
    const live = signals.coins[0];
    assert.equal(live.phase, 'RISE');
    assert.equal(live.momentum, 'UP');
    assert.equal(live.collapseRisk, 'STABLE');
    assert.deepEqual(live.typicalCycleMinutes, [3, 5]);
    const dead = signals.coins[1];
    assert.equal(dead.dead, true);
    assert.equal(dead.currentPrice, 0);
    assert.equal(dead.phase, 'DEAD');
    assert.equal(dead.recentChangePct, null);
  } finally {
    restore();
  }
});

test('market signals parser rejects malformed coins, unknown vocabularies and DEAD inconsistencies', () => {
  assert.throws(() => parseMarketSignals(null), /JSON object/);
  assert.throws(() => parseMarketSignals({ ...VALID_SIGNALS, coins: 'nope' }), /coins/);
  // Unknown phase / momentum / risk vocabularies fail closed.
  assert.throws(
    () => parseMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_SIGNALS.coins[0], phase: 'MOONING' }] }),
    /phase/
  );
  assert.throws(
    () => parseMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_SIGNALS.coins[0], momentum: 'SIDEWAYS' }] }),
    /momentum/
  );
  assert.throws(
    () => parseMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_SIGNALS.coins[0], collapseRisk: 'DOOMED' }] }),
    /collapseRisk/
  );
  // A dead coin without the DEAD markers, or a live coin carrying them, is
  // not the backend contract.
  assert.throws(
    () => parseMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_SIGNALS.coins[1], phase: 'DIP' }] }),
    /dead coin/
  );
  assert.throws(
    () => parseMarketSignals({ ...VALID_SIGNALS, coins: [{ ...VALID_SIGNALS.coins[0], collapseRisk: 'DEAD' }] }),
    /live coin/
  );
  // Hidden-information fields are never required — and never retained.
  const withLeak = {
    ...VALID_SIGNALS,
    coins: [{ ...VALID_SIGNALS.coins[0], seed: 'secret', nextPhaseAt: '2026-08-20T10:20:00.000Z' }]
  };
  const parsed = parseMarketSignals(withLeak);
  assert.equal('seed' in parsed.coins[0], false);
  assert.equal('nextPhaseAt' in parsed.coins[0], false);
});
