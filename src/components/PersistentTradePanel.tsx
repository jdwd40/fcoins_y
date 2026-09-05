import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePersistent } from '../context/PersistentContext.tsx';
import { SessionExpiredError, formatCurrency, parsePrice } from '../services/transactionService.ts';
import { GameApiError } from '../services/gameService.ts';
import {
  isCoinCollapsed,
  formatQuantity,
  parseTradeQuantity,
  minTradeValueError
} from '../utils/gameLogic.ts';
import type { Coin } from '../types';
import { Check, X } from 'lucide-react';

interface PersistentTradePanelProps {
  coin: Coin;
}

// Persistent-market Stage 6: THE persistent trade panel. Buys and sells
// settle against the player's persistent account at the server-locked live
// price — the request carries only { coin_id, quantity }; the price is
// never client input.
//
// Deliberate absences versus the retired round panel: no Apocalypse/cycle
// identifier, no countdown/settlement gating, no Power costs, and no
// position cap — none of those exist in the persistent economy. Server
// domain rejections (dead coin, insufficient cash/holdings, minimum
// notional) render verbatim after an immediate account resync.
export function PersistentTradePanel({ coin }: PersistentTradePanelProps) {
  const { user, handleSessionExpired } = useAuth();
  const { showToast } = useToast();
  const { account, synced, accountError, trade, syncNow } = usePersistent();

  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const collapsed = isCoinCollapsed(coin.current_price);
  const currentPrice = parsePrice(coin.current_price);
  // The quantity is validated against the authoritative ledger precision
  // (DECIMAL(18,8)) as the user types — an unparseable or over-precise entry
  // is worth exactly nothing until it validates; it is never rounded.
  const parsedQuantity = parseTradeQuantity(amount);
  const amountValue = parsedQuantity.ok ? parsedQuantity.value : 0;
  const total = Math.round(amountValue * currentPrice * 100) / 100;

  const cash = account?.cash ?? null;
  const heldQuantity = useMemo(() => {
    const holding = account?.holdings.find((h) => h.coinId === coin.coin_id);
    return holding?.quantity ?? 0;
  }, [account, coin.coin_id]);

  if (!user) {
    return (
      <div className="border border-rule rounded-xl p-5 bg-paper-alt text-center">
        <div className="label mb-2">Persistent trading</div>
        <p className="text-sm text-ink-dim">Sign in to trade the persistent market.</p>
      </div>
    );
  }

  if (!synced || (account === null && accountError === null)) {
    // Never fabricate a balance while the account syncs.
    return (
      <div className="border border-rule rounded-xl p-5 bg-paper-alt text-center">
        <div className="label mb-2">Persistent trading</div>
        <p className="text-sm text-ink-dim">Syncing your persistent account…</p>
      </div>
    );
  }

  if (accountError !== null && account === null) {
    return (
      <div className="border border-rule rounded-xl p-5 bg-paper-alt text-center">
        <div className="label mb-2">Persistent trading</div>
        <p className="text-sm text-ink-dim mb-3">Your persistent account is unavailable — {accountError}</p>
        <button type="button" onClick={() => void syncNow()} className="btn-ink">
          Retry
        </button>
      </div>
    );
  }

  if (collapsed) {
    // A persistently dead coin cannot be traded in either direction — the
    // backend enforces the same rule at commit time.
    return (
      <div className="border border-oxblood rounded-xl p-5 bg-paper-alt text-center" role="note">
        <div className="label text-oxblood mb-2">Dead</div>
        <p className="font-display text-xl font-bold text-ink">{coin.symbol} is permanently dead</p>
        <p className="text-sm text-ink-dim mt-2">
          This coin died in the persistent market and trading has stopped. Holdings remain on the books as history, valued at £0.00.
        </p>
      </div>
    );
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  const validationError = (): string | null => {
    if (!parsedQuantity.ok) return parsedQuantity.error;
    // Sub-penny trades are rejected by the backend (minimum notional);
    // block the obviously hopeless ones here with the same message.
    const minValue = minTradeValueError(total, currentPrice);
    if (minValue) return minValue;
    if (side === 'BUY' && cash !== null && total > cash) {
      return `Insufficient persistent cash. You need ${formatCurrency(total)} but have ${formatCurrency(cash)}.`;
    }
    if (side === 'SELL' && amountValue > heldQuantity) {
      return `Insufficient persistent holdings. You have ${formatQuantity(heldQuantity)} of ${coin.symbol} available to sell.`;
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validationError();
    if (invalid) {
      setError(invalid);
      return;
    }
    setConfirming(true);
  };

  const handleConfirm = async () => {
    setPending(true);
    setError(null);
    try {
      await trade(side, coin.coin_id, amountValue);
      showToast(
        side === 'BUY'
          ? `Bought ${formatQuantity(amountValue)} ${coin.symbol} at the live price`
          : `Sold ${formatQuantity(amountValue)} ${coin.symbol} at the live price`,
        'success'
      );
      setAmount('');
      setConfirming(false);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        handleSessionExpired();
        showToast('Your session has expired. Please log in again.', 'error');
      } else if (err instanceof GameApiError) {
        // Backend rejection before mutation (dead coin mid-flight,
        // insufficient cash/oversell): the exact server message, verbatim;
        // the context already forced an account resync.
        setError(err.message);
        showToast(err.message, 'error');
      } else {
        const message = err instanceof Error ? err.message : 'Trade failed';
        setError(message);
        showToast(message, 'error');
      }
      setConfirming(false);
    } finally {
      setPending(false);
    }
  };

  if (confirming) {
    return (
      <div className="border border-rule rounded-xl p-5 bg-paper-alt">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-rule">
          <div>
            <div className={`label ${side === 'BUY' ? 'text-gold' : 'text-oxblood'}`}>
              Confirm persistent {side === 'BUY' ? 'purchase' : 'sale'}
            </div>
            <h3 className="font-display font-semibold text-2xl text-ink">Review order</h3>
          </div>
          <button onClick={() => setConfirming(false)} disabled={pending} className="text-ink-mute hover:text-ink" aria-label="Cancel review">
            <X className="w-4 h-4" />
          </button>
        </div>
        <dl className="space-y-2 mb-5 font-mono text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-mute">Quantity</dt>
            <dd className="text-ink tnum text-right">{formatQuantity(amountValue)} {coin.symbol}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-mute">Unit price</dt>
            <dd className="text-ink tnum text-right">{formatCurrency(currentPrice)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-rule pt-2 mt-2">
            <dt className="text-ink font-bold">{side === 'BUY' ? 'Total' : 'Proceeds'}</dt>
            <dd className={`tnum font-bold text-right ${side === 'BUY' ? 'text-gold' : 'text-verdigris'}`}>{formatCurrency(total)}</dd>
          </div>
          {cash !== null && (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-mute">Cash after</dt>
              <dd className="text-ink-dim tnum text-right">{formatCurrency(side === 'BUY' ? cash - total : cash + total)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-ink-mute">Execution</dt>
            <dd className="text-ink-dim tnum text-right">Server-locked live price</dd>
          </div>
        </dl>
        <div className="flex gap-3">
          <button onClick={() => setConfirming(false)} disabled={pending} className="btn-ink flex-1">Cancel</button>
          <button onClick={() => void handleConfirm()} disabled={pending} className={`flex-1 ${side === 'BUY' ? 'btn-gold' : 'btn-oxblood'}`}>
            {pending ? 'Committing…' : (
              <span className="inline-flex items-center gap-2 justify-center">
                <Check className="w-3 h-3" /> Confirm {side === 'BUY' ? 'buy' : 'sell'}
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-rule rounded-xl p-5 bg-paper-alt">
      <div className="mb-4 pb-3 border-b border-rule">
        <div className="label">Persistent trading · your account</div>
        <div className="flex gap-2 mt-2" role="group" aria-label="Trade side">
          <button
            type="button"
            onClick={() => { setSide('BUY'); setError(null); }}
            className={side === 'BUY' ? 'btn-gold flex-1' : 'btn-ink flex-1'}
            aria-pressed={side === 'BUY'}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => { setSide('SELL'); setError(null); }}
            className={side === 'SELL' ? 'btn-oxblood flex-1' : 'btn-ink flex-1'}
            aria-pressed={side === 'SELL'}
          >
            Sell
          </button>
        </div>
      </div>

      {side === 'SELL' && heldQuantity <= 0 ? (
        <p className="text-center text-sm text-ink-mute py-4">
          No {coin.symbol} in your persistent holdings.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="persistent-amount" className="label block mb-2">Quantity</label>
            <div className="relative">
              <input
                id="persistent-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                className="input-ink"
                placeholder="0.004"
                disabled={pending}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none pr-3">
                <span className="font-mono text-xs text-ink-mute tracking-caps">{coin.symbol}</span>
              </div>
            </div>
            {side === 'SELL' && heldQuantity > 0 && (
              <button type="button" onClick={() => setAmount(formatQuantity(heldQuantity))} className="mt-2 label hover:text-gold transition-colors">
                → Sell all ({formatQuantity(heldQuantity)})
              </button>
            )}
          </div>

          <div className="flex justify-between items-baseline py-3 border-y border-rule">
            <div>
              <div className="label mb-1">Unit</div>
              <div className="font-mono text-sm text-ink tnum">{formatCurrency(currentPrice)}</div>
            </div>
            <div className="text-right">
              <div className="label mb-1">{side === 'BUY' ? 'Total' : 'Proceeds'}</div>
              <div className="font-mono text-sm sm:text-base tnum text-gold">{formatCurrency(total)}</div>
            </div>
          </div>

          <div className="label">
            Cash · <span className="text-ink-dim">{cash === null ? '—' : formatCurrency(cash)}</span>
            {side === 'SELL' && <span className="ml-3">Held · <span className="text-ink-dim">{formatQuantity(heldQuantity)} {coin.symbol}</span></span>}
          </div>

          {error && <div className="font-mono text-xs text-oxblood" role="alert">{error}</div>}

          <button type="submit" className={`w-full ${side === 'BUY' ? 'btn-gold' : 'btn-oxblood'}`} disabled={pending || !amount}>
            {side === 'BUY' ? 'Place buy' : 'Place sell'}
          </button>
        </form>
      )}
    </div>
  );
}
