import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePersistent } from '../context/PersistentContext.tsx';
import { getPersistentTransactions } from '../services/persistentService.ts';
import type { PersistentTransaction } from '../services/persistentService.ts';
import { SessionExpiredError } from '../services/transactionService.ts';

// The player's own persistent trade ledger (bounded read, newest first).
// Refetches whenever lastSyncAt changes (a poll or a committed trade), so it
// rides the shared sync cadence without a second timer. A read failure keeps
// the last good feed — it never wipes or fabricates history.

interface UsePersistentTransactions {
  transactions: PersistentTransaction[] | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

export function usePersistentTransactions(limit: number): UsePersistentTransactions {
  const { user, getAuthToken, handleSessionExpired } = useAuth();
  const { provisioned, lastSyncAt } = usePersistent();

  const [transactions, setTransactions] = useState<PersistentTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(() => {
    if (!user || !provisioned) {
      setTransactions(null);
      setError(null);
      return;
    }
    if (inFlight.current) return;
    const token = getAuthToken();
    if (!token) return;
    inFlight.current = true;
    setLoading(true);
    getPersistentTransactions(token, { limit })
      .then((result) => {
        setTransactions(result.transactions);
        setError(null);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          handleSessionExpired();
          setTransactions(null);
          setError(null);
        } else {
          setError(err instanceof Error ? err.message : 'Transaction history unavailable');
        }
      })
      .finally(() => {
        inFlight.current = false;
        setLoading(false);
      });
  }, [user, provisioned, limit, getAuthToken, handleSessionExpired]);

  useEffect(() => {
    load();
    // lastSyncAt bumps on every successful account sync — the ledger follows
    // the same cadence without a second timer.
  }, [load, lastSyncAt]);

  return { transactions, error, loading, refresh: load };
}
