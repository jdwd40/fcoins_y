import { useCallback, useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import { coinPriceHistory } from '../services/priceHistoryService.ts';
import type { CoinHistorySnapshot } from '../services/priceHistoryService.ts';
import { sparklineRangeForCoin } from '../utils/sparkline.ts';
import type { SparklineRange } from '../utils/sparkline.ts';
import type { PersistentCoinSignal } from '../services/persistentService.ts';

export interface CoinSparklineState extends CoinHistorySnapshot {
  range: SparklineRange;
}

// React binding for the shared price-history store (issue #12). One
// subscription per card to the central dedupe/cache — the card never fetches
// or polls by itself, and any coin/range change resubscribes cleanly (the
// store aborts and drops the old entry).
export function useCoinSparkline(
  coin: Pick<PersistentCoinSignal, 'coinId' | 'archetype'>
): CoinSparklineState {
  const range = sparklineRangeForCoin(coin);
  const subscribe = useCallback(
    (onStoreChange: () => void) => coinPriceHistory.subscribe(coin.coinId, range, onStoreChange),
    [coin.coinId, range]
  );
  const getSnapshot = useCallback(
    () => coinPriceHistory.getSnapshot(coin.coinId, range),
    [coin.coinId, range]
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return useMemo(() => ({ range, ...snapshot }), [range, snapshot]);
}
