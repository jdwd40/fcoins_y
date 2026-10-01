import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterBoardCoins, sortBoardCoins, topMovers } from './marketBoard.ts';
import type { PersistentCoinSignal } from '../services/persistentService.ts';

function coin(over: Partial<PersistentCoinSignal>): PersistentCoinSignal {
  return {
    coinId: 1,
    name: 'Coin',
    symbol: 'CN',
    currentPrice: 1,
    dead: false,
    status: 'ALIVE',
    archetype: 'ZIP',
    recentChangePct: 0,
    momentum: 'FLAT',
    ...over
  };
}

const coins: PersistentCoinSignal[] = [
  coin({ coinId: 1, symbol: 'A', recentChangePct: 5, currentPrice: 2 }),
  coin({ coinId: 2, symbol: 'B', recentChangePct: -3, currentPrice: 0.5 }),
  coin({ coinId: 3, symbol: 'C', recentChangePct: 0, currentPrice: 10 }),
  coin({ coinId: 4, symbol: 'D', dead: true, status: 'DEAD', currentPrice: 0, recentChangePct: null, momentum: 'FLAT' })
];

const owned = new Set([2]);
const isOwned = (id: number) => owned.has(id);
const withEvents = new Set([3]);
const hasEvents = (id: number) => withEvents.has(id);

describe('filterBoardCoins', () => {
  it('all: returns alive coins only (dead go to the Graveyard)', () => {
    assert.deepEqual(filterBoardCoins(coins, 'all', isOwned, hasEvents).map((c) => c.coinId), [1, 2, 3]);
  });
  it('owned / rising / falling / events', () => {
    assert.deepEqual(filterBoardCoins(coins, 'owned', isOwned, hasEvents).map((c) => c.coinId), [2]);
    assert.deepEqual(filterBoardCoins(coins, 'rising', isOwned, hasEvents).map((c) => c.coinId), [1]);
    assert.deepEqual(filterBoardCoins(coins, 'falling', isOwned, hasEvents).map((c) => c.coinId), [2]);
    assert.deepEqual(filterBoardCoins(coins, 'events', isOwned, hasEvents).map((c) => c.coinId), [3]);
  });
});

describe('sortBoardCoins', () => {
  it('featured: owned first, then catalogue order', () => {
    assert.deepEqual(sortBoardCoins(coins.slice(0, 3), 'featured', isOwned).map((c) => c.coinId), [2, 1, 3]);
  });
  it('movers: biggest absolute 1m change first', () => {
    assert.deepEqual(sortBoardCoins(coins.slice(0, 3), 'movers', isOwned).map((c) => c.coinId), [1, 2, 3]);
  });
  it('price-desc: highest price first', () => {
    assert.deepEqual(sortBoardCoins(coins.slice(0, 3), 'price-desc', isOwned).map((c) => c.coinId), [3, 1, 2]);
  });
  it('does not mutate the input array', () => {
    const input = coins.slice(0, 3);
    const before = input.map((c) => c.coinId).join(',');
    sortBoardCoins(input, 'movers', isOwned);
    assert.equal(input.map((c) => c.coinId).join(','), before);
  });
});

describe('topMovers', () => {
  it('splits biggest risers and fallers, excluding dead coins', () => {
    const movers = topMovers(coins, 2);
    assert.deepEqual(movers.rising.map((c) => c.coinId), [1]);
    assert.deepEqual(movers.falling.map((c) => c.coinId), [2]);
  });
  it('returns empty lists when nothing moves', () => {
    const still = [coin({ coinId: 1, recentChangePct: 0 })];
    assert.deepEqual(topMovers(still), { rising: [], falling: [] });
  });
});
