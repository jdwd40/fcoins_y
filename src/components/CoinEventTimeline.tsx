import { useEffect, useState } from 'react';
import { Gauge, Newspaper, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from './ui/Card.tsx';
import { Badge } from './ui/Badge.tsx';
import { Skeleton } from './ui/Skeleton.tsx';
import { getPersistentCoinEventHistory } from '../services/persistentService.ts';
import type { PersistentCoinHistoryEvent } from '../services/persistentService.ts';
import { formatModifierPct } from '../utils/formatModifierPct.ts';
import {
  COIN_EVENT_SOURCE_HINT,
  coinEventKind,
  coinEventSourceLabel,
  describeCoinEvent,
  formatCoinEventDuration,
  formatCoinEventTime,
  isCoinEventActive,
  orderCoinEventsNewestFirst
} from '../utils/coinEvents.ts';

// Issue #28: the coin's event history — every event that has already
// started on this coin (active and finished), newest first, from the public
// per-coin events feed. Complements the "Active events" card (live progress)
// with the historical record. Fetches on mount, then a light refresh while
// mounted. If the feed is unavailable the card simply does not render — the
// rest of the coin page never depends on it.

export const COIN_EVENT_TIMELINE_LIMIT = 50;
export const COIN_EVENT_REFRESH_MS = 30_000;
const EVENTS_INITIAL_COUNT = 8;

type TimelineStatus = 'loading' | 'ready' | 'hidden';

export function CoinEventTimeline({ coinId, serverNowMs }: { coinId: number; serverNowMs: number }) {
  const [events, setEvents] = useState<PersistentCoinHistoryEvent[]>([]);
  const [status, setStatus] = useState<TimelineStatus>('loading');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let inFlight: AbortController | null = null;
    let hasData = false;

    const load = () => {
      if (inFlight) return;
      const controller = new AbortController();
      inFlight = controller;
      getPersistentCoinEventHistory(coinId, { limit: COIN_EVENT_TIMELINE_LIMIT, signal: controller.signal })
        .then((history) => {
          if (cancelled) return;
          hasData = true;
          setEvents(orderCoinEventsNewestFirst(history.events));
          setStatus('ready');
        })
        .catch((err) => {
          if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
          // Keep the last good feed on a failed refresh; with nothing to show
          // the card hides instead of erroring the page.
          if (!hasData) setStatus('hidden');
        })
        .finally(() => {
          if (inFlight === controller) inFlight = null;
        });
    };

    load();
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      load();
    }, COIN_EVENT_REFRESH_MS);
    return () => {
      cancelled = true;
      inFlight?.abort();
      window.clearInterval(id);
    };
  }, [coinId]);

  if (status === 'hidden') return null;

  const visible = showAll ? events : events.slice(0, EVENTS_INITIAL_COUNT);

  return (
    <Card className="p-4 sm:p-5" aria-label="Event history">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-display font-bold text-ink">Event history</h2>
        {events.length > 0 && <span className="label">Newest first</span>}
      </div>
      <p className="text-xs text-ink-mute mb-3">
        Market events hit this coin directly. Director swings can sweep the whole market.
      </p>
      {status === 'loading' ? (
        <Skeleton lines={3} className="h-4" />
      ) : events.length === 0 ? (
        <p className="text-sm text-ink-mute">No events have moved this coin yet.</p>
      ) : (
        <ol className="space-y-3">
          {visible.map((event) => (
            <TimelineRow key={event.eventId} event={event} serverNowMs={serverNowMs} />
          ))}
        </ol>
      )}
      {events.length > EVENTS_INITIAL_COUNT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-3 min-h-[44px] text-sm font-semibold text-brand hover:underline"
        >
          {showAll ? 'Show fewer events' : `Show all ${events.length} events`}
        </button>
      )}
    </Card>
  );
}

function TimelineRow({ event, serverNowMs }: { event: PersistentCoinHistoryEvent; serverNowMs: number }) {
  const kind = coinEventKind(event);
  const DirectionIcon = kind === 'positive' ? TrendingUp : TrendingDown;
  const SourceIcon = event.source === 'DIRECTOR' ? Gauge : Newspaper;
  const active = isCoinEventActive(event, serverNowMs);
  const duration = formatCoinEventDuration(event.startsAt, event.endsAt);
  return (
    <li className="flex gap-3 min-w-0">
      <DirectionIcon
        className={`w-4 h-4 mt-0.5 shrink-0 ${kind === 'positive' ? 'text-up' : 'text-down'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="text-sm font-semibold text-ink min-w-0 break-words">{event.name}</span>
          <span className={`font-mono text-xs font-bold tnum shrink-0 ${kind === 'positive' ? 'text-up' : 'text-down'}`}>
            {formatModifierPct(event.modifierPct, kind)}
          </span>
        </div>
        <p className="text-sm text-ink-dim">{describeCoinEvent(event)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-mute">
          <Badge tone={event.source === 'DIRECTOR' ? 'director' : 'neutral'} title={COIN_EVENT_SOURCE_HINT[event.source]}>
            <SourceIcon className="w-3.5 h-3.5" aria-hidden="true" />
            {coinEventSourceLabel(event.source)}
          </Badge>
          <time dateTime={event.startsAt} className="font-mono tnum">
            {formatCoinEventTime(event.startsAt, serverNowMs)}
          </time>
          {duration && <span>· {active ? 'lasts' : 'ran'} {duration}</span>}
          {active && <Badge tone="brand">Active now</Badge>}
        </div>
      </div>
    </li>
  );
}
