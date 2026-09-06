// Persistent-market Stage 6: unit tests for the persistent trade gating
// helpers. Pure logic only — the gates never consult an Apocalypse/cycle
// lifecycle, Power, or a position cap.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  persistentTradeBlockReason,
  PERSISTENT_TRADE_BLOCK_LABEL,
  estimateNotional
} from './persistentTrading.ts';

const BASE = {
  authenticated: true,
  synced: true,
  provisioned: true,
  accountError: null,
  cash: 10000,
  notional: 250
};

test('an unauthenticated player is always blocked, whatever the account state', () => {
  assert.equal(persistentTradeBlockReason({ ...BASE, authenticated: false }), 'not-authenticated');
  assert.equal(
    persistentTradeBlockReason({ ...BASE, authenticated: false, cash: null, synced: false }),
    'not-authenticated'
  );
});

test('a never-synced account is syncing, never a fabricated balance', () => {
  assert.equal(persistentTradeBlockReason({ ...BASE, cash: null, synced: false }), 'account-syncing');
  assert.equal(persistentTradeBlockReason({ ...BASE, cash: null }), 'account-syncing');
});

test('a failed first sync is unavailable; a failed resync keeps the last good balance tradeable', () => {
  assert.equal(
    persistentTradeBlockReason({ ...BASE, cash: null, accountError: 'boom' }),
    'account-unavailable'
  );
  // last-good cash survives a transient read failure (the server revalidates
  // at commit time)
  assert.equal(persistentTradeBlockReason({ ...BASE, accountError: 'boom' }), null);
});

test('a synced-but-unprovisioned account can place the first BUY — never blocked as syncing', () => {
  // P0 regression: { provisioned: false } is a real SYNCED state (synced,
  // no error, account/cash unknown client-side). The first BUY must be
  // reachable: the server provisions the account idempotently with the
  // authoritative starting Cash and revalidates affordability at commit
  // time. Cash is never fabricated client-side, so the affordability gate
  // simply has nothing to check against yet.
  assert.equal(
    persistentTradeBlockReason({ ...BASE, provisioned: false, cash: null }),
    null
  );
  assert.equal(
    persistentTradeBlockReason({ ...BASE, provisioned: false, cash: null, notional: 100000 }),
    null
  );
});

test('an UNSYNCED unprovisioned identity is still syncing', () => {
  assert.equal(
    persistentTradeBlockReason({ ...BASE, provisioned: false, cash: null, synced: false }),
    'account-syncing'
  );
});

test('a failed sync with no account is unavailable even when unprovisioned', () => {
  assert.equal(
    persistentTradeBlockReason({ ...BASE, provisioned: false, cash: null, accountError: 'boom' }),
    'account-unavailable'
  );
});

test('affordability gates on the server-owned cash figure', () => {
  assert.equal(persistentTradeBlockReason({ ...BASE, notional: 10000 }), null);
  assert.equal(persistentTradeBlockReason({ ...BASE, notional: 10000.01 }), 'insufficient-cash');
  assert.equal(persistentTradeBlockReason({ ...BASE, cash: 100 }), 'insufficient-cash');
});

test('every block reason carries an explicit player-facing label', () => {
  for (const reason of ['not-authenticated', 'account-syncing', 'account-unavailable', 'insufficient-cash'] as const) {
    assert.equal(typeof PERSISTENT_TRADE_BLOCK_LABEL[reason], 'string');
    assert.ok(PERSISTENT_TRADE_BLOCK_LABEL[reason].length > 0);
  }
});

test('estimateNotional rounds to 2dp and is display-only', () => {
  assert.equal(estimateNotional(0.004, 2500), 10);
  assert.equal(estimateNotional(1, 0.005), 0.01);
  assert.equal(estimateNotional(3.33333333, 3), 10);
});
