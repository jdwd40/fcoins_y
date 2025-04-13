import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Coin } from '../types';
import { sellCoins, getUserPortfolio, formatCurrency, parsePrice } from '../services/transactionService';

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
  const { user } = useAuth();
  const { showToast } = useToast();
  const [amount, setAmount] = useState<string>('');
  const [totalValue, setTotalValue] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio>({});
  const [loadingPortfolio, setLoadingPortfolio] = useState<boolean>(true);

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
        const token = localStorage.getItem('token');
        
        if (!token) {
          throw new Error('Authentication token not found');
        }

        const data = await getUserPortfolio(user.id, token);
        const portfolioData: Portfolio = {};

        // Convert portfolio data to the format we need
        data.portfolio.forEach((item: any) => {
          portfolioData[item.coin_id] = {
            quantity: parseFloat(item.quantity),
            averagePrice: parseFloat(item.average_price)
          };
        });

        setPortfolio(portfolioData);
      } catch (err) {
        console.error('Error fetching portfolio:', err);
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

  const handleSubmit = async (e: React.FormEvent) => {
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
      setError(`Insufficient coins in portfolio. You have ${availableAmount} coins available to sell.`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await sellCoins(user.id, coin.coin_id, amountValue, token);

      // Update local user data with new funds balance
      const updatedUser = {
        ...user,
        funds: user.funds + totalValue
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      // Show success message
      showToast(`Successfully sold ${amountValue} ${coin.symbol}!`, 'success');
      
      // Reset form
      setAmount('');
      
      // Update portfolio
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
      setError(err instanceof Error ? err.message : 'Transaction failed');
      showToast(err instanceof Error ? err.message : 'Transaction failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const availableAmount = portfolio[coin.coin_id]?.quantity || 0;
  const insufficientCoins = parseFloat(amount) > availableAmount;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-3">Sell {coin.symbol}</h3>
      
      {loadingPortfolio ? (
        <div className="text-center py-4">
          <p className="text-gray-500">Loading portfolio...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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
                className={`w-full p-2 border rounded-md focus:ring-2 focus:outline-none ${
                  insufficientCoins ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
                }`}
                placeholder="0.00"
                disabled={loading || !user || availableAmount <= 0}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500">{coin.symbol}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Current price</p>
              <p className="font-medium">{formatCurrency(currentPrice)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total value</p>
              <p className="font-medium">{formatCurrency(totalValue)}</p>
            </div>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            Available: {availableAmount} {coin.symbol}
          </div>

          {error && (
            <div className="text-sm text-red-500">{error}</div>
          )}

          <button
            type="submit"
            className={`w-full py-2 px-4 rounded-md font-medium text-white ${
              loading || insufficientCoins || !user || !amount || availableAmount <= 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            disabled={loading || insufficientCoins || !user || !amount || availableAmount <= 0}
          >
            {loading ? 'Processing...' : 'Sell Now'}
          </button>

          {!user && (
            <div className="text-sm text-center text-gray-500 dark:text-gray-400">
              Please log in to sell coins
            </div>
          )}
          
          {user && availableAmount <= 0 && (
            <div className="text-sm text-center text-gray-500 dark:text-gray-400">
              You don't own any {coin.symbol} to sell
            </div>
          )}
        </form>
      )}
    </div>
  );
}
