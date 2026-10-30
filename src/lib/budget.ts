import { now } from './utils';
import { roundMoney } from './money';
import { format } from 'date-fns';
import type { BudgetItem, Category, Transaction } from './types';

export interface ActualBudgetCandidate {
  name: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId?: string;
}

/** Month key of an item; legacy rows without `month` fall back to their creation date. */
export function getItemMonth(item: BudgetItem): string {
  return item.month || format(new Date(item.createdAt || now()), 'yyyy-MM');
}

/**
 * Aggregates actual income and expenses from transactions of a given period into
 * budget candidates by the transaction's exact category. Subcategories stay
 * separate so the user can budget at the same level they categorize expenses.
 */
export function buildActualBudgetCandidates(
  txs: Transaction[],
  categories: Category[],
  uncategorizedLabel = 'Sin categoría'
): ActualBudgetCandidate[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const expenses = txs.filter((t) => t.type === 'expense');
  const incomes = txs.filter((t) => t.type === 'income');

  const aggregate = (
    txList: Transaction[],
    type: 'income' | 'expense'
  ): ActualBudgetCandidate[] => {
    const map = new Map<string, { name: string; amount: number; categoryId?: string }>();

    for (const tx of txList) {
      if (!tx.amount || tx.amount <= 0) continue;

      const cat = catMap.get(tx.categoryId);
      let key: string;
      let name: string;
      let categoryId: string | undefined;

      if (cat) {
        key = cat.id;
        name = cat.name;
        categoryId = cat.id;
      } else {
        key = '__uncategorized__';
        name = uncategorizedLabel;
        categoryId = undefined;
      }

      const existing = map.get(key);
      if (existing) {
        existing.amount += tx.amount;
      } else {
        map.set(key, { name, amount: tx.amount, categoryId });
      }
    }

    return Array.from(map.values())
      .map((entry) => ({
        name: entry.name,
        amount: roundMoney(entry.amount),
        type,
        categoryId: entry.categoryId,
      }))
      .filter((entry) => entry.amount > 0)
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  };

  const expenseItems = aggregate(expenses, 'expense');
  const incomeItems = aggregate(incomes, 'income');

  return [...incomeItems, ...expenseItems];
}

/**
 * Converts budget candidates into persisted `BudgetItem` records for the specified month.
 */
export function candidatesToBudgetItems(
  candidates: ActualBudgetCandidate[],
  targetMonthKey: string
): BudgetItem[] {
  const timestamp = now();
  return candidates.map((item) => ({
    id: crypto.randomUUID(),
    month: targetMonthKey,
    name: item.name,
    amount: item.amount,
    type: item.type,
    categoryId: item.categoryId,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}
