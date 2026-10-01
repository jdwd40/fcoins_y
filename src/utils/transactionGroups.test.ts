import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { groupTransactionsByDay } from './transactionGroups.ts';
import type { PersistentTransaction } from '../services/persistentService.ts';

function tx(id: number, createdAt: string): PersistentTransaction {
  return {
    persistentTransactionId: id,
    type: 'BUY',
    coinId: 1,
    symbol: 'FTR',
    quantity: 1,
    price: 1,
    totalAmount: 1,
    createdAt
  };
}

// Noon local time so day boundaries are stable in any timezone.
const now = new Date(2026, 9, 1, 12, 0, 0).getTime();

describe('groupTransactionsByDay', () => {
  it('groups into Today / Yesterday / dated buckets, newest first preserved', () => {
    const groups = groupTransactionsByDay(
      [
        tx(3, new Date(2026, 9, 1, 11, 30).toISOString()),
        tx(2, new Date(2026, 9, 1, 9, 0).toISOString()),
        tx(1, new Date(2026, 8, 30, 22, 0).toISOString()),
        tx(0, new Date(2026, 8, 20, 15, 0).toISOString())
      ],
      now
    );
    assert.deepEqual(groups.map((g) => g.label), ['Today', 'Yesterday', '20 Sept 2026']);
    assert.deepEqual(groups[0].items.map((t) => t.persistentTransactionId), [3, 2]);
  });

  it('skips unparseable timestamps and handles empty input', () => {
    assert.deepEqual(groupTransactionsByDay([], now), []);
    const groups = groupTransactionsByDay([tx(1, 'not-a-date')], now);
    assert.deepEqual(groups, []);
  });
});
