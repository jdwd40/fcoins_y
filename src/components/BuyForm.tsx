import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Coin } from '../types';
import { buyCoins, formatCurrency, parsePrice } from '../services/transactionService';
import { X, Check, AlertCircle } from 'lucide-react';

const API_BASE_URL = 'https://jdwd40.com/api-2/api';

interface BuyFormProps {
  coin: Coin;
  onSuccess?: () => void;
}

export function BuyForm({ coin, onSuccess }: BuyFormProps) {
  const { user, getAuthToken, getUserIdFromToken } = useAuth();
  const { showToast } = useToast();
  const [amount, setAmount] = useState<string>('');
  const [totalCost, setTotalCost] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);

  // Function to refresh user data from localStorage
  const refreshUserData = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log('Refreshed user data:', parsedUser);
        return parsedUser;
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
        return null;
      }
    }
    return null;
  };

  // Validate coin_id is a number
  useEffect(() => {
    if (coin) {
      console.log('Coin received in BuyForm:', {
        coin_id: coin.coin_id,
        type: typeof coin.coin_id,
        isNumber: !isNaN(Number(coin.coin_id))
      });
    }
  }, [coin]);

  const currentPrice = parsePrice(coin.current_price);

  // Calculate total cost whenever amount changes
  useEffect(() => {
    const amountValue = parseFloat(amount) || 0;
    setTotalCost(amountValue * currentPrice);
  }, [amount, currentPrice]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and decimals
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

    // Show confirmation dialog
    setShowConfirmation(true);
  };

  const handleConfirmBuy = async () => {
    if (!user) return;
    
    const amountValue = parseFloat(amount);
    
    try {
      setLoading(true);
      setError(null);
      
      // Get fresh user data from localStorage
      const freshUser = refreshUserData() || user;
      
      const token = getAuthToken();
      
      // Debug token and parameters
      console.log('Token found:', token ? 'Yes (length: ' + token.length + ')' : 'No');
      console.log('Fresh user object:', freshUser);
      console.log('Coin object:', coin);
      
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Try to get user ID from token first (most reliable)
      let userId = token ? getUserIdFromToken(token) : null;
      
      // If we couldn't get user ID from token, use the one from user object
      if (!userId && freshUser && freshUser.id) {
        userId = typeof freshUser.id === 'string' ? parseInt(freshUser.id, 10) : freshUser.id;
      }
      
      // If we still don't have a valid user ID, throw an error
      if (!userId || isNaN(userId) || userId <= 0) {
        console.error('Invalid user ID:', userId);
        throw new Error('Could not determine valid user ID. Please log out and log in again.');
      }
      
      console.log('Using user ID for transaction:', userId);
      
      // Parse the coin ID to ensure it's a number
      let coinId;
      try {
        // If coin.coin_id is a string that contains a number, convert it to a number
        coinId = typeof coin.coin_id === 'string' ? parseInt(coin.coin_id, 10) : coin.coin_id;
        
        // If coin.coin_id is not a valid number after conversion, throw an error
        if (isNaN(coinId) || coinId <= 0) {
          throw new Error('Coin ID is not a valid number');
        }
      } catch (error) {
        console.error('Error parsing coin ID:', error);
        throw new Error('Invalid coin ID. Please try again with a different coin.');
      }
      
      if (isNaN(amountValue) || amountValue <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Log the request details (without exposing the full token)
      console.log('Making buy request with user ID:', {
        endpoint: `${API_BASE_URL}/transactions/buy`,
        userId: userId,
        coinId: coinId,
        amount: amountValue,
        hasToken: !!token
      });

      await buyCoins(userId, coinId, amountValue, token);

      // Update local user data with new funds balance
      const updatedUser = {
        ...freshUser,
        funds: freshUser.funds - totalCost
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      // Show success message
      showToast(`Successfully purchased ${amountValue} ${coin.symbol}!`, 'success');
      
      // Reset form
      setAmount('');
      setShowConfirmation(false);
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Buy form error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      setShowConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBuy = () => {
    setShowConfirmation(false);
  };

  const insufficientFunds = user && totalCost > (user.funds || 0);
  const amountValue = parseFloat(amount) || 0;

  // Confirmation Dialog
  if (showConfirmation) {
    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Confirm Purchase</h3>
          <button 
            onClick={handleCancelBuy}
            className="text-gray-500 hover:text-gray-700"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md mb-4">
          <div className="flex items-center mb-2">
            <AlertCircle className="w-5 h-5 text-blue-500 mr-2" />
            <span className="font-medium">Transaction Details</span>
          </div>
          <div className="space-y-2 pl-7">
            <p>You are about to purchase:</p>
            <p className="font-medium">{amountValue} {coin.symbol} ({coin.name})</p>
            <p>at {formatCurrency(currentPrice)} per coin</p>
            <p className="font-medium">Total cost: {formatCurrency(totalCost)}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your balance after purchase: {formatCurrency((user?.funds || 0) - totalCost)}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={handleCancelBuy}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md font-medium text-gray-700 dark:text-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmBuy}
            className="flex-1 py-2 px-4 rounded-md font-medium text-white bg-blue-600 hover:bg-blue-700 flex justify-center items-center"
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
                Confirm Purchase
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Buy Form
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-3">Buy {coin.symbol}</h3>
      
      {!user ? (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md text-center">
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            Please log in to buy {coin.symbol}
          </p>
          <button
            onClick={() => showToast('Please log in to continue', 'info')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Log In
          </button>
        </div>
      ) : (
        <form onSubmit={handleBuyClick} className="space-y-4">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount to buy
            </label>
            <div className="relative">
              <input
                id="amount"
                type="text"
                value={amount}
                onChange={handleAmountChange}
                className={`w-full p-2 border rounded-md focus:ring-2 focus:outline-none ${
                  insufficientFunds ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
                }`}
                placeholder="0.00"
                disabled={loading}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500">{coin.symbol}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Price per coin</p>
              <p className="font-medium">{formatCurrency(currentPrice)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total cost</p>
              <p className={`font-medium ${insufficientFunds ? 'text-red-500' : ''}`}>
                {formatCurrency(totalCost)}
              </p>
            </div>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            Available funds: {formatCurrency(user.funds || 0)}
          </div>

          {error && (
            <div className="text-sm text-red-500">{error}</div>
          )}

          <button
            type="submit"
            className={`w-full py-2 px-4 rounded-md font-medium text-white ${
              loading || insufficientFunds || !amount
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            disabled={loading || insufficientFunds || !amount}
          >
            Buy Now
          </button>
        </form>
      )}
    </div>
  );
}
