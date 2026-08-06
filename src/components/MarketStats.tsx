import type { MarketStatsData } from '../services/marketService';
import type { MarketStatusView } from '../types';
import { formatCountdown } from '../utils/format';

interface MarketStatsProps {
  stats: MarketStatsData;
  status: MarketStatusView;
}

const formatValue = (value: number | null) =>
  value === null
    ? '—'
    : value.toLocaleString('en-GB', {
        style: 'currency',
        currency: 'GBP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });

const getCycleTone = (type: string) => {
  switch (type.toUpperCase()) {
    case 'STRONG_BOOM': return { label: 'Strong bull', cls: 'text-verdigris', glyph: '↗' };
    case 'MILD_BOOM':
    case 'BOOM': return { label: 'Bull market', cls: 'text-verdigris', glyph: '↗' };
    case 'STRONG_BUST': return { label: 'Strong bear', cls: 'text-oxblood', glyph: '↘' };
    case 'MILD_BUST':
    case 'BUST': return { label: 'Bear market', cls: 'text-oxblood', glyph: '↘' };
    default: return { label: 'Stable', cls: 'text-ink-dim', glyph: '→' };
  }
};

export function MarketStats({ stats, status }: MarketStatsProps) {
  if (!stats) return null;
  const cycle = getCycleTone(status.cycle);

  return (
    <div className="paper-card">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
        <div className="p-5 sm:p-6 xl:border-r border-rule bg-paper-alt">
          <div className="label mb-3">Market regime</div>
          <div className={`flex items-center gap-2 font-display text-xl font-bold ${cycle.cls}`}>
            <span>{cycle.glyph}</span> {cycle.label}
          </div>
          <div className="font-mono text-[0.68rem] text-ink-mute mt-2 tnum">
            Reprices in {formatCountdown(status.cycle_seconds_remaining)}
          </div>
        </div>
        <StatBlock label="Market value" value={formatValue(stats.currentValue)} emphasis delay={0} />
        <StatBlock label="Latest value" value={formatValue(stats.latestValue)} delay={80} />
        <StatBlock label="All-time high" value={formatValue(stats.allTimeHigh)} tone="verdigris" delay={160} />
        <StatBlock label="All-time low" value={formatValue(stats.allTimeLow)} tone="oxblood" delay={240} />
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  emphasis,
  tone,
  delay,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: 'verdigris' | 'oxblood';
  delay: number;
}) {
  const toneClass = tone === 'verdigris' ? 'text-verdigris' : tone === 'oxblood' ? 'text-oxblood' : 'text-ink';
  return (
    <div
      className="p-5 sm:p-6 border-t sm:border-t-0 sm:border-l first:border-l-0 border-rule animate-reveal-fast"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="label mb-3">{label}</div>
      <div className={`numeral ${toneClass} ${emphasis ? 'text-3xl' : 'text-2xl'}`}>{value}</div>
    </div>
  );
}
