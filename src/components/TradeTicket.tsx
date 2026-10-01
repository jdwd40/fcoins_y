import { useMemo, useState } from 'react';
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
  minTradeValueError,
  parseTradeQuantity,
  quantityForNotional,
  quickBuyLabel,
  QUICK_BUY_NOTIONALS
} from '../utils/gameLogic.ts';
import {
  persistentTradeBlockReason,
  PERSISTENT_TRADE_BLOCK_LABEL
} from '../utils/persistentTrading.ts';
import { formatPrice } from '../utils/formatPrice.ts';
import { Button } from './ui/Button.tsx';
import { SegmentedControl } from './ui/SegmentedControl.tsx';
import { InlineAlert } from './ui/InlineAlert.tsx';
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

type TradeStage =
  | { stage: 'form' }
  | { stage: 'review'; quantity: number }
  | { stage: 'receipt'; result: PersistentTradeResult };

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
  const [stage, setStage] = useState<TradeStage>({ stage: 'form' });

  const coin = signals?.coins.find((c) => c.coinId === coinId) ?? null;
  const holding = useMemo(
    () => account?.holdings.find((h) => h.coinId === coinId) ?? null,
    [account, coinId]
  );
  const heldQuantity = holding?.quantity ?? 0;
  const cash = account?.cash ?? null;
  const currentPrice = coin?.currentPrice ?? 0;
  const dead = coin === null || coin.dead;

  const parsedQuantity = parseTradeQuantity(amount);
  const amountValue = parsedQuantity.ok ? parsedQuantity.value : 0;
  const estimatedTotal = Math.round(amountValue * currentPrice * 100) / 100;

  const symbol = coin?.symbol ?? '';

  const commitTrade = async (quantity: number) => {
    setPending(true);
    setError(null);
    try {
      const result = await trade(side, coinId, quantity);
      showToast(
        side === 'BUY'
          ? `Bought ${formatQuantity(quantity)} ${symbol} at the live price`
          : `Sold ${formatQuantity(quantity)} ${symbol} at the live price`,
        'success'
      );
      setStage({ stage: 'receipt', result });
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        handleSessionExpired();
        showToast('Your session has expired. Please log in again.', 'error');
        setStage({ stage: 'form' });
      } else if (err instanceof GameApiError) {
        // Backend rejection BEFORE any mutation: the exact server message,
        // verbatim; the context already forced an account resync.
        setError(err.message);
        showToast(err.message, 'error');
      } else {
        const message = err instanceof Error ? err.message : 'Trade failed';
        setError(message);
        showToast(message, 'error');
      }
    } finally {
      setPending(false);
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

  // --- Review stage ------------------------------------------------------------
  if (stage.stage === 'review') {
    const quantity = stage.quantity;
    const total = Math.round(quantity * currentPrice * 100) / 100;
    const cashAfter = cash === null ? null : side === 'BUY' ? cash - total : cash + total;
    const holdingAfter = side === 'BUY' ? heldQuantity + quantity : heldQuantity - quantity;
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className={`label ${side === 'BUY' ? 'text-up' : 'text-down'}`}>
            Review {side === 'BUY' ? 'buy' : 'sell'} order
          </span>
          <button
            type="button"
            onClick={() => setStage({ stage: 'form' })}
            disabled={pending}
            className="text-ink-mute hover:text-ink p-1"
            aria-label="Back to order form"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <dl className="space-y-2 mb-5 font-mono text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-mute">Quantity</dt>
            <dd className="text-ink tnum text-right">{formatQuantity(quantity)} {symbol}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-mute">Unit price</dt>
            <dd className="text-ink tnum text-right">{formatPrice(currentPrice)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-rule pt-2 mt-2">
            <dt className="text-ink font-bold">{side === 'BUY' ? 'Estimated total' : 'Estimated proceeds'}</dt>
            <dd className={`tnum font-bold text-right ${side === 'BUY' ? 'text-up' : 'text-down'}`}>
              {formatCurrency(total)}
            </dd>
          </div>
          {cashAfter !== null && (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-mute">Cash after</dt>
              <dd className="text-ink-dim tnum text-right">{formatCurrency(cashAfter)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-ink-mute">Holding after</dt>
            <dd className="text-ink-dim tnum text-right">{formatQuantity(Math.max(0, holdingAfter))} {symbol}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-mute">Execution</dt>
            <dd className="text-ink-dim tnum text-right">Server-locked live price</dd>
          </div>
        </dl>
        <p className="text-xs text-ink-mute mb-4">
          The figures above are estimates at the currently displayed price.
        </p>
        {error && (
          <div className="font-mono text-xs text-down mb-3" role="alert">{error}</div>
        )}
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" disabled={pending} onClick={() => setStage({ stage: 'form' })}>
            Cancel
          </Button>
          <Button
            variant={side === 'BUY' ? 'buy' : 'sell'}
            className="flex-1"
            disabled={pending}
            onClick={() => void commitTrade(quantity)}
          >
            {pending ? 'Committing…' : (
              <span className="inline-flex items-center gap-2 justify-center">
                <Check className="w-4 h-4" aria-hidden="true" /> Confirm {side === 'BUY' ? 'buy' : 'sell'}
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
        <p className="font-mono text-ink tnum">
          {formatQuantity(tx.quantity)} {symbol} @ {formatPrice(tx.price)}
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
            setStage({ stage: 'form' });
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
  const validationError = (): string | null => {
    if (!parsedQuantity.ok) return parsedQuantity.error;
    const minValue = minTradeValueError(estimatedTotal, currentPrice);
    if (minValue) return minValue;
    if (side === 'BUY' && cash !== null && estimatedTotal > cash) {
      return `Not enough cash: this trade needs ${formatCurrency(estimatedTotal)} and you have ${formatCurrency(cash)}.`;
    }
    if (side === 'SELL' && amountValue > heldQuantity) {
      return `You hold ${formatQuantity(heldQuantity)} ${symbol} — you cannot sell ${formatQuantity(amountValue)}.`;
    }
    return null;
  };

  const startReview = (quantity: number) => {
    setError(null);
    setStage({ stage: 'review', quantity });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const invalid = validationError();
    if (invalid) {
      setError(invalid);
      return;
    }
    startReview(amountValue);
  };

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

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
              <label htmlFor={`trade-quantity-${coinId}`} className="label">Quantity</label>
              {side === 'SELL' && heldQuantity > 0 && (
                <button
                  type="button"
                  onClick={() => startReview(heldQuantity)}
                  className="text-xs font-semibold text-brand hover:underline min-h-[44px] px-1"
                >
                  Sell all ({formatQuantity(heldQuantity)})
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id={`trade-quantity-${coinId}`}
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                className="input-ink"
                placeholder="0.004"
                disabled={pending}
                autoComplete="off"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none pr-3">
                <span className="font-mono text-xs text-ink-mute">{symbol}</span>
              </div>
            </div>
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
              <span className="ml-3">
                Held · <span className="font-mono tnum text-ink-dim">{formatQuantity(heldQuantity)} {symbol}</span>
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

          {error && <div className="font-mono text-xs text-down" role="alert">{error}</div>}

          <Button
            type="submit"
            variant={side === 'BUY' ? 'buy' : 'sell'}
            block
            disabled={pending || !amount}
          >
            Review {side === 'BUY' ? 'buy' : 'sell'}
          </Button>
        </form>
      )}
    </div>
  );
}
