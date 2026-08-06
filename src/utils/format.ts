// Shared formatting helpers — the only place numbers become display strings.

/** Full GBP format for ordinary values. */
export function formatCurrency(value: number): string {
  return value.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Adaptive GBP: preserves tiny prices that £x.xx would round to zero. */
export function formatAdaptivePrice(value: number): string {
  if (value !== 0 && Math.abs(value) < 0.01) return `£${value.toFixed(6)}`;
  if (Math.abs(value) < 1) return `£${value.toFixed(4)}`;
  return formatCurrency(value);
}

/** Compact notation for market caps / supply (e.g. £12.3M). */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value || 0);
}

/** mm:ss (or h mm) countdown from seconds. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

/** Asset quantity with trimmed trailing zeros. */
export function formatQuantity(value: number): string {
  return value.toLocaleString('en-GB', { maximumFractionDigits: 8 });
}
