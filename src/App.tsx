import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { CoinsList } from './components/CoinsList';
import { CoinDetail } from './components/CoinDetail';
import { MarketStats } from './components/MarketStats';
import { MarketStatus } from './components/MarketStatus';
import { useFetch } from './hooks/useFetch';
import { Modal } from './components/Modal';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { GameProvider } from './context/GameContext.tsx';
import { AuthForms } from './components/AuthForms';
import { Profile } from './components/Profile';
import { MarketValueChart } from './components/MarketValueChart';
import { ApocalypseHeader } from './components/ApocalypseHeader.tsx';
import { PlayerRoundPanel } from './components/PlayerRoundPanel.tsx';
import { LeaderboardPanel } from './components/LeaderboardPanel.tsx';
import { ResultsOverlay, RecentResultsPanel } from './components/ResultsPanel.tsx';
import { GameTopBar } from './components/GameTopBar.tsx';
import { PlayerStatusStrip } from './components/PlayerStatusStrip.tsx';
import { LeaderboardPressure } from './components/LeaderboardPressure.tsx';
import { GameMarketGrid } from './components/GameMarketGrid.tsx';
import { API_BASE_URL } from './services/apiConfig.ts';
import type { Coin, MarketStatus as MarketStatusType, MarketStats as MarketStatsType } from './types';

const AUTO_REFRESH_INTERVAL = 30000;

// V2-5 primary screen composition: the casual mobile game FIRST — compact
// status header, player status strip, leaderboard pressure, then the
// scannable market grid. The classic exchange (stats, charts, asset table,
// profile/history) is preserved intact as the secondary drill-down surface
// below the game.
function Market({ refreshTrigger }: { refreshTrigger: number }) {
  const [selectedCoinId, setSelectedCoinId] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return true;
  });

  // Classic exchange feeds. These serve the secondary drill-down surfaces
  // only — the primary game surface reads the shared GameContext game
  // contracts, so a classic-market outage never blocks gameplay.
  const { data: coinsData, loading: coinsLoading, error: coinsError } =
    useFetch<{ coins: Coin[] }>(`${API_BASE_URL}/coins`, 2000);

  const { data: marketStats, loading: marketStatsLoading, error: marketStatsError } =
    useFetch<MarketStatsType>(`${API_BASE_URL}/market/stats`, 2000);

  const marketData = coinsData && marketStats ? {
    coins: coinsData.coins,
    market_stats: marketStats,
  } : undefined;

  const classicLoading = coinsLoading || marketStatsLoading;
  const classicError = coinsError || marketStatsError;

  const { data: marketStatus } = useFetch<MarketStatusType>(
    `${API_BASE_URL}/market/status`,
    2000
  );

  const { data: coinDetail, loading: coinLoading } = useFetch<{ coin: Coin }>(
    selectedCoinId ? `${API_BASE_URL}/coins/${selectedCoinId}` : ''
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const classicNotice = (() => {
    if (marketStatus?.status === 'STOPPED') {
      return 'The classic exchange simulator is temporarily offline. Balances and holdings remain safe.';
    }
    if (classicError) {
      return `Classic market data unavailable — ${classicError}`;
    }
    if (classicLoading && !marketData) {
      return 'Loading classic market data…';
    }
    return null;
  })();

  return (
    <div id="top" className="min-h-screen bg-paper text-ink">
      <GameTopBar
        onAuthClick={() => setShowAuthModal(true)}
        isDark={isDark}
        onThemeToggle={() => setIsDark(!isDark)}
      />

      {/* Compact game status: apocalypse id, server-anchored countdown,
          escalation, connection state — directly above the gameplay. */}
      <ApocalypseHeader coins={marketData?.coins ?? coinsData?.coins ?? []} />

      <main className="game-shell py-4 sm:py-8">
        {/* Primary mobile-first game surface */}
        <div className="space-y-4 sm:space-y-5 mb-8 sm:mb-10">
          <PlayerStatusStrip onAuthRequest={() => setShowAuthModal(true)} />
          <LeaderboardPressure />
          <GameMarketGrid />
        </div>

        {/* Drill-down: full board, round activity, recent results */}
        <section id="leaderboard" className="mb-10 sm:mb-12" aria-label="Round detail">
          <div className="label mb-2">Round detail</div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink mb-4">
            Board, activity and results
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <LeaderboardPanel />
            <PlayerRoundPanel coins={marketData?.coins ?? coinsData?.coins ?? []} onAuthRequest={() => setShowAuthModal(true)} />
            <RecentResultsPanel />
          </div>
        </section>

        {/* Secondary: classic exchange surfaces (preserved Core 7 behaviour) */}
        <section id="markets" className="animate-reveal" aria-label="Classic exchange">
          <div className="label mb-2">Classic exchange · drill-down</div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink mb-1">
            Charts and full asset detail
          </h2>
          <p className="text-ink-mute text-sm mb-5 max-w-2xl">
            The original exchange view: market statistics, charts and the full asset table.
          </p>

          {classicNotice !== null ? (
            <div className="paper-card max-w-md w-full p-7 text-center mb-8">
              <Activity className="w-8 h-8 text-oxblood mx-auto mb-4" aria-hidden="true" />
              <p className="text-ink-dim text-sm leading-relaxed">{classicNotice}</p>
            </div>
          ) : (
            <>
              {marketData?.market_stats && (
                <div className="mb-6">
                  <MarketStats stats={marketData.market_stats} />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
                <div className="lg:col-span-2">
                  <MarketValueChart refreshTrigger={refreshTrigger} />
                </div>
                <div>
                  {marketStatus && <MarketStatus status={marketStatus} />}
                </div>
              </div>

              {marketData?.coins && (
                <>
                  <div className="flex items-end justify-between mb-4">
                    <div className="label">{marketData.coins.length} assets · sorted by price · dead coins sink</div>
                  </div>
                  <CoinsList
                    coins={marketData.coins}
                    onSelectCoin={setSelectedCoinId}
                    selectedCoinId={selectedCoinId}
                    events={marketStatus?.events || []}
                  />
                </>
              )}
            </>
          )}
        </section>

        <footer id="about" className="mt-14 sm:mt-16 pt-7 border-t border-rule flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="font-display font-bold text-ink">Crypto Chaos · a CoinX apocalypse</div>
            <p className="text-ink-mute text-xs mt-1">A private fantasy market for friends and family — now with scheduled extinction events.</p>
          </div>
          <p className="label max-w-xl md:text-right">Virtual GBP only · No real cryptocurrency, deposits, withdrawals or financial services</p>
        </footer>

        <Modal isOpen={selectedCoinId !== null} onClose={() => setSelectedCoinId(null)}>
          {coinLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="label animate-flicker">Loading asset market…</div>
            </div>
          ) : (
            coinDetail?.coin && (
              <CoinDetail coin={coinDetail.coin} events={marketStatus?.events || []} refreshTrigger={refreshTrigger} />
            )
          )}
        </Modal>
      </main>

      <Modal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)}>
        <AuthForms onClose={() => setShowAuthModal(false)} />
      </Modal>

      {/* End-of-round immutable results experience (Core 6 snapshot) */}
      <ResultsOverlay />
    </div>
  );
}

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => setRefreshTrigger((previous) => previous + 1), AUTO_REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <AuthProvider>
      <ToastProvider>
        <GameProvider>
          <Router basename="/coins">
            <Routes>
              <Route path="/" element={<Market refreshTrigger={refreshTrigger} />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </Router>
        </GameProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
