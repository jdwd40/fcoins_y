import React from 'react';

// Pill badge. Colour only reinforces — every badge carries an icon and/or a
// word, never colour alone.

export type BadgeTone = 'neutral' | 'brand' | 'up' | 'down' | 'director' | 'golden' | 'demon' | 'warn';

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'border-rule bg-surface-2 text-ink-dim',
  brand: 'border-brand/40 bg-brand/10 text-brand',
  up: 'border-up/40 bg-up/10 text-up',
  down: 'border-down/40 bg-down/10 text-down',
  director: 'border-director/40 bg-director/10 text-director',
  golden: 'border-golden/50 bg-golden/10 text-golden',
  demon: 'border-demon/50 bg-demon/10 text-demon',
  warn: 'border-warn/50 bg-warn/10 text-warn'
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className = '', children, ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE_CLASS[tone]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </span>
  );
}
