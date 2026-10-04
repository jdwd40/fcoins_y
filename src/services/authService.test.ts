// Auth session contract tests. No UI rendering — the fetch/persistence
// contract only. Runs under plain Node (node --test); fetch is stubbed on
// globalThis, storage is a fake recording setItem calls.
import test from 'node:test';
import assert from 'node:assert/strict';

import { API_BASE_URL } from './apiConfig.ts';
import { loginUser, normalizeAuthResponse, registerUser } from './authService.ts';
import type { AuthSession } from './authService.ts';

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function tokenFor(payload: unknown): string {
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.${b64url('test-signature')}`;
}

// A well-formed backend login envelope: snake_case user row, funds as a pg
// NUMERIC string, token signed with the same user_id.
const VALID_PAYLOAD = {
  success: true,
  msg: 'Login successful',
  user: {
    user_id: 42,
    username: 'ada',
    email: 'ada@example.com',
    funds: '1000.00',
    is_bot: false,
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-20T10:00:00.000Z'
  },
  token: tokenFor({ user_id: 42, exp: 4_000_000_000 })
};

type FetchImpl = (args: { url: string; init?: RequestInit }) => Promise<Response>;

function stubFetch(impl: FetchImpl): () => void {
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

function fakeStorage() {
  const calls: Array<[string, string]> = [];
  return {
    calls,
    setItem(key: string, value: string) { calls.push([key, value]); }
  };
}

// --- normalizeAuthResponse: the no-fabrication contract ---------------------

test('normalises a well-formed backend envelope from user_id (authoritative)', () => {
  const session = normalizeAuthResponse(VALID_PAYLOAD);
  assert.equal(session.user.id, 42);
  assert.equal(session.user.email, 'ada@example.com');
  assert.equal(session.user.username, 'ada');
  assert.equal(session.user.funds, 1000); // parsed from the NUMERIC string
  assert.equal(session.token, VALID_PAYLOAD.token);
});

test('funds is omitted (never invented) when the payload does not carry it', () => {
  const payload = {
    ...VALID_PAYLOAD,
    user: { user_id: 42, username: 'ada', email: 'ada@example.com' }
  };
  const session = normalizeAuthResponse(payload);
  assert.equal('funds' in session.user, false);
});

test('rejects when the user object is missing', () => {
  assert.throws(
    () => normalizeAuthResponse({ success: true, token: VALID_PAYLOAD.token }),
    /did not include a user/
  );
});

test('rejects when user_id is missing or unusable', () => {
  for (const user of [
    { email: 'ada@example.com' },
    { user_id: 'not-a-number', email: 'ada@example.com' },
    { user_id: null, email: 'ada@example.com' }
  ]) {
    assert.throws(
      () => normalizeAuthResponse({ ...VALID_PAYLOAD, user }),
      /valid user id/
    );
  }
});

test('rejects when the token is missing', () => {
  const { token, ...noToken } = VALID_PAYLOAD;
  assert.throws(() => normalizeAuthResponse(noToken), /missing authentication token/);
  assert.equal(token.length > 0, true); // fixture sanity
});

test('rejects when the token identity disagrees with the body user_id', () => {
  const payload = { ...VALID_PAYLOAD, token: tokenFor({ user_id: 999, exp: 4_000_000_000 }) };
  assert.throws(() => normalizeAuthResponse(payload), /does not match the authentication token/);
});

test('an undecodable token fails closed even with a valid body user_id', () => {
  const payload = { ...VALID_PAYLOAD, token: 'not-a-jwt' };
  assert.throws(() => normalizeAuthResponse(payload), /invalid or expired/);
});

// --- loginUser: malformed payload fails WITHOUT persisting ------------------

test('well-formed login persists exactly token + normalised user', async () => {
  const restore = stubFetch(async ({ url }) => {
    assert.equal(url, `${API_BASE_URL}/users/login`);
    return jsonResponse(VALID_PAYLOAD);
  });
  const storage = fakeStorage();
  try {
    const session = await loginUser({ email: 'ada@example.com', password: 'secret1' }, storage);
    assert.equal(session.user.id, 42);
    assert.deepEqual(storage.calls.map(([key]) => key), ['token', 'user']);
    const storedUser = JSON.parse(storage.calls[1][1]) as AuthSession['user'];
    assert.equal(storedUser.id, 42);
    assert.equal(storedUser.email, 'ada@example.com');
  } finally {
    restore();
  }
});

test('malformed login payload fails WITHOUT persisting any user or token (M1 regression)', async () => {
  const malformedPayloads: unknown[] = [
    { success: true, msg: 'Login successful', token: tokenFor({ user_id: 1 }) }, // no user
    { success: true, user: { email: 'x@example.com' }, token: tokenFor({ user_id: 1 }) }, // no user_id
    { success: true, user: null, token: tokenFor({ user_id: 1 }) }
  ];
  for (const payload of malformedPayloads) {
    const restore = stubFetch(async () => jsonResponse(payload));
    const storage = fakeStorage();
    try {
      await assert.rejects(loginUser({ email: 'x@example.com', password: 'secret1' }, storage));
      assert.deepEqual(storage.calls, [], 'nothing may be persisted for a malformed payload');
    } finally {
      restore();
    }
  }
});

test('HTTP failure surfaces the backend msg and persists nothing', async () => {
  const restore = stubFetch(async () => jsonResponse({ success: false, msg: 'Invalid email or password' }, 401));
  const storage = fakeStorage();
  try {
    await assert.rejects(
      loginUser({ email: 'x@example.com', password: 'wrong' }, storage),
      /Invalid email or password/
    );
    assert.deepEqual(storage.calls, []);
  } finally {
    restore();
  }
});

test('register posts to /users/register then auto-logs in via /users/login', async () => {
  const seen: string[] = [];
  const restore = stubFetch(async ({ url }) => {
    seen.push(url);
    if (url.endsWith('/users/register')) {
      return jsonResponse({ success: true, msg: 'User registered successfully', user: VALID_PAYLOAD.user }, 201);
    }
    return jsonResponse(VALID_PAYLOAD);
  });
  const storage = fakeStorage();
  try {
    const session = await registerUser({ username: 'ada', email: 'ada@example.com', password: 'secret1' }, storage);
    assert.deepEqual(seen, [`${API_BASE_URL}/users/register`, `${API_BASE_URL}/users/login`]);
    assert.equal(session.user.id, 42);
    assert.deepEqual(storage.calls.map(([key]) => key), ['token', 'user']);
  } finally {
    restore();
  }
});

test('register fails WITHOUT persisting when the auto-login payload is malformed', async () => {
  const restore = stubFetch(async ({ url }) => {
    if (url.endsWith('/users/register')) {
      return jsonResponse({ success: true, user: VALID_PAYLOAD.user }, 201);
    }
    return jsonResponse({ success: true, token: tokenFor({ user_id: 1 }) }); // no user object
  });
  const storage = fakeStorage();
  try {
    await assert.rejects(
      registerUser({ username: 'ada', email: 'ada@example.com', password: 'secret1' }, storage),
      /Auto-login failed/
    );
    assert.deepEqual(storage.calls, []);
  } finally {
    restore();
  }
});
