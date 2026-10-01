import { coinHue, coinAvatarStyle, coinAvatarStyleLight } from '../../utils/coinIdentity.ts';

// Deterministic per-coin avatar: symbol monogram on a hue-tinted rounded
// square. The hue is derived from the coin identity (pure, unit-tested), so
// a coin looks the same everywhere it appears.

interface CoinAvatarProps {
  symbol: string;
  coinId?: number;
  size?: 'sm' | 'md' | 'lg';
  dead?: boolean;
}

const SIZE_CLASS = {
  sm: 'w-8 h-8 text-xs rounded-lg',
  md: 'w-10 h-10 text-sm rounded-xl',
  lg: 'w-14 h-14 text-lg rounded-2xl'
} as const;

export function CoinAvatar({ symbol, coinId, size = 'md', dead = false }: CoinAvatarProps) {
  const hue = coinHue({ symbol, coinId });
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const style = dark ? coinAvatarStyle(hue) : coinAvatarStyleLight(hue);
  const letters = symbol.slice(0, 3);
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center flex-none border font-mono font-bold tracking-tight ${SIZE_CLASS[size]} ${dead ? 'opacity-50 saturate-0' : ''}`}
      style={dead ? { background: 'var(--surface-3)', color: 'var(--text-3)', borderColor: 'var(--border)' } : style}
    >
      {letters}
    </span>
  );
}
