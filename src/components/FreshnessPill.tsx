// Freshness pill: "● Live · updated Ns ago" while the shared signals poll is
// healthy; amber "Reconnecting…" when the poll errors or data is >15s old.

import { usePersistent } from '../context/PersistentContext.tsx';
import { usePersistentCountdownTick } from '../hooks/usePersistentCountdown.ts';

const STALE_AFTER_MS = 15000;

export function FreshnessPill() {
  const { signalsError, signalsSyncedAt } = usePersistent();
  const nowLocal = usePersistentCountdownTick(true);

  const stale =
    signalsSyncedAt === null || nowLocal - signalsSyncedAt > STALE_AFTER_MS;
  const degraded = signalsError !== null || stale;

  if (degraded) {
    return (
      <span className="chip text-warn border-warn/50" role="status">
        <span className="live-dot live-dot-warn" aria-hidden="true" />
        Reconnecting…
      </span>
    );
  }

  const secondsAgo = Math.max(0, Math.floor((nowLocal - signalsSyncedAt) / 1000));
  return (
    <span className="chip" role="status" aria-label={`Live market data, updated ${secondsAgo} seconds ago`}>
      <span className="live-dot" aria-hidden="true" />
      Live · {secondsAgo}s ago
    </span>
  );
}
