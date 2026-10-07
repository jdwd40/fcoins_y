// Issue #28: pure copy/ordering helpers for the coin page event timeline.
//
// Every word here is derived ONLY from the published event fields (name,
// direction, source, modifierPct, startsAt, endsAt) — no invented causes, no
// hidden Director state, nothing about events that have not started. Source
// is the coarse public vocabulary: MARKET or DIRECTOR, shown as two game
// terms ("Market" / "Director").

import type {
  PersistentCoinEventSource,
  PersistentCoinHistoryEvent
} from '../services/persistentService.ts';
import { formatModifierPct, type ModifierKind } from './formatModifierPct.ts';

export const COIN_EVENT_SOURCE_LABEL: Readonly<Record<PersistentCoinEventSource, string>> = {
  MARKET: 'Market',
  DIRECTOR: 'Director'
};

export const COIN_EVENT_SOURCE_HINT: Readonly<Record<PersistentCoinEventSource, string>> = {
  MARKET: 'A market event on this coin',
  DIRECTOR: 'The Director stepped in — including market-wide swings'
};

export function coinEventSourceLabel(source: PersistentCoinEventSource): string {
  return COIN_EVENT_SOURCE_LABEL[source] ?? 'Market';
}

export function coinEventKind(event: Pick<PersistentCoinHistoryEvent, 'direction'>): ModifierKind {
  return event.direction === 'POSITIVE' ? 'positive' : 'negative';
}

/** Signed 1dp effect without the glyph, e.g. "+4.1%" / "−2.3%" / "+<0.1%". */
export function formatCoinEventEffect(event: Pick<PersistentCoinHistoryEvent, 'direction' | 'modifierPct'>): string {
  return formatModifierPct(event.modifierPct, coinEventKind(event)).replace(/^[▲▼]\s*/, '');
}

/**
 * One plain sentence per event, e.g.
 *   MARKET   + → "Whale Confidence pushed the price up +4.1%."
 *   MARKET   − → "Rug Rumours pushed the price down −2.3%."
 *   DIRECTOR + → "A Director swing pushed the price up +2.3%."
 *   DIRECTOR − → "A Director swing pushed the price down −2.3%."
 */
export function describeCoinEvent(
  event: Pick<PersistentCoinHistoryEvent, 'name' | 'direction' | 'source' | 'modifierPct'>
): string {
  const subject = event.source === 'DIRECTOR' ? 'A Director swing' : event.name;
  const way = event.direction === 'POSITIVE' ? 'up' : 'down';
  return `${subject} pushed the price ${way} ${formatCoinEventEffect(event)}.`;
}

/** Newest first: startsAt DESC, then eventId DESC. Returns a new array. */
export function orderCoinEventsNewestFirst<T extends Pick<PersistentCoinHistoryEvent, 'eventId' | 'startsAt'>>(
  events: readonly T[]
): T[] {
  if (!Array.isArray(events)) return [];
  return [...events].sort((a, b) => {
    const ta = Date.parse(a.startsAt);
    const tb = Date.parse(b.startsAt);
    const sa = Number.isFinite(ta) ? ta : -Infinity;
    const sb = Number.isFinite(tb) ? tb : -Infinity;
    if (sa !== sb) return sb - sa;
    return b.eventId - a.eventId;
  });
}

/** Active while startsAt ≤ now < endsAt (now = server-derived clock). */
export function isCoinEventActive(
  event: Pick<PersistentCoinHistoryEvent, 'startsAt' | 'endsAt'>,
  nowMs: number
): boolean {
  const start = Date.parse(event.startsAt);
  const end = Date.parse(event.endsAt);
  return Number.isFinite(start) && Number.isFinite(end) && start <= nowMs && nowMs < end;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Local timestamp: "14:05" for today, "6 Oct 14:05" for earlier days
 * (with the year only when it differs from now's year).
 */
export function formatCoinEventTime(iso: string, nowMs: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const d = new Date(t);
  const now = new Date(nowMs);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) return time;
  const year = d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year} ${time}`;
}

/** Published run length, e.g. "45s", "3m", "1h 20m". */
export function formatCoinEventDuration(startsAt: string, endsAt: string): string | null {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
