import { useState, useEffect, useRef } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useFetch<T>(url: string, pollInterval = 5000) {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!url) return;

    const fetchData = async () => {
      // Throttle requests to prevent too frequent updates
      const now = Date.now();
      if (now - lastFetchTimeRef.current < 500) { // Minimum 500ms between requests
        return;
      }
      lastFetchTimeRef.current = now;

      try {
        // Cancel any ongoing requests
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        const token = localStorage.getItem('token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          signal: abortControllerRef.current.signal,
          headers
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const json = await response.json();
        setState({ data: json, loading: false, error: null });
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') return;

        const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
        setState(prev => ({
          data: prev.data, // Keep existing data on error
          loading: false,
          error: errorMessage,
        }));
      }
    };

    // Initial fetch
    fetchData();

    // Set up polling with a minimum interval
    const intervalId = setInterval(fetchData, Math.max(1000, pollInterval));

    // Cleanup function
    return () => {
      clearInterval(intervalId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [url, pollInterval]);

  return state;
}