import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Check, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePersistent } from '../context/PersistentContext.tsx';
import { SessionExpiredError, formatCurrency } from '../services/transactionService.ts';
import { GameApiError } from '../services/gameService.ts';
import type { PersistentTradeResult } from '../services/persistentService.ts';
import {
  formatQuantity,
  quantityForNotional,
  quickBuyLabel,
  QUICK_BUY_NOTIONALS
} from '../utils/gameLogic.ts';
import {
  createReviewSnapshot,
  formatQuantityCompact,
  isQuantityAbbreviated,
  quantityPlaceholder,
  reviewDrift,
  reviewMatchesContext,
  validateTradeAmount,
  validateTradeForm
} from '../utils/tradeTicket.ts';
import type { TradeReviewSnapshot } from '../utils/tradeTicket.ts';
import {
  persistentTradeBlockReason,
  PERSISTENT_TRADE_BLOCK_LABEL
} from '../utils/persistentTrading.ts';
import { formatPrice } from '../utils/formatPrice.ts';
import { Button } from './ui/Button.tsx';
import { SegmentedControl } from './ui/SegmentedControl.tsx';
import { InlineAlert } from './ui/InlineAlert.tsx';
import { QuantityText } from './ui/QuantityText.tsx';
import { useShellServices } from './shell/shellServices.ts';

// The ONE trade ticket — used inline on the Coin page and inside the trade
// sheet. Buys and sells settle against the player's persistent account at
// the server-locked live price; the request carries only
// { coin_id, quantity } and the price is never client input.
//
// Every trade (quick-buy chips and sell-all included) passes a review step
// before committing. Server domain rejections render verbatim and the
// account resyncs through the shared context. Success is never optimistic:
// the receipt renders the SERVER transaction only.
//
// Issue #32: the form validates as the player types (inline, accessible
// message; Review disabled while invalid). The review panel renders a
// snapshot frozen at review entry (quantity, price, cash, holding): the
// context adopts the server's post-trade account BEFORE the receipt shows,
// so live figures would apply the estimate twice ("phantom" second trade).
// While the review is open (not committing) live price/account drift is
// reported honestly and an order that became invalid cannot be confirmed.
//
// Identity/instrument binding (review R2/R3): the ticket can stay mounted
// across sign-out/sign-in and across a coin route change (the desktop
// ticket is not keyed). Every review/receipt stage belongs to ONE binding
// generation (authenticated user + coin); a binding change starts a new
// generation, discarding the old review, receipt, typed amount and error.
// Confirm re-verifies the reviewed identity and coin and builds the request
// ONLY from the snapshot. A completion (receipt, toast, error, session
// expiry) that settles after its generation ended is suppressed — the
// already-committed server trade is never "cancelled" or re-targeted, and
// PersistentContext's own identity gate still decides account adoption.

type TradeStage =
  | { stage: 'form' }
  | { stage: 'review'; generation: number; snapshot: TradeReviewSnapshot }
  | { stage: 'receipt'; generation: number; snapshot: TradeReviewSnapshot; result: PersistentTradeResult };

const FORM_STAGE: TradeStage = { stage: 'form' };

interface TradeTicketProps {
  coinId: number;
  /** Initial side (the mobile sticky bar opens the sheet per side). */
  initialSide?: 'BUY' | 'SELL';
  /** Called after a successful trade (the sheet closes itself). */
  onDone?: () => void;
}

export function TradeTicket({ coinId, initialSide = 'BUY', onDone }: TradeTicketProps) {
  const { user, handleSessionExpired } = useAuth();
  const { showToast } = useToast();
  const { openAuth } = useShellServices();
  const { account, synced, provisioned, accountError, signals, trade, syncNow } = usePersistent();

  const [side, setSide] = useState<'BUY' | 'SELL'>(initialSide);
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawStage, setStage] = useState<TradeStage>(FORM_STAGE);

  // --- Identity/instrument binding generation (review R2/R3) ---------------
  const currentUserId = user ? String(user.id) : null;
  const bindingKey = `${currentUserId ?? ''}|${coinId}`;
  const [binding, setBinding] = useState({ key: bindingKey, generation: 0 });
  if (binding.key !== bindingKey) {
    // Adjust state while rendering (no stale frame): a new identity or coin
    // gets a fresh form; nothing from the previous binding survives.
    setBinding({ key: bindingKey, generation: binding.generation + 1 });
    setStage(FORM_STAGE);
    setAmount('');
    setError(null);
    setPending(false);
  }
  const generation = binding.generation;
  // Async completions compare against the LATEST committed generation.
  const generationRef = useRef(generation);
  const userIdRef = useRef(currentUserId);
  const mountedRef = useRef(true);
  useLayoutEffect(() => {
    generationRef.current = generation;
    userIdRef.current = currentUserId;
  }, [generation, currentUserId]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // A stage from an older generation is never rendered (belt and braces
  // for the in-render reset above).
  const stage: TradeStage = rawStage.stage !== 'form' && rawStage.generation !== generation ? FORM_STAGE : rawStage;

  const coin = signals?.coins.find((c) => c.coinId === coinId) ?? null;
  const holding = useMemo(
    () => account?.holdings.find((h) => h.coinId === coinId) ?? null,
    [account, coinId]
  );
  const heldQuantity = holding?.quantity ?? 0;
  const cash = account?.cash ?? null;
  const currentPrice = coin?.currentPrice ?? 0;
  const dead = coin === null || coin.dead;

  const symbol = coin?.symbol ?? '';

  // Live validation on every render (as the player types, and whenever the
  // shared poll moves the price, cash or holding).
  const validation = validateTradeForm({ side, raw: amount, price: currentPrice, cash, heldQuantity, symbol });
  const estimatedTotal = validation.estimatedTotal;
  // Per-instance ids: the coin page renders a desktop ticket (CSS-hidden on
  // phones) AND the phone trade sheet, so coin-based ids would collide and
  // the sheet's label/error would point at the hidden desktop input.
  const fieldId = `trade-quantity-${coinId}-${useId().replace(/:/g, '')}`;
  const errorId = `${fieldId}-error`;

  const commitTrade = async (snap: TradeReviewSnapshot) => {
    // Review R2/R3: the reviewed identity and instrument must still be the
    // ticket's. Otherwise refuse — never re-target the order.
    if (!reviewMatchesContext(snap, { userId: currentUserId, coinId })) {
      setStage(FORM_STAGE);
      setError('This review no longer matches your account or coin — review the order again.');
      return;
    }
    const startedGeneration = generation;
    // Same binding (identity AND coin) still on screen: receipt allowed.
    const isCurrent = () => mountedRef.current && generationRef.current === startedGeneration;
    // Same signed-in identity (the coin may have changed): a toast naming
    // the snapshot's own instrument is still truthful for this player.
    const isOwnIdentity = () => mountedRef.current && userIdRef.current === snap.userId;
    setPending(true);
    setError(null);
    try {
      // The request comes ONLY from the frozen snapshot: side, coin and the
      // quantity verbatim (8dp ledger precision, never rounded).
      const result = await trade(snap.side, snap.coinId, snap.quantity);
      // Settled after a sign-out / identity switch: the committed trade
      // belongs to the old identity — no receipt, toast or cash figure is
      // shown to the current one. After a coin change (same identity) the
      // player still gets the toast for the coin actually traded, but no
      // receipt inside another coin's ticket.
      if (!isOwnIdentity()) return;
      showToast(
        snap.side === 'BUY'
          ? `Bought ${formatQuantityCompact(snap.quantity)} ${snap.symbol} at the live price`
          : `Sold ${formatQuantityCompact(snap.quantity)} ${snap.symbol} at the live price`,
        'success'
      );
      if (isCurrent()) setStage({ stage: 'receipt', generation: startedGeneration, snapshot: snap, result });
    } catch (err) {
      // An old identity's failure (including its expired session) must not
      // sign out, alert or re-render the current identity.
      if (!isOwnIdentity()) return;
      if (err instanceof SessionExpiredError) {
        handleSessionExpired();
        showToast('Your session has expired. Please log in again.', 'error');
        if (isCurrent()) setStage(FORM_STAGE);
      } else if (err instanceof GameApiError) {
        // Backend rejection BEFORE any mutation: the exact server message,
        // verbatim; the context already forced an account resync.
        if (isCurrent()) setError(err.message);
        showToast(err.message, 'error');
      } else {
        const message = err instanceof Error ? err.message : 'Trade failed';
        if (isCurrent()) setError(message);
        showToast(message, 'error');
      }
    } finally {
      if (isCurrent()) setPending(false);
    }
  };

  // --- Gate states (never fabricate a balance) -------------------------------
  if (!user) {
    return (
      <div className="text-center py-2">
        <p className="text-sm text-ink-dim mb-4">Sign in to trade the persistent market.</p>
        <Button variant="primary" block onClick={() => openAuth('signin')}>
          Sign in to trade
        </Button>
      </div>
    );
  }

  if (!synced) {
    // A synced-but-unprovisioned account is NOT this state: it falls through
    // to the form — the first BUY is the provisioning path (the server grants
    // the starting Cash once at commit time, safely repeatable).
    return (
      <p className="text-sm text-ink-dim text-center py-4" role="status">
        Syncing your account…
      </p>
    );
  }

  if (accountError !== null && account === null) {
    return (
      <div className="text-center py-2">
        <InlineAlert tone="error" className="mb-3 text-left">
          Your account is unavailable — {accountError}
        </InlineAlert>
        <Button variant="ghost" onClick={() => void syncNow()}>
          Retry
        </Button>
      </div>
    );
  }

  if (dead) {
    return (
      <InlineAlert tone="error">
        {symbol || 'This coin'} is dead — trading has stopped permanently. Dead coins cannot be
        bought or sold, and holdings are worth £0.00.
      </InlineAlert>
    );
  }

  // --- Review stage (frozen snapshot) --------------------------------------------
  if (stage.stage === 'review') {
    const snap = stage.snapshot;
    // Drift is only meaningful while the review is open. While committing,
    // the account change IS this trade being adopted — never a second one.
    const drift = pending ? null : reviewDrift(snap, { price: currentPrice, cash, heldQuantity });
    const blocked = drift !== null && drift.blockingError !== null;
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className={`label ${snap.side === 'BUY' ? 'text-up' : 'text-down'}`}>
            Review {snap.side === 'BUY' ? 'buy' : 'sell'} {snap.symbol} order
          </span>
          <button
            type="button"
            onClick={() => setStage(FORM_STAGE)}
            disabled={pending}
            className="text-ink-mute hover:text-ink p-1"
            aria-label="Back to order form"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <dl className="space-y-2 mb-5 font-mono text-sm" data-testid="trade-review">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-mute">Quantity</dt>
            <dd className="text-ink tnum text-right">
              <QuantityText value={snap.quantity} symbol={snap.symbol} />
              {isQuantityAbbreviated(snap.quantity) && (
                <span className="block text-xs text-ink-mute">exact {formatQuantity(snap.quantity)}</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-mute">Unit price</dt>
            <dd className="text-ink tnum text-right">{formatPrice(snap.price)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-rule pt-2 mt-2">
            <dt className="text-ink font-bold">{snap.side === 'BUY' ? 'Estimated total' : 'Estimated proceeds'}</dt>
            <dd className={`tnum font-bold text-right ${snap.side === 'BUY' ? 'text-up' : 'text-down'}`}>
              {formatCurrency(snap.estimatedTotal)}
            </dd>
          </div>
          {snap.cashAfter !== null && (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-mute">Cash after</dt>
              <dd className="text-ink-dim tnum text-right" data-testid="review-cash-after">{formatCurrency(snap.cashAfter)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-ink-mute">Holding after</dt>
            <dd className="text-ink-dim tnum text-right" data-testid="review-holding-after">
              <QuantityText value={snap.holdingAfter} symbol={snap.symbol} />
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-mute">Execution</dt>
            <dd className="text-ink-dim tnum text-right">Server-locked live price</dd>
          </div>
        </dl>
        <p className="text-xs text-ink-mute mb-4">
          Estimates as of when you opened this review. The trade executes at the live price when you confirm.
        </p>
        {drift !== null && (drift.priceMoved || drift.accountChanged) && (
          <div className="text-xs text-warn mb-3 space-y-1" role="status" data-testid="review-drift">
            {drift.priceMoved && (
              <p>
                The live price has moved to {formatPrice(currentPrice)} (est. {formatCurrency(drift.liveEstimatedTotal)}).
              </p>
            )}
            {drift.accountChanged && <p>Your account changed since this review opened.</p>}
          </div>
        )}
        {blocked && (
          <div className="font-mono text-xs text-down mb-3" role="alert">
            {drift?.blockingError} Go back to adjust the order.
          </div>
        )}
        {error && (
          <div className="font-mono text-xs text-down mb-3" role="alert">{error}</div>
        )}
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" disabled={pending} onClick={() => setStage(FORM_STAGE)}>
            {error || blocked ? 'Back to edit' : 'Cancel'}
          </Button>
          <Button
            variant={snap.side === 'BUY' ? 'buy' : 'sell'}
            className="flex-1"
            disabled={pending || blocked}
            onClick={() => void commitTrade(snap)}
          >
            {pending ? 'Committing…' : (
              <span className="inline-flex items-center gap-2 justify-center">
                <Check className="w-4 h-4" aria-hidden="true" /> Confirm {snap.side === 'BUY' ? 'buy' : 'sell'}
              </span>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // --- Receipt stage (server transaction, verbatim) -----------------------------
  if (stage.stage === 'receipt') {
    const tx = stage.result.transaction;
    const bought = tx.type === 'BUY';
    // The receipt names the COMMITTED transaction's instrument (the frozen
    // snapshot it was placed from), never whichever coin renders now.
    const receiptSymbol = tx.coinId === stage.snapshot.coinId ? stage.snapshot.symbol : `coin #${tx.coinId}`;
    return (
      <div className="text-center py-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold mb-3 ${
            bought ? 'border-up/50 bg-up/10 text-up' : 'border-down/50 bg-down/10 text-down'
          }`}
        >
          {bought ? <TrendingUp className="w-4 h-4" aria-hidden="true" /> : <TrendingDown className="w-4 h-4" aria-hidden="true" />}
          {bought ? 'Bought' : 'Sold'}
        </span>
        {/* Exact server values: full ledger quantity, never abbreviated. */}
        <p className="font-mono text-ink tnum break-all" data-testid="receipt-line">
          {formatQuantity(tx.quantity)} {receiptSymbol} @ <span title={`£${tx.price}`}>{formatPrice(tx.price)}</span>
        </p>
        <p className="font-mono text-lg font-bold text-ink tnum mt-1">{formatCurrency(tx.totalAmount)}</p>
        <p className="text-xs text-ink-mute mt-2">
          Executed at the server-locked live price. New cash balance: {formatCurrency(stage.result.account.cash)}.
        </p>
        <Button
          variant="primary"
          block
          className="mt-5"
          onClick={() => {
            setStage(FORM_STAGE);
            setAmount('');
            onDone?.();
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  // --- Form stage ---------------------------------------------------------------
  // Every path into review (typed quantity, quick-buy chip, sell-all) passes
  // the same amount rules and freezes the review snapshot at entry.
  const startReview = (quantity: number) => {
    const verdict = validateTradeAmount({ side, quantity, price: currentPrice, cash, heldQuantity, symbol });
    if (!verdict.canReview) {
      setError(verdict.error);
      return;
    }
    if (currentUserId === null) return;
    setError(null);
    setStage({
      stage: 'review',
      generation,
      snapshot: createReviewSnapshot({ userId: currentUserId, side, coinId, symbol, quantity, price: currentPrice, cash, heldQuantity })
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!validation.canReview || validation.quantity === null) return; // Review is disabled anyway
    startReview(validation.quantity);
  };

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Keep what the player typed (bounded) so a negative or malformed entry
    // gets an explicit message instead of a silently ignored keystroke.
    setAmount(event.target.value.slice(0, 40));
    setError(null);
  };

  const inlineError = validation.error ?? error;

  const quickBlockReasons = QUICK_BUY_NOTIONALS.map((notional) =>
    persistentTradeBlockReason({
      authenticated: !!user,
      synced,
      provisioned,
      accountError,
      cash,
      notional
    })
  );

  return (
    <div>
      <SegmentedControl
        label="Trade side"
        className="w-full flex mb-4"
        value={side}
        onChange={(next) => {
          setSide(next);
          setError(null);
        }}
        options={[
          {
            value: 'BUY',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" aria-hidden="true" /> Buy
              </span>
            ),
            ariaLabel: 'Buy'
          },
          {
            value: 'SELL',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4" aria-hidden="true" /> Sell
              </span>
            ),
            ariaLabel: 'Sell'
          }
        ]}
      />

      {side === 'BUY' && (
        <div className="mb-4">
          <div className="label mb-2">Quick buy</div>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label={`Quick buy ${symbol}`}>
            {QUICK_BUY_NOTIONALS.map((notional, index) => {
              const reason = quickBlockReasons[index];
              return (
                <button
                  key={notional}
                  type="button"
                  disabled={reason !== null}
                  title={reason !== null ? PERSISTENT_TRADE_BLOCK_LABEL[reason] : undefined}
                  aria-label={
                    reason !== null
                      ? `Buy ${quickBuyLabel(notional)} of ${symbol} — unavailable: ${PERSISTENT_TRADE_BLOCK_LABEL[reason]}`
                      : `Buy ${quickBuyLabel(notional)} of ${symbol}`
                  }
                  onClick={() => {
                    const quantity = quantityForNotional(notional, currentPrice);
                    if (quantity !== null) startReview(quantity);
                  }}
                  className="min-h-[44px] rounded-[10px] border border-rule bg-surface-2 font-mono text-sm font-bold text-ink tnum hover:border-brand hover:text-brand transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {quickBuyLabel(notional)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {side === 'SELL' && heldQuantity <= 0 ? (
        <p className="text-center text-sm text-ink-mute py-3">
          You hold no {symbol} to sell.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor={fieldId} className="label">Quantity</label>
              {side === 'SELL' && heldQuantity > 0 && (
                <button
                  type="button"
                  onClick={() => startReview(heldQuantity)}
                  title={`Sell all ${formatQuantity(heldQuantity)} ${symbol}`}
                  className="text-xs font-semibold text-brand hover:underline min-h-[44px] px-1"
                >
                  Sell all (<QuantityText value={heldQuantity} />)
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id={fieldId}
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                className="input-ink"
                placeholder={quantityPlaceholder(currentPrice)}
                disabled={pending}
                autoComplete="off"
                aria-invalid={inlineError !== null}
                aria-describedby={errorId}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none pr-3">
                <span className="font-mono text-xs text-ink-mute">{symbol}</span>
              </div>
            </div>
            {/* Live, accessible inline validation right under the field, so it is
                visible wherever the field is (desktop ticket and phone sheet). */}
            <p
              id={errorId}
              className={`font-mono text-xs mt-2 min-h-[1rem] ${inlineError ? 'text-down' : 'text-ink-mute'}`}
              aria-live="polite"
              data-testid="trade-inline-error"
            >
              {inlineError ?? ''}
            </p>
          </div>

          <dl className="flex justify-between items-baseline py-3 border-y border-rule font-mono text-sm">
            <div>
              <dt className="label mb-1">Unit price</dt>
              <dd className="text-ink tnum">{formatPrice(currentPrice)}</dd>
            </div>
            <div className="text-right">
              <dt className="label mb-1">{side === 'BUY' ? 'Est. total' : 'Est. proceeds'}</dt>
              <dd className="text-ink tnum font-bold">{formatCurrency(estimatedTotal)}</dd>
            </div>
          </dl>

          <p className="text-xs text-ink-mute">
            Cash · <span className="font-mono tnum text-ink-dim">{cash === null ? '—' : formatCurrency(cash)}</span>
            {side === 'SELL' && (
              <span className="ml-3" title={`Exact: ${formatQuantity(heldQuantity)} ${symbol}`}>
                Held · <QuantityText className="font-mono tnum text-ink-dim" value={heldQuantity} symbol={symbol} />
              </span>
            )}
            <span className="block mt-1">Executes at the server-locked live price — estimates only.</span>
          </p>

          {!provisioned && (
            <p className="text-xs text-ink-mute" role="note">
              Your first buy sets up your account on the server — the starting cash is added
              when the trade goes through.
            </p>
          )}

          <Button
            type="submit"
            variant={side === 'BUY' ? 'buy' : 'sell'}
            block
            disabled={pending || !validation.canReview}
          >
            Review {side === 'BUY' ? 'buy' : 'sell'}
          </Button>
        </form>
      )}
    </div>
  );
}
