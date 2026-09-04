// Persistent-market Stage 10B: tiny sync gate so an in-flight account request
// for identity A can never mutate B's account (or restore state after logout).
// Generation bumps on every identity change; beginSync/endSync coalesce a
// blocked sync into exactly one follow-up so B resyncs immediately instead of
// waiting for the next 5s poll. Leaderboard applies stay ungated — the board
// is public and identity-independent.

export interface PersistentSyncGate {
  readonly generation: number;
  /** Bump when user?.id changes (login / switch / logout). */
  bumpGeneration(): number;
  /**
   * Claim the single in-flight slot. If a sync is already running, mark that
   * exactly one follow-up is needed and return false.
   */
  beginSync(): boolean;
  /**
   * Release the in-flight slot. Returns true when a follow-up sync was
   * requested while this one was running (caller should void syncNow()).
   */
  endSync(): boolean;
  /**
   * Account success/error may apply only when the request's generation and
   * intended userId still match the live identity. Generation move OR identity
   * mismatch → false (stale A never touches B / logout).
   */
  shouldApplyAccount(
    startedGen: number,
    startedUserId: string | null | undefined,
    currentUserId: string | null | undefined
  ): boolean;
}

export function createPersistentSyncGate(): PersistentSyncGate {
  let generation = 0;
  let inFlight = false;
  let rerunRequested = false;

  return {
    get generation() {
      return generation;
    },
    bumpGeneration() {
      generation += 1;
      return generation;
    },
    beginSync() {
      if (inFlight) {
        rerunRequested = true;
        return false;
      }
      inFlight = true;
      rerunRequested = false;
      return true;
    },
    endSync() {
      inFlight = false;
      const shouldRerun = rerunRequested;
      rerunRequested = false;
      return shouldRerun;
    },
    shouldApplyAccount(startedGen, startedUserId, currentUserId) {
      if (startedGen !== generation) return false;
      return (startedUserId ?? null) === (currentUserId ?? null);
    }
  };
}
