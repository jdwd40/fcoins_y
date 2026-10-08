// Issue #32: live trade-ticket validation, the frozen review snapshot,
// readable quantities and the price-aware placeholder (pure logic).
// node:test / node:assert/strict via the typed test-only bridge (the app
// TS project has no @types/node; see testing/nodeTestRunner.js).
import { test, assert } from './testing/nodeTestRunner.js';

import {
  createReviewSnapshot,
  formatQuantityCompact,
  isQuantityAbbreviated,
  quantityPlaceholder,
  reviewDrift,
  reviewMatchesContext,
  validateTradeAmount,
  validateTradeForm
} from './tradeTicket.ts';
import { formatQuantity } from './gameLogic.ts';
import { formatPrice } from './formatPrice.ts';

const BUY = { side: 'BUY' as const, price: 0.1089, cash: 9000, heldQuantity: 0, symbol: 'PLD' };
const SELL = { side: 'SELL' as const, price: 0.1089, cash: 9000, heldQuantity: 9182.73645546, symbol: 'PLD' };

test('empty input is calm: no message, Review disabled', () => {
  const v = validateTradeForm({ ...BUY, raw: '' });
  assert.equal(v.error, null);
  assert.equal(v.canReview, false);
  assert.equal(validateTradeForm({ ...BUY, raw: '   ' }).error, null);
});

test('quantity 0 shows an explicit message and disables Review', () => {
  for (const raw of ['0', '0.0', '0.00000000', '.0']) {
    const v = validateTradeForm({ ...BUY, raw });
    assert.equal(v.canReview, false, raw);
    assert.match(v.error ?? '', /greater than 0/, raw);
  }
});

test('negatives, non-finite and malformed entries are explicit errors (never silently ignored)', () => {
  assert.match(validateTradeForm({ ...BUY, raw: '-5' }).error ?? '', /greater than 0 — negative/);
  assert.match(validateTradeForm({ ...BUY, raw: '−5' }).error ?? '', /negative/); // unicode minus
  assert.match(validateTradeForm({ ...BUY, raw: 'Infinity' }).error ?? '', /finite/);
  assert.match(validateTradeForm({ ...BUY, raw: 'NaN' }).error ?? '', /finite/);
  assert.match(validateTradeForm({ ...BUY, raw: '1e5' }).error ?? '', /valid decimal/);
  assert.match(validateTradeForm({ ...BUY, raw: '1.2.3' }).error ?? '', /valid decimal/);
  assert.match(validateTradeForm({ ...BUY, raw: '9'.repeat(400) }).error ?? '', /finite/);
  assert.match(validateTradeForm({ ...BUY, raw: '1.123456789' }).error ?? '', /8 decimal places/);
  for (const raw of ['-5', 'Infinity', 'abc', '1e5']) {
    assert.equal(validateTradeForm({ ...BUY, raw }).canReview, false, raw);
  }
});

test('below the £0.01 minimum notional is rejected live', () => {
  const v = validateTradeForm({ ...BUY, raw: '0.04' }); // £0.0044 -> £0.00
  assert.equal(v.canReview, false);
  assert.match(v.error ?? '', /at least £0\.01/);
  assert.equal(validateTradeForm({ ...BUY, raw: '0.1' }).canReview, true); // £0.01
});

test('an unaffordable BUY says "Not enough cash" immediately and disables Review', () => {
  const ok = validateTradeForm({ ...BUY, cash: 1000, raw: '9182.73645546' }); // exactly £1,000.00
  assert.equal(ok.canReview, true);
  const tooMuch = validateTradeForm({ ...BUY, cash: 999.99, raw: '9182.73645546' });
  assert.equal(tooMuch.canReview, false);
  assert.match(tooMuch.error ?? '', /^Not enough cash: this trade needs £1,000\.00 and you have £999\.99\.$/);
  // Unknown (unprovisioned) cash is never a fabricated verdict: server decides.
  assert.equal(validateTradeForm({ ...BUY, cash: null, raw: '100' }).canReview, true);
});

test('an excessive SELL is rejected live; selling exactly the holding is allowed', () => {
  const over = validateTradeForm({ ...SELL, raw: '9182.73645547' });
  assert.equal(over.canReview, false);
  assert.match(over.error ?? '', /You hold 9182\.73645546 PLD — you cannot sell 9182\.73645547\./);
  assert.equal(validateTradeForm({ ...SELL, raw: '9182.73645546' }).canReview, true);
});

test('the submitted quantity keeps full ledger precision (never the display rounding)', () => {
  const v = validateTradeForm({ ...BUY, raw: '9182.73645546' });
  assert.equal(v.quantity, 9182.73645546);
  assert.equal(v.estimatedTotal, 1000);
  assert.equal(validateTradeAmount({ ...BUY, quantity: 0 }).canReview, false);
});

test('review snapshot: account adoption while committing can never show a phantom second trade', () => {
  // Issue evidence: a £1,000 PLD buy from £10,000 cash.
  const snapshot = createReviewSnapshot({ userId: '7', side: 'BUY', coinId: 101, symbol: 'PLD', quantity: 9182.73645546, price: 0.1089, cash: 10000, heldQuantity: 0 });
  assert.equal(snapshot.estimatedTotal, 1000);
  assert.equal(snapshot.cashAfter, 9000);
  assert.equal(snapshot.holdingAfter, 9182.73645546);
  // The context now adopts the server account (cash 9000, holding 9182.73…):
  // the snapshot is frozen, so the review still reads 9000 / 9182.73, never
  // 8000 / 18365.47 as the issue screenshot showed.
  assert.ok(Object.isFrozen(snapshot));
  assert.throws(() => { (snapshot as { cashAfter: number | null }).cashAfter = 8000; });
  assert.equal(snapshot.cashAfter, 9000);
  assert.equal(formatQuantityCompact(snapshot.holdingAfter), '9,182.74');

  const sell = createReviewSnapshot({ userId: '7', side: 'SELL', coinId: 101, symbol: 'PLD', quantity: 4591.36822773, price: 0.1089, cash: 9000, heldQuantity: 9182.73645546 });
  assert.equal(sell.cashAfter, 9500);
  assert.equal(sell.holdingAfter, 9182.73645546 - 4591.36822773);
});

test('review drift: price moves and account changes are reported; an order made invalid blocks Confirm', () => {
  const snapshot = createReviewSnapshot({ userId: '7', side: 'BUY', coinId: 101, symbol: 'PLD', quantity: 9182.73645546, price: 0.1089, cash: 1000, heldQuantity: 0 });
  const same = reviewDrift(snapshot, { price: 0.1089, cash: 1000, heldQuantity: 0 });
  assert.deepEqual(same, { priceMoved: false, liveEstimatedTotal: 1000, accountChanged: false, blockingError: null });

  const moved = reviewDrift(snapshot, { price: 0.1095, cash: 1000, heldQuantity: 0 });
  assert.equal(moved.priceMoved, true);
  assert.equal(moved.liveEstimatedTotal, 1005.51);
  assert.match(moved.blockingError ?? '', /Not enough cash/); // £1,005.51 > £1,000

  const spent = reviewDrift(snapshot, { price: 0.1089, cash: 400, heldQuantity: 0 });
  assert.equal(spent.accountChanged, true);
  assert.match(spent.blockingError ?? '', /Not enough cash/);

  const sellSnap = createReviewSnapshot({ userId: '7', side: 'SELL', coinId: 101, symbol: 'PLD', quantity: 100, price: 0.1089, cash: 0, heldQuantity: 100 });
  assert.match(reviewDrift(sellSnap, { price: 0.1089, cash: 0, heldQuantity: 50 }).blockingError ?? '', /you cannot sell/);
});

test('a review is bound to its identity and instrument (review R2/R3)', () => {
  const snapshot = createReviewSnapshot({ userId: '7', side: 'BUY', coinId: 1, symbol: 'FTR', quantity: 123.12345678, price: 0.1089, cash: 10000, heldQuantity: 0 });
  assert.equal(snapshot.userId, '7');
  assert.equal(reviewMatchesContext(snapshot, { userId: '7', coinId: 1 }), true);
  // Another signed-in identity can never confirm A's frozen review.
  assert.equal(reviewMatchesContext(snapshot, { userId: '8', coinId: 1 }), false);
  // Signed out.
  assert.equal(reviewMatchesContext(snapshot, { userId: null, coinId: 1 }), false);
  // The ticket now renders a different coin: the FTR review must not post BYT.
  assert.equal(reviewMatchesContext(snapshot, { userId: '7', coinId: 3 }), false);
  // A snapshot without an identity is never confirmable.
  const anonymous = createReviewSnapshot({ userId: null, side: 'BUY', coinId: 1, symbol: 'FTR', quantity: 1, price: 1, cash: null, heldQuantity: 0 });
  assert.equal(reviewMatchesContext(anonymous, { userId: null, coinId: 1 }), false);
  // The submitted quantity is the frozen value verbatim (8dp, never rounded).
  assert.equal(snapshot.quantity, 123.12345678);
});

test('compact quantities are readable; exact precision stays discoverable', () => {
  assert.equal(formatQuantityCompact(9182.73645546), '9,182.74');
  assert.equal(formatQuantityCompact(1234567.891), '1,234,567.89');
  assert.equal(formatQuantityCompact(25.12345678), '25.1235');
  assert.equal(formatQuantityCompact(1), '1');
  assert.equal(formatQuantityCompact(0.08603482), '0.08603');
  assert.equal(formatQuantityCompact(0.00000001), '0.00000001'); // never 0, never 1e-8
  assert.equal(formatQuantityCompact(0), '0');
  assert.equal(isQuantityAbbreviated(9182.73645546), true);
  assert.equal(isQuantityAbbreviated(12.5), false);
  assert.equal(formatQuantity(9182.73645546), '9182.73645546'); // the receipt value
});

test('the placeholder follows the price (about £100 worth)', () => {
  assert.equal(quantityPlaceholder(0.1089), '920');
  assert.equal(quantityPlaceholder(41601.0542), '0.0024');
  assert.equal(quantityPlaceholder(32.7869), '3');
  assert.equal(quantityPlaceholder(1.0515), '95');
  assert.equal(quantityPlaceholder(0), '0');
  assert.notEqual(quantityPlaceholder(0.1089), '0.004');
});

test('issue #55 consumer check: a precise sub-£1 average entry renders as the receipt price', () => {
  // Backend #55 now returns costBasis / quantity unrounded.
  assert.equal(formatPrice(1000 / 9182.73645546), '£0.1089');
  assert.equal(formatPrice(0.11), '£0.1100'); // what the old rounded value displayed
});
