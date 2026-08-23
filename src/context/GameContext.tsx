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
  GameApiError,
  getGameState,
  getLiveLeaderboard,
  joinGame,
  buyGameTrade,
  sellGameTrade
} from '../services/gameService.ts';
import type {
  GameState,
  LeaderboardEntry,
  LiveLeaderboard,
  RoundParticipant
} from '../services/gameService.ts';
import { SessionExpiredError } from '../services/transactionService.ts';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import {
  anchorFromState,
  connectionState,
  detectCompletedCycle,
  findMyEntry,
  lifecycleFromState,
  participantBelongsToCycle,
  readCachedParticipant,
  writeCachedParticipant
} from '../utils/gameLogic.ts';
import type { ConnectionState, CountdownAnchor, LifecyclePhase } from '../utils/gameLogic.ts';

// Central polling cadence for game state + leaderboard. One shared fetch
// feeds every consumer (header, dashboard, leaderboard, trade forms).
export const GAME_POLL_INTERVAL_MS = 5000;

export type TradeSide = 'BUY' | 'SELL';

interface GameContextValue {
  gameState: GameState | null;
  /** Server-anchored countdown basis; display derives from this. */
  anchor: CountdownAnchor | null;
  /** Local timestamp of the last successful state sync (null = never). */
  lastSyncAt: number | null;
  connection: ConnectionState;
  lifecycle: LifecyclePhase;
  /** Last state-sync failure message, for diagnostics/copy. */
  stateError: string | null;
  leaderboard: LiveLeaderboard | null;
  /** True when the leaderboard answered with the deliberate Core 6
   *  settlement-in-progress 409 — a lifecycle state, not an error page. */
  settling: boolean;
  /** Public id of the apocalypse that just completed (transition trigger). */
  completedCycleId: string | null;
  /** Bumped on every detected cycle transition so listeners can react. */
  resultsVersion: number;
  /** Cached authoritative participant for the LIVE cycle (ensure/trade
   *  responses). Participation is server-owned (backend #17), so an
   *  authenticated player always has one — null here means "still syncing",
   *  never "needs to join". */
  myParticipant: RoundParticipant | null;
  /** The player's live leaderboard row for the current cycle, if synced. */
  myEntry: LeaderboardEntry | null;
  joined: boolean;
  trade: (side: TradeSide, coinId: number, amount: number) => Promise<void>;
  /** Force an immediate resync (focus/visibility/post-trade/error recovery). */
  syncNow: () => Promise<void>;
  acknowledgeCompleted: () => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

// Milestone 1: participant cache reads/writes are keyed by BOTH the
// authenticated user identity and the apocalypse id (helpers in gameLogic).
// A logout or account switch can therefore never surface another user's
// round state, and the payload identity is re-validated on every read.

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { user, getAuthToken, handleSessionExpired } = useAuth();
  const { showToast } = useToast();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [anchor, setAnchor] = useState<CountdownAnchor | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LiveLeaderboard | null>(null);
  const [settling, setSettling] = useState(false);
  const [completedCycleId, setCompletedCycleId] = useState<string | null>(null);
  const [resultsVersion, setResultsVersion] = useState(0);
  const [myParticipant, setMyParticipant] = useState<RoundParticipant | null>(null);
  // Tick that only drives DERIVED display state (staleness); never a clock.
  const [nowTick, setNowTick] = useState(() => Date.now());

  const inFlight = useRef(false);
  const previousCycleRef = useRef<string | null>(null);
  // One participation-ensure attempt per (user, cycle); a separate latch for
  // the error toast so retries stay quiet.
  const ensureAttemptRef = useRef<string | null>(null);
  const ensureToastRef = useRef<string | null>(null);

  const syncNow = useCallback(async () => {
    if (inFlight.current) return; // never stack polls
    inFlight.current = true;
    try {
      const [stateResult, boardResult] = await Promise.allSettled([
        getGameState(),
        getLiveLeaderboard()
      ]);

      if (stateResult.status === 'fulfilled') {
        const receivedAt = Date.now();
        setGameState(stateResult.value);
        setAnchor(anchorFromState(stateResult.value, receivedAt));
        setLastSyncAt(receivedAt);
        setStateError(null);
      } else {
        setStateError(
          stateResult.reason instanceof Error ? stateResult.reason.message : 'Game state unavailable'
        );
      }

      if (boardResult.status === 'fulfilled') {
        setLeaderboard(boardResult.value);
        setSettling(false);
      } else if (boardResult.reason instanceof GameApiError && boardResult.reason.status === 409) {
        // Deliberate Core 6 lifecycle signal: the round is settling.
        setSettling(true);
      }
      // Other leaderboard failures: keep the last good board, the state
      // error/staleness machinery reports the connection problem.
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Central poll: one interval for the whole game surface.
  useEffect(() => {
    void syncNow();
    const intervalId = setInterval(() => void syncNow(), GAME_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [syncNow]);

  // Resync on focus/visibility return (sleep, backgrounding, tab switch).
  useEffect(() => {
    const resync = () => void syncNow();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') resync();
    };
    window.addEventListener('focus', resync);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', resync);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [syncNow]);

  // Display tick for derived countdown/staleness (1s). This never counts the
  // round itself — it only re-derives from the server-anchored basis.
  useEffect(() => {
    const tickId = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(tickId);
  }, []);

  // Cycle transition detection: a new apocalypseId means the previous round
  // completed — fetch its results once and reset round-specific UI state.
  useEffect(() => {
    const currentId = gameState?.apocalypseId ?? null;
    const completed = detectCompletedCycle(previousCycleRef.current, currentId);
    if (completed) {
      setCompletedCycleId(completed);
      setResultsVersion((v) => v + 1);
      setMyParticipant(null); // round state never carries across apocalypses
    }
    previousCycleRef.current = currentId;
  }, [gameState?.apocalypseId]);

  // Milestone 1: account changes never leave unsafe in-memory state. A
  // logout or identity switch drops the cached-participant mirror
  // immediately; the restore effect below only ever re-reads the CURRENT
  // user's key. (Round state for a previous cycle is already dropped by the
  // transition effect above.)
  useEffect(() => {
    setMyParticipant(null);
    ensureAttemptRef.current = null; // a new identity re-ensures from scratch
    ensureToastRef.current = null;
  }, [user?.id]);

  // Restore the cached participant when the live cycle becomes known —
  // strictly the current user's entry for the current apocalypse.
  useEffect(() => {
    const currentId = gameState?.apocalypseId ?? null;
    if (!currentId) return;
    const userId = user?.id ?? null;
    setMyParticipant((existing) =>
      participantBelongsToCycle(existing, currentId) && existing?.userId === userId
        ? existing
        : readCachedParticipant(localStorage, userId, currentId)
    );
  }, [gameState?.apocalypseId, user?.id]);

  const connection = connectionState(lastSyncAt, nowTick);
  const lifecycle = lifecycleFromState(gameState?.status ?? null, settling, gameState === null);
  const myEntry = useMemo(
    () => findMyEntry(leaderboard?.entries, user?.id),
    [leaderboard, user?.id]
  );
  const joined = myEntry !== null || participantBelongsToCycle(myParticipant, gameState?.apocalypseId ?? null);

  // Issue #10: participation is automatic and server-owned. When an
  // authenticated player has no authoritative participant for the LIVE cycle
  // yet (fresh login, page reload, successor rollover), ensure it once via
  // the idempotent POST /game/join ensure+read endpoint — no JOIN button, no
  // client-side cash fabrication. Failures retry on the next successful poll
  // (the endpoint is idempotent); the error toast fires once per (user,
  // cycle) so a settling window or offline stretch never spams.
  useEffect(() => {
    const currentId = gameState?.apocalypseId ?? null;
    const userId = user?.id ?? null;
    if (!currentId || userId === null) return;
    if (participantBelongsToCycle(myParticipant, currentId)) return; // synced
    const key = `${userId}:${currentId}`;
    if (ensureAttemptRef.current === key) return; // one in-flight attempt
    const token = getAuthToken();
    if (!token) return;
    ensureAttemptRef.current = key;
    let cancelled = false;
    joinGame(token)
      .then((participant) => {
        if (cancelled) return;
        writeCachedParticipant(localStorage, participant);
        setMyParticipant(participant);
        void syncNow();
      })
      .catch((err) => {
        if (cancelled) return;
        ensureAttemptRef.current = null; // allow the next poll to retry
        if (err instanceof SessionExpiredError) {
          handleSessionExpired();
          showToast('Your session has expired. Please log in again.', 'error');
          ensureAttemptRef.current = key; // never retry a dead session
          return;
        }
        if (ensureToastRef.current !== key) {
          ensureToastRef.current = key;
          showToast(
            err instanceof Error ? err.message : 'Could not sync your position for this apocalypse',
            'error'
          );
        }
      });
    return () => { cancelled = true; };
  }, [gameState?.apocalypseId, user?.id, myParticipant, lastSyncAt, getAuthToken, syncNow, showToast, handleSessionExpired]);

  const trade = useCallback(
    async (side: TradeSide, coinId: number, amount: number) => {
      const token = getAuthToken();
      if (!token) throw new SessionExpiredError();
      const cycleId = gameState?.apocalypseId;
      if (!cycleId) throw new Error('Game state is not loaded yet — try again in a moment');

      const request = { cycleId, coinId, amount };
      try {
        const result = side === 'BUY'
          ? await buyGameTrade(token, request)
          : await sellGameTrade(token, request);

        writeCachedParticipant(localStorage, result.participant);
        setMyParticipant(result.participant);
        await syncNow();
      } catch (err) {
        // Stale cycle / freeze race / mid-flight collapse: the server
        // rejected BEFORE any mutation, so reconcile local state immediately
        // rather than leaving optimistic UI behind.
        if (err instanceof GameApiError) await syncNow();
        throw err;
      }
    },
    [getAuthToken, gameState?.apocalypseId, syncNow]
  );

  const acknowledgeCompleted = useCallback(() => setCompletedCycleId(null), []);

  const value: GameContextValue = {
    gameState,
    anchor,
    lastSyncAt,
    connection,
    lifecycle,
    stateError,
    leaderboard,
    settling,
    completedCycleId,
    resultsVersion,
    myParticipant,
    myEntry,
    joined,
    trade,
    syncNow,
    acknowledgeCompleted
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
