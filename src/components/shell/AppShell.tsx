import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar.tsx';
import { WorldStrip } from './WorldStrip.tsx';
import { BottomTabBar } from './BottomTabBar.tsx';
import { AuthDialog } from './AuthDialog.tsx';
import { TradeSheet } from './TradeSheet.tsx';
import { HowToPlayDialog } from './HowToPlayDialog.tsx';
import { ShellServicesProvider, type AuthTab, type ShellServices } from './shellServices.ts';
import { useTheme } from '../../hooks/usePageTitle.ts';

// The player app shell: sticky top bar, world strip, page outlet, bottom tab
// bar on phones, footer. Mounted ONCE for all player routes so the auth /
// toast / persistent providers (in PlayerShell) never remount on navigation.
export function AppShell() {
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();

  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>('signin');
  const [tradeCoinId, setTradeCoinId] = useState<number | null>(null);
  const [tradeSide, setTradeSide] = useState<'BUY' | 'SELL'>('BUY');
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  // Scroll to top on every route change.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const services = useMemo<ShellServices>(
    () => ({
      openAuth: (tab = 'signin') => {
        setAuthTab(tab);
        setAuthOpen(true);
      },
      openTrade: (coinId, side = 'BUY') => {
        setTradeCoinId(coinId);
        setTradeSide(side);
      },
      openHowToPlay: () => setHowToPlayOpen(true)
    }),
    []
  );

  return (
    <ShellServicesProvider value={services}>
      <div className="min-h-screen flex flex-col bg-paper text-ink">
        <TopBar isDark={isDark} onThemeToggle={toggleTheme} />
        <WorldStrip />
        {/* Bottom padding clears the fixed phone tab bar. */}
        <main className="flex-1 pb-24 md:pb-10">
          <Outlet />
        </main>
        <footer className="border-t border-rule py-6 pb-24 md:pb-6">
          <div className="game-shell flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-sm text-ink-dim">
              Crypto Chaos — a fantasy market for friends and family.
            </p>
            <p className="text-xs text-ink-mute">
              Virtual GBP only · No real cryptocurrency, deposits, withdrawals or financial services
            </p>
          </div>
        </footer>
        <BottomTabBar />
      </div>

      <AuthDialog open={authOpen} tab={authTab} onTabChange={setAuthTab} onClose={() => setAuthOpen(false)} />
      <TradeSheet coinId={tradeCoinId} side={tradeSide} onClose={() => setTradeCoinId(null)} />
      <HowToPlayDialog open={howToPlayOpen} onClose={() => setHowToPlayOpen(false)} />
    </ShellServicesProvider>
  );
}
