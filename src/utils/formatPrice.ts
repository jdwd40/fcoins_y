// After-Hours Exchange: unit-price formatting.
//
// Unit prices need more precision than money totals: cheap coins trade under
// £1 and a 2dp rendering (£0.10) hides their movement entirely. Rule:
//   >= £1  -> 2dp (£1.19)
//   <  £1  -> 4dp (£0.1021) so sub-pound movement stays visible
//   0      -> £0.00 (a dead coin's price is exactly zero)
// Cash, totals, values, P&L and net worth keep formatCurrency (2dp).

export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value <= 0) return '£0.00';
  if (value >= 1) {
    return value.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  return `£${value.toFixed(4)}`;
}
