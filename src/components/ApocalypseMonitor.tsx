import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ShieldCheck, AlertTriangle } from 'lucide-react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type Plugin
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import {
  getMonitorCycles,
  getMonitorSnapshot,
  MonitorApiError,
  type MonitorCycleSummary,
  type MonitorSnapshot
} from '../services/monitorService.ts';
import {
  MONITOR_CHART_MODE_LABEL,
  attributionLabel,
  buildMonitorSeries,
  clampReplayTime,
  formatElapsed,
  formatInspecting,
  formatMonitorChangePct,
  formatMonitorPrice,
  getCoinStateAtTime,
  monitorReplayBounds,
  pickNewestCycle,
  summariseMonitorCoin,
  type MonitorChartMode
} from '../utils/apocalypseMonitor.ts';

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Apocalypse Monitor Phase 3 Plan 1: internal operator dashboard.
//
// Route: /internal/apocalypse-monitor under the /coins basename — internal
// tooling only, deliberately absent from every player navigation surface.
//
// TOKEN HANDLING (hard rules): the diagnostics token is entered manually by
// the operator and lives ONLY in React memory (the `token` state below). It
// is never hard-coded, never read from Vite env, never written to any Web
// Storage and never logged or embedded in an error string. It leaves the
// page solely as `Authorization: Bearer <token>` on diagnostics calls inside
// monitorService.
//
// Phase 4 replay cursor: the operator can scrub one loaded snapshot with a
// slider. `currentReplayTime` is elapsed ms since the cycle start (null =
// the bounds default: cycle end for finished cycles, latest observable for
// ACTIVE). Scrubbing NEVER refetches or mutates monitorData — it is a pure
// read over the loaded snapshot. No auto movement, no live polling: the page
// still fetches one historical snapshot per selected cycle on demand.

// Deterministic per-coin line palette (index-cycled); legible on the paper
// theme in both light and dark.
const LINE_COLORS = [
  '#7132f5', '#0e8a6d', '#c24b3f', '#c9962e', '#2f6fed',
  '#d0559b', '#4da3a3', '#8a6d3b', '#6b4fd8', '#557a2e'
];

const CHART_MODES: readonly MonitorChartMode[] = ['price', 'percent'];

function chartColor(index: number): string {
  return LINE_COLORS[index % LINE_COLORS.length];
}

export function ApocalypseMonitor() {
  // React-memory-only operator token. Never persisted, never logged.
  const [token, setToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [cycles, setCycles] = useState<MonitorCycleSummary[] | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  const [monitorData, setMonitorData] = useState<MonitorSnapshot | null>(null);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<MonitorChartMode>('price');
  // Replay cursor: elapsed ms since the cycle start. Null = the bounds
  // default (cycle end for finished cycles, latest observable for ACTIVE).
  const [currentReplayTime, setCurrentReplayTime] = useState<number | null>(null);

  // Stale-response guard: a slow fetch for a previously selected cycle can
  // never overwrite the newer selection.
  const requestSeq = useRef(0);

  const handleAuthFailure = (err: unknown): boolean => {
    if (err instanceof MonitorApiError && err.status === 401) {
      // Back to the token screen; the message is the fixed invalid-token
      // copy from the service (never the token itself).
      setToken('');
      setCycles(null);
      setSelectedCycle(null);
      setMonitorData(null);
      setCurrentReplayTime(null);
      setUnlockError(err.message);
      return true;
    }
    return false;
  };

  const loadMonitor = async (activeToken: string, cycleId: string) => {
    const seq = ++requestSeq.current;
    setMonitorLoading(true);
    setMonitorError(null);
    try {
      const snapshot = await getMonitorSnapshot(activeToken, cycleId);
      if (seq !== requestSeq.current) return;
      setMonitorData(snapshot);
      // New cycle data: the replay cursor resets to the bounds default
      // (cycle end for finished cycles, latest observable for ACTIVE).
      setCurrentReplayTime(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      if (handleAuthFailure(err)) return;
      setMonitorData(null);
      setCurrentReplayTime(null);
      setMonitorError(err instanceof Error ? err.message : 'Failed to load monitor data');
    } finally {
      if (seq === requestSeq.current) setMonitorLoading(false);
    }
  };

  const handleTokenSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const candidate = tokenInput.trim();
    if (candidate.length === 0 || unlocking) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const result = await getMonitorCycles(candidate);
      // Token accepted — keep it in React memory only, select the newest
      // cycle automatically and load its snapshot.
      setToken(candidate);
      setTokenInput('');
      setCycles(result.cycles);
      const newest = pickNewestCycle(result.cycles);
      setSelectedCycle(newest ? newest.cycleId : null);
      if (newest) {
        void loadMonitor(candidate, newest.cycleId);
      }
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : 'Failed to load monitor cycles');
    } finally {
      setUnlocking(false);
    }
  };

  const handleCycleChange = (cycleId: string) => {
    setSelectedCycle(cycleId);
    void loadMonitor(token, cycleId);
  };

  const handleReset = () => {
    // Drop every trace of the token from memory and return to the gate.
    requestSeq.current += 1;
    setToken('');
    setTokenInput('');
    setCycles(null);
    setSelectedCycle(null);
    setMonitorData(null);
    setCurrentReplayTime(null);
    setMonitorError(null);
    setUnlockError(null);
  };

  const series = useMemo(
    () =>
      monitorData
        ? monitorData.coins.map((coin) => buildMonitorSeries(coin, monitorData.cycle.startTime, chartMode))
        : [],
    [monitorData, chartMode]
  );

  // Phase 4: replay bounds derive purely from the loaded snapshot; the
  // effective cursor is the operator's scrub position (or the bounds
  // default) clamped into range. Scrubbing never refetches monitorData.
  const replayBounds = useMemo(
    () => (monitorData ? monitorReplayBounds(monitorData) : null),
    [monitorData]
  );
  const effectiveReplayMs =
    replayBounds === null
      ? null
      : clampReplayTime(currentReplayTime ?? replayBounds.defaultMs, replayBounds);

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const axisColor = isDark ? '#85899e' : '#686b82';
  const gridColor = isDark ? 'rgba(148, 151, 169, 0.10)' : 'rgba(104, 107, 130, 0.12)';

  // Vertical replay-cursor marker: one dashed line drawn after the datasets
  // at the cursor's x position. Deliberately tiny — no interaction logic.
  const replayCursorPlugin = useMemo<Plugin<'line'>>(
    () => ({
      id: 'replayCursor',
      afterDatasetsDraw(chart) {
        if (effectiveReplayMs === null || !chart.chartArea) return;
        const xScale = chart.scales.x;
        if (!xScale) return;
        const { top, bottom, left, right } = chart.chartArea;
        const xPixel = Math.min(right, Math.max(left, xScale.getPixelForValue(effectiveReplayMs)));
        const { ctx } = chart;
        ctx.save();
        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(xPixel, top);
        ctx.lineTo(xPixel, bottom);
        ctx.stroke();
        ctx.restore();
      }
    }),
    [effectiveReplayMs, axisColor]
  );

  const chartData = {
    datasets: series.map((entry, index) => ({
      label: `${entry.symbol} — ${entry.name}`,
      data: entry.points.map((point) => ({ x: point.elapsedMs, y: point.value })),
      borderColor: chartColor(index),
      backgroundColor: chartColor(index),
      borderWidth: 1.75,
      pointRadius: 2,
      pointHoverRadius: 5,
      spanGaps: false,
      tension: 0.15
    }))
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: {
        display: true,
        labels: { color: axisColor, font: { family: 'Inter', size: 11 }, boxWidth: 14 }
      },
      tooltip: {
        backgroundColor: isDark ? '#12141d' : '#ffffff',
        titleColor: isDark ? '#f5f6fa' : '#101114',
        bodyColor: isDark ? '#c9cbe0' : '#3a3d4f',
        borderColor: isDark ? 'rgba(148,151,169,0.18)' : '#dedee5',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        filter: (item: { parsed: { y: number | null } }) => item.parsed.y !== null,
        callbacks: {
          title: (items: Array<{ parsed: { x: number } }>) =>
            items.length > 0 ? `Elapsed ${formatElapsed(items[0].parsed.x)}` : '',
          label: (context: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            context.parsed.y === null
              ? `${context.dataset.label}: n/a`
              : chartMode === 'price'
                ? `${context.dataset.label}: £${context.parsed.y.toFixed(2)}`
                : `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`
        }
      }
    },
    scales: {
      x: {
        type: 'linear' as const,
        title: { display: true, text: 'Elapsed apocalypse time', color: axisColor, font: { family: 'JetBrains Mono', size: 10 } },
        grid: { display: false },
        border: { color: gridColor },
        ticks: {
          maxRotation: 0,
          color: axisColor,
          font: { family: 'JetBrains Mono', size: 10 },
          callback: (value: number | string) => formatElapsed(Number(value))
        }
      },
      y: {
        title: {
          display: true,
          text: chartMode === 'price' ? 'Price (GBP)' : 'Change vs first observed (%)',
          color: axisColor,
          font: { family: 'JetBrains Mono', size: 10 }
        },
        grid: { color: gridColor },
        border: { display: false },
        ticks: {
          color: axisColor,
          font: { family: 'JetBrains Mono', size: 10 },
          callback: (value: number | string) =>
            chartMode === 'price' ? `£${Number(value)}` : `${Number(value)}%`
        }
      }
    }
  };

  // --- Operator token gate -----------------------------------------------------
  if (cycles === null) {
    return (
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center px-4">
        <div className="paper-card max-w-md w-full p-8 sm:p-10">
          <div className="ornament mb-4"><span className="label-ink">Internal tooling</span></div>
          <h1 className="font-display text-3xl font-bold text-ink mb-2">Apocalypse Monitor</h1>
          <p className="text-sm text-ink-mute mb-6 leading-relaxed">
            Operator diagnostics dashboard. Enter the diagnostics token to load cycle history.
            The token is held in memory only — never stored, never logged.
          </p>
          <form onSubmit={handleTokenSubmit} className="space-y-4">
            <div>
              <label htmlFor="diagnostics-token" className="label block mb-2">Diagnostics token</label>
              <input
                id="diagnostics-token"
                type="password"
                autoComplete="off"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                className="input-ink w-full"
                placeholder="Paste the operator token"
                disabled={unlocking}
              />
            </div>
            {unlockError !== null && (
              <p className="text-sm text-oxblood" role="alert">{unlockError}</p>
            )}
            <button type="submit" className="btn-gold w-full" disabled={unlocking || tokenInput.trim().length === 0}>
              {unlocking ? 'Checking token…' : 'Open monitor'}
            </button>
          </form>
          <p className="mt-6 text-center">
            <Link to="/" className="text-xs text-ink-mute hover:text-ink underline">Back to the exchange</Link>
          </p>
        </div>
      </div>
    );
  }

  // --- Dashboard ---------------------------------------------------------------
  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="game-shell py-6 sm:py-10">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="label mb-1">Internal tooling</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              Apocalypse Monitor
            </h1>
            <p className="text-ink-mute text-sm mt-1">
              Historical per-coin price series with provenance attribution. Read-only operator view.
            </p>
          </div>
          <button type="button" onClick={handleReset} className="btn-ink">
            Use a different token
          </button>
        </div>

        {cycles.length === 0 ? (
          <div className="paper-card max-w-md w-full p-7 text-center">
            <Activity className="w-8 h-8 text-oxblood mx-auto mb-4" aria-hidden="true" />
            <p className="text-ink-dim text-sm leading-relaxed">
              No apocalypse cycles recorded yet. The monitor populates once a cycle has run.
            </p>
          </div>
        ) : (
          <>
            <div className="paper-card p-5 sm:p-6 mb-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[16rem]">
                  <label htmlFor="monitor-cycle" className="label block mb-2">Cycle</label>
                  <select
                    id="monitor-cycle"
                    value={selectedCycle ?? ''}
                    onChange={(event) => handleCycleChange(event.target.value)}
                    className="input-ink w-full"
                    disabled={monitorLoading}
                  >
                    {cycles.map((cycle) => (
                      <option key={cycle.cycleId} value={cycle.cycleId}>
                        {cycle.cycleId} · {cycle.status}{cycle.hasExactHistory ? '' : ' · legacy history'}
                      </option>
                    ))}
                  </select>
                </div>
                {monitorData && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-mute">
                    <span>Status <strong className="text-ink">{monitorData.cycle.status}</strong></span>
                    <span>Observed <strong className="text-ink">{new Date(monitorData.cycle.observedAt).toLocaleString()}</strong></span>
                    <span>
                      Provenance{' '}
                      <strong className={monitorData.exact ? 'text-verdigris' : 'text-oxblood'}>
                        {attributionLabel(monitorData.attribution)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {monitorError !== null && (
              <div className="paper-card max-w-md w-full p-7 text-center mb-6">
                <AlertTriangle className="w-8 h-8 text-oxblood mx-auto mb-4" aria-hidden="true" />
                <p className="text-ink-dim text-sm leading-relaxed mb-4">{monitorError}</p>
                {selectedCycle && (
                  <button type="button" className="btn-ink" onClick={() => void loadMonitor(token, selectedCycle)}>
                    Retry
                  </button>
                )}
              </div>
            )}

            {monitorLoading && (
              <div className="paper-card p-10 text-center mb-6">
                <div className="label animate-flicker">Loading monitor data…</div>
              </div>
            )}

            {!monitorLoading && monitorData && (
              <>
                <div className="paper-card p-6 sm:p-8 mb-6">
                  <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                    <div>
                      <div className="label mb-1">{monitorData.cycle.cycleId}</div>
                      <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">
                        Coin price history
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Chart mode">
                      {CHART_MODES.map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={chartMode === mode}
                          onClick={() => setChartMode(mode)}
                          className={`font-mono text-[0.7rem] tracking-caps uppercase px-3 py-1.5 border transition-all ${
                            chartMode === mode
                              ? 'border-gold text-gold bg-paper-alt'
                              : 'border-transparent text-ink-mute hover:text-ink hover:border-rule'
                          }`}
                        >
                          {MONITOR_CHART_MODE_LABEL[mode]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {series.every((entry) => entry.points.length === 0) ? (
                    <div className="flex items-center justify-center h-64 label">
                      No price history recorded for this cycle
                    </div>
                  ) : (
                    <div className="h-[320px] sm:h-[420px]">
                      <Line data={chartData} options={chartOptions} plugins={[replayCursorPlugin]} />
                    </div>
                  )}

                  {replayBounds !== null && effectiveReplayMs !== null && replayBounds.maxMs > 0 && (
                    <div className="mt-6 border-t border-rule pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <label htmlFor="replay-cursor" className="label">Replay cursor</label>
                        <span className="font-mono text-xs text-ink-mute" aria-live="polite">
                          {formatInspecting(effectiveReplayMs, replayBounds.maxMs)}
                        </span>
                      </div>
                      <input
                        id="replay-cursor"
                        type="range"
                        min={replayBounds.minMs}
                        max={replayBounds.maxMs}
                        step={1000}
                        value={effectiveReplayMs}
                        onChange={(event) => setCurrentReplayTime(Number(event.target.value))}
                        aria-label="Replay position in the cycle"
                        aria-valuetext={`${formatElapsed(effectiveReplayMs)} elapsed of ${formatElapsed(replayBounds.maxMs)}`}
                        className="w-full accent-gold"
                      />
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          className="btn-ink"
                          onClick={() => setCurrentReplayTime(replayBounds.minMs)}
                        >Start</button>
                        <button
                          type="button"
                          className="btn-ink"
                          onClick={() => setCurrentReplayTime(replayBounds.maxMs)}
                        >
                          {monitorData.cycle.status === 'ACTIVE' ? 'Latest' : 'End'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {monitorData.warnings.length > 0 && (
                  <div className="paper-card p-5 sm:p-6 mb-6 border-l-4 border-gold">
                    <div className="label mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-gold" aria-hidden="true" /> Warnings
                    </div>
                    <ul className="space-y-1 text-sm text-ink-dim list-disc pl-5">
                      {monitorData.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="paper-card p-6 sm:p-8">
                  <div className="label mb-4">Per-coin summary</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left label border-b border-rule">
                          <th className="py-2 pr-4">Coin</th>
                          <th className="py-2 pr-4">Provenance</th>
                          <th className="py-2 pr-4 text-right">Start</th>
                          <th className="py-2 pr-4 text-right">End</th>
                          <th className="py-2 pr-4 text-right">Latest</th>
                          <th className="py-2 pr-4 text-right">At cursor</th>
                          <th className="py-2 pr-4 text-right">Cursor Δ</th>
                          <th className="py-2 pr-4 text-right">High</th>
                          <th className="py-2 pr-4 text-right">Low</th>
                          <th className="py-2 pr-4 text-right">Change</th>
                          <th className="py-2 pr-4 text-right">Samples</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monitorData.coins.map((coin) => {
                          const summary = summariseMonitorCoin(coin, monitorData.cycle.endTime);
                          // Point-in-time state at the replay cursor (pure
                          // read over the loaded snapshot — no refetch).
                          const replayState = effectiveReplayMs === null
                            ? null
                            : getCoinStateAtTime(coin, monitorData.cycle.startTime, effectiveReplayMs);
                          return (
                            <tr
                              key={coin.coinId}
                              className={`border-b border-rule ${summary.collapsed ? 'bg-paper-alt' : ''}`}
                            >
                              <td className="py-2 pr-4">
                                <span className="font-semibold text-ink">{coin.symbol}</span>{' '}
                                <span className="text-ink-mute text-xs">{coin.name}</span>
                              </td>
                              <td className="py-2 pr-4 text-xs text-ink-dim">
                                {attributionLabel(summary.attribution)}
                              </td>
                              <td className="py-2 pr-4 text-right tnum">{formatMonitorPrice(summary.startPrice)}</td>
                              <td className="py-2 pr-4 text-right tnum">{formatMonitorPrice(summary.endPrice)}</td>
                              <td className={`py-2 pr-4 text-right tnum ${summary.collapsed ? 'text-oxblood font-bold' : ''}`}>
                                {formatMonitorPrice(summary.latestPrice)}
                              </td>
                              <td className="py-2 pr-4 text-right tnum">
                                {replayState === null || !replayState.available ? (
                                  'n/a'
                                ) : replayState.collapsed ? (
                                  <span className="text-oxblood font-bold">£0.00 COLLAPSED</span>
                                ) : (
                                  formatMonitorPrice(replayState.price)
                                )}
                              </td>
                              <td className={`py-2 pr-4 text-right tnum ${
                                replayState === null || replayState.changePct === null
                                  ? ''
                                  : replayState.changePct >= 0
                                    ? 'text-verdigris'
                                    : 'text-oxblood'
                              }`}>
                                {formatMonitorChangePct(replayState === null ? null : replayState.changePct)}
                              </td>
                              <td className="py-2 pr-4 text-right tnum">{formatMonitorPrice(summary.highPrice)}</td>
                              <td className="py-2 pr-4 text-right tnum">{formatMonitorPrice(summary.lowPrice)}</td>
                              <td className={`py-2 pr-4 text-right tnum ${
                                summary.changeAbs === null ? '' : summary.changeAbs >= 0 ? 'text-verdigris' : 'text-oxblood'
                              }`}>
                                {summary.changeAbs === null
                                  ? 'n/a'
                                  : `${summary.changeAbs >= 0 ? '+' : ''}${formatMonitorPrice(summary.changeAbs).replace('£-', '-£')} · ${formatMonitorChangePct(summary.changePct)}`}
                              </td>
                              <td className="py-2 pr-4 text-right tnum">{summary.sampleCount}</td>
                              <td className="py-2">
                                {summary.collapsed ? (
                                  <span className="inline-flex items-center gap-1 font-mono text-[0.7rem] tracking-caps uppercase text-oxblood font-bold">
                                    <ShieldCheck className="w-3 h-3" aria-hidden="true" /> COLLAPSED · £0.00
                                  </span>
                                ) : summary.hasCollapseEvent ? (
                                  <span className="font-mono text-[0.7rem] tracking-caps uppercase text-ink-mute">
                                    COLLAPSE EVENT
                                  </span>
                                ) : (
                                  <span className="font-mono text-[0.7rem] tracking-caps uppercase text-verdigris">LIVE</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
