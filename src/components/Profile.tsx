import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Wallet, History, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface Transaction {
  id: number;
  type: 'BUY' | 'SELL';
  coinName: string;
  amount: number;
  price: number;
  date: string;
}

// Dummy transactions for demonstration
const dummyTransactions: Transaction[] = [
  {
    id: 1,
    type: 'BUY',
    coinName: 'Bitcoin',
    amount: 0.5,
    price: 35000,
    date: '2024-03-15T10:30:00Z'
  },
  {
    id: 2,
    type: 'SELL',
    coinName: 'Ethereum',
    amount: 2.5,
    price: 2200,
    date: '2024-03-14T15:45:00Z'
  },
  {
    id: 3,
    type: 'BUY',
    coinName: 'Cardano',
    amount: 1000,
    price: 0.5,
    date: '2024-03-13T09:15:00Z'
  }
];

export function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || !user.username) {
    return null;
  }

  const handleClose = () => {
    navigate(location.state?.from || '/');
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="Close profile"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                <span className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {user.username || 'User'}
                </h1>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span>{user.email || 'No email provided'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Wallet className="w-4 h-4" />
                    <span>£{(user.funds || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <History className="w-5 h-5" />
                Recent Transactions
              </h2>
              <div className="space-y-4">
                {dummyTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          transaction.type === 'BUY'
                            ? 'bg-green-100 dark:bg-green-900'
                            : 'bg-red-100 dark:bg-red-900'
                        }`}
                      >
                        <span
                          className={`text-sm font-medium ${
                            transaction.type === 'BUY'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {transaction.type === 'BUY' ? '+' : '-'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {transaction.type} {transaction.coinName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(transaction.date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {transaction.amount} {transaction.coinName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        £{transaction.price.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}