// After-Hours Exchange: price-flash diff.
//
// When the shared poll delivers a new price, the price cell flashes a brief
// up/down tint (~600ms, CSS-only, disabled under prefers-reduced-motion).
// This pure helper decides the flash direction so components stay dumb.

export type PriceFlashDirection = 'up' | 'down' | null;

export function priceFlashDirection(
  previous: number | null | undefined,
  next: number | null | undefined
): PriceFlashDirection {
  if (previous === null || previous === undefined) return null;
  if (next === null || next === undefined) return null;
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return null;
  if (next > previous) return 'up';
  if (next < previous) return 'down';
  return null;
}
