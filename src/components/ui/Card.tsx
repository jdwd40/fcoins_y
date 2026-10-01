import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article';
}

/** The standard 16px-radius surface card. */
export function Card({ as: Tag = 'div', className = '', children, ...rest }: CardProps) {
  return (
    <Tag className={`paper-card ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
