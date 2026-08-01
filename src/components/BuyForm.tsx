import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Coin } from '../types';
import { buyCoins, formatCurrency, parsePrice, SessionExpiredError } from '../services/transactionService';
import { X, Check } from 'lucide-react';

interface BuyFormProps {
  coin: Coin;
  onSuccess?: () => void;
}

export function BuyForm({ coin, onSuccess }: BuyFormProps) {
  const { user, getAuthToken, getUserIdFromToken, handleSessionExpired, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [amount, setAmount] = useState<string>('');
  const [totalCost, setTotalCost] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);

  const refreshUserData = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch {
        return null;
      }
    }
    return null;
  };

  const currentPrice = parsePrice(coin.current_price);

  useEffect(() => {
    const amountValue = parseFloat(amount) || 0;
    setTotalCost(amountValue * currentPrice);
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
    if (totalCost > (user.funds || 0)) {
      setError(`Insufficient funds. You need ${formatCurrency(totalCost)} to complete this purchase.`);
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmBuy = async () => {
    if (!user) return;
    const amountValue = parseFloat(amount);
    try {
      setLoading(true);
      setError(null);
      const freshUser = refreshUserData() || user;
      const token = getAuthToken();
      if (!token) throw new Error('Authentication token not found');
      let userId = token ? getUserIdFromToken(token) : null;
      if (!userId && freshUser && freshUser.id) {
        userId = typeof freshUser.id === 'string' ? parseInt(freshUser.id, 10) : freshUser.id;
      }
      if (!userId || isNaN(userId) || userId <= 0) {
        throw new Error('Could not determine valid user ID. Please log out and log in again.');
      }
      let coinId;
      try {
        coinId = typeof coin.coin_id === 'string' ? parseInt(coin.coin_id, 10) : coin.coin_id;
        if (isNaN(coinId) || coinId <= 0) throw new Error('Coin ID is not a valid number');
      } catch {
        throw new Error('Invalid coin ID. Please try again.');
      }
      if (isNaN(amountValue) || amountValue <= 0) throw new Error('Amount must be greater than 0');

      const result = await buyCoins(userId, coinId, amountValue, token);
      const newBalance = result.data?.new_balance ?? (freshUser.funds - totalCost);
      const updatedUser = { ...freshUser, funds: newBalance };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      refreshUser();

      showToast(`Purchased ${amountValue} ${coin.symbol}`, 'success');
      setAmount('');
      setShowConfirmation(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        handleSessionExpired();
        showToast('Your session has expired. Please log in again.', 'error');
        setShowConfirmation(false);
        setLoading(false);
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      setShowConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBuy = () => setShowConfirmation(false);

  const insufficientFunds = !!user && totalCost > (user.funds || 0);
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
            <dt className="text-ink font-bold">Total</dt>
            <dd className="text-gold tnum font-bold">{formatCurrency(totalCost)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-mute">After Purchase</dt>
            <dd className="text-ink-dim tnum">{formatCurrency((user?.funds || 0) - totalCost)}</dd>
          </div>
        </dl>

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
              <div className="label mb-1">Total</div>
              <div className={`font-mono text-sm sm:text-base tnum ${insufficientFunds ? 'text-oxblood' : 'text-gold'}`}>
                {formatCurrency(totalCost)}
              </div>
            </div>
          </div>

          <div className="label">
            Available · <span className="text-ink-dim">{formatCurrency(user.funds || 0)}</span>
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
