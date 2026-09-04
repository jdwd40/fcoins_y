import { Skull } from 'lucide-react';
import { UserMenu } from './UserMenu';

// V2-5 / Stage 11 slim top bar: brand + account access only. The dense
// desktop exchange navigation no longer sits above the gameplay — the
// persistent market header and the player strip lead the screen instead.
export function GameTopBar({
  onAuthClick,
  isDark,
  onThemeToggle,
}: {
  onAuthClick: () => void;
  isDark: boolean;
  onThemeToggle: () => void;
}) {
  return (
    <header className="exchange-nav sticky top-0 z-30">
      <div className="game-shell h-14 flex items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2.5 shrink-0" aria-label="Crypto Chaos home">
          <span className="w-8 h-8 rounded-lg bg-gold text-white grid place-items-center font-extrabold text-sm shadow-gold-glow">
            <Skull className="w-4 h-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-ink">Crypto Chaos</span>
          <span className="hidden sm:inline chip">Virtual GBP</span>
        </a>
        <UserMenu onAuthClick={onAuthClick} isDark={isDark} onThemeToggle={onThemeToggle} />
      </div>
    </header>
  );
}
