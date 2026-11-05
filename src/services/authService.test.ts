// Issue #27: auth must establish the backend's real identity or fail. Fake
// fetch and storage drive the same flow AuthContext calls.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decodeJwtPayload,
  getUserIdFromToken,
  isTokenExpired,
  loginUser,
  normalizeAuthResponse,
  readStoredSession,
  registerUser
} from './authService.ts';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt = (payload: unknown) => `${encode({ alg: 'HS256' })}.${encode(payload)}.signature`;
const future = () => Math.floor(Date.now() / 1000) + 3600;

// Exactly what the backend sends: `user_id`, no `id`, NUMERIC funds as a string.
const backendUser = {
  user_id: 42,
  username: 'zoe',
  email: 'zoe@example.com',
  funds: '2500.50',
  created_at: '2026-10-01T10:00:00.000Z',
  is_bot: false
};
const expectedUser = { id: 42, username: 'zoe', email: 'zoe@example.com', funds: 2500.5 };
const loginBody = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  msg: 'Login successful',
  user: backendUser,
  token: jwt({ user_id: 42, exp: future() }),
  ...overrides
});

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key)
  };
}

function fakeFetch(...responses: Array<{ status?: number; body: unknown }>) {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    const next = responses.shift();
    assert.ok(next, `unexpected request to ${url}`);
    const text = typeof next.body === 'string' ? next.body : JSON.stringify(next.body);
    return new Response(text, { status: next.status ?? 200 });
  };
  return { calls, fetchImpl };
}

const credentials = { email: 'zoe@example.com', password: 'secret1' };

test('login with user_id and no id establishes and persists the real identity', async () => {
  const storage = memoryStorage();
  const body = loginBody();
  const { fetchImpl, calls } = fakeFetch({ body });

  const user = await loginUser(credentials, { fetchImpl, storage, baseUrl: 'http://api' });

  assert.equal('id' in body.user, false);
  assert.deepEqual(user, expectedUser);
  assert.equal(storage.getItem('token'), body.token);
  assert.deepEqual(JSON.parse(storage.getItem('user') ?? ''), expectedUser);
  assert.deepEqual(calls, [{ url: 'http://api/users/login', body: credentials }]);
});

test('registration logs in with the new credentials and persists that identity', async () => {
  const storage = memoryStorage();
  const body = loginBody();
  const { fetchImpl, calls } = fakeFetch(
    { status: 201, body: { success: true, msg: 'User registered successfully', user: backendUser } },
    { body }
  );

  const user = await registerUser({ ...credentials, username: 'zoe' }, { fetchImpl, storage, baseUrl: 'http://api' });

  assert.deepEqual(user, expectedUser);
  assert.equal(storage.getItem('token'), body.token);
  assert.deepEqual(calls, [
    { url: 'http://api/users/register', body: { ...credentials, username: 'zoe' } },
    { url: 'http://api/users/login', body: credentials }
  ]);
});

const without = (key: string) => {
  const user: Record<string, unknown> = { ...backendUser };
  delete user[key];
  return user;
};

const malformedBodies: Array<[string, unknown]> = [
  ['non-object body', null],
  ['missing token', loginBody({ token: undefined })],
  ['undecodable token', loginBody({ token: 'not-a-jwt' })],
  ['token payload is not an object', loginBody({ token: jwt(null) })],
  ['token without identity', loginBody({ token: jwt({ exp: future() }) })],
  ['expired token', loginBody({ token: jwt({ user_id: 42, exp: 1 }) })],
  ['missing user', loginBody({ user: undefined })],
  ['null user', loginBody({ user: null })],
  ['user is not an object', loginBody({ user: 'zoe' })],
  ['missing user_id', loginBody({ user: without('user_id') })],
  ['id instead of user_id', loginBody({ user: { ...without('user_id'), id: 42 } })],
  ['zero user_id', loginBody({ user: { ...backendUser, user_id: 0 }, token: jwt({ user_id: 0 }) })],
  ['non-numeric user_id', loginBody({ user: { ...backendUser, user_id: '42abc' } })],
  ['user_id disagrees with token', loginBody({ user: { ...backendUser, user_id: 7 } })],
  ['id disagrees with user_id', loginBody({ user: { ...backendUser, id: 7 } })],
  ['missing email', loginBody({ user: without('email') })],
  ['invalid email', loginBody({ user: { ...backendUser, email: 'zoe' } })],
  ['missing username', loginBody({ user: without('username') })],
  ['missing funds', loginBody({ user: without('funds') })],
  ['blank funds', loginBody({ user: { ...backendUser, funds: ' ' } })],
  ['non-numeric funds', loginBody({ user: { ...backendUser, funds: 'lots' } })]
];

for (const [name, body] of malformedBodies) {
  test(`login fails without persisting anything: ${name}`, async () => {
    const storage = memoryStorage();
    const { fetchImpl } = fakeFetch({ body });

    await assert.rejects(loginUser(credentials, { fetchImpl, storage }));

    assert.equal(storage.items.size, 0);
  });
}

test('registration fails without persisting when auto-login is malformed', async () => {
  const storage = memoryStorage();
  const { fetchImpl } = fakeFetch(
    { status: 201, body: { success: true, user: backendUser } },
    { body: loginBody({ user: undefined }) }
  );

  await assert.rejects(
    registerUser({ ...credentials, username: 'zoe' }, { fetchImpl, storage }),
    /Auto-login failed/
  );

  assert.equal(storage.items.size, 0);
});

test('rejected registration surfaces the backend message and never logs in', async () => {
  const storage = memoryStorage();
  const { fetchImpl, calls } = fakeFetch({ status: 409, body: { msg: 'Email already exists' } });

  await assert.rejects(
    registerUser({ ...credentials, username: 'zoe' }, { fetchImpl, storage }),
    /Email already exists/
  );

  assert.equal(calls.length, 1);
  assert.equal(storage.items.size, 0);
});

test('failed credentials and non-JSON responses fail without persisting', async () => {
  const storage = memoryStorage();
  const rejected = fakeFetch({ status: 401, body: { msg: 'Invalid email or password' } });
  await assert.rejects(loginUser(credentials, { fetchImpl: rejected.fetchImpl, storage }), /Invalid email or password/);

  const gateway = fakeFetch({ status: 502, body: '<html>Bad gateway</html>' });
  await assert.rejects(loginUser(credentials, { fetchImpl: gateway.fetchImpl, storage }), /invalid JSON/);

  assert.equal(storage.items.size, 0);
});

test('a storage failure mid-write leaves no partial session', async () => {
  const storage = memoryStorage();
  const failing = {
    ...storage,
    setItem: (key: string, value: string) => {
      if (key === 'user') throw new Error('quota exceeded');
      storage.setItem(key, value);
    }
  };
  const { fetchImpl } = fakeFetch({ body: loginBody() });

  await assert.rejects(loginUser(credentials, { fetchImpl, storage: failing }), /quota exceeded/);

  assert.equal(storage.items.size, 0);
});

test('normalizeAuthResponse keeps only validated fields', () => {
  const body = loginBody();
  assert.deepEqual(normalizeAuthResponse(body), { token: body.token, user: expectedUser });
});

// A payload whose base64url form uses both URL-safe characters and no padding.
const urlSafePayload = { user_id: 42, exp: 4102444800, name: 'Zoë ÿ>?~', pad: 'x' };

test('JWT decoding handles URL-safe characters and omitted padding', () => {
  const token = jwt(urlSafePayload);
  const segment = token.split('.')[1];

  assert.match(segment, /[-_]/);
  assert.notEqual(segment.length % 4, 0);
  assert.throws(() => atob(segment));

  assert.deepEqual(decodeJwtPayload(token), urlSafePayload);
  assert.equal(getUserIdFromToken(token), 42);
  assert.equal(isTokenExpired(token), false);
});

test('login accepts a token with a base64url payload', () => {
  const token = jwt(urlSafePayload);
  assert.equal(normalizeAuthResponse(loginBody({ token })).user.id, 42);
});

test('malformed tokens fail safely in every reader', () => {
  const invalidUtf8 = Buffer.from([0xff, 0xfe]).toString('base64url');
  for (const token of [
    '',
    'abc',
    'a.b',
    'a.b.c.d',
    'header..signature',
    'header.%%%.signature',
    'header.A.signature',
    `header.${invalidUtf8}.signature`,
    `header.${Buffer.from('not json').toString('base64url')}.signature`,
    jwt([1, 2])
  ]) {
    assert.equal(decodeJwtPayload(token), null, token);
    assert.equal(getUserIdFromToken(token), null, token);
    assert.equal(isTokenExpired(token), true, token);
  }
});

test('token identity and expiry claims are validated', () => {
  assert.equal(getUserIdFromToken(jwt({ user_id: '42' })), 42);
  assert.equal(getUserIdFromToken(jwt({ user_id: '42abc' })), null);
  assert.equal(getUserIdFromToken(jwt({ user_id: -1 })), null);
  assert.equal(isTokenExpired(jwt({ user_id: 42 })), false);
  assert.equal(isTokenExpired(jwt({ user_id: 42, exp: 1 })), true);
  assert.equal(isTokenExpired(jwt({ user_id: 42, exp: 'soon' })), true);
});

test('a stored session restores, including one with a base64url token', () => {
  const token = jwt(urlSafePayload);
  const storage = memoryStorage({ token, user: JSON.stringify(expectedUser) });

  assert.deepEqual(readStoredSession(storage), { token, user: expectedUser });
  assert.equal(storage.items.size, 2);
});

test('a session stored before this fix (raw backend user plus id) still restores', () => {
  const token = jwt({ user_id: 42, exp: future() });
  const storage = memoryStorage({ token, user: JSON.stringify({ ...backendUser, id: 42 }) });

  assert.deepEqual(readStoredSession(storage)?.user, expectedUser);
});

const fabricated = { id: 1, email: 'default@example.com', funds: 1000 };
const badStoredSessions: Array<[string, Record<string, string>]> = [
  ['previously fabricated user', { token: jwt({ user_id: 42, exp: future() }), user: JSON.stringify(fabricated) }],
  ['fabricated user whose id matches the token', { token: jwt({ user_id: 1, exp: future() }), user: JSON.stringify(fabricated) }],
  ['user id disagrees with token', { token: jwt({ user_id: 7, exp: future() }), user: JSON.stringify(expectedUser) }],
  ['expired token', { token: jwt({ user_id: 42, exp: 1 }), user: JSON.stringify(expectedUser) }],
  ['malformed token', { token: 'not-a-jwt', user: JSON.stringify(expectedUser) }],
  ['unparseable user', { token: jwt({ user_id: 42, exp: future() }), user: '{oops' }],
  ['token without user', { token: jwt({ user_id: 42, exp: future() }) }],
  ['user without token', { user: JSON.stringify(expectedUser) }]
];

for (const [name, initial] of badStoredSessions) {
  test(`stored session is cleared, not restored: ${name}`, () => {
    const storage = memoryStorage(initial);

    assert.equal(readStoredSession(storage), null);
    assert.equal(storage.items.size, 0);
  });
}
