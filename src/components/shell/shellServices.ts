import { createContext, useContext } from 'react';

// Shell-level services provided by AppShell: one auth dialog, one trade
// sheet, one How-to-play dialog — opened from anywhere in the player tree.

export type AuthTab = 'signin' | 'register';

export interface ShellServices {
  openAuth: (tab?: AuthTab) => void;
  openTrade: (coinId: number, side?: 'BUY' | 'SELL') => void;
  openHowToPlay: () => void;
}

const ShellServicesContext = createContext<ShellServices | undefined>(undefined);

export const ShellServicesProvider = ShellServicesContext.Provider;

export function useShellServices(): ShellServices {
  const context = useContext(ShellServicesContext);
  if (context === undefined) {
    throw new Error('useShellServices must be used within AppShell');
  }
  return context;
}
