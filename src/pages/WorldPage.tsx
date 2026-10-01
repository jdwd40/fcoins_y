import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ChevronDown, Crown, Flame, HelpCircle } from 'lucide-react';
import { usePersistent } from '../context/PersistentContext.tsx';
import { usePageTitle } from '../hooks/usePageTitle.ts';
import { useFetch } from '../hooks/useFetch.ts';
import { usePersistentCountdownTick } from '../hooks/usePersistentCountdown.ts';
import { useShellServices } from '../components/shell/shellServices.ts';
import { MarketValueChart } from '../components/MarketValueChart.tsx';
import { DirectorModeChip } from '../components/DirectorModeChip.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Price } from '../components/ui/Price.tsx';
import { CoinAvatar } from '../components/ui/CoinAvatar.tsx';
import { API_BASE_URL } from '../services/apiConfig.ts';
import type { MarketStats, MarketStatus } from '../types';
import { formatCurrency } from '../services/transactionService.ts';
import { decisionSummaryCopy, directorModeExplanation } from '../utils/persistentRuntimeCopy.ts';
import { regimeCopy, regimeLabel, regimeSentiment } from '../utils/regimeCopy.ts';
import { collectActiveEvents, eventProgress, soonestEndingEvents } from '../utils/worldEvents.ts';
import { formatModifierPct } from '../utils/formatModifierPct.ts';
import { formatRemaining, remainingMs } from '../utils/persistentCountdown.ts';
import { derivedServerNowMs, formatActivityTimestamp } from '../utils/gameLogic.ts';

// World: the simulation as a place, not telemetry — the Director, the
// climate, the Golden/Demon roles, live coin events, the Director log and
// the market pulse (aggregate index chart + stats + tick status).
// /market/stats and /market/status are fetched ONLY while this page is
// mounted, at 10s intervals (no faster polling anywhere).

const TICK_TYPE_COPY: Record<string, string> = {
  STRONG_BOOM: 'Strong upward tick',
  MILD_BOOM: 'Mild upward tick',
  STABLE: 'Flat tick',
  MILD_BUST: 'Mild downward tick',
  STRONG_BUST: 'Strong downward tick'
};

// The live-events card shows the 8 soonest-ending events by default, with a
// toggle for the full list — a 22-row wall is not scannable.
const EVENTS_INITIAL_COUNT = 8;

export function WorldPage() {
  usePageTitle('World · Crypto Chaos');
  const { signals, runtime, runtimeSyncedAt } = usePersistent();
  const { openHowToPlay } = useShellServices();
  const nowLocal = usePersistentCountdownTick(true);
  const [showAllEvents, setShowAllEvents] = useState(false);

  // Page-scoped feeds: mounted only here, 10s cadence.
  const { data: statsData } = useFetch<MarketStats>(`${API_BASE_URL}/market/stats`, 10000);
  const { data: statusData } = useFetch<MarketStatus>(`${API_BASE_URL}/market/status`, 10000);

  const director = runtime?.director ?? null;
  const receivedAtLocal = runtimeSyncedAt ?? Date.now();
  const serverTime = runtime?.serverTime ?? new Date().toISOString();
  const serverNowMs = runtime ? derivedServerNowMs(runtime.serverTime, receivedAtLocal, nowLocal) : nowLocal;
  const windowLeft = director
    ? formatRemaining(remainingMs(director.endsAt, serverTime, receivedAtLocal, nowLocal))
    : null;

  const coinById = new Map((signals?.coins ?? []).map((c) => [c.coinId, c]));
  const regime = signals?.director?.regime ?? null;
  const climateIntensity = signals?.director?.intensity ?? null;

  const events = soonestEndingEvents(collectActiveEvents(runtime), 50);
  const visibleEvents = showAllEvents ? events : events.slice(0, EVENTS_INITIAL_COUNT);

  const golden = director?.goldenCoinId != null ? coinById.get(director.goldenCoinId) : undefined;
  const demon = director?.demonCoinId != null ? coinById.get(director.demonCoinId) : undefined;
  const goldenLeft = director?.goldenExpiresAt
    ? formatRemaining(remainingMs(director.goldenExpiresAt, serverTime, receivedAtLocal, nowLocal))
    : null;
  const demonLeft = director?.demonExpiresAt
    ? formatRemaining(remainingMs(director.demonExpiresAt, serverTime, receivedAtLocal, nowLocal))
    : null;

  return (
    <div className="game-shell py-4 sm:py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">The World</h1>
          <p className="text-sm text-ink-mute mt-1">What the Director is doing to the market right now.</p>
        </div>
        <button
          type="button"
          onClick={openHowToPlay}
          className="chip hover:border-brand hover:text-brand transition-colors min-h-[44px]"
        >
          <HelpCircle className="w-4 h-4" aria-hidden="true" /> How to play
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Director */}
        <Card className="p-5" aria-label="The Director">
          <h2 className="font-display font-bold text-ink mb-3">The Director</h2>
          {director === null ? (
            <p className="text-sm text-ink-mute" role="status">
              {runtime === null ? 'Listening for the Director…' : 'The Director is idle right now.'}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <DirectorModeChip mode={director.mode} timeLeft={windowLeft ?? undefined} />
                {director.direction && (
                  <Badge tone={director.direction === 'POSITIVE' ? 'up' : 'down'}>
                    {director.direction === 'POSITIVE' ? '▲ Upward pressure' : '▼ Downward pressure'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-ink-dim">{directorModeExplanation(director.mode)}</p>
              <div>
                <div className="flex justify-between text-xs text-ink-mute mb-1">
                  <span>Intensity</span>
                  <span className="font-mono tnum">{Math.round(director.intensity * 100)}%</span>
                </div>
                <div
                  className="intensity-meter"
                  role="progressbar"
                  aria-valuenow={Math.round(director.intensity * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Director intensity ${Math.round(director.intensity * 100)} percent`}
                >
                  <div className="intensity-meter-fill" style={{ width: `${Math.round(director.intensity * 100)}%` }} />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Climate */}
        <Card className="p-5" aria-label="Market climate">
          <h2 className="font-display font-bold text-ink mb-3">Market climate</h2>
          {regime === null ? (
            <p className="text-sm text-ink-mute" role="status">Reading the climate…</p>
          ) : (
            <div className="space-y-2">
              <Badge tone={regimeSentiment(regime) === 'positive' ? 'up' : regimeSentiment(regime) === 'negative' ? 'down' : 'neutral'} className="text-sm px-3 py-1">
                {regimeLabel(regime)}
                {climateIntensity !== null && (
                  <span className="font-mono tnum text-ink-mute">· {Math.round(climateIntensity * 100)}%</span>
                )}
              </Badge>
              <p className="text-sm text-ink-dim">{regimeCopy(regime)}</p>
              <p className="text-xs text-ink-mute">The climate is the long-run weather; the Director is the minute-to-minute hand.</p>
            </div>
          )}
        </Card>

        {/* Golden / Demon */}
        <RoleCard
          role="Golden"
          coin={golden}
          timeLeft={goldenLeft}
          explanation="The Golden coin gets the Director's favour — a gentle upward nudge while the role lasts."
        />
        <RoleCard
          role="Demon"
          coin={demon}
          timeLeft={demonLeft}
          explanation="The Demon coin gets dragged down — extra downward pressure while the role lasts."
        />
      </div>

      {/* Live events feed */}
      <Card className="p-5" aria-label="Live coin events">
        <h2 className="font-display font-bold text-ink mb-3">Live events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-ink-mute">No live coin events right now — the market is moving on its own.</p>
        ) : (
          <>
            <ul className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-4">
              {visibleEvents.map(({ coinId, kind, event }) => {
              const coin = coinById.get(coinId);
              const progress = eventProgress(event, serverNowMs);
              const left = formatRemaining(remainingMs(event.endsAt, serverTime, receivedAtLocal, nowLocal));
              return (
                <li key={event.eventId}>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {coin && (
                      <Link to={`/coin/${coinId}`} className="flex items-center gap-2 hover:opacity-80">
                        <CoinAvatar symbol={coin.symbol} coinId={coin.coinId} size="sm" />
                        <span className="font-mono font-bold text-brand">{coin.symbol}</span>
                      </Link>
                    )}
                    <span className="text-sm text-ink flex-1 min-w-0">{event.name}</span>
                    <span className={`font-mono text-xs font-bold tnum ${kind === 'positive' ? 'text-up' : 'text-down'}`}>
                      {formatModifierPct(event.modifierPct, kind)}
                    </span>
                    <span className="font-mono text-xs text-ink-mute tnum">{left}</span>
                  </div>
                  <div className="event-progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${event.name} elapsed`}>
                    <div className="event-progress-fill" style={{ width: `${progress * 100}%` }} />
                  </div>
                </li>
              );
            })}
            </ul>
            {events.length > EVENTS_INITIAL_COUNT && (
              <button
                type="button"
                onClick={() => setShowAllEvents((v) => !v)}
                aria-expanded={showAllEvents}
                className="mt-3 flex items-center gap-2 min-h-[44px] text-sm font-semibold text-ink-mute hover:text-ink transition-colors"
              >
                {showAllEvents ? 'Show fewer events' : `Show all ${events.length} events`}
                <ChevronDown className={`w-4 h-4 transition-transform ${showAllEvents ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </Card>

      {/* Director log */}
      {director && director.recentDecisions.length > 0 && (
        <Card className="p-5" aria-label="Director log">
          <h2 className="font-display font-bold text-ink mb-3">Director log</h2>
          <ol className="space-y-2">
            {director.recentDecisions.map((decision, i) => (
              <li key={`${decision.startedAt}-${decision.summaryCode}-${i}`} className="flex items-start gap-3 text-sm">
                <DirectorModeChip mode={decision.mode} />
                <div className="min-w-0">
                  <p className="text-ink-dim">{decisionSummaryCopy(decision.summaryCode)}</p>
                  <time dateTime={decision.startedAt} className="text-xs text-ink-mute font-mono">
                    {formatActivityTimestamp(decision.startedAt, nowLocal)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Market pulse */}
      <Card className="p-5" aria-label="Market pulse">
        <h2 className="font-display font-bold text-ink mb-3">Market pulse</h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="stat-cell">
            <div className="label mb-1">Index now</div>
            <div className="font-mono text-base sm:text-lg font-semibold text-ink tnum">
              {statsData ? formatCurrency(statsData.currentValue) : '—'}
            </div>
          </div>
          <div className="stat-cell">
            <div className="label mb-1">All-time high</div>
            <div className="font-mono text-base sm:text-lg font-semibold text-ink tnum">
              {statsData ? formatCurrency(statsData.allTimeHigh) : '—'}
            </div>
          </div>
          <div className="stat-cell">
            <div className="label mb-1">All-time low</div>
            <div className="font-mono text-base sm:text-lg font-semibold text-ink tnum">
              {statsData ? formatCurrency(statsData.allTimeLow) : '—'}
            </div>
          </div>
        </div>
        {statusData?.currentCycle && (
          <p className="text-sm text-ink-dim mb-3" role="status">
            Last tick: <strong className="text-ink">{TICK_TYPE_COPY[statusData.currentCycle.type] ?? statusData.currentCycle.type}</strong>
            {' · '}next price tick in <span className="font-mono tnum">{statusData.currentCycle.timeRemaining}</span>
          </p>
        )}
        <MarketValueChart refreshTrigger={0} />
      </Card>
    </div>
  );
}

function RoleCard({
  role,
  coin,
  timeLeft,
  explanation
}: {
  role: 'Golden' | 'Demon';
  coin: { coinId: number; name: string; symbol: string; currentPrice: number; dead: boolean } | undefined;
  timeLeft: string | null;
  explanation: string;
}) {
  const tone = role === 'Golden' ? 'golden' : 'demon';
  const Icon = role === 'Golden' ? Crown : Flame;
  return (
    <Card className="p-5" aria-label={`${role} coin`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${role === 'Golden' ? 'text-golden' : 'text-demon'}`} aria-hidden="true" />
        <h2 className="font-display font-bold text-ink">{role} coin</h2>
      </div>
      {coin ? (
        <div className="space-y-1.5">
          <Link to={`/coin/${coin.coinId}`} className="flex items-center gap-2 group">
            <CoinAvatar symbol={coin.symbol} coinId={coin.coinId} size="sm" dead={coin.dead} />
            <span className="font-semibold text-ink group-hover:text-brand transition-colors">{coin.name}</span>
            <Badge tone={tone}>{role}</Badge>
          </Link>
          <p className="font-mono text-lg font-bold text-ink tnum"><Price value={coin.currentPrice} flash /></p>
          {timeLeft && <p className="text-xs text-ink-mute font-mono tnum">Expires in {timeLeft}</p>}
        </div>
      ) : (
        <p className="text-sm text-ink-mute">{role === 'Golden' ? 'No golden coin right now.' : 'No demon coin right now.'}</p>
      )}
      <p className="text-xs text-ink-mute mt-2">{explanation}</p>
    </Card>
  );
}
