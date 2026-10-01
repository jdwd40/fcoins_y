import React from 'react';
import { Card } from './Card.tsx';

interface EmptyStateProps {
  title: string;
  body?: string;
  action?: React.ReactNode;
}

/** Neutral empty state: one headline, one line of guidance, optional action. */
export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <Card className="p-6 sm:p-8 text-center">
      <p className="font-display font-semibold text-ink text-lg">{title}</p>
      {body && <p className="text-sm text-ink-dim mt-2 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}
