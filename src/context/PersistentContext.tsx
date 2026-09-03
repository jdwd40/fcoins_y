import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import {
  getPersistentAccount,
  buyPersistentTrade,
  sellPersistentTrade
} from '../services/persistentService.ts';
import type { PersistentAccount, PersistentTradeSide } from '../services/persistentService.ts';
import { GameApiError } from '../services/gameService.ts';
import { SessionExpiredError } from '../services/transactionService.ts';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

// Persistent-market Stage 6: THE persistent account context. This is the
// state home for the new gameplay economy — persistent cash, holdings at
// server-published live value, and server-owned wealth.
//
// Deliberate absences (the persistent contract):
//   * no Apocalypse/cycle identifier exists anywhere in this context — the
//     account is scoped to THE active world, resolved server-side;
//   * no countdown, settlement, Power, position cap or round state;
//   * no client-side price input: trades carry { coin_id, quantity } only,
//     and the post-trade account is adopted from the server's response.
//
// The old GameContext (cycle-shaped) is untouched and still feeds the
// retained compatibility surfaces (market signals, leaderboard, results)
// until their Stage 10/11/13 replacement.

export const PERSISTENT_POLL_INTERVAL_MS = 5000;

interface PersistentContextValue {
  /** The caller's persistent account. null = logged out OR not synced yet;
   *  never a fabricated balance. */
  account: PersistentAccount | null;
  /** True once the server answered at least once for the current identity. */
  synced: boolean;
  /** True when the account exists server-side (provisioned at registration
   *  or first trade). A synced-but-unprovisioned account is a real state:
   *  the first trade provisions it idempotently. */
  provisioned: boolean;
  /** Local timestamp of the last successful account sync (null = never). */
  lastSyncAt: number | null;
  /** Last account-sync failure message; the last good account is kept. */
  accountError: string | null;
  /** Execute a persistent trade at the server-locked live price. */
  trade: (side: PersistentTradeSide, coinId: number, quantity: number) => Promise<void>;
  /** Force an immediate resync (post-trade/error recovery/focus). */
  syncNow: () => Promise<void>;
}

const PersistentContext = createContext<PersistentContextValue | undefined>(undefined);

export function PersistentProvider({ children }: { children: React.ReactNode }) {
  const { user, getAuthToken, handleSessionExpired } = useAuth();
  const { showToast } = useToast();

  const [account, setAccount] = useState<PersistentAccount | null>(null);
  const [synced, setSynced] = useState(false);
  const [provisioned, setProvisioned] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const inFlight = useRef(false);

  const syncNow = useCallback(async () => {
    if (inFlight.current) return; // never stack polls
    const token = getAuthToken();
    if (!token) return; // logged out: the identity effect owns the reset
    inFlight.current = true;
    try {
      const result = await getPersistentAccount(token);
      setLastSyncAt(Date.now());
      setSynced(true);
      setAccountError(null);
      if (result.provisioned) {
        setProvisioned(true);
        setAccount({
          accountId: result.accountId,
          worldId: result.worldId,
          userId: result.userId,
          startingCash: result.startingCash,
          cash: result.cash,
          debt: result.debt,
          provisionedAt: result.provisionedAt,
          holdings: result.holdings,
          holdingsValue: result.holdingsValue,
          wealth: result.wealth,
          netWealth: result.netWealth
        });
      } else {
        // A real state: no account row yet. The UI shows the onboarding
        // state; the £10,000 is never fabricated client-side.
        setProvisioned(false);
        setAccount(null);
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        handleSessionExpired();
        showToast('Your session has expired. Please log in again.', 'error');
      } else {
        // A read failure NEVER fabricates or wipes the last good account.
        setSynced(true);
        setAccountError(
          err instanceof Error ? err.message : 'Persistent account unavailable'
        );
      }
    } finally {
      inFlight.current = false;
    }
  }, [getAuthToken, handleSessionExpired, showToast]);

  // Central poll while authenticated. One shared fetch feeds every consumer
  // (status strip, account panel, trade panels, profile).
  useEffect(() => {
    if (!user) return;
    void syncNow();
    const intervalId = setInterval(() => void syncNow(), PERSISTENT_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [user, syncNow]);

  // Identity changes never leak another user's account: a logout or account
  // switch drops all account state immediately; the next sync re-reads the
  // current identity only.
  useEffect(() => {
    setAccount(null);
    setSynced(false);
    setProvisioned(false);
    setLastSyncAt(null);
    setAccountError(null);
  }, [user?.id]);

  const trade = useCallback(
    async (side: PersistentTradeSide, coinId: number, quantity: number) => {
      const token = getAuthToken();
      if (!token) throw new SessionExpiredError();
      try {
        const result = side === 'BUY'
          ? await buyPersistentTrade(token, { coinId, quantity })
          : await sellPersistentTrade(token, { coinId, quantity });
        // Adopt the authoritative post-trade account from the response —
        // the server-locked price and committed balances, never a guess.
        setAccount(result.account);
        setProvisioned(true);
        setSynced(true);
        setAccountError(null);
        await syncNow();
      } catch (err) {
        // A domain rejection happened BEFORE any mutation server-side;
        // reconcile local state immediately rather than leaving a stale
        // balance behind.
        if (err instanceof GameApiError) await syncNow();
        throw err;
      }
    },
    [getAuthToken, syncNow]
  );

  const value: PersistentContextValue = {
    account,
    synced,
    provisioned,
    lastSyncAt,
    accountError,
    trade,
    syncNow
  };

  return <PersistentContext.Provider value={value}>{children}</PersistentContext.Provider>;
}

export function usePersistent() {
  const context = useContext(PersistentContext);
  if (context === undefined) {
    throw new Error('usePersistent must be used within a PersistentProvider');
  }
  return context;
}
