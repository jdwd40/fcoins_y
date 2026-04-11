import type { MarketStatus as MarketStatusType } from '../types';

interface MarketStatusProps {
  status: MarketStatusType;
}

const formatCycleType = (type: string) => {
  switch (type) {
    case 'STRONG_BOOM': return 'Strong Bull';
    case 'MILD_BOOM':
    case 'BOOM': return 'Mild Bull';
    case 'STRONG_BUST': return 'Strong Bear';
    case 'MILD_BUST':
    case 'BUST': return 'Mild Bear';
    case 'STABLE': return 'Stable';
    default: return type;
  }
};

export function MarketStatus({ status }: MarketStatusProps) {
  const type = status?.currentCycle?.type || 'STABLE';
  const isBull = type.includes('BOOM');
  const tone = isBull ? 'text-verdigris' : type.includes('BUST') ? 'text-oxblood' : 'text-ink';
  const effect = status?.currentCycle?.baseEffect ?? 0;

  return (
    <div className="paper-card h-full p-6 sm:p-8 flex flex-col">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="label mb-1">Dispatch</div>
          <h3 className="font-display text-3xl italic text-ink"
              style={{ fontVariationSettings: "'opsz' 144" }}>
            The Tide
          </h3>
        </div>
        <span className="chip">
          <span className="live-dot" style={{ background: 'currentColor' }}></span>
          Live
        </span>
      </div>

      <div className="rule-thin mb-6"></div>

      <div className="mb-6">
        <div className="label mb-2">Current Cycle</div>
        <div className={`font-display text-5xl italic leading-none ${tone}`}
             style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40" }}>
          {formatCycleType(type)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-auto pt-6 border-t border-rule">
        <div>
          <div className="label mb-1">Ends In</div>
          <div className="font-mono text-lg text-ink tnum">
            {status?.currentCycle?.timeRemaining || '--:--'}
          </div>
        </div>
        <div>
          <div className="label mb-1">Base Effect</div>
          <div className={`font-mono text-lg tnum ${tone}`}>
            {effect >= 0 ? '+' : ''}{(effect * 100).toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}
