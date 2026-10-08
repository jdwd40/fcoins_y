// Issue #32: pure trade-ticket logic — live validation, the frozen review
// snapshot, readable quantities and the price-aware placeholder. Pure and
// unit-tested (tradeTicket.test.ts); TradeTicket.tsx only renders it.
//
// Contracts preserved:
//   * the trade request still carries the parsed quantity VERBATIM (8dp
//     ledger precision, never rounded) — display helpers here never feed a
//     request;
//   * the server stays authoritative: every rule below is an early mirror
//     of a backend rejection, and the server revalidates at commit time;
//   * no balance is fabricated: an unknown (unprovisioned) cash balance is
//     never used for an affordability verdict.
import { formatCurrency } from '../services/transactionService.ts';
import {
  formatQuantity,
  minTradeValueError,
  parseTradeQuantity
} from './gameLogic.ts';

export type TradeSide = 'BUY' | 'SELL';

export interface TradeFormInput {
  side: TradeSide;
  /** The raw text in the quantity field. */
  raw: string;
  /** The displayed live unit price. */
  price: number;
  /** Server-owned cash, or null when unknown (never fabricated). */
  cash: number | null;
  heldQuantity: number;
  symbol: string;
}

export interface TradeFormValidation {
  /** The parsed quantity to submit verbatim, or null when invalid/empty. */
  quantity: number | null;
  /** 2dp estimate at the displayed price (0 when there is no quantity). */
  estimatedTotal: number;
  /** The message to show inline right now, or null (empty input stays calm). */
  error: string | null;
  /** True only when Review may be pressed. */
  canReview: boolean;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const NEGATIVE_PATTERN = /^\s*[-−]/;
const NON_FINITE_PATTERN = /^\s*[+-]?(?:infinity|nan)\s*$/i;

// Live (as-you-type) validation of the order form. Empty input is calm: no
// message, Review disabled. Every other invalid state — 0, negatives,
// non-finite or malformed text, too much precision, below the £0.01
// minimum, an unaffordable BUY, a SELL above the holding — produces an
// immediate, explicit message and disables Review.
export function validateTradeForm(input: TradeFormInput): TradeFormValidation {
  const invalid = (error: string | null): TradeFormValidation => ({
    quantity: null,
    estimatedTotal: 0,
    error,
    canReview: false
  });
  const text = input.raw.trim();
  if (text === '') return invalid(null);
  if (NEGATIVE_PATTERN.test(text)) return invalid('Quantity must be greater than 0 — negative amounts are not allowed.');
  if (NON_FINITE_PATTERN.test(text) || Number(text) === Infinity) {
    return invalid('Enter a finite quantity (digits with at most one decimal point).');
  }
  const parsed = parseTradeQuantity(text);
  if (!parsed.ok) return invalid(parsed.error);
  if (!Number.isFinite(parsed.value)) return invalid('Enter a finite quantity (digits with at most one decimal point).');
  return validateTradeAmount({ ...input, quantity: parsed.value });
}

// The amount rules for an already-parsed quantity (shared by the live form
// and the review drift check, so both apply the identical verdict).
export function validateTradeAmount(input: Omit<TradeFormInput, 'raw'> & { quantity: number }): TradeFormValidation {
  const { quantity } = input;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { quantity: null, estimatedTotal: 0, error: 'Enter a quantity greater than 0', canReview: false };
  }
  if (!(input.price > 0)) {
    return { quantity: null, estimatedTotal: 0, error: 'This coin has no live price right now.', canReview: false };
  }
  const estimatedTotal = roundMoney(quantity * input.price);
  const withError = (error: string): TradeFormValidation => ({ quantity, estimatedTotal, error, canReview: false });

  const minValue = minTradeValueError(estimatedTotal, input.price);
  if (minValue) return withError(minValue);
  if (input.side === 'BUY' && input.cash !== null && estimatedTotal > input.cash) {
    return withError(`Not enough cash: this trade needs ${formatCurrency(estimatedTotal)} and you have ${formatCurrency(input.cash)}.`);
  }
  if (input.side === 'SELL' && quantity > input.heldQuantity) {
    return withError(`You hold ${formatQuantity(input.heldQuantity)} ${input.symbol} — you cannot sell ${formatQuantity(quantity)}.`);
  }
  return { quantity, estimatedTotal, error: null, canReview: true };
}

// --- Review snapshot -----------------------------------------------------------

// Everything the review panel shows is frozen at review entry. The shared
// context adopts the authoritative post-trade account BEFORE the ticket
// switches to the receipt, so computing "after" figures from LIVE cash and
// holdings while committing applied the estimate twice (the phantom second
// trade). The snapshot is never mutated afterwards.
export interface TradeReviewSnapshot {
  /** The authenticated identity the review was opened for (review R2). */
  userId: string | null;
  side: TradeSide;
  coinId: number;
  symbol: string;
  quantity: number;
  price: number;
  estimatedTotal: number;
  cashBefore: number | null;
  heldBefore: number;
  cashAfter: number | null;
  holdingAfter: number;
}

export function createReviewSnapshot(args: {
  userId: string | null;
  side: TradeSide;
  coinId: number;
  symbol: string;
  quantity: number;
  price: number;
  cash: number | null;
  heldQuantity: number;
}): TradeReviewSnapshot {
  const estimatedTotal = roundMoney(args.quantity * args.price);
  const cashAfter = args.cash === null
    ? null
    : roundMoney(args.side === 'BUY' ? args.cash - estimatedTotal : args.cash + estimatedTotal);
  const holdingAfter = Math.max(0, args.side === 'BUY' ? args.heldQuantity + args.quantity : args.heldQuantity - args.quantity);
  return Object.freeze({
    userId: args.userId,
    side: args.side,
    coinId: args.coinId,
    symbol: args.symbol,
    quantity: args.quantity,
    price: args.price,
    estimatedTotal,
    cashBefore: args.cash,
    heldBefore: args.heldQuantity,
    cashAfter,
    holdingAfter
  });
}

// Review R2/R3: a frozen review is an order for ONE identity and ONE
// instrument. Confirm re-checks both against the CURRENT ticket context and
// refuses (never re-targets) an order whose identity or coin changed — the
// request is built only from the snapshot (side, coinId, quantity
// verbatim), never from whatever the ticket renders now.
export function reviewMatchesContext(
  snapshot: TradeReviewSnapshot,
  current: { userId: string | null; coinId: number }
): boolean {
  return snapshot.userId !== null
    && snapshot.userId === current.userId
    && snapshot.coinId === current.coinId;
}

export interface ReviewDrift {
  /** The live price moved since review entry. */
  priceMoved: boolean;
  /** The live estimate at the current price (2dp). */
  liveEstimatedTotal: number;
  /** Cash/holding changed since review entry (another trade, a resync). */
  accountChanged: boolean;
  /** The order is no longer valid against the LIVE account/price. */
  blockingError: string | null;
}

// Honest drift reporting while the review is OPEN (not while committing —
// then the change is our own trade being adopted). The trade always
// executes at the server-locked live price; the review never pretends
// otherwise and blocks Confirm when the order became invalid.
export function reviewDrift(
  snapshot: TradeReviewSnapshot,
  live: { price: number; cash: number | null; heldQuantity: number }
): ReviewDrift {
  const priceMoved = live.price !== snapshot.price;
  const accountChanged = live.cash !== snapshot.cashBefore || live.heldQuantity !== snapshot.heldBefore;
  const liveCheck = validateTradeAmount({
    side: snapshot.side,
    quantity: snapshot.quantity,
    price: live.price,
    cash: live.cash,
    heldQuantity: live.heldQuantity,
    symbol: snapshot.symbol
  });
  return {
    priceMoved,
    liveEstimatedTotal: roundMoney(snapshot.quantity * live.price),
    accountChanged,
    blockingError: liveCheck.canReview ? null : liveCheck.error
  };
}

// --- Readable quantities -------------------------------------------------------

// Compact display for positions, lists and the review ("9,182.74 PLD"):
// grouped thousands, at most 2 decimals from 1,000 up, at most 4 decimals
// from 1 up, and 4 significant digits below 1 — never exponent notation and
// never rounded to zero for a positive amount. The exact ledger value stays
// discoverable through formatQuantity (title/receipt). Display only.
export function formatQuantityCompact(quantity: number): string {
  if (!Number.isFinite(quantity)) return '0';
  if (quantity === 0) return '0';
  const abs = Math.abs(quantity);
  if (abs >= 1000) {
    return quantity.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  }
  if (abs >= 1) {
    return quantity.toLocaleString('en-GB', { maximumFractionDigits: 4 });
  }
  return quantity.toLocaleString('en-GB', {
    maximumSignificantDigits: 4,
    maximumFractionDigits: 8
  });
}

/** True when the compact display hides precision the exact value carries. */
export function isQuantityAbbreviated(quantity: number): boolean {
  return formatQuantityCompact(quantity).replace(/,/g, '') !== formatQuantity(quantity);
}

// --- Price-aware placeholder -------------------------------------------------

export const PLACEHOLDER_NOTIONAL = 100;

// A sensible example quantity: about £100 at the displayed price, rounded to
// two significant digits ("920" for a £0.1089 coin, "0.0024" for a £41,601
// coin). Returns a neutral fallback without a live price.
export function quantityPlaceholder(price: number, notional = PLACEHOLDER_NOTIONAL): string {
  if (!Number.isFinite(price) || price <= 0) return '0';
  const raw = notional / price;
  const rounded = Number(raw.toPrecision(2));
  if (rounded >= 1) {
    return rounded.toLocaleString('en-GB', { maximumFractionDigits: 0, useGrouping: false });
  }
  return rounded.toLocaleString('en-GB', { maximumSignificantDigits: 2, maximumFractionDigits: 8, useGrouping: false });
}
