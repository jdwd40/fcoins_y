import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from './apiError.ts';

test('ApiError preserves message, status, and optional payload', () => {
  const payload = { status: 'error', message: 'boom' };
  const err = new ApiError('Request failed', 422, payload);
  assert.equal(err.name, 'ApiError');
  assert.equal(err.message, 'Request failed');
  assert.equal(err.status, 422);
  assert.equal(err.payload, payload);
  assert.ok(err instanceof Error);
});

test('ApiError works without a payload', () => {
  const err = new ApiError('Unauthorized', 401);
  assert.equal(err.message, 'Unauthorized');
  assert.equal(err.status, 401);
  assert.equal(err.payload, undefined);
});
