import { Link } from 'react-router-dom';
import { Crown, Flame, Zap } from 'lucide-react';
import { usePersistent } from '../../context/PersistentContext.tsx';
import { DirectorModeChip } from '../DirectorModeChip.tsx';
import { FreshnessPill } from '../FreshnessPill.tsx';
import { Badge } from '../ui/Badge.tsx';
import { activeEventCount } from '../../utils/worldEvents.ts';
import { regimeLabel } from '../../utils/regimeCopy.ts';
import { formatRemaining, remainingMs } from '../../utils/persistentCountdown.ts';
import { usePersistentCountdownTick } from '../../hooks/usePersistentCountdown.ts';

// World strip: the state of the world at a glance, under the top bar on
// every player page. On phones it is a single row that scrolls horizontally
// INSIDE itself — it never causes page overflow.

export function WorldStrip() {
  const { signals, runtime, runtimeSyncedAt } = usePersistent();
  const nowLocal = usePersistentCountdownTick(true);

  const director = runtime?.director ?? null;
  const receivedAtLocal = runtimeSyncedAt ?? Date.now();
  const serverTime = runtime?.serverTime ?? new Date().toISOString();
  const windowLeft = director
    ? formatRemaining(remainingMs(director.endsAt, serverTime, receivedAtLocal, nowLocal))
    : null;

  const coinById = new Map((signals?.coins ?? []).map((coin) => [coin.coinId, coin]));
  const golden = director?.goldenCoinId != null ? coinById.get(director.goldenCoinId) : undefined;
  const demon = director?.demonCoinId != null ? coinById.get(director.demonCoinId) : undefined;
  const eventCount = activeEventCount(runtime);
  const regime = signals?.director?.regime ?? null;
  const intensity = signals?.director?.intensity ?? null;

  return (
    <div className="border-b border-rule bg-surface/60 backdrop-blur-sm" aria-label="World status">
      <div className="game-shell">
        <div className="world-strip-scroll py-2">
          {director ? (
            <DirectorModeChip mode={director.mode} timeLeft={windowLeft ?? undefined} />
          ) : (
            <Badge tone="director">
              Director: —
            </Badge>
          )}
          {regime && (
            <Badge tone="neutral" aria-label={`Market climate ${regimeLabel(regime)}${intensity !== null ? `, intensity ${Math.round(intensity * 100)} percent` : ''}`}>
              <Zap className="w-3.5 h-3.5 text-director" aria-hidden="true" />
              {regimeLabel(regime)}
              {intensity !== null && <span className="font-mono tnum text-ink-mute">{Math.round(intensity * 100)}%</span>}
            </Badge>
          )}
          {golden && (
            <Link to={`/coin/${golden.coinId}`} aria-label={`Golden coin ${golden.name}`}>
              <Badge tone="golden">
                <Crown className="w-3.5 h-3.5" aria-hidden="true" />
                Golden · {golden.symbol}
              </Badge>
            </Link>
          )}
          {demon && (
            <Link to={`/coin/${demon.coinId}`} aria-label={`Demon coin ${demon.name}`}>
              <Badge tone="demon">
                <Flame className="w-3.5 h-3.5" aria-hidden="true" />
                Demon · {demon.symbol}
              </Badge>
            </Link>
          )}
          {eventCount > 0 && (
            <Badge tone="neutral" aria-label={`${eventCount} live coin events`}>
              {eventCount} live event{eventCount === 1 ? '' : 's'}
            </Badge>
          )}
          <FreshnessPill />
          <Link
            to="/world"
            className="chip hover:border-brand hover:text-brand transition-colors"
            aria-label="Open the World page"
          >
            World ›
          </Link>
        </div>
      </div>
    </div>
  );
}
