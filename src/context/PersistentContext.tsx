import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  getPersistentAccount,
  getPersistentLeaderboard,
  getPersistentSignals,
  buyPersistentTrade,
  sellPersistentTrade
} from '../services/persistentService.ts';
import type {
  PersistentAccount,
  PersistentLeaderboard,
  PersistentLeaderboardEntry,
  PersistentMarketSignals,
  PersistentTradeSide
} from '../services/persistentService.ts';
import { GameApiError } from '../services/gameService.ts';
import { SessionExpiredError } from '../services/transactionService.ts';
import { findMyEntry } from '../utils/gameLogic.ts';
import { createPersistentSyncGate } from '../utils/persistentSyncGate.ts';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

// Persistent-market Stage 6/10B: THE persistent account + leaderboard context.
// This is the state home for the new gameplay economy — persistent cash,
// holdings at server-published live value, server-owned wealth, and the
// public persistent leaderboard (Stage 10B).
//
// Deliberate absences (the persistent contract):
//   * no Apocalypse/cycle identifier exists anywhere in this context — the
//     account/board are scoped to THE active world, resolved server-side;
//   * no countdown, settlement, Power, position cap or round state;
//   * no client-side price input: trades carry { coin_id, quantity } only,
//     and the post-trade account is adopted from the server's response;
//   * no client-side re-sort of the leaderboard — backend rank is authoritative.
//
// One shared 5s poll feeds account (when authenticated) AND the public
// leaderboard. Do not add a second timer for the board.
//
// Account responses (sync + post-trade) are gated by persistentSyncGate: a
// request/trade started for identity A that resolves after logout or an A→B
// switch never mutates B's account (or restores state after logout). The
// server trade is never cancelled — only the client apply is skipped.
// Leaderboard applies stay ungated.

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
  /** Public persistent leaderboard (backend order/rank authoritative). */
  leaderboard: PersistentLeaderboard | null;
  /** Last leaderboard-sync failure; the last good board is kept. */
  leaderboardError: string | null;
  /** Public persistent market signals (identity-independent, like leaderboard). */
  signals: PersistentMarketSignals | null;
  /** Last signals-sync failure; the last good signals are kept on transient error. */
  signalsError: string | null;
  /** The signed-in human's row matched by authenticated userId, if present. */
  myEntry: PersistentLeaderboardEntry | null;
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
  const [leaderboard, setLeaderboard] = useState<PersistentLeaderboard | null>(null);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [signals, setSignals] = useState<PersistentMarketSignals | null>(null);
  const [signalsError, setSignalsError] = useState<string | null>(null);

  const gateRef = useRef(createPersistentSyncGate());
  const userIdRef = useRef<string | undefined>(user?.id);
  userIdRef.current = user?.id;

  const syncNow = useCallback(async () => {
    const gate = gateRef.current;
    if (!gate.beginSync()) return; // in-flight: exactly one follow-up queued

    const startedGen = gate.generation;
    const startedUserId = userIdRef.current;
    try {
      const token = getAuthToken();
      // One shared poll: public leaderboard + signals always (identity-independent),
      // account only when authed. Do not add a second timer.
      const [boardResult, signalsResult, accountResult] = await Promise.allSettled([
        getPersistentLeaderboard(),
        getPersistentSignals(),
        token ? getPersistentAccount(token) : Promise.resolve(null)
      ]);

      // Leaderboard and signals are public and identity-independent — always apply.
      // Transient error preserves last-good data (never wipe on failure).
      if (boardResult.status === 'fulfilled') {
        setLeaderboard(boardResult.value);
        setLeaderboardError(null);
      } else {
        setLeaderboardError(
          boardResult.reason instanceof Error
            ? boardResult.reason.message
            : 'Persistent leaderboard unavailable'
        );
      }

      if (signalsResult.status === 'fulfilled') {
        setSignals(signalsResult.value);
        setSignalsError(null);
      } else {
        setSignalsError(
          signalsResult.reason instanceof Error
            ? signalsResult.reason.message
            : 'Persistent signals unavailable'
        );
      }

      if (!token) {
        // Logged out: account state is owned by the identity-reset effect.
        return;
      }

      // Stale A (after logout / A→B) must never touch account state or errors.
      if (!gate.shouldApplyAccount(startedGen, startedUserId, userIdRef.current)) {
        return;
      }

      if (accountResult.status === 'fulfilled' && accountResult.value !== null) {
        const result = accountResult.value;
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
      } else if (accountResult.status === 'rejected') {
        const err = accountResult.reason;
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
      }
    } finally {
      if (gate.endSync()) {
        // Identity changed (or syncNow) while we were in flight — run once now.
        void syncNow();
      }
    }
  }, [getAuthToken, handleSessionExpired, showToast]);

  const syncNowRef = useRef(syncNow);
  syncNowRef.current = syncNow;

  // Central poll for the public board (always) and the authenticated account.
  // One shared fetch feeds every consumer — do not add a second timer.
  useEffect(() => {
    void syncNow();
    const intervalId = setInterval(() => void syncNow(), PERSISTENT_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [syncNow]);

  // Identity changes never leak another user's account: a logout or account
  // switch bumps the sync generation, drops all account state immediately, and
  // triggers an immediate resync for the new identity (or logged-out board-only
  // poll). The public leaderboard is shared and kept.
  useEffect(() => {
    gateRef.current.bumpGeneration();
    setAccount(null);
    setSynced(false);
    setProvisioned(false);
    setLastSyncAt(null);
    setAccountError(null);
    void syncNowRef.current();
  }, [user?.id]);

  const trade = useCallback(
    async (side: PersistentTradeSide, coinId: number, quantity: number) => {
      const token = getAuthToken();
      if (!token) throw new SessionExpiredError();
      // Capture identity at trade start (same gate as sync) so a late BUY/SELL
      // response for A cannot overwrite cleared/B account after logout/switch.
      const gate = gateRef.current;
      const startedGen = gate.generation;
      const startedUserId = userIdRef.current;
      try {
        const result = side === 'BUY'
          ? await buyPersistentTrade(token, { coinId, quantity })
          : await sellPersistentTrade(token, { coinId, quantity });
        // Adopt the authoritative post-trade account only if this identity is
        // still current — never cancel/reverse the server trade; just skip apply.
        if (gate.shouldApplyAccount(startedGen, startedUserId, userIdRef.current)) {
          setAccount(result.account);
          setProvisioned(true);
          setSynced(true);
          setAccountError(null);
        }
        // Always resync so the current identity gets board (+ account if authed).
        await syncNow();
      } catch (err) {
        // A domain rejection happened BEFORE any mutation server-side;
        // reconcile local state immediately rather than leaving a stale
        // balance behind. syncNow is already identity-gated.
        if (err instanceof GameApiError) await syncNow();
        throw err;
      }
    },
    [getAuthToken, syncNow]
  );

  // Rank comes from the persistent board matched by authenticated userId —
  // never a local sort of wealth figures.
  const myEntry = useMemo(
    () => findMyEntry(leaderboard?.entries, user?.id),
    [leaderboard, user?.id]
  );

  const value: PersistentContextValue = {
    account,
    synced,
    provisioned,
    lastSyncAt,
    accountError,
    leaderboard,
    leaderboardError,
    signals,
    signalsError,
    myEntry,
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
