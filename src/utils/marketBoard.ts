// After-Hours Exchange: market board filtering, sorting and top movers.
//
// All pure. Client-side filter/sort of the PUBLIC signals list is a
// presentation concern (it is not a rank — the leaderboard rank contract is
// separate and stays server-authoritative).

import type { PersistentCoinSignal } from '../services/persistentService.ts';

export type BoardFilter = 'all' | 'owned' | 'rising' | 'falling' | 'events';
export type BoardSort = 'featured' | 'movers' | 'price-desc';

export const BOARD_FILTERS: readonly { id: BoardFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'owned', label: 'Owned' },
  { id: 'rising', label: 'Rising' },
  { id: 'falling', label: 'Falling' },
  { id: 'events', label: 'With events' }
];

export const BOARD_SORTS: readonly { id: BoardSort; label: string }[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'movers', label: 'Biggest movers' },
  { id: 'price-desc', label: 'Price high → low' }
];

/** Apply a board filter. Dead coins are never filtered INTO the board — the
 *  Graveyard section renders them separately. */
export function filterBoardCoins(
  coins: PersistentCoinSignal[],
  filter: BoardFilter,
  isOwned: (coinId: number) => boolean,
  hasEvents: (coinId: number) => boolean
): PersistentCoinSignal[] {
  const alive = coins.filter((coin) => !coin.dead);
  switch (filter) {
    case 'owned':
      return alive.filter((coin) => isOwned(coin.coinId));
    case 'rising':
      return alive.filter((coin) => (coin.recentChangePct ?? 0) > 0);
    case 'falling':
      return alive.filter((coin) => (coin.recentChangePct ?? 0) < 0);
    case 'events':
      return alive.filter((coin) => hasEvents(coin.coinId));
    case 'all':
    default:
      return alive;
  }
}

/** Sort a filtered board. 'featured' puts owned coins first, then keeps the
 *  backend catalogue order (stable coinId order). */
export function sortBoardCoins(
  coins: PersistentCoinSignal[],
  sort: BoardSort,
  isOwned: (coinId: number) => boolean
): PersistentCoinSignal[] {
  const copy = [...coins];
  switch (sort) {
    case 'movers':
      copy.sort(
        (a, b) => Math.abs(b.recentChangePct ?? 0) - Math.abs(a.recentChangePct ?? 0) || a.coinId - b.coinId
      );
      return copy;
    case 'price-desc':
      copy.sort((a, b) => b.currentPrice - a.currentPrice || a.coinId - b.coinId);
      return copy;
    case 'featured':
    default:
      copy.sort((a, b) => {
        const aOwned = isOwned(a.coinId) ? 0 : 1;
        const bOwned = isOwned(b.coinId) ? 0 : 1;
        return aOwned - bOwned || a.coinId - b.coinId;
      });
      return copy;
  }
}

export interface TopMovers {
  rising: PersistentCoinSignal[];
  falling: PersistentCoinSignal[];
}

/** Biggest |1m change| movers among ALIVE coins, split by direction. Client
 *  sort of public signals — explicitly not a rank. */
export function topMovers(coins: PersistentCoinSignal[], count = 3): TopMovers {
  const alive = coins.filter((coin) => !coin.dead && coin.recentChangePct !== null);
  const rising = alive
    .filter((coin) => (coin.recentChangePct ?? 0) > 0)
    .sort((a, b) => (b.recentChangePct ?? 0) - (a.recentChangePct ?? 0))
    .slice(0, count);
  const falling = alive
    .filter((coin) => (coin.recentChangePct ?? 0) < 0)
    .sort((a, b) => (a.recentChangePct ?? 0) - (b.recentChangePct ?? 0))
    .slice(0, count);
  return { rising, falling };
}
