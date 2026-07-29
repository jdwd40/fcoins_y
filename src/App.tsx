import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Activity, BarChart3, ShieldCheck } from 'lucide-react';
import { CoinsList } from './components/CoinsList';
import { CoinDetail } from './components/CoinDetail';
import { MarketStats } from './components/MarketStats';
import { MarketStatus } from './components/MarketStatus';
import { useFetch } from './hooks/useFetch';
import { Modal } from './components/Modal';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { UserMenu } from './components/UserMenu';
import { AuthForms } from './components/AuthForms';
import { Profile } from './components/Profile';
import { MarketValueChart } from './components/MarketValueChart';
import type { Coin, MarketStatus as MarketStatusType, MarketStats as MarketStatsType } from './types';

const AUTO_REFRESH_INTERVAL = 30000;

function TickerTape({ coins }: { coins: Coin[] }) {
  const items = useMemo(() => {
    const base = coins.slice(0, 20);
    return [...base, ...base];
  }, [coins]);

  if (!coins.length) return null;

  return (
    <div className="border-b border-rule overflow-hidden bg-paper-alt">
      <div className="flex animate-ticker whitespace-nowrap py-2.5">
        {items.map((coin, i) => {
          const price = parseFloat(coin?.current_price?.toString() ?? '0');
          const change = parseFloat(coin?.price_change_24h?.toString() ?? '0');
          const up = change >= 0;
          return (
            <div key={`${coin.coin_id}-${i}`} className="flex items-center gap-3 px-5 border-r border-rule">
              <span className="font-mono text-[0.7rem] text-ink font-bold">{coin.symbol}/GBP</span>
              <span className="font-mono text-[0.72rem] text-ink-dim tnum">£{price.toFixed(2)}</span>
              <span className={`font-mono text-[0.68rem] font-semibold tnum ${up ? 'text-verdigris' : 'text-oxblood'}`}>
                {up ? '+' : ''}{change.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExchangeHeader({
  onAuthClick,
  isDark,
  onThemeToggle,
  marketStatus,
}: {
  onAuthClick: () => void;
  isDark: boolean;
  onThemeToggle: () => void;
  marketStatus: MarketStatusType | null | undefined;
}) {
  const cycle = marketStatus?.currentCycle?.type?.replace('_', ' ') ?? 'STABLE';
  const isLive = marketStatus?.status !== 'STOPPED';

  return (
    <header className="exchange-nav sticky top-0 z-30">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-5">
        <a href="#top" className="flex items-center gap-3 shrink-0" aria-label="CoinX home">
          <span className="w-9 h-9 rounded-xl bg-gold text-white grid place-items-center font-extrabold text-sm shadow-gold-glow">CX</span>
          <span className="font-display text-xl font-bold tracking-tight text-ink">CoinX</span>
          <span className="hidden sm:inline chip">Virtual GBP</span>
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-ink-mute" aria-label="Main navigation">
          <a href="#markets" className="hover:text-gold transition-colors">Markets</a>
          <a href="#analytics" className="hover:text-gold transition-colors">Analytics</a>
          <a href="#about" className="hover:text-gold transition-colors">About</a>
        </nav>

        <UserMenu onAuthClick={onAuthClick} isDark={isDark} onThemeToggle={onThemeToggle} />
      </div>

      <div className="border-t border-rule bg-paper-alt">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-2 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-5 whitespace-nowrap">
            <span className="flex items-center gap-2 label-ink">
              <span className="live-dot" /> {isLive ? 'Market live' : 'Market halted'}
            </span>
            <span className="label">Cycle <strong className="text-ink ml-1">{cycle}</strong></span>
          </div>
          <div className="hidden sm:flex items-center gap-2 label whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5 text-gold" /> Simulation only · No real funds
          </div>
        </div>
      </div>
    </header>
  );
}

function Market({ refreshTrigger }: { refreshTrigger: number }) {
  const [selectedCoinId, setSelectedCoinId] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return true;
  });

  const { data: coinsData, loading: coinsLoading, error: coinsError } =
    useFetch<{ coins: Coin[] }>('https://jdwd40.com/api-2/api/coins', 2000);

  const { data: marketStats, loading: marketStatsLoading, error: marketStatsError } =
    useFetch<MarketStatsType>('https://jdwd40.com/api-2/api/market/stats', 2000);

  const marketData = coinsData && marketStats ? {
    coins: coinsData.coins,
    market_stats: marketStats,
  } : undefined;

  const loading = coinsLoading || marketStatsLoading;
  const error = coinsError || marketStatsError;

  const { data: marketStatus } = useFetch<MarketStatusType>(
    'https://jdwd40.com/api-2/api/market/status',
    2000
  );

  const { data: coinDetail, loading: coinLoading } = useFetch<{ coin: Coin }>(
    selectedCoinId ? `https://jdwd40.com/api-2/api/coins/${selectedCoinId}` : ''
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

  if (marketStatus?.status === 'STOPPED') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="paper-card max-w-md w-full p-9 text-center animate-reveal">
          <Activity className="w-10 h-10 text-oxblood mx-auto mb-5" />
          <div className="label mb-2">Market status</div>
          <h2 className="font-display text-3xl font-bold text-ink mb-3">Trading paused</h2>
          <p className="text-ink-dim text-sm leading-relaxed">
            The virtual market simulator is temporarily offline. Balances and holdings remain safe.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="paper-card max-w-md w-full p-9 text-center">
          <div className="label text-oxblood mb-2">Connection error</div>
          <h2 className="font-display text-3xl font-bold text-ink mb-3">Market data unavailable</h2>
          <p className="text-oxblood font-mono text-xs leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  if (loading && !marketData) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-11 h-11 rounded-full border-2 border-rule border-t-gold animate-spin" />
          <span className="label">Loading live market data</span>
        </div>
      </div>
    );
  }

  return (
    <div id="top" className="min-h-screen bg-paper text-ink">
      <ExchangeHeader
        onAuthClick={() => setShowAuthModal(true)}
        isDark={isDark}
        onThemeToggle={() => setIsDark(!isDark)}
        marketStatus={marketStatus}
      />

      {marketData?.coins && <TickerTape coins={marketData.coins} />}

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <section className="animate-reveal delay-75 mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7">
            <div>
              <div className="flex items-center gap-2 label text-gold mb-2">
                <BarChart3 className="w-3.5 h-3.5" /> Live simulation
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-ink">Market Overview</h1>
              <p className="text-ink-mute mt-3 max-w-2xl text-sm sm:text-base">
                Track fantasy assets, monitor simulated price movement and manage your virtual GBP portfolio.
              </p>
            </div>
            <span className="chip self-start lg:self-auto">Refreshes every 2 seconds</span>
          </div>
          {marketData?.market_stats && <MarketStats stats={marketData.market_stats} />}
        </section>

        <section id="analytics" className="mt-7 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 animate-reveal delay-150">
            <MarketValueChart refreshTrigger={refreshTrigger} />
          </div>
          <div className="animate-reveal delay-225">
            {marketStatus && <MarketStatus status={marketStatus} />}
          </div>
        </section>

        <section id="markets" className="mt-12 sm:mt-16 animate-reveal delay-300">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="label mb-2">Virtual assets</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">Markets</h2>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm text-ink">{marketData?.coins.length ?? 0} assets</div>
              <div className="label mt-1">Sorted by price</div>
            </div>
          </div>
          {marketData?.coins && (
            <CoinsList
              coins={marketData.coins}
              onSelectCoin={setSelectedCoinId}
              selectedCoinId={selectedCoinId}
              events={marketStatus?.events || []}
            />
          )}
        </section>

        <footer id="about" className="mt-16 sm:mt-20 pt-7 border-t border-rule flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="font-display font-bold text-ink">CoinX Virtual Exchange</div>
            <p className="text-ink-mute text-xs mt-1">A private fantasy market for friends and family.</p>
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
        <Router basename="/coins">
          <Routes>
            <Route path="/" element={<Market refreshTrigger={refreshTrigger} />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
