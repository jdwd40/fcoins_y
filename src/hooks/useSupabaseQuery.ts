// useSupabaseQuery — typed polling query with cancellation and last-good-data
// retention (plan §11.3). Replaces the fetch/localStorage-based useFetch.
import { useState, useEffect, useRef, useCallback } from 'react';

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useSupabaseQuery<T>(
  fetcher: (() => Promise<T>) | null,
  pollInterval = 0, // 0 = fetch once
) {
  const [state, setState] = useState<QueryState<T>>({ data: null, loading: true, error: null });
  const generationRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    const fn = fetcherRef.current;
    if (!fn) return;
    const generation = ++generationRef.current;
    try {
      const data = await fn();
      if (generation !== generationRef.current) return; // stale
      setState({ data, loading: false, error: null });
    } catch (err) {
      if (generation !== generationRef.current) return;
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setState((prev) => ({ data: prev.data, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    if (!fetcher) return;
    setState((prev) => ({ ...prev, loading: prev.data === null }));
    void run();
    if (pollInterval > 0) {
      const id = setInterval(() => void run(), Math.max(1000, pollInterval));
      return () => clearInterval(id);
    }
  }, [run, pollInterval, fetcher === null]);

  return { ...state, refetch: run };
}
