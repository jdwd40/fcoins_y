// Skeleton loading block (shimmer disabled under reduced motion).

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className = 'h-4 w-full', lines = 1 }: SkeletonProps) {
  if (lines <= 1) {
    return <div className={`skeleton ${className}`} aria-hidden="true" />;
  }
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`skeleton ${className}`} style={i === lines - 1 ? { width: '60%' } : undefined} />
      ))}
    </div>
  );
}
