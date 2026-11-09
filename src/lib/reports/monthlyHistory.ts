import { eachMonthOfInterval, format, getDaysInMonth, parse, startOfMonth, subMonths } from 'date-fns';
import { db } from '@/lib/db';
import { DEMO_ID_PREFIX } from '@/lib/db/demoData';
import { getItemMonth } from '@/lib/budget';
import { currencyDigits, type CurrencyCode } from '@/lib/region/region';
import { getRegion } from '@/lib/region/regionStore';
import type { Account, BudgetItem, Category, Reserve, Transaction } from '@/lib/types';
import {
    aggregateByCategory,
    getBalanceSummary,
    getFixedBudgetSummary,
    getMonthlyTotals,
    getMonthRange,
    isPendingReview,
    type BalanceSummary,
    type CategoryAggregate,
    type CategoryLabels,
    type FixedBudgetSummary,
    type MonthlyTotals,
} from './monthlyMetrics';

export type HistoryRange = 'month' | '6' | '12' | 'all';

export interface SeriesStats {
    average: number;
    median: number;
    min: number;
    max: number;
}

export interface CategoryStats extends SeriesStats {
    categoryId: string | null;
    name: string;
    activeMonths: number;
}

export interface HistoryMonth {
    month: string;
    /** True for the month in progress and for future months: not comparable with closed months. */
    isPartial: boolean;
    daysElapsed: number;
    daysInMonth: number;
    hasData: boolean;
    totals: MonthlyTotals;
    adjustments: { income: number; expense: number };
    fixedBudget: FixedBudgetSummary;
    expenses: { byCategory: CategoryAggregate[]; bySubcategory: CategoryAggregate[] };
    income: { byCategory: CategoryAggregate[]; bySubcategory: CategoryAggregate[] };
    dataQuality: { transactionCount: number; pendingReviewCount: number; demoTransactionCount: number };
}

export interface HistoryTransaction {
    date: string;
    type: 'income' | 'expense';
    amount: number;
    categoryId: string;
    accountId: string;
    isAdjustment: boolean;
}

export interface MonthlyHistory {
    range: { from: string; to: string; completeMonths: number };
    generatedAt: Date;
    currency: { code: CurrencyCode; minorUnitDigits: 0 | 2 };
    balanceAtExport: BalanceSummary;
    summary: { income: SeriesStats | null; expense: SeriesStats | null; expenseByCategory: CategoryStats[] };
    months: HistoryMonth[];
    transactions: HistoryTransaction[];
}

export interface BuildHistoryInput {
    selectedMonth: Date;
    range: HistoryRange;
    transactions: Transaction[];
    categories: Category[];
    budgetItems: BudgetItem[];
    accounts: Account[];
    reserves: Reserve[];
    now: Date;
    labels: CategoryLabels;
    currency: CurrencyCode;
}

const MONTHS_IN_RANGE: Record<Exclude<HistoryRange, 'all'>, number> = { month: 1, '6': 6, '12': 12 };

/** First month of the window, or null when the range has no lower limit. */
function getWindowStart(selectedMonth: Date, range: HistoryRange): Date | null {
    if (range === 'all') return null;
    return startOfMonth(subMonths(selectedMonth, MONTHS_IN_RANGE[range] - 1));
}

function describeSeries(values: number[]): SeriesStats {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return {
        average: values.reduce((acc, v) => acc + v, 0) / values.length,
        median: sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
        min: sorted[0],
        max: sorted[sorted.length - 1],
    };
}

/** Monthly behaviour of each expense category; a month without spending counts as zero. */
function describeCategories(behaviourByMonth: Transaction[][], input: BuildHistoryInput): CategoryStats[] {
    const series = new Map<string | null, { name: string; values: number[] }>();

    behaviourByMonth.forEach((txs, monthIndex) => {
        const expenses = txs.filter((tx) => tx.type === 'expense');
        for (const item of aggregateByCategory(expenses, input.categories, 'parents', input.labels)) {
            const entry = series.get(item.categoryId) ?? {
                name: item.name,
                values: new Array<number>(behaviourByMonth.length).fill(0),
            };
            entry.values[monthIndex] = item.amount;
            series.set(item.categoryId, entry);
        }
    });

    return Array.from(series.entries())
        .map(([categoryId, { name, values }]) => ({
            categoryId,
            name,
            ...describeSeries(values),
            activeMonths: values.filter((v) => v > 0).length,
        }))
        .sort((a, b) => b.average - a.average || a.name.localeCompare(b.name));
}

function buildMonth(key: string, txs: Transaction[], input: BuildHistoryInput, currentKey: string): HistoryMonth {
    const date = parse(key, 'yyyy-MM', input.now);
    const daysInMonth = getDaysInMonth(date);
    const movements = txs.filter((tx) => tx.type !== 'transfer');
    const expenses = movements.filter((tx) => tx.type === 'expense');
    const incomes = movements.filter((tx) => tx.type === 'income');
    const totals = getMonthlyTotals(movements);
    const { income, expense } = getMonthlyTotals(movements.filter((tx) => tx.isAdjustment));
    const hasBudget = input.budgetItems.some((item) => getItemMonth(item) === key);

    let daysElapsed = daysInMonth;
    if (key === currentKey) daysElapsed = input.now.getDate();
    else if (key > currentKey) daysElapsed = 0;

    return {
        month: key,
        isPartial: key >= currentKey,
        daysElapsed,
        daysInMonth,
        hasData: txs.length > 0 || hasBudget,
        totals,
        adjustments: { income, expense },
        fixedBudget: getFixedBudgetSummary(input.budgetItems, key, totals),
        expenses: {
            byCategory: aggregateByCategory(expenses, input.categories, 'parents', input.labels),
            bySubcategory: aggregateByCategory(expenses, input.categories, 'children', input.labels),
        },
        income: {
            byCategory: aggregateByCategory(incomes, input.categories, 'parents', input.labels),
            bySubcategory: aggregateByCategory(incomes, input.categories, 'children', input.labels),
        },
        dataQuality: {
            transactionCount: movements.length,
            pendingReviewCount: movements.filter(isPendingReview).length,
            demoTransactionCount: movements.filter((tx) => tx.id.startsWith(DEMO_ID_PREFIX)).length,
        },
    };
}

export function buildMonthlyHistory(input: BuildHistoryInput): MonthlyHistory {
    const { selectedMonth, range, now, currency } = input;
    const toKey = format(selectedMonth, 'yyyy-MM');
    const windowStart = getWindowStart(selectedMonth, range);
    const windowKey = windowStart ? format(windowStart, 'yyyy-MM') : '';
    const currentKey = format(now, 'yyyy-MM');
    const inWindow = (key: string) => key >= windowKey && key <= toKey;

    const txsByMonth = new Map<string, Transaction[]>();
    for (const tx of input.transactions) {
        const { monthKey, end } = getMonthRange(new Date(tx.date));
        // Dashboard and Reports read months with an exclusive upper bound; mirror it to stay equal.
        if (tx.date >= end || !inWindow(monthKey)) continue;
        txsByMonth.set(monthKey, [...(txsByMonth.get(monthKey) ?? []), tx]);
    }

    const keysWithData = [...txsByMonth.keys(), ...input.budgetItems.map(getItemMonth).filter(inWindow)].sort();
    const fromKey = keysWithData[0] ?? toKey;

    const months = eachMonthOfInterval({
        start: parse(fromKey, 'yyyy-MM', now),
        end: startOfMonth(selectedMonth),
    }).map((date) => {
        const key = format(date, 'yyyy-MM');
        return buildMonth(key, txsByMonth.get(key) ?? [], input, currentKey);
    });

    // Averages describe behaviour: closed months with movements and no reconciliation adjustments.
    const behaviourByMonth = months
        .filter((m) => !m.isPartial)
        .map((m) => (txsByMonth.get(m.month) ?? []).filter((tx) => tx.type !== 'transfer' && !tx.isAdjustment))
        .filter((txs) => txs.length > 0);
    const behaviourTotals = behaviourByMonth.map(getMonthlyTotals);
    const hasCompleteMonths = behaviourByMonth.length > 0;

    const transactions = months
        .flatMap((m) => txsByMonth.get(m.month) ?? [])
        .filter((tx): tx is Transaction & { type: 'income' | 'expense' } => tx.type !== 'transfer')
        .sort((a, b) => a.date - b.date)
        .map((tx) => ({
            date: format(new Date(tx.date), 'yyyy-MM-dd'),
            type: tx.type,
            amount: tx.amount,
            categoryId: tx.categoryId,
            accountId: tx.accountId,
            isAdjustment: tx.isAdjustment === true,
        }));

    return {
        range: { from: fromKey, to: toKey, completeMonths: behaviourByMonth.length },
        generatedAt: now,
        currency: { code: currency, minorUnitDigits: currencyDigits(currency) },
        balanceAtExport: getBalanceSummary(input.accounts, input.reserves),
        summary: {
            income: hasCompleteMonths ? describeSeries(behaviourTotals.map((t) => t.income)) : null,
            expense: hasCompleteMonths ? describeSeries(behaviourTotals.map((t) => t.expense)) : null,
            expenseByCategory: describeCategories(behaviourByMonth, input),
        },
        months,
        transactions,
    };
}

export interface LoadHistoryOptions {
    selectedMonth: Date;
    range: HistoryRange;
    labels: CategoryLabels;
    now?: Date;
}

/** Reads everything in one Dexie transaction so a concurrent write cannot produce a partial file. */
export async function loadMonthlyHistory({
    selectedMonth,
    range,
    labels,
    now = new Date(),
}: LoadHistoryOptions): Promise<MonthlyHistory> {
    const { end } = getMonthRange(selectedMonth);
    const windowStart = getWindowStart(selectedMonth, range);

    return db.transaction('r', [db.transactions, db.categories, db.budgetItems, db.accounts, db.reserves], async () => {
        const dates = db.transactions.where('date');
        const [transactions, categories, budgetItems, accounts, reserves] = await Promise.all([
            (windowStart ? dates.between(windowStart.getTime(), end) : dates.below(end)).toArray(),
            db.categories.toArray(),
            db.budgetItems.toArray(),
            db.accounts.toArray(),
            db.reserves.toArray(),
        ]);

        return buildMonthlyHistory({
            selectedMonth,
            range,
            transactions,
            categories,
            budgetItems,
            accounts,
            reserves,
            now,
            labels,
            currency: getRegion().currency,
        });
    });
}

/** Only months: amounts and names must never reach a file name. */
export function getHistoryFileName(history: MonthlyHistory, extension: 'json' | 'md'): string {
    const { from, to } = history.range;
    return `historial-${from === to ? to : `${from}_${to}`}.${extension}`;
}
