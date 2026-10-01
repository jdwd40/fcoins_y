import React from 'react';

// Stat: label + value pair for summary grids.

interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
  valueClassName?: string;
}

export function Stat({ label, value, sub, className = '', valueClassName = '' }: StatProps) {
  return (
    <div className={`stat-cell ${className}`.trim()}>
      <div className="label mb-1">{label}</div>
      <div className={`font-mono text-base sm:text-lg font-semibold text-ink tnum ${valueClassName}`.trim()}>{value}</div>
      {sub && <div className="text-xs text-ink-mute mt-0.5">{sub}</div>}
    </div>
  );
}
