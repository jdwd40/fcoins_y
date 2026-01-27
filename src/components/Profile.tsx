import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { User, Mail, Wallet, History, X, TrendingUp, TrendingDown, Coins, RefreshCw } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  getUserPortfolio, 
  getUserTransactions, 
  formatCurrency,
  SessionExpiredError,
  type PortfolioItem,
  type TransactionHistoryItem
} from '../services/transactionService';
import { SellForm } from './SellForm';
import { Modal } from './Modal';

export function Profile() {
  const { user, getAuthToken, handleSessionExpired, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<PortfolioItem | null>(null);
  const [showSellModal, setShowSellModal] = useState(false);

  const fetchData = async () => {
    if (!user || !user.id) {
      setLoading(false);
      return;
    }
    
    const token = getAuthToken();
    if (!token) {
      setError('Please log in to view your portfolio');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch portfolio and transactions in parallel
      const [portfolioData, transactionsData] = await Promise.all([
        getUserPortfolio(user.id, token),
        getUserTransactions(user.id, token)
      ]);
      
      setPortfolio(portfolioData.portfolio || []);
      setTransactions(transactionsData.transactions || []);
      
      // Update user funds if different
      if (portfolioData.user_funds !== undefined && portfolioData.user_funds !== user.funds) {
        const updatedUser = { ...user, funds: portfolioData.user_funds };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        refreshUser();
      }
    } catch (err) {
      console.error('Error fetching profile data:', err);
      
      if (err instanceof SessionExpiredError) {
        handleSessionExpired();
        showToast('Your session has expired. Please log in again.', 'error');
        return;
      }
      
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Check if user is properly logged in with required fields
  if (!user || !user.id) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Please log in to view your profile</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Get display name safely
  const displayName = user.username || user.email || 'User';
  const displayInitial = displayName.charAt(0).toUpperCase();

  const handleClose = () => {
    navigate(location.state?.from || '/');
  };

  const handleSellClick = (item: PortfolioItem) => {
    setSelectedCoin(item);
    setShowSellModal(true);
  };

  const handleSellSuccess = () => {
    setShowSellModal(false);
    setSelectedCoin(null);
    // Refresh portfolio data after successful sale
    fetchData();
  };

  const totalPortfolioValue = portfolio.reduce((sum, item) => sum + (Number(item.total_value) || 0), 0);
  const totalProfitLoss = portfolio.reduce((sum, item) => sum + (Number(item.profit_loss) || 0), 0);

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
            {/* User Info Header */}
            <div className="flex items-center gap-6 mb-8">
              <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                <span className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
                  {displayInitial}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {displayName}
                </h1>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span>{user.email || 'No email provided'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Wallet className="w-4 h-4" />
                    <span>{formatCurrency(Number(user.funds) || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Portfolio Summary */}
            {!loading && !error && portfolio.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                    <Coins className="w-4 h-4" />
                    <span className="text-sm font-medium">Portfolio Value</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(totalPortfolioValue)}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm font-medium">Available Funds</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(Number(user.funds) || 0)}
                  </p>
                </div>
                <div className={`rounded-lg p-4 ${totalProfitLoss >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <div className={`flex items-center gap-2 mb-1 ${totalProfitLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {totalProfitLoss >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span className="text-sm font-medium">Total P/L</span>
                  </div>
                  <p className={`text-xl font-bold ${totalProfitLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {totalProfitLoss >= 0 ? '+' : ''}{formatCurrency(totalProfitLoss)}
                  </p>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading your portfolio...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <button
                  onClick={fetchData}
                  className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Portfolio Holdings */}
            {!loading && !error && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Coins className="w-5 h-5" />
                    Your Holdings
                  </h2>
                  <button
                    onClick={fetchData}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                
                {portfolio.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <Coins className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">You don't own any coins yet.</p>
                    <button
                      onClick={() => navigate('/')}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Browse Coins
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {portfolio.map((item) => (
                      <div
                        key={item.portfolio_id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                              {(item.coin_symbol || '?').charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {item.coin_name} ({item.coin_symbol})
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {Number(item.quantity || 0).toFixed(4)} coins @ {formatCurrency(Number(item.average_purchase_price) || 0)} avg
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right mr-4">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(Number(item.total_value) || 0)}
                          </p>
                          <p className={`text-sm ${Number(item.profit_loss) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {Number(item.profit_loss) >= 0 ? '+' : ''}{formatCurrency(Number(item.profit_loss) || 0)} ({Number(item.profit_loss_percentage || 0).toFixed(2)}%)
                          </p>
                        </div>
                        <button
                          onClick={() => handleSellClick(item)}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                        >
                          Sell
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Transaction History */}
            {!loading && !error && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Transaction History
                </h2>
                
                {transactions.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <History className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No transactions yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.slice(0, 10).map((transaction) => (
                      <div
                        key={transaction.transaction_id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              transaction.type === 'BUY'
                                ? 'bg-green-100 dark:bg-green-900'
                                : 'bg-red-100 dark:bg-red-900'
                            }`}
                          >
                            {transaction.type === 'BUY' ? (
                              <TrendingUp className={`w-5 h-5 text-green-600 dark:text-green-400`} />
                            ) : (
                              <TrendingDown className={`w-5 h-5 text-red-600 dark:text-red-400`} />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {transaction.type} {transaction.coin_name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(transaction.created_at).toLocaleDateString('en-GB', {
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
                            {Number(transaction.quantity || 0).toFixed(4)} {transaction.coin_symbol}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatCurrency(Number(transaction.total_amount) || 0)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {transactions.length > 10 && (
                      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                        Showing 10 of {transactions.length} transactions
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sell Modal */}
      {showSellModal && selectedCoin && (
        <Modal
          isOpen={showSellModal}
          onClose={() => {
            setShowSellModal(false);
            setSelectedCoin(null);
          }}
        >
          <SellForm
            coin={{
              coin_id: selectedCoin.coin_id,
              name: selectedCoin.coin_name,
              symbol: selectedCoin.coin_symbol,
              current_price: selectedCoin.current_price,
              market_cap: 0,
              circulating_supply: 0,
              price_change_24h: 0,
              date_added: '',
              latest_price: selectedCoin.current_price
            }}
            onSuccess={handleSellSuccess}
          />
        </Modal>
      )}
    </div>
  );
}
