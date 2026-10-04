// Contract tests for JWT payload decoding. Runs under plain Node
// (node --test); atob is a Node >=16 global.
import test from 'node:test';
import assert from 'node:assert/strict';

import { base64UrlToBase64, decodeJwtPayload, getUserIdFromToken, isTokenExpired } from './jwt.ts';

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function unsignedToken(payload: unknown): string {
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.${b64url('test-signature')}`;
}

test('decodes a plain base64url payload', () => {
  const payload = { user_id: 42, exp: 4_000_000_000 };
  assert.deepEqual(decodeJwtPayload(unsignedToken(payload)), payload);
});

test('decodes payloads whose base64url encoding contains - or _ (M2 regression)', () => {
  // '>' and '~' bytes force '+'/'/' in standard base64, i.e. '-'/'_' in
  // base64url. Guard the fixture so the regression test can never go stale.
  const payload = { user_id: 42, exp: 4_000_000_000, iss: 'coins?>', jti: '~id~' };
  const encoded = b64url(payload);
  assert.match(encoded, /[-_]/, 'fixture must exercise base64url-only characters');
  const token = unsignedToken(payload);
  assert.deepEqual(decodeJwtPayload(token), payload);
  assert.equal(getUserIdFromToken(token), 42);
});

test('decodes unpadded payloads (length not a multiple of 4)', () => {
  const payload = { user_id: 7 };
  const encoded = b64url(payload);
  assert.notEqual(encoded.length % 4, 0, 'fixture must be unpadded');
  assert.deepEqual(decodeJwtPayload(unsignedToken(payload)), payload);
});

test('rejects malformed tokens instead of throwing', () => {
  assert.equal(decodeJwtPayload('not-a-jwt'), null);
  assert.equal(decodeJwtPayload('a.!!!not-base64!!!.c'), null);
  assert.equal(decodeJwtPayload('a.b'), null);
  assert.equal(getUserIdFromToken('not-a-jwt'), null);
});

test('getUserIdFromToken reads the backend user_id claim', () => {
  assert.equal(getUserIdFromToken(unsignedToken({ user_id: 123 })), 123);
  assert.equal(getUserIdFromToken(unsignedToken({ sub: '55' })), null);
  assert.equal(getUserIdFromToken(unsignedToken({ exp: 4_000_000_000 })), null);
});

test('isTokenExpired: expired, valid and claim-less tokens', () => {
  assert.equal(isTokenExpired(unsignedToken({ user_id: 1, exp: 1_000_000_000 })), true);
  assert.equal(isTokenExpired(unsignedToken({ user_id: 1, exp: 4_000_000_000 })), false);
  assert.equal(isTokenExpired(unsignedToken({ user_id: 1 })), true);
  // An undecodable token fails closed (treated as expired).
  assert.equal(isTokenExpired('garbage'), true);
});

test('base64UrlToBase64 restores alphabet and padding', () => {
  assert.equal(base64UrlToBase64('YWJj'), 'YWJj');
  // 'ø' -> base64 '+/' territory; verify via round-trip through Buffer.
  const raw = Buffer.from('<???>~~~').toString('base64');
  const urlForm = raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.equal(Buffer.from(base64UrlToBase64(urlForm), 'base64').toString(), '<???>~~~');
});
