import { NavLink } from 'react-router-dom';
import { Globe, LineChart, Trophy, Wallet } from 'lucide-react';

// Bottom tab bar on phones (<768px). 56px tall + safe-area inset; content
// gets matching bottom padding in AppShell so nothing hides behind it.

const TABS = [
  { to: '/', label: 'Market', icon: LineChart, end: true },
  { to: '/portfolio', label: 'Portfolio', icon: Wallet, end: false },
  { to: '/leaderboard', label: 'Ranks', icon: Trophy, end: false },
  { to: '/world', label: 'World', icon: Globe, end: false }
] as const;

export function BottomTabBar() {
  return (
    <nav
      className="tabbar md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t border-rule"
      aria-label="Primary"
    >
      <div className="grid grid-cols-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className="tabbar-tab">
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
