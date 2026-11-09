import { endOfMonth, format, startOfMonth } from 'date-fns';
import { getItemMonth } from '@/lib/budget';
import type { Account, BudgetItem, Category, Reserve, Transaction } from '@/lib/types';

/**
 * Single source of the money figures shown by Dashboard and Reports and written to the exported
 * history. Screens and exports must call these functions so their numbers cannot drift apart.
 */

export interface MonthRange {
    monthKey: string;
    start: number;
    end: number;
}

export function getMonthRange(date: Date): MonthRange {
    return {
        monthKey: format(date, 'yyyy-MM'),
        start: startOfMonth(date).getTime(),
        end: endOfMonth(date).getTime(),
    };
}

export interface MonthlyTotals {
    income: number;
    expense: number;
    net: number;
}

/** Transfers move money between accounts, so they are neither income nor expense. */
export function getMonthlyTotals(txs: Transaction[]): MonthlyTotals {
    let income = 0;
    let expense = 0;
    for (const tx of txs) {
        if (tx.type === 'income') income += tx.amount;
        else if (tx.type === 'expense') expense += tx.amount;
    }
    return { income, expense, net: income - expense };
}

export interface BalanceSummary {
    totalRealBalance: number;
    totalReserved: number;
    totalAvailable: number;
}

/** Point-in-time balance. The app keeps no balance history, so this always describes "now". */
export function getBalanceSummary(accounts: Account[], reserves: Reserve[]): BalanceSummary {
    const totalRealBalance = accounts
        .filter((a) => a.isActive)
        .reduce((acc, curr) => acc + (curr.actualBalance ?? curr.calculatedBalance), 0);
    const totalReserved = reserves
        .filter((r) => r.isActive)
        .reduce((acc, curr) => acc + curr.amount, 0);

    return { totalRealBalance, totalReserved, totalAvailable: totalRealBalance - totalReserved };
}

export type HierarchyView = 'parents' | 'children';

export interface CategoryAggregate {
    /** Null for the "uncategorized" bucket. */
    categoryId: string | null;
    name: string;
    parentName?: string;
    color: string;
    amount: number;
    percentage: number;
}

export interface CategoryLabels {
    uncategorized: string;
    /** Name for a group whose parent category no longer exists. */
    parentFallback: string;
}

const UNCATEGORIZED_KEY = '__uncategorized__';
const FALLBACK_COLOR = '#94a3b8';

/** Groups by parent category or by the exact category of each transaction, largest first. */
export function aggregateByCategory(
    txs: Transaction[],
    categories: Category[],
    view: HierarchyView,
    labels: CategoryLabels
): CategoryAggregate[] {
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const aggregated = new Map<string, Omit<CategoryAggregate, 'categoryId' | 'percentage'>>();
    const total = txs.reduce((acc, tx) => acc + tx.amount, 0);

    const addTo = (key: string, amount: number, init: () => Omit<CategoryAggregate, 'categoryId' | 'percentage' | 'amount'>) => {
        const entry = aggregated.get(key) ?? { ...init(), amount: 0 };
        entry.amount += amount;
        aggregated.set(key, entry);
    };

    for (const tx of txs) {
        const cat = catMap.get(tx.categoryId);

        if (view === 'children') {
            addTo(tx.categoryId || UNCATEGORIZED_KEY, tx.amount, () => ({
                name: cat?.name || labels.uncategorized,
                parentName: cat?.parentId ? catMap.get(cat.parentId)?.name : undefined,
                color: cat?.color || FALLBACK_COLOR,
            }));
        } else if (cat?.parentId) {
            const parent = catMap.get(cat.parentId);
            addTo(parent?.id || cat.parentId, tx.amount, () => ({
                name: parent?.name || labels.parentFallback,
                color: parent?.color || cat.color || FALLBACK_COLOR,
            }));
        } else if (cat) {
            addTo(cat.id, tx.amount, () => ({ name: cat.name, color: cat.color || FALLBACK_COLOR }));
        } else {
            addTo(UNCATEGORIZED_KEY, tx.amount, () => ({ name: labels.uncategorized, color: FALLBACK_COLOR }));
        }
    }

    return Array.from(aggregated.entries())
        .sort(([, a], [, b]) => b.amount - a.amount)
        .map(([key, item]) => ({
            ...item,
            categoryId: key === UNCATEGORIZED_KEY ? null : key,
            percentage: total > 0 ? (item.amount / total) * 100 : 0,
        }));
}

export type FixedBudgetStatus = 'no_budget' | 'within' | 'exceeded';

export interface FixedBudgetSummary {
    plannedIncome: number;
    plannedExpense: number;
    plannedAvailable: number;
    expenseUsedPercent: number;
    incomeReceivedPercent: number;
    /** Planned minus actual; negative when the plan was exceeded. */
    expenseDifference: number;
    status: FixedBudgetStatus;
    incomeItems: BudgetItem[];
    expenseItems: BudgetItem[];
}

const percentOf = (actual: number, planned: number): number =>
    planned > 0 ? Math.round((actual / planned) * 100) : 0;

/** Compares the month's plan with actual totals. Actuals include every expense, not only fixed ones. */
export function getFixedBudgetSummary(
    budgetItems: BudgetItem[],
    monthKey: string,
    actual: { income: number; expense: number }
): FixedBudgetSummary {
    const monthItems = budgetItems.filter((item) => getItemMonth(item) === monthKey);
    const expenseItems = monthItems.filter((item) => item.type === 'expense');
    const incomeItems = monthItems.filter((item) => item.type === 'income');

    const plannedExpense = expenseItems.reduce((acc, curr) => acc + curr.amount, 0);
    const plannedIncome = incomeItems.reduce((acc, curr) => acc + curr.amount, 0);
    const expenseUsedPercent = percentOf(actual.expense, plannedExpense);

    let status: FixedBudgetStatus = 'within';
    if (plannedExpense === 0) status = 'no_budget';
    else if (expenseUsedPercent > 100) status = 'exceeded';

    return {
        plannedIncome,
        plannedExpense,
        plannedAvailable: plannedIncome - plannedExpense,
        expenseUsedPercent,
        incomeReceivedPercent: percentOf(actual.income, plannedIncome),
        expenseDifference: plannedExpense - actual.expense,
        status,
        incomeItems,
        expenseItems,
    };
}

export function isPendingReview(tx: Transaction): boolean {
    return tx.isAmbiguous === true || (tx.aiConfidence !== undefined && tx.aiConfidence < 0.7);
}
