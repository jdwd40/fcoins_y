// Apocalypse Monitor Phase 3 Plan 1: REST client contract tests for the
// operator diagnostics monitor service. No UI rendering assertions — the
// fetch contract only. Runs under plain Node (node --test); fetch is stubbed
// on globalThis. The diagnostics token must NEVER appear in any error
// message, log or thrown value.
import test from 'node:test';
import assert from 'node:assert/strict';

import { API_BASE_URL } from './apiConfig.ts';
import {
  MonitorApiError,
  INVALID_MONITOR_TOKEN_MESSAGE,
  getMonitorCycles,
  getMonitorSnapshot,
  parseMonitorCycles,
  parseMonitorSnapshot
} from './monitorService.ts';
import type { MonitorCyclesResult, MonitorSnapshot } from './monitorService.ts';

const OPERATOR_TOKEN = 'op-token-7f3a9c1e-super-secret';

const VALID_CYCLES: MonitorCyclesResult = {
  limit: 20,
  returned: 2,
  cycles: [
    {
      cycleId: 'APOC-0042',
      status: 'ACTIVE',
      startTime: '2026-08-30T10:00:00.000Z',
      endTime: '2026-08-30T10:30:00.000Z',
      settledAt: null,
      hasExactHistory: true
    },
    {
      cycleId: 'APOC-0041',
      status: 'COMPLETED',
      startTime: '2026-08-30T09:00:00.000Z',
      endTime: '2026-08-30T09:30:00.000Z',
      settledAt: '2026-08-30T09:30:01.000Z',
      hasExactHistory: false
    }
  ]
};

const VALID_SNAPSHOT: MonitorSnapshot = {
  cycle: {
    cycleId: 'APOC-0042',
    status: 'ACTIVE',
    startTime: '2026-08-30T10:00:00.000Z',
    endTime: '2026-08-30T10:30:00.000Z',
    settlementStartedAt: null,
    settledAt: null,
    observedAt: '2026-08-30T10:05:00.000Z'
  },
  attribution: 'mixed',
  exact: false,
  coins: [
    {
      coinId: 2,
      name: 'JD Coin',
      symbol: 'JDC',
      history: {
        sampleCount: 2,
        firstObservedAt: '2026-08-30T10:00:30.000Z',
        lastObservedAt: '2026-08-30T10:01:00.000Z',
        attribution: 'exact',
        points: [
          { time: '2026-08-30T10:00:30.000Z', price: 10, source: 'TICK' },
          { time: '2026-08-30T10:01:00.000Z', price: 12, source: 'COLLAPSE' }
        ]
      }
    },
    {
      coinId: 3,
      name: 'Empty Coin',
      symbol: 'EMP',
      history: {
        sampleCount: 0,
        firstObservedAt: null,
        lastObservedAt: null,
        attribution: null,
        points: []
      }
    }
  ],
  warnings: [
    '3 price row(s) carry no cycle provenance (legacy rows); attributed by time window.'
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

test('getMonitorCycles hits the cycles endpoint with only a Bearer Authorization header', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => {
    seen = args;
    return jsonResponse({ status: 'success', data: VALID_CYCLES });
  });
  try {
    const result = await getMonitorCycles(OPERATOR_TOKEN);
    assert.equal(seen?.url, `${API_BASE_URL}/game/diagnostics/monitor/cycles`);
    assert.equal(seen?.init?.method, 'GET');
    assert.equal((seen?.init?.headers as Record<string, string>).Authorization, `Bearer ${OPERATOR_TOKEN}`);
    // No player-session cookie/token plumbing: Authorization is the only
    // credential header the diagnostics client ever sends.
    assert.equal(Object.keys(seen?.init?.headers as Record<string, string>).sort().join(','), 'Accept,Authorization');
    assert.equal(result.cycles[0].cycleId, 'APOC-0042');
    assert.equal(result.cycles[0].hasExactHistory, true);
    assert.equal(result.cycles[1].hasExactHistory, false);
  } finally {
    restore();
  }
});

test('getMonitorSnapshot requests the monitor endpoint with the encoded cycleId', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => {
    seen = args;
    return jsonResponse({ status: 'success', data: VALID_SNAPSHOT });
  });
  try {
    const snapshot = await getMonitorSnapshot(OPERATOR_TOKEN, 'APOC-0042');
    assert.equal(seen?.url, `${API_BASE_URL}/game/diagnostics/monitor?cycleId=APOC-0042`);
    assert.equal((seen?.init?.headers as Record<string, string>).Authorization, `Bearer ${OPERATOR_TOKEN}`);
    assert.equal(snapshot.cycle.cycleId, 'APOC-0042');
    assert.equal(snapshot.attribution, 'mixed');
    assert.equal(snapshot.exact, false);
    assert.equal(snapshot.coins.length, 2);
    // Raw backend points and the COLLAPSE source are preserved verbatim.
    assert.equal(snapshot.coins[0].history.points[1].source, 'COLLAPSE');
    // A coin with no history parses cleanly (empty points, null attribution).
    assert.equal(snapshot.coins[1].history.sampleCount, 0);
    assert.equal(snapshot.coins[1].history.attribution, null);
    assert.deepEqual(snapshot.warnings, VALID_SNAPSHOT.warnings);
  } finally {
    restore();
  }
});

test('an empty cycles list is a valid result (fresh deployment, no cycles yet)', async () => {
  const restore = stubFetch(async () =>
    jsonResponse({ status: 'success', data: { limit: 20, returned: 0, cycles: [] } })
  );
  try {
    const result = await getMonitorCycles(OPERATOR_TOKEN);
    assert.equal(result.returned, 0);
    assert.deepEqual(result.cycles, []);
  } finally {
    restore();
  }
});

test('401 maps to a fixed invalid-token error that NEVER contains the token', async () => {
  const restore = stubFetch(async () => jsonResponse({ msg: 'Authentication required' }, 401));
  try {
    await assert.rejects(
      () => getMonitorCycles(OPERATOR_TOKEN),
      (err: unknown) => {
        assert.ok(err instanceof MonitorApiError);
        assert.equal((err as MonitorApiError).status, 401);
        assert.equal(err.message, INVALID_MONITOR_TOKEN_MESSAGE);
        assert.ok(!err.message.includes(OPERATOR_TOKEN), 'token must never leak into the error');
        return true;
      }
    );
    await assert.rejects(
      () => getMonitorSnapshot(OPERATOR_TOKEN, 'APOC-0042'),
      (err: unknown) => {
        assert.ok(err instanceof MonitorApiError && err.status === 401);
        assert.ok(!err.message.includes(OPERATOR_TOKEN));
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('an unknown cycle 404 surfaces the backend message verbatim', async () => {
  const restore = stubFetch(async () =>
    jsonResponse({ status: 'error', message: 'Unknown apocalypse cycle APOC-9999.' }, 404)
  );
  try {
    await assert.rejects(
      () => getMonitorSnapshot(OPERATOR_TOKEN, 'APOC-9999'),
      (err: unknown) => {
        assert.ok(err instanceof MonitorApiError);
        assert.equal((err as MonitorApiError).status, 404);
        assert.equal(err.message, 'Unknown apocalypse cycle APOC-9999.');
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('the fail-closed 404 { message: Route not found } shape is surfaced (diagnostics disabled server-side)', async () => {
  const restore = stubFetch(async () => jsonResponse({ message: 'Route not found' }, 404));
  try {
    await assert.rejects(() => getMonitorCycles(OPERATOR_TOKEN), /Route not found/);
  } finally {
    restore();
  }
});

test('a blank token is rejected before any fetch is attempted', async () => {
  let called = false;
  const restore = stubFetch(async () => { called = true; return jsonResponse({}); });
  try {
    await assert.rejects(() => getMonitorCycles('   '), /diagnostics token is required/);
    await assert.rejects(() => getMonitorSnapshot('', 'APOC-0042'), /diagnostics token is required/);
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test('network failure and malformed JSON reject with clear errors (no token leak)', async () => {
  let restore = stubFetch(async () => { throw new TypeError('fetch failed'); });
  try {
    await assert.rejects(() => getMonitorCycles(OPERATOR_TOKEN), (err: unknown) => {
      assert.ok(err instanceof Error && /Network failure/.test(err.message));
      assert.ok(!err.message.includes(OPERATOR_TOKEN));
      return true;
    });
  } finally {
    restore();
  }
  restore = stubFetch(async () => new Response('<html>oops</html>', { status: 200 }));
  try {
    await assert.rejects(() => getMonitorSnapshot(OPERATOR_TOKEN, 'APOC-0042'), /malformed/);
  } finally {
    restore();
  }
});

test('AbortSignal is forwarded to fetch', async () => {
  let seen: FetchArgs | undefined;
  const restore = stubFetch(async (args) => {
    seen = args;
    if (args.init?.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    return jsonResponse({ status: 'success', data: VALID_CYCLES });
  });
  try {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => getMonitorCycles(OPERATOR_TOKEN, controller.signal), /abort/i);
    assert.equal(seen?.init?.signal, controller.signal);
  } finally {
    restore();
  }
});

test('cycles parser rejects malformed payloads', () => {
  assert.throws(() => parseMonitorCycles(null), /JSON object/);
  assert.throws(() => parseMonitorCycles({ limit: 20 }), /cycles/);
  assert.throws(() => parseMonitorCycles({ limit: 20, returned: 1, cycles: 'nope' }), /array/);
  assert.throws(
    () => parseMonitorCycles({ limit: 20, returned: 1, cycles: [{ cycleId: 42 }] }),
    /cycleId/
  );
  assert.throws(
    () => parseMonitorCycles({ limit: 20, returned: 1, cycles: [{ ...VALID_CYCLES.cycles[0], status: 'PAUSED' }] }),
    /unknown status/
  );
  assert.throws(
    () => parseMonitorCycles({ limit: 20, returned: 1, cycles: [{ ...VALID_CYCLES.cycles[0], hasExactHistory: 'yes' }] }),
    /hasExactHistory/
  );
});

test('snapshot parser rejects malformed payloads and unknown attribution values', () => {
  assert.throws(() => parseMonitorSnapshot(null), /JSON object/);
  assert.throws(() => parseMonitorSnapshot({ ...VALID_SNAPSHOT, attribution: 'guessed' }), /unknown attribution/);
  assert.throws(() => parseMonitorSnapshot({ ...VALID_SNAPSHOT, exact: 'false' }), /exact/);
  assert.throws(() => parseMonitorSnapshot({ ...VALID_SNAPSHOT, warnings: 'none' }), /warnings/);
  assert.throws(
    () => parseMonitorSnapshot({ ...VALID_SNAPSHOT, cycle: { ...VALID_SNAPSHOT.cycle, status: 'PAUSED' } }),
    /unknown status/
  );
  const badPoint = {
    ...VALID_SNAPSHOT,
    coins: [{
      ...VALID_SNAPSHOT.coins[0],
      history: { ...VALID_SNAPSHOT.coins[0].history, points: [{ time: 'x', price: 'ten', source: null }] }
    }]
  };
  assert.throws(() => parseMonitorSnapshot(badPoint), /price/);
  const badAttribution = {
    ...VALID_SNAPSHOT,
    coins: [{
      ...VALID_SNAPSHOT.coins[0],
      history: { ...VALID_SNAPSHOT.coins[0].history, attribution: 'estimated' }
    }]
  };
  assert.throws(() => parseMonitorSnapshot(badAttribution), /attribution/);
});

test('parsers accept every documented attribution value', () => {
  for (const attribution of ['exact', 'time_window_derived', 'mixed'] as const) {
    assert.equal(parseMonitorSnapshot({ ...VALID_SNAPSHOT, attribution }).attribution, attribution);
  }
  for (const status of ['ACTIVE', 'SETTLING', 'COMPLETED'] as const) {
    const cycle = { ...VALID_CYCLES.cycles[0], status };
    assert.equal(parseMonitorCycles({ limit: 20, returned: 1, cycles: [cycle] }).cycles[0].status, status);
  }
});
