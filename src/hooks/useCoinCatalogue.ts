import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../services/apiConfig.ts';
import type { Coin } from '../types';

// One-shot read of the legacy catalogue entry (/coins/:id) for extra coin
// stats (founder, market cap, circulating supply, 24h change). Not part of
// the shared poll: fetched once per coin mount, aborted on unmount, and the
// UI hides gracefully if it fails.

interface CoinCatalogueState {
  coin: Coin | null;
  error: boolean;
}

export function useCoinCatalogue(coinId: number | null): CoinCatalogueState {
  const [state, setState] = useState<CoinCatalogueState>({ coin: null, error: false });

  useEffect(() => {
    if (coinId === null) return undefined;
    const controller = new AbortController();
    setState({ coin: null, error: false });
    fetch(`${API_BASE_URL}/coins/${coinId}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload: { coin?: Coin }) => {
        if (payload && payload.coin) {
          setState({ coin: payload.coin, error: false });
        } else {
          setState({ coin: null, error: true });
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setState({ coin: null, error: true });
      });
    return () => controller.abort();
  }, [coinId]);

  return state;
}
