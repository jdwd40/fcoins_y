// After-Hours Exchange: world/live-event aggregation.
//
// GET /persistent/runtime carries per-coin active events. These helpers
// flatten them into one feed (soonest ending first) for the World page and
// the Market right rail. Pure and unit-tested.

import type {
  PersistentRuntime,
  PersistentRuntimeEvent
} from '../services/persistentService.ts';

export interface ActiveCoinEvent {
  coinId: number;
  kind: 'positive' | 'negative';
  event: PersistentRuntimeEvent;
}

/** Every active event across all coins, flat. */
export function collectActiveEvents(runtime: PersistentRuntime | null): ActiveCoinEvent[] {
  if (!runtime) return [];
  const out: ActiveCoinEvent[] = [];
  for (const coin of runtime.coins) {
    for (const event of coin.events.positive) out.push({ coinId: coin.coinId, kind: 'positive', event });
    for (const event of coin.events.negative) out.push({ coinId: coin.coinId, kind: 'negative', event });
  }
  return out;
}

/** The N soonest-ending active events (stable tiebreak on eventId). */
export function soonestEndingEvents(events: ActiveCoinEvent[], count: number): ActiveCoinEvent[] {
  return [...events]
    .sort((a, b) => Date.parse(a.event.endsAt) - Date.parse(b.event.endsAt) || a.event.eventId - b.event.eventId)
    .slice(0, count);
}

/** Total count of active events across the runtime (for the world strip). */
export function activeEventCount(runtime: PersistentRuntime | null): number {
  return collectActiveEvents(runtime).length;
}

/** Set of coinIds with at least one active event (for the board filter). */
export function coinIdsWithEvents(runtime: PersistentRuntime | null): Set<number> {
  const ids = new Set<number>();
  for (const item of collectActiveEvents(runtime)) ids.add(item.coinId);
  return ids;
}

/** 0..1 progress of an event's active window at the derived server instant. */
export function eventProgress(event: PersistentRuntimeEvent, serverNowMs: number): number {
  const start = Date.parse(event.startsAt);
  const end = Date.parse(event.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const ratio = (serverNowMs - start) / (end - start);
  return Math.min(1, Math.max(0, ratio));
}
