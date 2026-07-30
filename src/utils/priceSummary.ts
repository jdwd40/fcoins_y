export interface PeriodSummary {
  first: number;
  last: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  direction: 'up' | 'down' | 'flat';
}

export function computePeriodSummary(
  points: { high: number; low: number; close: number }[],
  latestValue: number
): PeriodSummary | null {
  if (!points || points.length === 0) {
    return null;
  }

  const first = points[0].close;
  const last = latestValue;
  const change = last - first;
  const changePct = first !== 0 ? (change / first) * 100 : 0;

  const high = Math.max(...points.map(p => p.high));
  const low = Math.min(...points.map(p => p.low));

  let direction: 'up' | 'down' | 'flat';
  if (Math.abs(changePct) < 0.005 || change === 0) {
    direction = 'flat';
  } else if (change > 0) {
    direction = 'up';
  } else {
    direction = 'down';
  }

  return {
    first,
    last,
    change,
    changePct,
    high,
    low,
    direction,
  };
}
