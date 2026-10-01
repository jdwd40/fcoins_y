// Segmented control implemented as a radiogroup: arrow-key friendly, with an
// explicit selected state that never relies on colour alone.

import type { ReactNode } from 'react';

interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly { value: T; label: ReactNode; ariaLabel?: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({ label, options, value, onChange, className = '' }: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex rounded-[10px] border border-rule bg-surface-2 p-1 gap-1 ${className}`.trim()}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={`min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors ${
              selected ? 'bg-surface-3 text-ink shadow-sm' : 'text-ink-mute hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
