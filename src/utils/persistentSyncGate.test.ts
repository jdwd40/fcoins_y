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

// --- Trade identity gating (same shouldApplyAccount contract as sync) ---
// trade() captures generation + userIdRef at start (after token check) and only
// applies setAccount/setProvisioned/setSynced/setAccountError when shouldApply
// is true. Server trade is never cancelled; syncNow always runs afterward.

test('trade BUY: A starts → logout bump → shouldApply false (A never restored)', () => {
  const gate = createPersistentSyncGate();
  // Trade start: capture gate like PersistentContext.trade after token check.
  const startedGen = gate.generation;
  const startedUserId = 'user-A';

  gate.bumpGeneration(); // logout while BUY is in flight
  assert.equal(
    gate.shouldApplyAccount(startedGen, startedUserId, undefined),
    false,
    'stale BUY result must not restore A after logout'
  );
  // Public-only syncNow for logged-out identity still runs (beginSync/endSync);
  // it has no account fetch — shouldApply stays false for the trade apply path.
  assert.equal(gate.beginSync(), true);
  assert.equal(gate.shouldApplyAccount(startedGen, startedUserId, undefined), false);
  assert.equal(gate.endSync(), false);
});

test('trade SELL: A starts → switch to B → shouldApply false; B gen may apply', () => {
  const gate = createPersistentSyncGate();
  const aGen = gate.generation;
  const aUserId = 'user-A';

  gate.bumpGeneration(); // A→B while SELL is in flight
  const bGen = gate.generation;
  assert.equal(
    gate.shouldApplyAccount(aGen, aUserId, 'user-B'),
    false,
    'stale SELL for A must never mutate B account'
  );
  // B's new generation (post-bump immediate sync / B's own trade) may apply.
  assert.equal(gate.shouldApplyAccount(bGen, 'user-B', 'user-B'), true);
});

test('same-user successful trade shouldApply true', () => {
  const gate = createPersistentSyncGate();
  const startedGen = gate.generation;
  const startedUserId = 'user-A';
  // No identity change — post-trade account apply is allowed.
  assert.equal(
    gate.shouldApplyAccount(startedGen, startedUserId, 'user-A'),
    true,
    'same-user trade response must apply account'
  );
});

test('stale trade does not interfere with immediate sync for current identity', () => {
  // Pattern: A trade in flight; identity bump queues sync via beginSync while
  // (hypothetically) something else holds inFlight; endSync reruns for B.
  const gate = createPersistentSyncGate();
  const aTradeGen = gate.generation;
  const aUserId = 'user-A';

  // A's sync (or any in-flight sync) is running when identity switches.
  assert.equal(gate.beginSync(), true);
  gate.bumpGeneration(); // logout or A→B
  // Immediate syncNow for new identity hits inFlight → queues one follow-up.
  assert.equal(gate.beginSync(), false);

  // Late trade resolve for A: must not apply.
  assert.equal(gate.shouldApplyAccount(aTradeGen, aUserId, 'user-B'), false);

  // endSync schedules immediate follow-up for current identity (not 5s wait).
  assert.equal(gate.endSync(), true);
  assert.equal(gate.beginSync(), true);
  const bGen = gate.generation;
  assert.equal(gate.shouldApplyAccount(bGen, 'user-B', 'user-B'), true);
  assert.equal(gate.endSync(), false);
});
