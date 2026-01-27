import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Coin } from '../types';
import { sellCoins, getUserPortfolio, formatCurrency, parsePrice, SessionExpiredError } from '../services/transactionService';
import { X, Check, AlertCircle } from 'lucide-react';

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

  // Fetch user's portfolio
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

        // Convert portfolio data to the format we need
        if (data.portfolio) {
          data.portfolio.forEach((item: any) => {
            portfolioData[item.coin_id] = {
              quantity: parseFloat(item.quantity),
              averagePrice: parseFloat(item.average_purchase_price || item.average_price)
            };
          });
        }

        setPortfolio(portfolioData);
      } catch (err) {
        console.error('Error fetching portfolio:', err);
        
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

  // Calculate total value whenever amount changes
  useEffect(() => {
    const amountValue = parseFloat(amount) || 0;
    setTotalValue(amountValue * currentPrice);
  }, [amount, currentPrice]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and decimals
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
      setError(`Insufficient coins in portfolio. You have ${availableAmount.toFixed(4)} coins available to sell.`);
      return;
    }

    // Show confirmation dialog
    setShowConfirmation(true);
  };

  const handleConfirmSell = async () => {
    if (!user) return;
    
    const amountValue = parseFloat(amount);

    try {
      setLoading(true);
      setError(null);
      
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const result = await sellCoins(user.id, coin.coin_id, amountValue, token);

      // Update local user data with new funds balance from response or calculated
      const newBalance = result.data?.new_balance ?? (user.funds + totalValue);
      const updatedUser = {
        ...user,
        funds: newBalance
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Refresh user in context to sync state
      refreshUser();

      // Show success message
      showToast(`Successfully sold ${amountValue} ${coin.symbol}!`, 'success');
      
      // Reset form
      setAmount('');
      setShowConfirmation(false);
      
      // Update local portfolio state
      setPortfolio(prev => ({
        ...prev,
        [coin.coin_id]: {
          ...prev[coin.coin_id],
          quantity: prev[coin.coin_id].quantity - amountValue
        }
      }));
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Sell form error:', err);
      
      // Handle session expired error
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

  const handleCancelSell = () => {
    setShowConfirmation(false);
  };

  const availableAmount = portfolio[coin.coin_id]?.quantity || 0;
  const insufficientCoins = parseFloat(amount) > availableAmount;
  const amountValue = parseFloat(amount) || 0;

  // Confirmation Dialog
  if (showConfirmation) {
    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Confirm Sale</h3>
          <button 
            onClick={handleCancelSell}
            className="text-gray-500 hover:text-gray-700"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md mb-4">
          <div className="flex items-center mb-2">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="font-medium">Transaction Details</span>
          </div>
          <div className="space-y-2 pl-7">
            <p>You are about to sell:</p>
            <p className="font-medium">{amountValue} {coin.symbol} ({coin.name})</p>
            <p>at {formatCurrency(currentPrice)} per coin</p>
            <p className="font-medium">Total value: {formatCurrency(totalValue)}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your balance after sale: {formatCurrency((user?.funds || 0) + totalValue)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Remaining holdings: {(availableAmount - amountValue).toFixed(4)} {coin.symbol}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={handleCancelSell}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md font-medium text-gray-700 dark:text-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSell}
            className="flex-1 py-2 px-4 rounded-md font-medium text-white bg-red-600 hover:bg-red-700 flex justify-center items-center"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              <span className="flex items-center">
                <Check className="w-4 h-4 mr-2" />
                Confirm Sale
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Sell Form
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-3">Sell {coin.symbol}</h3>
      
      {loadingPortfolio ? (
        <div className="text-center py-4">
          <p className="text-gray-500">Loading portfolio...</p>
        </div>
      ) : !user ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-md text-center">
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            Please log in to sell {coin.symbol}
          </p>
          <button
            onClick={() => showToast('Please log in to continue', 'info')}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Log In
          </button>
        </div>
      ) : availableAmount <= 0 ? (
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-md text-center">
          <p className="text-gray-500 dark:text-gray-400">
            You don't own any {coin.symbol} to sell
          </p>
        </div>
      ) : (
        <form onSubmit={handleSellClick} className="space-y-4">
          <div>
            <label htmlFor="sell-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount to sell
            </label>
            <div className="relative">
              <input
                id="sell-amount"
                type="text"
                value={amount}
                onChange={handleAmountChange}
                className={`w-full p-2 border rounded-md focus:ring-2 focus:outline-none dark:bg-gray-700 dark:text-white ${
                  insufficientCoins ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 dark:border-gray-600 focus:ring-red-200'
                }`}
                placeholder="0.00"
                disabled={loading}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500">{coin.symbol}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAmount(availableAmount.toString())}
              className="mt-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
            >
              Sell all ({availableAmount.toFixed(4)})
            </button>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Price per coin</p>
              <p className="font-medium">{formatCurrency(currentPrice)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total value</p>
              <p className="font-medium text-green-600 dark:text-green-400">
                +{formatCurrency(totalValue)}
              </p>
            </div>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            Available: {availableAmount.toFixed(4)} {coin.symbol}
          </div>

          {error && (
            <div className="text-sm text-red-500">{error}</div>
          )}

          <button
            type="submit"
            className={`w-full py-2 px-4 rounded-md font-medium text-white ${
              loading || insufficientCoins || !amount
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'
            }`}
            disabled={loading || insufficientCoins || !amount}
          >
            Sell Now
          </button>
        </form>
      )}
    </div>
  );
}
