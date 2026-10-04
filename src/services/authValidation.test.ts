import test from 'node:test';
import assert from 'node:assert/strict';
import { loginUser, normalizeAuthResponse, restoreAuthSession } from './authService.ts';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const tokenFor = (payload: unknown) => `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.${encode('test-signature')}`;
const validToken = tokenFor({ user_id: 42, exp: 4_000_000_000 });
const valid = { success: true, user: { user_id: 42, email: 'ada@example.com' }, token: validToken };

const badIds: unknown[] = ['', ' ', 0, -1, 1.5, '42junk', '4.2', '0x2a', '4.2e1', '042', true, null, {}, [], Number.MAX_SAFE_INTEGER + 1];

async function rejectsWithoutPersistence(payload: unknown) {
  const original = globalThis.fetch;
  const calls: Array<[string, string]> = [];
  globalThis.fetch = async () => new Response(JSON.stringify(payload), { status: 200 });
  try {
    await assert.rejects(loginUser({ email: 'ada@example.com', password: 'secret1' }, {
      setItem(key: string, value: string) { calls.push([key, value]); }
    }));
    assert.deepEqual(calls, []);
  } finally { globalThis.fetch = original; }
}

for (const id of badIds) {
  test(`login and restoration reject invalid identity ${JSON.stringify(id)}`, async () => {
    const token = tokenFor({ user_id: id, exp: 4_000_000_000 });
    const payload = { ...valid, user: { ...valid.user, user_id: id }, token };
    assert.throws(() => normalizeAuthResponse(payload), /valid user id/);
    assert.equal(restoreAuthSession(token, JSON.stringify({ id, email: valid.user.email })), null);
    await rejectsWithoutPersistence(payload);
  });
}

const badTokens = [
  'garbage',
  `.${encode({ user_id: 42, exp: 4_000_000_000 })}.sig`,
  `${encode({ alg: 'HS256' })}.${encode({ user_id: 42, exp: 4_000_000_000 })}.`,
  `${encode({ alg: 'none' })}.${encode({ user_id: 42, exp: 4_000_000_000 })}.sig`,
  tokenFor(null), tokenFor([]), tokenFor('string'),
  tokenFor({ user_id: 42 }),
  tokenFor({ user_id: 42, exp: '4000000000' }),
  tokenFor({ user_id: 42, exp: null }),
  tokenFor({ user_id: 42, exp: 1 }),
  tokenFor({ exp: 4_000_000_000 }),
  tokenFor({ user_id: '42junk', exp: 4_000_000_000 }),
  tokenFor({ user_id: 7, exp: 4_000_000_000 })
];

badTokens.forEach((token, index) => {
  test(`invalid, expired or mismatched token ${index} rejects login and restoration`, async () => {
    assert.throws(() => normalizeAuthResponse({ ...valid, token }));
    assert.equal(restoreAuthSession(token, JSON.stringify({ id: 42, email: valid.user.email })), null);
    await rejectsWithoutPersistence({ ...valid, token });
  });
});

test('restoration never repairs or fabricates users and requires identity agreement', () => {
  const stored = JSON.stringify({ id: 42, email: valid.user.email, funds: 12.5 });
  assert.deepEqual(restoreAuthSession(validToken, stored)?.user, { id: 42, email: valid.user.email, funds: 12.5 });
  for (const invalid of [null, '', 'not-json', 'null', '[]', '{}', JSON.stringify({ id: 42 }), JSON.stringify({ id: 7, email: valid.user.email })]) {
    assert.equal(restoreAuthSession(validToken, invalid), null);
  }
  assert.equal(restoreAuthSession(null, stored), null);
  assert.equal(normalizeAuthResponse({ ...valid, user: { ...valid.user, user_id: '42' } }).user.id, 42);
});
