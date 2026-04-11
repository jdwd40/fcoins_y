import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
    <div className="border-y border-rule overflow-hidden bg-paper-alt">
      <div className="flex animate-ticker whitespace-nowrap py-2">
        {items.map((coin, i) => {
          const price = parseFloat(coin?.current_price?.toString() ?? '0');
          const change = parseFloat(coin?.price_change_24h?.toString() ?? '0');
          const up = change >= 0;
          return (
            <div key={`${coin.coin_id}-${i}`} className="flex items-center gap-3 px-6 border-r border-rule">
              <span className="font-mono text-[0.7rem] tracking-caps text-ink-dim font-semibold">
                {coin.symbol}
              </span>
              <span className="font-mono text-[0.75rem] text-ink tnum">
                £{price.toFixed(2)}
              </span>
              <span className={`font-mono text-[0.7rem] tnum ${up ? 'text-verdigris' : 'text-oxblood'}`}>
                {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Masthead({
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
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const volume = marketStatus?.currentCycle?.type ?? 'STABLE';
  const isLive = marketStatus?.status !== 'STOPPED';

  return (
    <header className="relative bg-paper border-b border-rule">
      {/* Top meta strip */}
      <div className="border-b border-rule">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-2 flex items-center justify-between gap-4 text-ink-mute">
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="flex items-center gap-2 label">
              <span className="live-dot"></span>
              {isLive ? 'Live' : 'Halted'}
            </span>
            <span className="hidden sm:inline label">Vol I · No. {new Date().getDate().toString().padStart(2, '0')}</span>
          </div>
          <div className="label hidden md:block">{today}</div>
          <div className="flex items-center gap-3">
            <UserMenu
              onAuthClick={onAuthClick}
              isDark={isDark}
              onThemeToggle={onThemeToggle}
            />
          </div>
        </div>
      </div>

      {/* Masthead title */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="ornament mb-4">
          <span className="label-ink">Est. MMXXIV</span>
        </div>
        <h1 className="font-display text-center text-ink leading-[0.88] tracking-masthead"
            style={{ fontVariationSettings: "'SOFT' 30, 'opsz' 144, 'wght' 500" }}>
          <span className="block text-[10vw] sm:text-[7.5vw] md:text-[5.5rem] lg:text-[6.5rem] xl:text-[7.5rem] italic">
            The&nbsp;Almanac
          </span>
          <span className="block text-[10vw] sm:text-[7.5vw] md:text-[5.5rem] lg:text-[6.5rem] xl:text-[7.5rem] -mt-1 sm:-mt-2">
            Exchange
          </span>
        </h1>
        <div className="ornament mt-5">
          <span className="label-ink">A Dispatch from the Coin Markets · {volume.replace('_', ' ')}</span>
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
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const { data: coinsData, loading: coinsLoading, error: coinsError } =
    useFetch<{ coins: Coin[] }>('https://jdwd40.com/api-2/api/coins', 2000);

  const { data: marketStats, loading: marketStatsLoading, error: marketStatsError } =
    useFetch<MarketStatsType>('https://jdwd40.com/api-2/api/market/stats', 2000);

  const marketData = coinsData && marketStats ? {
    coins: coinsData.coins,
    market_stats: marketStats
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
        <div className="paper-card max-w-md w-full p-10 text-center animate-reveal">
          <div className="ornament mb-5"><span className="label-ink">Notice</span></div>
          <h2 className="font-display text-4xl italic text-ink mb-4" style={{ fontVariationSettings: "'opsz' 144" }}>
            Trading Halted
          </h2>
          <p className="text-ink-dim font-mono text-sm leading-relaxed">
            The exchange floor has closed its books. The market simulation is currently suspended. Please check back shortly.
          </p>
          <div className="rule-thin mt-6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="paper-card max-w-md w-full p-10 text-center">
          <div className="ornament mb-5"><span className="label-ink text-oxblood">Transmission Error</span></div>
          <h2 className="font-display text-4xl italic text-ink mb-4">Wire Severed</h2>
          <p className="text-oxblood font-mono text-xs leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  if (loading && !marketData) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="font-display text-5xl italic text-ink animate-flicker" style={{ fontVariationSettings: "'opsz' 144" }}>
            Composing…
          </div>
          <span className="label">Setting the wires · Printing the sheet</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Masthead
        onAuthClick={() => setShowAuthModal(true)}
        isDark={isDark}
        onThemeToggle={() => setIsDark(!isDark)}
        marketStatus={marketStatus}
      />

      {marketData?.coins && <TickerTape coins={marketData.coins} />}

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Section: Front page splash with market stats */}
        <section className="animate-reveal delay-75">
          {marketData?.market_stats && (
            <MarketStats stats={marketData.market_stats} />
          )}
        </section>

        {/* Section: Market chart + status side-by-side */}
        <section className="mt-10 sm:mt-16 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 animate-reveal delay-150">
            <MarketValueChart refreshTrigger={refreshTrigger} />
          </div>
          <div className="animate-reveal delay-225">
            {marketStatus && <MarketStatus status={marketStatus} />}
          </div>
        </section>

        {/* Section: The Issues — coins list */}
        <section className="mt-12 sm:mt-20 animate-reveal delay-300">
          <div className="flex items-end justify-between mb-6 border-b border-rule pb-4">
            <div>
              <div className="label mb-1">Section II</div>
              <h2 className="font-display text-4xl sm:text-5xl italic text-ink"
                  style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40" }}>
                The&nbsp;Issues
              </h2>
            </div>
            <div className="hidden sm:block text-right">
              <div className="label mb-1">Sorted by</div>
              <div className="font-mono text-xs text-ink-dim">↓ Unit Price</div>
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

        {/* Footer colophon */}
        <footer className="mt-20 pt-8 border-t border-rule">
          <div className="ornament mb-4"><span className="label-ink">Colophon</span></div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-ink-mute">
            <p className="font-display italic text-sm">
              Set in Fraunces & JetBrains Mono. Printed on virtual parchment.
            </p>
            <p className="label">© {new Date().getFullYear()} · All quotes delayed by the aether</p>
          </div>
        </footer>

        <Modal isOpen={selectedCoinId !== null} onClose={() => setSelectedCoinId(null)}>
          {coinLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="font-display text-3xl italic text-ink-dim animate-flicker">Fetching dispatch…</div>
            </div>
          ) : (
            coinDetail?.coin && (
              <CoinDetail
                coin={coinDetail.coin}
                events={marketStatus?.events || []}
                refreshTrigger={refreshTrigger}
              />
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
    const intervalId = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, AUTO_REFRESH_INTERVAL);

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
