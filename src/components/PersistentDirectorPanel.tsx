import type { ReactNode } from 'react';
import { AlertTriangle, Flame, HeartHandshake, Minus, Shield, Sparkles } from 'lucide-react';
import { usePersistent, RUNTIME_STALE_AFTER_MS } from '../context/PersistentContext.tsx';
import type { PersistentDirectorMode, PersistentRuntimeDirector } from '../services/persistentService.ts';
import {
  decisionSummaryCopy,
  directorModeExplanation
} from '../utils/persistentRuntimeCopy.ts';
import { formatRemaining, remainingMs } from '../utils/persistentCountdown.ts';
import { usePersistentCountdownTick } from '../hooks/usePersistentCountdown.ts';

// Compact Wave 4 Director strip for PersistentMarketHeader.
// Modes use text + icon + subtle colour (never colour-only). Golden/Demon
// chips resolve symbol/name from signals.coins when available; otherwise
// show coin id / "unavailable" — never invent a name.

const MODE_STYLE: Record<
  PersistentDirectorMode,
  { icon: typeof Shield; chip: string; label: string }
> = {
  NORMAL: {
    icon: Minus,
    chip: 'border-rule text-ink-dim bg-paper-alt',
    label: 'Normal'
  },
  BOOM: {
    icon: Flame,
    chip: 'border-verdigris/40 text-verdigris bg-verdigris/10',
    label: 'Boom'
  },
  BUST: {
    icon: AlertTriangle,
    chip: 'border-oxblood/40 text-oxblood bg-oxblood/10',
    label: 'Bust'
  },
  RESCUE: {
    icon: HeartHandshake,
    chip: 'border-gold/40 text-gold bg-gold/10',
    label: 'Rescue'
  }
};

function resolveCoinLabel(
  coinId: number | null,
  signalsCoins: Array<{ coinId: number; symbol: string; name: string }> | undefined,
  role: 'Golden' | 'Demon'
): string {
  if (coinId === null) return `${role} coin unavailable`;
  const hit = signalsCoins?.find((c) => c.coinId === coinId);
  if (hit) return `${role} · ${hit.symbol}`;
  return `${role} · Coin #${coinId}`;
}

function DirectorActiveBody({
  director,
  serverTime,
  receivedAtLocal,
  signalsCoins
}: {
  director: PersistentRuntimeDirector;
  serverTime: string;
  receivedAtLocal: number;
  signalsCoins: Array<{ coinId: number; symbol: string; name: string }> | undefined;
}) {
  const nowLocal = usePersistentCountdownTick(true);
  const style = MODE_STYLE[director.mode];
  const Icon = style.icon;
  const windowLeft = formatRemaining(
    remainingMs(director.endsAt, serverTime, receivedAtLocal, nowLocal)
  );
  const decisions = director.recentDecisions.slice(0, 3);
  const goldenLabel = resolveCoinLabel(director.goldenCoinId, signalsCoins, 'Golden');
  const demonLabel = resolveCoinLabel(director.demonCoinId, signalsCoins, 'Demon');

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold tracking-caps uppercase ${style.chip}`}
          aria-label={`Director mode ${style.label}`}
        >
          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
          {style.label}
        </span>
        <span className="font-mono text-xs text-ink-mute tnum" aria-label={`Director window ${windowLeft}`}>
          {windowLeft}
        </span>
      </div>
      <p className="text-xs text-ink-dim leading-snug">{directorModeExplanation(director.mode)}</p>
      <div className="flex flex-wrap gap-1.5" aria-label="Special coin roles">
        <span
          className="inline-flex items-center gap-1 rounded-md border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs text-gold"
          title={director.goldenCoinId === null ? undefined : `Coin id ${director.goldenCoinId}`}
        >
          <Sparkles className="w-3 h-3" aria-hidden="true" />
          {goldenLabel}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-md border border-oxblood/30 bg-oxblood/10 px-2 py-0.5 text-xs text-oxblood"
          title={director.demonCoinId === null ? undefined : `Coin id ${director.demonCoinId}`}
        >
          <AlertTriangle className="w-3 h-3" aria-hidden="true" />
          {demonLabel}
        </span>
      </div>
      {decisions.length > 0 && (
        <ul className="space-y-1" aria-label="Recent Director decisions">
          {decisions.map((d, i) => (
            <li key={`${d.startedAt}-${d.summaryCode}-${i}`} className="text-xs text-ink-mute leading-snug">
              <span className="font-mono text-ink-dim">{d.mode}</span>
              {' — '}
              {decisionSummaryCopy(d.summaryCode)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PersistentDirectorPanel() {
  const {
    runtime,
    runtimeError,
    runtimeSyncedAt,
    directorUnavailable,
    signals
  } = usePersistent();

  const stale =
    runtimeSyncedAt !== null && Date.now() - runtimeSyncedAt > RUNTIME_STALE_AFTER_MS;

  let body: ReactNode;
  if (runtime === null && runtimeError === null) {
    body = (
      <p className="text-xs text-ink-mute" role="status">
        Loading Director…
      </p>
    );
  } else if (runtime !== null && runtime.worldId === null) {
    body = (
      <p className="text-xs text-ink-mute" role="status">
        No active world — Director idle.
      </p>
    );
  } else if (runtime?.director && !stale) {
    // Retain last-good director across transient errors until stale.
    body = (
      <DirectorActiveBody
        director={runtime.director}
        serverTime={runtime.serverTime}
        receivedAtLocal={runtimeSyncedAt ?? Date.now()}
        signalsCoins={signals?.coins}
      />
    );
  } else {
    const reason = stale
      ? 'Director data is stale.'
      : runtimeError || directorUnavailable
        ? 'Director temporarily unavailable.'
        : 'Director state unavailable for this world.';
    body = (
      <p className="text-xs text-ink-dim" role="status">
        {reason}
      </p>
    );
  }

  return (
    <div
      className="mt-3 w-full min-w-0 rounded-lg border border-rule bg-paper px-3 py-2.5"
      aria-label="Director"
    >
      <div className="label mb-1.5">Director</div>
      {body}
    </div>
  );
}
