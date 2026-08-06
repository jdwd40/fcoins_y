import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { sellCoin } from '../services/tradingService';
import { CoinsError, describeError } from '../services/errorMapper';
import { formatCurrency, formatQuantity } from '../utils/format';
import { X, Check } from 'lucide-react';

interface SellFormProps {
  assetId: number;
  symbol: string;
  name: string;
  currentPrice: number;
  maxQuantity: number;
  onSuccess?: () => void;
}

export function SellForm({ assetId, symbol, name, currentPrice, maxQuantity, onSuccess }: SellFormProps) {
  const { user, refreshAccount } = useAuth();
  const { showToast } = useToast();
  const [amount, setAmount] = useState<string>('');
  const [estimatedProceeds, setEstimatedProceeds] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    const amountValue = parseFloat(amount) || 0;
    setEstimatedProceeds(amountValue * currentPrice);
  }, [amount, currentPrice]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  const exceedsHolding = parseFloat(amount || '0') > maxQuantity;

  const handleSellClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast('Please log in to sell coins', 'error');
      return;
    }
    const amountValue = parseFloat(amount);
    if (!amountValue || amountValue <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    if (amountValue > maxQuantity) {
      setError(`You hold ${formatQuantity(maxQuantity)} ${symbol}.`);
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmSell = async () => {
    if (!user || loading) return;
    const amountValue = parseFloat(amount);
    try {
      setLoading(true);
      setError(null);
      const result = await sellCoin(assetId, amountValue, idempotencyKeyRef.current);
      showToast(
        `Sold ${result.quantity} ${symbol} for ${formatCurrency(Number(result.total_amount))}`,
        'success',
      );
      await refreshAccount();
      idempotencyKeyRef.current = crypto.randomUUID();
      setAmount('');
      setShowConfirmation(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      const code = err instanceof CoinsError ? err.code : 'UNKNOWN';
      const message = describeError(code);
      setError(message);
      showToast(message, 'error');
      if (code === 'IDEMPOTENCY_CONFLICT') {
        idempotencyKeyRef.current = crypto.randomUUID();
      }
      setShowConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  const amountValue = parseFloat(amount) || 0;

  if (showConfirmation) {
    return (
      <div className="border border-rule rounded-xl p-5 bg-paper-alt">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-rule">
          <div>
            <div className="label text-oxblood">Confirm Sale</div>
            <h3 className="font-display font-semibold text-2xl text-ink">Review sell order</h3>
          </div>
          <button onClick={() => setShowConfirmation(false)} disabled={loading} className="text-ink-mute hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <dl className="space-y-2 mb-5 font-mono text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-mute">Quantity</dt>
            <dd className="text-ink tnum">{amountValue} {symbol}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-mute">Unit Price</dt>
            <dd className="text-ink tnum">{formatCurrency(currentPrice)}</dd>
          </div>
          <div className="flex justify-between border-t border-rule pt-2 mt-2">
            <dt className="text-ink font-bold">Estimated proceeds</dt>
            <dd className="text-gold tnum font-bold">{formatCurrency(estimatedProceeds)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-mute">Est. holding after</dt>
            <dd className="text-ink-dim tnum">{formatQuantity(Math.max(0, maxQuantity - amountValue))} {symbol}</dd>
          </div>
        </dl>
        <p className="label text-ink-mute mb-4">Estimates only — the server sets the final price and total.</p>

        <div className="flex gap-3">
          <button onClick={() => setShowConfirmation(false)} disabled={loading} className="btn-ink flex-1">
            Cancel
          </button>
          <button onClick={handleConfirmSell} disabled={loading} className="btn-oxblood flex-1">
            {loading ? 'Processing…' : (
              <span className="inline-flex items-center gap-2 justify-center">
                <Check className="w-3 h-3" /> Confirm sell
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
        <div className="label">Sell order</div>
        <h3 className="font-display font-semibold text-2xl text-ink">Sell {name} ({symbol})</h3>
      </div>

      {!user ? (
        <div className="text-center py-6">
          <p className="text-sm text-ink-dim">Sign in to place a virtual order</p>
        </div>
      ) : (
        <form onSubmit={handleSellClick} className="space-y-5">
          <div>
            <label htmlFor="sell-amount" className="label block mb-2">Quantity</label>
            <div className="relative">
              <input
                id="sell-amount"
                type="text"
                value={amount}
                onChange={handleAmountChange}
                className="input-ink"
                placeholder="0.00"
                disabled={loading}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none">
                <span className="font-mono text-xs text-ink-mute tracking-caps">{symbol}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAmount(String(maxQuantity))}
              className="label hover:text-gold mt-2"
            >
              Max · {formatQuantity(maxQuantity)} {symbol}
            </button>
          </div>

          <div className="flex justify-between items-baseline py-3 border-y border-rule">
            <div>
              <div className="label mb-1">Unit</div>
              <div className="font-mono text-sm text-ink tnum">{formatCurrency(currentPrice)}</div>
            </div>
            <div className="text-right">
              <div className="label mb-1">Est. proceeds</div>
              <div className={`font-mono text-base tnum ${exceedsHolding ? 'text-oxblood' : 'text-gold'}`}>
                {formatCurrency(estimatedProceeds)}
              </div>
            </div>
          </div>

          {error && <div className="font-mono text-xs text-oxblood">{error}</div>}

          <button
            type="submit"
            className="btn-oxblood w-full"
            disabled={loading || exceedsHolding || !amount}
          >
            Place sell order
          </button>
        </form>
      )}
    </div>
  );
}
