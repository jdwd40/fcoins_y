import { useEffect, useState } from 'react';

/**
 * 1s tick while mounted. Returns current local now so callers can recompute
 * remainingMs on each frame. Cleanup clears the interval on unmount.
 * Only runs while `enabled` is true.
 */
export function usePersistentCountdownTick(enabled = true): number {
  const [nowLocal, setNowLocal] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    setNowLocal(Date.now());
    const id = setInterval(() => setNowLocal(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return nowLocal;
}
