import { formatQuantity } from '../../utils/gameLogic.ts';
import { formatQuantityCompact, isQuantityAbbreviated } from '../../utils/tradeTicket.ts';

// Issue #32: a readable coin quantity ("9,182.74 PLD") whose exact ledger
// value stays discoverable — a hover title for pointer users and an
// sr-only exact reading for assistive tech. Display only: never a source of
// trade-request precision.
interface QuantityTextProps {
  value: number;
  symbol?: string;
  className?: string;
}

export function QuantityText({ value, symbol, className }: QuantityTextProps) {
  const suffix = symbol ? ` ${symbol}` : '';
  const compact = formatQuantityCompact(value);
  if (!isQuantityAbbreviated(value)) {
    return <span className={className}>{compact}{suffix}</span>;
  }
  const exact = `${formatQuantity(value)}${suffix}`;
  return (
    <span className={className} title={`Exact: ${exact}`} data-exact-quantity={formatQuantity(value)}>
      <span aria-hidden="true">{compact}{suffix}</span>
      <span className="sr-only">{exact}</span>
    </span>
  );
}
