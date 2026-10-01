import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectActiveEvents,
  soonestEndingEvents,
  activeEventCount,
  coinIdsWithEvents,
  eventProgress
} from './worldEvents.ts';
import type { PersistentRuntime } from '../services/persistentService.ts';

function ev(eventId: number, endsAt: string, modifierPct = 1) {
  return { eventId, name: `Event ${eventId}`, modifierPct, startsAt: '2026-10-01T13:00:00Z', endsAt };
}

const runtime: PersistentRuntime = {
  serverTime: '2026-10-01T13:30:00Z',
  worldId: 1,
  director: null,
  coins: [
    { coinId: 1, events: { positive: [ev(1, '2026-10-01T14:00:00Z')], negative: [ev(2, '2026-10-01T13:45:00Z', -2)] }, activeNetModifierPct: -1 },
    { coinId: 2, events: { positive: [], negative: [] }, activeNetModifierPct: 0 },
    { coinId: 3, events: { positive: [ev(3, '2026-10-01T13:35:00Z')], negative: [] }, activeNetModifierPct: 1 }
  ]
};

describe('collectActiveEvents', () => {
  it('flattens positive and negative events across coins', () => {
    const all = collectActiveEvents(runtime);
    assert.equal(all.length, 3);
    assert.equal(all.filter((e) => e.kind === 'negative').length, 1);
  });
  it('handles null runtime', () => {
    assert.deepEqual(collectActiveEvents(null), []);
    assert.equal(activeEventCount(null), 0);
  });
});

describe('soonestEndingEvents', () => {
  it('orders by endsAt ascending', () => {
    const soonest = soonestEndingEvents(collectActiveEvents(runtime), 2);
    assert.deepEqual(soonest.map((e) => e.event.eventId), [3, 2]);
  });
});

describe('coinIdsWithEvents', () => {
  it('collects coin ids with any active event', () => {
    assert.deepEqual([...coinIdsWithEvents(runtime)].sort(), [1, 3]);
  });
});

describe('eventProgress', () => {
  it('computes window progress 0..1', () => {
    const event = ev(1, '2026-10-01T14:00:00Z'); // start 13:00, end 14:00
    assert.equal(eventProgress(event, Date.parse('2026-10-01T13:30:00Z')), 0.5);
    assert.equal(eventProgress(event, Date.parse('2026-10-01T12:00:00Z')), 0);
    assert.equal(eventProgress(event, Date.parse('2026-10-01T15:00:00Z')), 1);
  });
  it('is safe on malformed input', () => {
    assert.equal(eventProgress(ev(1, 'not-a-date'), 0), 0);
  });
});
