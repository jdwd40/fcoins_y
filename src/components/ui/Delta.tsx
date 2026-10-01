// Direction chip: glyph + signed figure + word, never colour alone.

import { deltaParts } from '../../utils/delta.ts';

interface DeltaProps {
  /** Signed percentage, or null when unknown (dead coins). */
  pct: number | null;
  /** Accessible context, e.g. 'in the last minute'. */
  windowLabel?: string;
  className?: string;
}

const DIRECTION_CLASS = {
  up: 'text-up',
  down: 'text-down',
  flat: 'text-flat'
} as const;

export function Delta({ pct, windowLabel = 'in the last minute', className = '' }: DeltaProps) {
  const parts = deltaParts(pct);
  const a11y =
    pct === null
      ? `no movement data ${windowLabel}`
      : parts.direction === 'flat'
        ? `flat, no change ${windowLabel}`
        : `${parts.word} ${Math.abs(pct).toFixed(2)}% ${windowLabel}`;
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-semibold tnum ${DIRECTION_CLASS[parts.direction]} ${className}`.trim()}
    >
      <span aria-hidden="true">{parts.glyph}</span>
      <span aria-hidden="true">{pct === null ? '—' : parts.pctText}</span>
      <span className="sr-only">{a11y}</span>
    </span>
  );
}
