// After-Hours Exchange: transaction ledger day grouping.
//
// The portfolio ledger groups the newest-first transaction list into
// Today / Yesterday / dated day buckets (local time). Pure and unit-tested.

import type { PersistentTransaction } from '../services/persistentService.ts';

export interface TransactionDayGroup {
  /** YYYY-MM-DD local key, used as React key. */
  key: string;
  /** 'Today' | 'Yesterday' | e.g. '29 Sep 2026'. */
  label: string;
  items: PersistentTransaction[];
}

function localDayKey(timeMs: number): string {
  const d = new Date(timeMs);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function dayLabel(key: string, todayKey: string, yesterdayKey: string): string {
  if (key === todayKey) return 'Today';
  if (key === yesterdayKey) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/** Group a newest-first ledger into day buckets, preserving input order. */
export function groupTransactionsByDay(
  transactions: PersistentTransaction[],
  nowMs: number
): TransactionDayGroup[] {
  const todayKey = localDayKey(nowMs);
  const yesterdayKey = localDayKey(nowMs - 24 * 60 * 60 * 1000);
  const groups: TransactionDayGroup[] = [];
  const byKey = new Map<string, TransactionDayGroup>();
  for (const tx of transactions) {
    const time = Date.parse(tx.createdAt);
    if (!Number.isFinite(time)) continue;
    const key = localDayKey(time);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: dayLabel(key, todayKey, yesterdayKey), items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(tx);
  }
  return groups;
}
