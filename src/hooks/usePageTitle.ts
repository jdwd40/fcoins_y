import { useEffect, useState } from 'react';

/** Set document.title while the page is mounted. */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = 'Crypto Chaos · Fantasy Coin Market';
    };
  }, [title]);
}

/** Theme state shared by the shell: dark default, 'theme' in localStorage. */
export function useTheme(): { isDark: boolean; toggleTheme: () => void } {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      try {
        localStorage.setItem('theme', next ? 'dark' : 'light');
      } catch {
        // storage unavailable — theme still flips for this session
      }
      return next;
    });
  };

  return { isDark, toggleTheme };
}
