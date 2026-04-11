import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Coin } from '../types';
import { sellCoins, getUserPortfolio, formatCurrency, parsePrice, SessionExpiredError } from '../services/transactionService';
import { X, Check } from 'lucide-react';

interface SellFormProps {
  coin: Coin;
  onSuccess?: () => void;
}

interface Portfolio {
  [coinId: number]: {
    quantity: number;
    averagePrice: number;
  };
}

export function SellForm({ coin, onSuccess }: SellFormProps) {
  const { user, getAuthToken, handleSessionExpired, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [amount, setAmount] = useState<string>('');
  const [totalValue, setTotalValue] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio>({});
  const [loadingPortfolio, setLoadingPortfolio] = useState<boolean>(true);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);

  const currentPrice = parsePrice(coin.current_price);

  useEffect(() => {
    const fetchPortfolio = async () => {
      if (!user) {
        setLoadingPortfolio(false);
        return;
      }
      try {
        setLoadingPortfolio(true);
        const token = getAuthToken();
        if (!token) {
          setLoadingPortfolio(false);
          return;
        }
        const data = await getUserPortfolio(user.id, token);
        const portfolioData: Portfolio = {};
        if (data.portfolio) {
          data.portfolio.forEach((item: any) => {
            portfolioData[item.coin_id] = {
              quantity: parseFloat(item.quantity),
              averagePrice: parseFloat(item.average_purchase_price || item.average_price),
            };
          });
        }
        setPortfolio(portfolioData);
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          handleSessionExpired();
          showToast('Your session has expired. Please log in again.', 'error');
        }
      } finally {
        setLoadingPortfolio(false);
      }
    };
    fetchPortfolio();
  }, [user]);

  useEffect(() => {
    const amountValue = parseFloat(amount) || 0;
    setTotalValue(amountValue * currentPrice);
  }, [amount, currentPrice]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

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
    const availableAmount = portfolio[coin.coin_id]?.quantity || 0;
    if (amountValue > availableAmount) {
      setError(`Insufficient holdings. You have ${availableAmount.toFixed(4)} available.`);
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmSell = async () => {
    if (!user) return;
    const amountValue = parseFloat(amount);
    try {
      setLoading(true);
      setError(null);
      const token = getAuthToken();
      if (!token) throw new Error('Authentication token not found');
      const result = await sellCoins(user.id, coin.coin_id, amountValue, token);
      const newBalance = result.data?.new_balance ?? (user.funds + totalValue);
      const updatedUser = { ...user, funds: newBalance };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      refreshUser();

      showToast(`Sold ${amountValue} ${coin.symbol}`, 'success');
      setAmount('');
      setShowConfirmation(false);
      setPortfolio((prev) => ({
        ...prev,
        [coin.coin_id]: {
          ...prev[coin.coin_id],
          quantity: prev[coin.coin_id].quantity - amountValue,
        },
      }));
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

  const handleCancelSell = () => setShowConfirmation(false);

  const availableAmount = portfolio[coin.coin_id]?.quantity || 0;
  const insufficientCoins = parseFloat(amount) > availableAmount;
  const amountValue = parseFloat(amount) || 0;

  if (showConfirmation) {
    return (
      <div className="border border-rule p-5 bg-paper-alt">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-rule">
          <div>
            <div className="label text-oxblood">Confirm Sale</div>
            <h3 className="font-display italic text-2xl text-ink">Final Review</h3>
          </div>
          <button onClick={handleCancelSell} disabled={loading} className="text-ink-mute hover:text-ink">
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
            <dt className="text-ink font-bold">Proceeds</dt>
            <dd className="text-verdigris tnum font-bold">+{formatCurrency(totalValue)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-mute">After Sale</dt>
            <dd className="text-ink-dim tnum">{formatCurrency((user?.funds || 0) + totalValue)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-mute">Remaining Holdings</dt>
            <dd className="text-ink-dim tnum">{(availableAmount - amountValue).toFixed(4)} {coin.symbol}</dd>
          </div>
        </dl>

        <div className="flex gap-3">
          <button onClick={handleCancelSell} disabled={loading} className="btn-ink flex-1">
            Withdraw
          </button>
          <button onClick={handleConfirmSell} disabled={loading} className="btn-oxblood flex-1">
            {loading ? 'Filing…' : (
              <span className="inline-flex items-center gap-2 justify-center">
                <Check className="w-3 h-3" /> Execute
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-rule p-5">
      <div className="mb-4 pb-3 border-b border-rule">
        <div className="label">Order · Sell</div>
        <h3 className="font-display italic text-2xl text-ink">Divest {coin.symbol}</h3>
      </div>

      {loadingPortfolio ? (
        <div className="py-6 text-center label animate-flicker">Reading the books…</div>
      ) : !user ? (
        <div className="text-center py-6">
          <p className="font-display italic text-ink-dim mb-3">Sign in to file an order</p>
          <button onClick={() => showToast('Please log in to continue', 'info')} className="btn-gold">
            Sign In
          </button>
        </div>
      ) : availableAmount <= 0 ? (
        <div className="py-6 text-center">
          <p className="font-display italic text-ink-dim">No {coin.symbol} in holdings</p>
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
                <span className="font-mono text-xs text-ink-mute tracking-caps">{coin.symbol}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAmount(availableAmount.toString())}
              className="mt-2 label hover:text-gold transition-colors"
            >
              → Divest all ({availableAmount.toFixed(4)})
            </button>
          </div>

          <div className="flex justify-between items-baseline py-3 border-y border-rule">
            <div>
              <div className="label mb-1">Unit</div>
              <div className="font-mono text-sm text-ink tnum">{formatCurrency(currentPrice)}</div>
            </div>
            <div className="text-right">
              <div className="label mb-1">Proceeds</div>
              <div className="font-mono text-base text-verdigris tnum">+{formatCurrency(totalValue)}</div>
            </div>
          </div>

          <div className="label">
            Holdings · <span className="text-ink-dim">{availableAmount.toFixed(4)} {coin.symbol}</span>
          </div>

          {error && <div className="font-mono text-xs text-oxblood">{error}</div>}

          <button
            type="submit"
            className="btn-oxblood w-full"
            disabled={loading || insufficientCoins || !amount}
          >
            File Order
          </button>
        </form>
      )}
    </div>
  );
}
