import { useEffect, useState } from 'react';
import { Radiation, WifiOff, RefreshCw, Skull } from 'lucide-react';
import { useGame } from '../context/GameContext.tsx';
import { HowToPlay } from './HowToPlay.tsx';
import {
  displayRemainingMs,
  formatCountdown,
  meterPhase,
  METER_PHASE_LABEL,
  LIFECYCLE_LABEL,
  countLivingCoins
} from '../utils/gameLogic.ts';
import type { Coin } from '../types';

// Persistent Crypto Chaos status bar: which apocalypse, how long is left,
// how bad is it, and can you trade. The countdown display interpolates from
// the server-anchored basis in GameContext — it is re-anchored on every
// successful poll and on focus/visibility return, so it self-corrects drift
// and survives sleep/backgrounding without ever becoming its own clock.
export function ApocalypseHeader({ coins }: { coins: Coin[] }) {
  const { gameState, anchor, connection, lifecycle, lastSyncAt, stateError } = useGame();
  // Local 1s tick for display derivation only.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const percent = gameState?.apocalypsePercent ?? 0;
  const phase = meterPhase(percent);
  const remaining = displayRemainingMs(anchor, now);
  const living = countLivingCoins(coins);
  const total = coins.length;

  const lastSyncSeconds = lastSyncAt ? Math.max(0, Math.round((now - lastSyncAt) / 1000)) : null;

  return (
    <section
      aria-label="Apocalypse status"
      className={`apocalypse-header apocalypse-phase-${phase.toLowerCase()} ${lifecycle === 'SETTLING' ? 'apocalypse-settling' : ''}`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-3 sm:py-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <span className="apocalypse-mark" aria-hidden="true">
              {lifecycle === 'SETTLING' ? <Skull className="w-4 h-4" /> : <Radiation className="w-4 h-4" />}
            </span>
            <div className="min-w-0">
              <div className="label">Crypto Chaos</div>
              <div className="font-display font-bold text-ink text-lg sm:text-xl leading-tight truncate">
                {gameState ? gameState.apocalypseId.replace('APOC-', 'APOCALYPSE ') : 'APOCALYPSE —'}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div
              className="apocalypse-meter"
              role="progressbar"
              aria-label="Apocalypse progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(percent)}
            >
              <div className="apocalypse-meter-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5 gap-3">
              <span className="label">
                Apocalypse <strong className="text-ink ml-1 tnum">{percent.toFixed(1)}%</strong>
              </span>
              <span className="label hidden sm:inline">{METER_PHASE_LABEL[phase]}</span>
              <span className="label tnum">
                {total > 0 ? `${living} of ${total} coins still breathing` : '—'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 shrink-0">
            <HowToPlay />
            <div className="text-right">
              <div className="label">Time left</div>
              <div className="numeral text-ink text-2xl sm:text-3xl tnum" aria-live="off">
                {lifecycle === 'SETTLING' ? '--:--' : formatCountdown(remaining)}
              </div>
            </div>
            <div className="text-right">
              <div className="label">Status</div>
              <div
                className={`font-mono text-xs font-bold tracking-caps uppercase ${
                  lifecycle === 'ACTIVE' ? 'text-verdigris'
                  : lifecycle === 'SETTLING' ? 'text-oxblood'
                  : 'text-ink-dim'
                }`}
                role="status"
              >
                {LIFECYCLE_LABEL[lifecycle]}
              </div>
            </div>
          </div>
        </div>

        {connection !== 'live' && (
          <div className="mt-3 flex items-center gap-2 border border-oxblood rounded-lg px-3 py-2 bg-paper-alt" role="alert">
            {connection === 'offline' ? (
              <WifiOff className="w-3.5 h-3.5 text-oxblood" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-oxblood" />
            )}
            <span className="font-mono text-xs text-oxblood font-semibold tracking-caps uppercase">
              {connection === 'offline' ? 'Backend unavailable' : 'Connection stale · reconnecting…'}
            </span>
            {stateError && <span className="font-mono text-[0.68rem] text-ink-mute truncate">{stateError}</span>}
            {lastSyncSeconds !== null && connection === 'stale' && (
              <span className="label ml-auto">last sync {lastSyncSeconds}s ago</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
