import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePersistent } from '../context/PersistentContext.tsx';
import { X, RefreshCw } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatCurrency, SessionExpiredError } from '../services/transactionService.ts';
import { getPersistentTransactions } from '../services/persistentService.ts';
import type { PersistentHolding, PersistentTransaction } from '../services/persistentService.ts';
import { PersistentTradePanel } from './PersistentTradePanel.tsx';
import { Modal } from './Modal';

// Persistent-market Stage 6 profile: the player's PERSISTENT account —
// cash, holdings at server-published live value, wealth, and the bounded
// persistent trade ledger. The legacy exchange portfolio (users.funds /
// portfolios table) is historical archive and no longer rendered here; the
// classic sell form is retired from this page with it. The persistent
// account figures are server-owned verbatim — nothing is derived
// client-side beyond summing the server's own per-holding P&L rows.
export function Profile() {
  const { user, getAuthToken, handleSessionExpired } = useAuth();
  const { showToast } = useToast();
  const { account, synced, provisioned, accountError, lastSyncAt, syncNow } = usePersistent();
  const navigate = useNavigate();
  const location = useLocation();

  const [transactions, setTransactions] = useState<PersistentTransaction[] | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [selectedHolding, setSelectedHolding] = useState<PersistentHolding | null>(null);
  const [showSellModal, setShowSellModal] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!user || !provisioned) {
      setTransactions(null);
      setTransactionsError(null);
      return;
    }
    const token = getAuthToken();
    if (!token) return;
    try {
      const result = await getPersistentTransactions(token, { limit: 100 });
      setTransactions(result.transactions);
      setTransactionsError(null);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        handleSessionExpired();
        showToast('Your session has expired. Please log in again.', 'error');
        return;
      }
      setTransactionsError(err instanceof Error ? err.message : 'Failed to load transactions');
    }
  }, [user, provisioned, getAuthToken, handleSessionExpired, showToast]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions, lastSyncAt]);

  const refresh = () => {
    void syncNow();
    void fetchTransactions();
  };

  if (!user || !user.id) {
    return (
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center px-4">
        <div className="paper-card max-w-md w-full p-10 text-center">
          <div className="ornament mb-4"><span className="label-ink">Access</span></div>
          <h2 className="font-display text-4xl italic text-ink mb-4">Credentials Required</h2>
          <p className="text-sm text-ink-mute mb-6">Sign in to view your persistent account</p>
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

  const handleSellClick = (holding: PersistentHolding) => {
    setSelectedHolding(holding);
    setShowSellModal(true);
  };

  const handleSellDone = () => {
    setShowSellModal(false);
    setSelectedHolding(null);
    refresh();
  };

  const loading = !synced;
  const error = accountError !== null && account === null ? accountError : null;

  // Server-owned figures only: portfolio value is the account's live
  // holdingsValue; overall P/L is server wealth minus the exactly-once
  // £10,000 starting grant; per-holding P&L rows are summed from the
  // server's own figures.
  const holdings = account?.holdings ?? [];
  const totalPortfolioValue = account?.holdingsValue ?? 0;
  const totalUnrealizedPnl = holdings.reduce((sum, holding) => sum + holding.unrealizedPnl, 0);
  const accountPnl = account !== null ? account.netWealth - account.startingCash : 0;

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
          <div className="mb-6 border border-rule rounded-xl px-4 py-3 bg-paper-alt">
            <span className="label">Persistent market account</span>
            <p className="text-xs text-ink-mute mt-1">
              This is your persistent Crypto Chaos account — the £10,000.00 starting Cash was granted
              exactly once, and every balance and holding here survives; there are no rounds, resets
              or settlements. Trades execute at the server-locked live price.
            </p>
          </div>
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

          {/* Account summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="label mb-2">Portfolio Value</div>
              <div className="numeral text-ink text-4xl" style={{ fontVariationSettings: "'opsz' 144" }}>
                {formatCurrency(totalPortfolioValue)}
              </div>
            </div>
            <div className="sm:border-l sm:border-rule sm:pl-6">
              <div className="label mb-2">Persistent cash</div>
              <div className="numeral text-ink text-4xl" style={{ fontVariationSettings: "'opsz' 144" }}>
                {account !== null ? formatCurrency(account.cash) : '—'}
              </div>
            </div>
            <div className="sm:border-l sm:border-rule sm:pl-6">
              <div className="label mb-2">Account P/L since start</div>
              <div className={`numeral text-4xl ${accountPnl >= 0 ? 'text-verdigris' : 'text-oxblood'}`}
                   style={{ fontVariationSettings: "'opsz' 144" }}>
                {accountPnl >= 0 ? '+' : ''}{formatCurrency(accountPnl)}
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
            <button onClick={refresh} className="btn-ink">Retry</button>
          </div>
        )}

        {!loading && !error && synced && !provisioned && (
          <div className="text-center py-16">
            <div className="ornament mb-4"><span className="label-ink">Provisioning</span></div>
            <p className="font-display italic text-ink-dim text-xl mb-4">
              Your persistent account is being provisioned by the server — once, idempotently
            </p>
            <button onClick={refresh} className="btn-gold">
              Refresh
            </button>
          </div>
        )}

        {/* Holdings */}
        {!loading && !error && provisioned && account !== null && (
          <section className="mb-16 animate-reveal delay-150">
            <div className="flex items-end justify-between mb-6 pb-4 border-b border-rule">
              <div>
                <div className="label mb-1">Portfolio</div>
                <h2 className="font-display text-3xl sm:text-4xl italic text-ink"
                    style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40" }}>
                  Holdings
                </h2>
              </div>
              <button onClick={refresh} className="label hover:text-gold inline-flex items-center gap-2">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {holdings.length === 0 ? (
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
                {holdings.map((holding) => {
                  const pl = holding.unrealizedPnl;
                  const plPct = holding.unrealizedPnlPct ?? 0;
                  const up = pl >= 0;
                  const dead = !(holding.currentPrice > 0);
                  return (
                    <div
                      key={holding.coinId}
                      className="flex items-center gap-4 p-5 bg-card hover:bg-paper-alt transition-colors"
                    >
                      <div className="w-12 h-12 shrink-0 border border-rule flex items-center justify-center bg-paper-alt">
                        <span className="font-display italic text-xl text-gold">
                          {(holding.symbol || '?').charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display italic text-xl text-ink truncate">
                          {holding.symbol}
                          {dead && <span className="ml-2 font-mono text-xs text-oxblood not-italic">DEAD</span>}
                        </div>
                        <div className="font-mono text-[0.7rem] text-ink-mute tracking-caps uppercase tnum">
                          {holding.quantity.toFixed(4)} {holding.symbol} · avg {holding.averageEntryPrice === null ? '—' : formatCurrency(holding.averageEntryPrice)}
                        </div>
                      </div>
                      <div className="text-right hidden sm:block">
                        <div className="font-mono text-sm text-ink tnum">
                          {formatCurrency(holding.currentValue)}
                        </div>
                        <div className={`font-mono text-xs tnum ${up ? 'text-verdigris' : 'text-oxblood'}`}>
                          {up ? '+' : ''}{formatCurrency(pl)} ({plPct.toFixed(2)}%)
                        </div>
                      </div>
                      {!dead && (
                        <button
                          onClick={() => handleSellClick(holding)}
                          className="btn-oxblood shrink-0"
                        >
                          Sell
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className="px-5 py-3 border-t border-rule bg-paper-alt flex justify-between">
                  <span className="label">Unrealised P/L</span>
                  <span className={`font-mono text-sm tnum ${totalUnrealizedPnl >= 0 ? 'text-verdigris' : 'text-oxblood'}`}>
                    {totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnl)}
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Transaction history */}
        {!loading && !error && provisioned && (
          <section className="animate-reveal delay-300">
            <div className="mb-6 pb-4 border-b border-rule">
              <div className="label mb-1">Account activity</div>
              <h2 className="font-display text-3xl sm:text-4xl italic text-ink"
                  style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40" }}>
                Transaction history
              </h2>
            </div>

            {transactionsError && (
              <p className="text-xs text-oxblood mb-3" role="status">
                History update failed — showing the last synced entries. {transactionsError}
              </p>
            )}

            {transactions === null ? (
              !transactionsError && (
                <div className="text-center py-12 label animate-flicker">Reading the ledger…</div>
              )
            ) : transactions.length === 0 ? (
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
                  {transactions.map((transaction) => {
                    const isBuy = transaction.type === 'BUY';
                    return (
                      <div
                        key={transaction.persistentTransactionId}
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
                          {transaction.symbol}
                        </div>
                        <div className="sm:col-span-3 font-mono text-[0.7rem] text-ink-mute tracking-caps">
                          {new Date(transaction.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="sm:col-span-2 font-mono text-sm text-ink-dim tnum sm:text-right">
                          {transaction.quantity.toFixed(4)} {transaction.symbol}
                        </div>
                        <div className="sm:col-span-2 font-mono text-sm text-ink tnum sm:text-right">
                          {formatCurrency(transaction.totalAmount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {showSellModal && selectedHolding && (
        <Modal
          isOpen={showSellModal}
          onClose={handleSellDone}
        >
          <div className="p-2">
            <div className="label mb-3">Sell {selectedHolding.symbol} · persistent account</div>
            <PersistentTradePanel
              coin={{
                coin_id: selectedHolding.coinId,
                name: selectedHolding.symbol,
                symbol: selectedHolding.symbol,
                current_price: String(selectedHolding.currentPrice),
                market_cap: '£0.00',
                circulating_supply: 0,
                price_change_24h: 0,
                founder: ''
              }}
            />
            <button onClick={handleSellDone} className="btn-ink w-full mt-4">
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
