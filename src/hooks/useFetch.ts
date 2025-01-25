import { useState, useEffect, useRef } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useFetch<T>(url: string, pollInterval = 5000) { // Poll every 5 seconds by default
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!url) return;

    const fetchData = async () => {
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
          const errorText = await response.text();
          throw new Error(errorText || 'Network response was not ok');
        }
        const json = await response.json();
        setState(prev => {
          // Only update if data has changed
          if (JSON.stringify(prev.data) !== JSON.stringify(json)) {
            return { data: json, loading: false, error: null };
          }
          return prev;
        });
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

    // Set up polling
    const intervalId = setInterval(fetchData, pollInterval);

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