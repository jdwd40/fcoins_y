import { MarketStats as MarketStatsType } from '../types';

interface MarketStatsProps {
  stats: MarketStatsType;
}

const formatValue = (value: number) =>
  value.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const getCycleTone = (type: string) => {
  switch (type.toUpperCase()) {
    case 'STRONG_BOOM':
      return { label: 'Strong Bull', cls: 'text-verdigris', glyph: '▲▲' };
    case 'MILD_BOOM':
    case 'BOOM':
      return { label: 'Mild Bull', cls: 'text-verdigris', glyph: '▲' };
    case 'STRONG_BUST':
      return { label: 'Strong Bear', cls: 'text-oxblood', glyph: '▼▼' };
    case 'MILD_BUST':
    case 'BUST':
      return { label: 'Mild Bear', cls: 'text-oxblood', glyph: '▼' };
    default:
      return { label: 'Stable', cls: 'text-ink-dim', glyph: '◆' };
  }
};

export function MarketStats({ stats }: MarketStatsProps) {
  if (!stats) return null;
  const cycle = getCycleTone(stats.currentCycle.type);

  return (
    <div className="paper-card p-6 sm:p-10">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="label mb-2">Section I · Front Page</div>
          <h2 className="font-display text-4xl sm:text-5xl italic text-ink leading-none"
              style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 50" }}>
            The Ledger
          </h2>
        </div>
        <div className="text-right">
          <div className="label mb-2">Market Cycle</div>
          <div className={`font-mono text-sm font-bold tracking-capstight ${cycle.cls}`}>
            <span className="mr-2">{cycle.glyph}</span>
            {cycle.label.toUpperCase()}
          </div>
          <div className="font-mono text-[0.68rem] text-ink-mute mt-1 tnum">
            {stats.currentCycle.timeRemaining} remaining
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-0 md:gap-0 divide-rule md:divide-y-0">
        <StatBlock
          label="Current Value"
          value={formatValue(stats.currentValue)}
          emphasis
          delay={0}
        />
        <StatBlock
          label="Latest Print"
          value={formatValue(stats.latestValue)}
          delay={100}
        />
        <StatBlock
          label="All-Time High"
          value={formatValue(stats.allTimeHigh)}
          tone="verdigris"
          delay={200}
        />
        <StatBlock
          label="All-Time Low"
          value={formatValue(stats.allTimeLow)}
          tone="oxblood"
          delay={300}
        />
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
  const toneCls = tone === 'verdigris' ? 'text-verdigris' : tone === 'oxblood' ? 'text-oxblood' : 'text-ink';
  return (
    <div
      className="md:border-l md:first:border-l-0 border-rule px-0 md:px-6 py-5 md:py-0 animate-reveal-fast"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="label mb-3">{label}</div>
      <div className={`numeral ${toneCls} ${emphasis ? 'text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl'}`}
           style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 30" }}>
        {value}
      </div>
    </div>
  );
}
