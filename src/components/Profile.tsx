import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { X, RefreshCw } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getUserPortfolio,
  getUserTransactions,
  formatCurrency,
  SessionExpiredError,
  type PortfolioItem,
  type TransactionHistoryItem,
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
      const [portfolioData, transactionsData] = await Promise.all([
        getUserPortfolio(user.id, token),
        getUserTransactions(user.id, token),
      ]);
      setPortfolio(portfolioData.portfolio || []);
      setTransactions(transactionsData.transactions || []);
      if (portfolioData.user_funds !== undefined && portfolioData.user_funds !== user.funds) {
        const updatedUser = { ...user, funds: portfolioData.user_funds };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        refreshUser();
      }
    } catch (err) {
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

  if (!user || !user.id) {
    return (
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center px-4">
        <div className="paper-card max-w-md w-full p-10 text-center">
          <div className="ornament mb-4"><span className="label-ink">Access</span></div>
          <h2 className="font-display text-4xl italic text-ink mb-4">Credentials Required</h2>
          <p className="text-sm text-ink-mute mb-6">Sign in to view your virtual portfolio</p>
          <button onClick={() => navigate('/')} className="btn-gold">
            Return Home
          </button>
        </div>
      </div>
    );
  }

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
    fetchData();
  };

  const totalPortfolioValue = portfolio.reduce((sum, item) => sum + (Number(item.total_value) || 0), 0);
  const totalProfitLoss = portfolio.reduce((sum, item) => sum + (Number(item.profit_loss) || 0), 0);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <button
          onClick={handleClose}
          className="mb-8 label hover:text-gold transition-colors inline-flex items-center gap-2"
        >
          <X className="w-3 h-3" /> Return to Markets
        </button>

        {/* Portfolio masthead */}
        <div className="paper-card p-6 sm:p-10 mb-10 animate-reveal">
          <div className="flex items-start gap-6 mb-8">
            <div className="w-24 h-24 shrink-0 border border-rule flex items-center justify-center bg-paper-alt">
              <span className="font-display italic text-5xl text-gold"
                    style={{ fontVariationSettings: "'opsz' 144" }}>
                {displayInitial}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="label mb-1">Account Holder</div>
              <h1 className="font-display text-4xl sm:text-5xl italic text-ink leading-none truncate"
                  style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 50" }}>
                {displayName}
              </h1>
              <div className="mt-3 font-mono text-xs text-ink-mute tracking-caps uppercase">
                {user.email || '—'}
              </div>
            </div>
          </div>

          <div className="rule-thin mb-6"></div>

          {/* Portfolio summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="label mb-2">Portfolio Value</div>
              <div className="numeral text-ink text-4xl" style={{ fontVariationSettings: "'opsz' 144" }}>
                {formatCurrency(totalPortfolioValue)}
              </div>
            </div>
            <div className="sm:border-l sm:border-rule sm:pl-6">
              <div className="label mb-2">Available cash</div>
              <div className="numeral text-ink text-4xl" style={{ fontVariationSettings: "'opsz' 144" }}>
                {formatCurrency(Number(user.funds) || 0)}
              </div>
            </div>
            <div className="sm:border-l sm:border-rule sm:pl-6">
              <div className="label mb-2">Unrealised P/L</div>
              <div className={`numeral text-4xl ${totalProfitLoss >= 0 ? 'text-verdigris' : 'text-oxblood'}`}
                   style={{ fontVariationSettings: "'opsz' 144" }}>
                {totalProfitLoss >= 0 ? '+' : ''}{formatCurrency(totalProfitLoss)}
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-center py-16 label animate-flicker">Balancing the books…</div>
        )}

        {error && (
          <div className="border-l-2 border-oxblood bg-card p-5 mb-10">
            <div className="label text-oxblood mb-1">Error</div>
            <p className="font-mono text-xs text-ink-dim mb-3">{error}</p>
            <button onClick={fetchData} className="btn-ink">Retry</button>
          </div>
        )}

        {/* Holdings */}
        {!loading && !error && (
          <section className="mb-16 animate-reveal delay-150">
            <div className="flex items-end justify-between mb-6 pb-4 border-b border-rule">
              <div>
                <div className="label mb-1">Portfolio</div>
                <h2 className="font-display text-3xl sm:text-4xl italic text-ink"
                    style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40" }}>
                  Holdings
                </h2>
              </div>
              <button onClick={fetchData} className="label hover:text-gold inline-flex items-center gap-2">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {portfolio.length === 0 ? (
              <div className="text-center py-16">
                <div className="ornament mb-4"><span className="label-ink">No holdings</span></div>
                <p className="font-display italic text-ink-dim text-xl mb-4">
                  You hold no positions at present
                </p>
                <button onClick={() => navigate('/')} className="btn-gold">
                  Browse Markets
                </button>
              </div>
            ) : (
              <div className="divide-rule border border-rule">
                {portfolio.map((item) => {
                  const pl = Number(item.profit_loss) || 0;
                  const plPct = Number(item.profit_loss_percentage || 0);
                  const up = pl >= 0;
                  return (
                    <div
                      key={item.portfolio_id}
                      className="flex items-center gap-4 p-5 bg-card hover:bg-paper-alt transition-colors"
                    >
                      <div className="w-12 h-12 shrink-0 border border-rule flex items-center justify-center bg-paper-alt">
                        <span className="font-display italic text-xl text-gold">
                          {(item.coin_symbol || '?').charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display italic text-xl text-ink truncate">
                          {item.coin_name}
                        </div>
                        <div className="font-mono text-[0.7rem] text-ink-mute tracking-caps uppercase tnum">
                          {Number(item.quantity || 0).toFixed(4)} {item.coin_symbol} · avg {formatCurrency(Number(item.average_purchase_price) || 0)}
                        </div>
                      </div>
                      <div className="text-right hidden sm:block">
                        <div className="font-mono text-sm text-ink tnum">
                          {formatCurrency(Number(item.total_value) || 0)}
                        </div>
                        <div className={`font-mono text-xs tnum ${up ? 'text-verdigris' : 'text-oxblood'}`}>
                          {up ? '+' : ''}{formatCurrency(pl)} ({plPct.toFixed(2)}%)
                        </div>
                      </div>
                      <button
                        onClick={() => handleSellClick(item)}
                        className="btn-oxblood shrink-0"
                      >
                        Sell
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Transaction history */}
        {!loading && !error && (
          <section className="animate-reveal delay-300">
            <div className="mb-6 pb-4 border-b border-rule">
              <div className="label mb-1">Account activity</div>
              <h2 className="font-display text-3xl sm:text-4xl italic text-ink"
                  style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40" }}>
                Transaction history
              </h2>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="font-display italic text-ink-dim">No entries yet</p>
              </div>
            ) : (
              <div className="border border-rule">
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 border-b border-rule bg-paper-alt">
                  <div className="label col-span-1">Type</div>
                  <div className="label col-span-4">Instrument</div>
                  <div className="label col-span-3">Date</div>
                  <div className="label col-span-2 text-right">Quantity</div>
                  <div className="label col-span-2 text-right">Value</div>
                </div>
                <div className="divide-rule">
                  {transactions.slice(0, 20).map((transaction) => {
                    const isBuy = transaction.type === 'BUY';
                    return (
                      <div
                        key={transaction.transaction_id}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-4 px-5 py-4 bg-card hover:bg-paper-alt transition-colors"
                      >
                        <div className="sm:col-span-1">
                          <span className={`font-mono text-[0.65rem] tracking-caps uppercase font-bold ${
                            isBuy ? 'text-verdigris' : 'text-oxblood'
                          }`}>
                            {isBuy ? '▲ Buy' : '▼ Sell'}
                          </span>
                        </div>
                        <div className="sm:col-span-4 font-display italic text-lg text-ink truncate">
                          {transaction.coin_name}
                        </div>
                        <div className="sm:col-span-3 font-mono text-[0.7rem] text-ink-mute tracking-caps">
                          {new Date(transaction.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="sm:col-span-2 font-mono text-sm text-ink-dim tnum sm:text-right">
                          {Number(transaction.quantity || 0).toFixed(4)} {transaction.coin_symbol}
                        </div>
                        <div className="sm:col-span-2 font-mono text-sm text-ink tnum sm:text-right">
                          {formatCurrency(Number(transaction.total_amount) || 0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {transactions.length > 20 && (
                  <div className="px-5 py-3 border-t border-rule text-center label bg-paper-alt">
                    Showing 20 of {transactions.length} entries
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>

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
              latest_price: selectedCoin.current_price,
            }}
            onSuccess={handleSellSuccess}
          />
        </Modal>
      )}
    </div>
  );
}
