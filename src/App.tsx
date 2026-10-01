import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { PersistentProvider } from './context/PersistentContext.tsx';
import { AppShell } from './components/shell/AppShell.tsx';
import { MarketPage } from './pages/MarketPage.tsx';
import { PortfolioPage } from './pages/PortfolioPage.tsx';
import { LeaderboardPage } from './pages/LeaderboardPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { Card } from './components/ui/Card.tsx';
import { Skeleton } from './components/ui/Skeleton.tsx';

// After-Hours Exchange: all player routes live under ONE layout route so
// AuthProvider / ToastProvider / PersistentProvider mount once and never
// remount on navigation. The internal operator monitor stays OUTSIDE the
// player providers (no player-API polling on the operator page) and every
// chart-heavy route is lazy so chart.js leaves the main chunk.

const CoinPage = lazy(() =>
  import('./pages/CoinPage.tsx').then((module) => ({ default: module.CoinPage }))
);
const WorldPage = lazy(() =>
  import('./pages/WorldPage.tsx').then((module) => ({ default: module.WorldPage }))
);
const ApocalypseMonitor = lazy(() =>
  import('./components/ApocalypseMonitor.tsx').then((module) => ({ default: module.ApocalypseMonitor }))
);

function RouteSkeleton() {
  return (
    <div className="game-shell py-6">
      <Card className="p-6" aria-label="Loading page">
        <Skeleton lines={5} className="h-6" />
      </Card>
    </div>
  );
}

function PlayerShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {/* The persistent context is the sole runtime provider for player
            routes. Legacy GameContext remains on disk for compatibility but
            is never mounted here. */}
        <PersistentProvider>
          {children}
        </PersistentProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

function App() {
  return (
    <Router basename="/coins">
      <Routes>
        {/* Internal operator tooling: unlinked from player navigation,
            mounted WITHOUT the player providers, lazy-loaded. */}
        <Route
          path="/internal/apocalypse-monitor"
          element={
            <Suspense fallback={<RouteSkeleton />}>
              <ApocalypseMonitor />
            </Suspense>
          }
        />
        <Route
          element={
            <PlayerShell>
              <AppShell />
            </PlayerShell>
          }
        >
          <Route index element={<MarketPage />} />
          <Route
            path="/coin/:coinId"
            element={
              <Suspense fallback={<RouteSkeleton />}>
                <CoinPage />
              </Suspense>
            }
          />
          <Route path="/portfolio" element={<PortfolioPage />} />
          {/* Old profile links keep working. */}
          <Route path="/profile" element={<Navigate to="/portfolio" replace />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route
            path="/world"
            element={
              <Suspense fallback={<RouteSkeleton />}>
                <WorldPage />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
