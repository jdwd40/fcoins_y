import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Coin } from '../types';
import { buyCoin } from '../services/tradingService';
import { CoinsError, describeError } from '../services/errorMapper';
import { formatCurrency } from '../utils/format';
import { X, Check } from 'lucide-react';

interface BuyFormProps {
  coin: Coin;
  onSuccess?: () => void;
}

export function BuyForm({ coin, onSuccess }: BuyFormProps) {
  const { user, refreshAccount } = useAuth();
  const { showToast } = useToast();
  const [amount, setAmount] = useState<string>('');
  const [estimatedTotal, setEstimatedTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  // One idempotency key per order attempt: double-clicks/retries replay
  // server-side instead of duplicating the trade.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const currentPrice = Number(coin.current_price);

  useEffect(() => {
    const amountValue = parseFloat(amount) || 0;
    setEstimatedTotal(amountValue * currentPrice);
  }, [amount, currentPrice]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  const handleBuyClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast('Please log in to buy coins', 'error');
      return;
    }
    const amountValue = parseFloat(amount);
    if (!amountValue || amountValue <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    if (estimatedTotal > user.cashBalance) {
      setError(`Insufficient funds. You need ${formatCurrency(estimatedTotal)} to complete this purchase.`);
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmBuy = async () => {
    if (!user || loading) return;
    const amountValue = parseFloat(amount);
    try {
      setLoading(true);
      setError(null);
      const result = await buyCoin(coin.id, amountValue, idempotencyKeyRef.current);
      // Authoritative post-state from the server — never browser arithmetic.
      showToast(
        `Purchased ${result.quantity} ${coin.symbol} for ${formatCurrency(Number(result.total_amount))}`,
        'success',
      );
      await refreshAccount();
      idempotencyKeyRef.current = crypto.randomUUID(); // next order = new key
      setAmount('');
      setShowConfirmation(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      const code = err instanceof CoinsError ? err.code : 'UNKNOWN';
      const message = describeError(code);
      setError(message);
      showToast(message, 'error');
      // A replayed key after a timeout is safe; on conflict, rotate so the
      // user can deliberately resubmit changed semantics.
      if (code === 'IDEMPOTENCY_CONFLICT') {
        idempotencyKeyRef.current = crypto.randomUUID();
      }
      setShowConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBuy = () => setShowConfirmation(false);

  const insufficientFunds = !!user && estimatedTotal > user.cashBalance;
  const amountValue = parseFloat(amount) || 0;

  if (showConfirmation) {
    return (
      <div className="border border-rule rounded-xl p-5 bg-paper-alt">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-rule">
          <div>
            <div className="label text-gold">Confirm Purchase</div>
            <h3 className="font-display font-semibold text-2xl text-ink">Review buy order</h3>
          </div>
          <button onClick={handleCancelBuy} disabled={loading} className="text-ink-mute hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <dl className="space-y-2 mb-5 font-mono text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-mute">Quantity</dt>
            <dd className="text-ink tnum">{amountValue} {coin.symbol}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-mute">Unit Price</dt>
            <dd className="text-ink tnum">{formatCurrency(currentPrice)}</dd>
          </div>
          <div className="flex justify-between border-t border-rule pt-2 mt-2">
            <dt className="text-ink font-bold">Estimated total</dt>
            <dd className="text-gold tnum font-bold">{formatCurrency(estimatedTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-mute">Est. balance after</dt>
            <dd className="text-ink-dim tnum">{formatCurrency((user?.cashBalance || 0) - estimatedTotal)}</dd>
          </div>
        </dl>
        <p className="label text-ink-mute mb-4">Estimates only — the server sets the final price and total.</p>

        <div className="flex gap-3">
          <button onClick={handleCancelBuy} disabled={loading} className="btn-ink flex-1">
            Cancel
          </button>
          <button onClick={handleConfirmBuy} disabled={loading} className="btn-gold flex-1">
            {loading ? 'Processing…' : (
              <span className="inline-flex items-center gap-2 justify-center">
                <Check className="w-3 h-3" /> Confirm buy
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
        <div className="label">Buy order</div>
        <h3 className="font-display font-semibold text-2xl text-ink">Buy {coin.symbol}</h3>
      </div>

      {!user ? (
        <div className="text-center py-6">
          <p className="text-sm text-ink-dim mb-3">Sign in to place a virtual order</p>
          <button onClick={() => showToast('Please log in to continue', 'info')} className="btn-gold">
            Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleBuyClick} className="space-y-5">
          <div>
            <label htmlFor="amount" className="label block mb-2">Quantity</label>
            <div className="relative">
              <input
                id="amount"
                type="text"
                value={amount}
                onChange={handleAmountChange}
                className="input-ink"
                placeholder="0.00"
                disabled={loading}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none">
                <span className="font-mono text-xs text-ink-mute tracking-caps">{coin.symbol}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-baseline py-3 border-y border-rule">
            <div>
              <div className="label mb-1">Unit</div>
              <div className="font-mono text-sm text-ink tnum">{formatCurrency(currentPrice)}</div>
            </div>
            <div className="text-right">
              <div className="label mb-1">Est. total</div>
              <div className={`font-mono text-base tnum ${insufficientFunds ? 'text-oxblood' : 'text-gold'}`}>
                {formatCurrency(estimatedTotal)}
              </div>
            </div>
          </div>

          <div className="label">
            Available · <span className="text-ink-dim">{formatCurrency(user.cashBalance)}</span>
          </div>

          {error && <div className="font-mono text-xs text-oxblood">{error}</div>}

          <button
            type="submit"
            className="btn-gold w-full"
            disabled={loading || insufficientFunds || !amount}
          >
            Place buy order
          </button>
        </form>
      )}
    </div>
  );
}
