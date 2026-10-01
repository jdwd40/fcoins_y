import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, Coins, HelpCircle, LogOut, Moon, Sun, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePersistent } from '../../context/PersistentContext.tsx';
import { formatCurrency } from '../../services/transactionService.ts';
import { useShellServices } from './shellServices.ts';
import { Button } from '../ui/Button.tsx';

// Top bar: brand, primary nav (>=768px) and the account area.

const NAV_ITEMS = [
  { to: '/', label: 'Market', end: true },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/world', label: 'World' }
] as const;

interface TopBarProps {
  isDark: boolean;
  onThemeToggle: () => void;
}

export function TopBar({ isDark, onThemeToggle }: TopBarProps) {
  const { user } = useAuth();
  const { account } = usePersistent();
  const { openAuth } = useShellServices();

  return (
    <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-md border-b border-rule">
      <div className="game-shell flex items-center justify-between gap-3 min-h-[56px] py-1.5">
        <Link to="/" className="flex items-center gap-2.5 shrink-0 min-h-[44px]" aria-label="Crypto Chaos home">
          <span className="w-8 h-8 rounded-lg bg-brand text-[var(--on-brand)] grid place-items-center" aria-hidden="true">
            <Coins className="w-4 h-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-ink">Crypto Chaos</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-semibold transition-colors min-h-[44px] inline-flex items-center ${
                  isActive ? 'text-brand bg-accent-soft' : 'text-ink-dim hover:text-ink'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              {account && (
                <Link
                  to="/portfolio"
                  className="hidden sm:flex flex-col items-end px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors"
                  aria-label={`Cash ${formatCurrency(account.cash)}, net worth ${formatCurrency(account.netWealth)} — open portfolio`}
                >
                  <span className="font-mono text-sm font-bold text-ink tnum leading-tight">{formatCurrency(account.cash)}</span>
                  <span className="font-mono text-xs text-ink-mute tnum leading-tight">
                    net {formatCurrency(account.netWealth)}
                  </span>
                </Link>
              )}
              <AccountMenu isDark={isDark} onThemeToggle={onThemeToggle} />
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => openAuth('signin')}>Sign in</Button>
              <Button variant="primary" onClick={() => openAuth('register')} className="hidden sm:inline-flex">Create account</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function AccountMenu({ isDark, onThemeToggle }: TopBarProps) {
  const { user, logout } = useAuth();
  const { account } = usePersistent();
  const { openHowToPlay } = useShellServices();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Phones (<640px) show compact cash in the button instead of the username;
  // the username stays in the aria-label and at the top of the open menu.
  const compactCash = account
    ? `${account.cash < 0 ? '−' : ''}£${Math.abs(Math.round(account.cash)).toLocaleString('en-GB')}`
    : null;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${user?.username || 'player'}`}
        className="flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-rule bg-surface-2 text-ink hover:border-rule-strong transition-colors"
      >
        <UserIcon className="w-4 h-4" aria-hidden="true" />
        {compactCash !== null && (
          <span className="sm:hidden font-mono text-sm font-semibold tnum max-w-[6rem] truncate">{compactCash}</span>
        )}
        <span className={`text-sm font-semibold max-w-[7rem] truncate ${compactCash !== null ? 'hidden sm:inline' : ''}`}>
          {user?.username || 'Account'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-ink-mute" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-rule bg-surface-3 shadow-overlay p-1.5 z-50"
        >
          <div className="px-3 py-2 mb-1 border-b border-rule text-xs text-ink-mute">
            Signed in as <span className="font-semibold text-ink">{user?.username || 'player'}</span>
            {account && (
              <span className="block font-mono tnum mt-0.5">Cash {formatCurrency(account.cash)}</span>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-ink hover:bg-surface-2 transition-colors text-left"
            onClick={() => { setOpen(false); navigate('/portfolio'); }}
          >
            <UserIcon className="w-4 h-4 text-ink-mute" aria-hidden="true" /> Portfolio
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-ink hover:bg-surface-2 transition-colors text-left"
            onClick={() => { setOpen(false); openHowToPlay(); }}
          >
            <HelpCircle className="w-4 h-4 text-ink-mute" aria-hidden="true" /> How to play
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-ink hover:bg-surface-2 transition-colors text-left"
            onClick={() => { setOpen(false); onThemeToggle(); }}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDark
              ? <Sun className="w-4 h-4 text-ink-mute" aria-hidden="true" />
              : <Moon className="w-4 h-4 text-ink-mute" aria-hidden="true" />}
            {isDark ? 'Light theme' : 'Dark theme'}
          </button>
          <div className="my-1 border-t border-rule" />
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-down hover:bg-down/10 transition-colors text-left"
            onClick={() => { setOpen(false); logout(); }}
          >
            <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
