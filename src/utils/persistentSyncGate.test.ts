// Persistent-market Stage 10B: unit tests for the account-sync identity gate.
// Pure logic only — proves stale A never applies after A→B / logout, and that
// a bump while inFlight schedules an immediate follow-up (not a 5s wait).
// Leaderboard applies are deliberately outside this gate.
import test from 'node:test';
import assert from 'node:assert/strict';

import { createPersistentSyncGate } from './persistentSyncGate.ts';

test('A in flight → switch to B (bump) → A resolve late → shouldApply false', () => {
  const gate = createPersistentSyncGate();
  assert.equal(gate.beginSync(), true);
  const startedGen = gate.generation;
  const startedUserId = 'user-A';

  // Identity switch A→B while A's request is still in flight.
  gate.bumpGeneration();
  assert.equal(
    gate.shouldApplyAccount(startedGen, startedUserId, 'user-B'),
    false,
    'stale A account must never mutate B'
  );
  // Even if somehow currentUserId were still read as A, generation moved.
  assert.equal(gate.shouldApplyAccount(startedGen, startedUserId, 'user-A'), false);
});

test('bump while inFlight → endSync requests rerun so B sync begins immediately', () => {
  const gate = createPersistentSyncGate();
  assert.equal(gate.beginSync(), true); // A's sync

  gate.bumpGeneration(); // A→B
  // B's immediate syncNow hits the inFlight guard and queues exactly one rerun.
  assert.equal(gate.beginSync(), false);
  assert.equal(gate.beginSync(), false); // coalesced — still one follow-up

  assert.equal(gate.endSync(), true, 'blocked B sync must schedule an immediate follow-up');

  // Follow-up begins for B (not waiting for the poll interval).
  assert.equal(gate.beginSync(), true);
  const bGen = gate.generation;
  assert.equal(gate.shouldApplyAccount(bGen, 'user-B', 'user-B'), true);
  assert.equal(gate.endSync(), false); // no further rerun queued
});

test('in flight → logout bump → response must not apply', () => {
  const gate = createPersistentSyncGate();
  assert.equal(gate.beginSync(), true);
  const startedGen = gate.generation;
  const startedUserId = 'user-A';

  gate.bumpGeneration(); // logout: user?.id → undefined
  assert.equal(
    gate.shouldApplyAccount(startedGen, startedUserId, undefined),
    false,
    'logout must keep account cleared — stale A cannot restore state'
  );
  assert.equal(gate.shouldApplyAccount(startedGen, startedUserId, null), false);
});

test('stale A error must not apply as B accountError', () => {
  const gate = createPersistentSyncGate();
  assert.equal(gate.beginSync(), true);
  const startedGen = gate.generation;

  gate.bumpGeneration(); // A→B before A's rejection lands
  // Callers gate BOTH success and error paths through shouldApplyAccount.
  assert.equal(gate.shouldApplyAccount(startedGen, 'user-A', 'user-B'), false);
});

test('leaderboard applies are independent of account generation', () => {
  // The gate exposes only shouldApplyAccount — there is no leaderboard gate.
  // Document the contract: board updates remain valid across identity change.
  const gate = createPersistentSyncGate();
  assert.equal(gate.beginSync(), true);
  const startedGen = gate.generation;
  gate.bumpGeneration();
  assert.equal(gate.shouldApplyAccount(startedGen, 'user-A', 'user-B'), false);
  // Identity change does not invent a board gate; PersistentContext always
  // applies leaderboard results regardless of generation / userId.
  assert.equal(typeof (gate as { shouldApplyLeaderboard?: unknown }).shouldApplyLeaderboard, 'undefined');
  assert.ok(gate.generation > startedGen);
});

test('same identity and generation may apply; null↔null matches when gen matches', () => {
  const gate = createPersistentSyncGate();
  assert.equal(gate.beginSync(), true);
  const gen = gate.generation;
  assert.equal(gate.shouldApplyAccount(gen, 'user-A', 'user-A'), true);
  assert.equal(gate.shouldApplyAccount(gen, undefined, undefined), true);
  assert.equal(gate.shouldApplyAccount(gen, null, undefined), true);
  assert.equal(gate.shouldApplyAccount(gen, 'user-A', 'user-B'), false);
  assert.equal(gate.endSync(), false);
});

test('beginSync without contention clears a prior unused rerun flag', () => {
  const gate = createPersistentSyncGate();
  assert.equal(gate.beginSync(), true);
  assert.equal(gate.beginSync(), false); // queues rerun
  assert.equal(gate.endSync(), true);
  assert.equal(gate.beginSync(), true);
  assert.equal(gate.endSync(), false);
});
