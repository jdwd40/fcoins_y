import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AlertTriangle, XCircle } from 'lucide-react';
import { CoinsList } from './components/CoinsList';
import { CoinDetail } from './components/CoinDetail';
import { MarketStats } from './components/MarketStats';
import { PriceChart } from './components/PriceChart';
import { MarketStatus } from './components/MarketStatus';
import { ThemeToggle } from './components/ThemeToggle';
import { useFetch } from './hooks/useFetch';
import { Modal } from './components/Modal';
import { AuthProvider } from './context/AuthContext';
import { UserMenu } from './components/UserMenu';
import { AuthForms } from './components/AuthForms';
import { Profile } from './components/Profile';
import { MarketValueChart } from './components/MarketValueChart';
import type { MarketData, Coin, PriceHistory, MarketStatus as MarketStatusType } from './types';

function Market() {
  const [selectedCoinId, setSelectedCoinId] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isDark, setIsDark] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const { data: marketData, loading: marketLoading, error: marketError } =
    useFetch<MarketData>('https://jdwd40.com/api-2/api/market/stats', 2000);

  const { data: marketStatus } = useFetch<MarketStatusType>(
    'https://jdwd40.com/api-2/api/market/status',
    2000
  );

  const { data: coinDetail, loading: coinLoading } = useFetch<{ coin: Coin }>(
    selectedCoinId ? `https://jdwd40.com/api-2/api/coins/${selectedCoinId}` : ''
  );

  const { data: priceHistoryData } = useFetch<PriceHistory>(
    selectedCoinId
      ? `https://jdwd40.com/api-2/api/coins/${selectedCoinId}/price-history?range=30M`
      : ''
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  if (marketStatus?.status === 'STOPPED') {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 max-w-md w-full text-center">
          <div className="mb-4 text-yellow-500">
            <AlertTriangle className="w-16 h-16 mx-auto" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Simulation Stopped
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            The market simulation is currently stopped. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (marketError) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 max-w-md w-full text-center">
          <div className="mb-4 text-red-500">
            <XCircle className="w-16 h-16 mx-auto" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Error
          </h2>
          <p className="text-red-600 dark:text-red-400">
            {marketError}
          </p>
        </div>
      </div>
    );
  }

  if (marketLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Coins Viewer</h1>
            <div className="flex items-center gap-4">
              <UserMenu 
                onAuthClick={() => setShowAuthModal(true)}
                isDark={isDark}
                onThemeToggle={() => setIsDark(!isDark)}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {marketStatus && <MarketStatus status={marketStatus} />}
        {marketData?.market_stats && <MarketStats stats={marketData.market_stats} />}
        
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <MarketValueChart className="w-full" />
          </div>
          <div className="flex justify-between items-center mb-6">
            {marketData?.coins && (
              <CoinsList
                coins={marketData.coins}
                onSelectCoin={setSelectedCoinId}
                selectedCoinId={selectedCoinId}
                events={marketStatus?.events || []}
              />
            )}
          </div>
        </div>

        <Modal isOpen={selectedCoinId !== null} onClose={() => setSelectedCoinId(null)}>
          {coinLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <p className="text-gray-600 dark:text-gray-400">Loading coin details...</p>
            </div>
          ) : (
            <>
              {coinDetail?.coin && (
                <CoinDetail 
                  coin={coinDetail.coin}
                  events={marketStatus?.events || []}
                />
              )}
              {priceHistoryData?.price_history && (
                <PriceChart 
                  coinId={selectedCoinId.toString()}
                  priceHistory={priceHistoryData.price_history}
                />
              )}
            </>
          )}
        </Modal>
      </main>
      
      <Modal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)}>
        <AuthForms onClose={() => setShowAuthModal(false)} />
      </Modal>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
          <Routes>
            <Route path="/" element={<Market />} />
            <Route 
              path="/profile" 
              element={<Profile />}
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;