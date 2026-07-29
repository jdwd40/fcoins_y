import { Activity, Clock3, Gauge } from 'lucide-react';
import type { MarketStatus as MarketStatusType } from '../types';

interface MarketStatusProps {
  status: MarketStatusType;
}

const formatCycleType = (type: string) => {
  switch (type) {
    case 'STRONG_BOOM': return 'Strong Bull';
    case 'MILD_BOOM':
    case 'BOOM': return 'Bull Market';
    case 'STRONG_BUST': return 'Strong Bear';
    case 'MILD_BUST':
    case 'BUST': return 'Bear Market';
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
    <div className="paper-card h-full p-6 sm:p-7 flex flex-col">
      <div className="flex items-start justify-between gap-4 mb-7">
        <div>
          <div className="label mb-2">Market pulse</div>
          <h3 className="font-display text-2xl font-bold text-ink">Simulation status</h3>
        </div>
        <span className="chip text-verdigris">
          <span className="live-dot" /> Live
        </span>
      </div>

      <div className="rounded-xl bg-paper-alt border border-rule p-5 mb-5">
        <div className="flex items-center gap-2 label mb-3"><Activity className="w-3.5 h-3.5" /> Current cycle</div>
        <div className={`font-display text-3xl font-bold tracking-tight ${tone}`}>{formatCycleType(type)}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-auto">
        <div className="rounded-xl border border-rule p-4">
          <div className="flex items-center gap-2 label mb-2"><Clock3 className="w-3.5 h-3.5" /> Reprice</div>
          <div className="font-mono text-base font-semibold text-ink tnum">
            {status?.currentCycle?.timeRemaining || '--:--'}
          </div>
        </div>
        <div className="rounded-xl border border-rule p-4">
          <div className="flex items-center gap-2 label mb-2"><Gauge className="w-3.5 h-3.5" /> Drift</div>
          <div className={`font-mono text-base font-semibold tnum ${tone}`}>
            {effect >= 0 ? '+' : ''}{(effect * 100).toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}
