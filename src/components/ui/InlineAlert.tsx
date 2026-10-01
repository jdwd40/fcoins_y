import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

// Inline alert: error = role="alert", anything else = role="status".

interface InlineAlertProps {
  tone?: 'error' | 'warn' | 'info';
  children: React.ReactNode;
  className?: string;
}

const TONE = {
  error: { border: 'border-down/50', text: 'text-down', role: 'alert' as const, Icon: AlertTriangle },
  warn: { border: 'border-warn/50', text: 'text-warn', role: 'status' as const, Icon: AlertTriangle },
  info: { border: 'border-brand/50', text: 'text-brand', role: 'status' as const, Icon: Info }
};

export function InlineAlert({ tone = 'info', children, className = '' }: InlineAlertProps) {
  const { border, text, role, Icon } = TONE[tone];
  return (
    <div
      role={role}
      className={`flex items-start gap-2 rounded-lg border ${border} bg-surface-2 px-3 py-2 text-sm ${className}`.trim()}
    >
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${text}`} aria-hidden="true" />
      <div className="text-ink-dim min-w-0">{children}</div>
    </div>
  );
}
