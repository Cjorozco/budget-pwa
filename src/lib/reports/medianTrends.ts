import { addMonths, format, min as earliest, startOfMonth, subMonths } from 'date-fns';
import type { Category, Transaction } from '@/lib/types';
import { aggregateByCategory, getMonthlyTotals, type CategoryLabels, type HierarchyView } from './monthlyMetrics';

const TARGET_MONTHS = 6;
const TREND_WINDOW = 3;

export interface Trend {
    change: number;
    percent: number;
}

export interface TotalMetrics {
    median: number;
    trend: Trend | null;
    /** Secondary figure only: a single spike distorts it. */
    averageReference: number;
}

export interface CategoryMetrics {
    /** Null for the "uncategorized" bucket. */
    categoryId: string | null;
    name: string;
    median: number;
    min: number;
    max: number;
    monthsWithRecords: number;
    trend: Trend | null;
    outlier: boolean;
    subcategories: CategoryMetrics[];
}

export interface OutlierMonth {
    month: string;
    expense: number;
    categories: Array<{ categoryId: string | null; name: string; amount: number; median: number }>;
}

export interface MedianTrends {
    period: { from: string | null; to: string | null; months: string[]; monthsUsed: number; targetMonths: number };
    totals: {
        income: TotalMetrics;
        expense: TotalMetrics;
        net: TotalMetrics;
        expenseWithoutOutliers: { median: number | null; monthsUsed: number };
    };
    outlierMonths: OutlierMonth[];
    adjustments: { income: number; expense: number };
    categories: { expense: CategoryMetrics[]; income: CategoryMetrics[] };
}

export interface BuildMedianTrendsInput {
    /** Last month of the export. */
    selectedMonth: Date;
    now: Date;
    /** Transactions of the exported window, grouped by 'yyyy-MM'. */
    txsByMonth: Map<string, Transaction[]>;
    categories: Category[];
    labels: CategoryLabels;
}

export function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Last 3 months against the 3 before them; null when they cannot be compared. */
export function computeTrend(values: number[]): Trend | null {
    if (values.length < TREND_WINDOW * 2) return null;
    const previous = median(values.slice(-TREND_WINDOW * 2, -TREND_WINDOW));
    const recent = median(values.slice(-TREND_WINDOW));
    if (previous === 0 || recent === 0) return null;

    const change = recent - previous;
    return { change, percent: Math.round((change / Math.abs(previous)) * 100) || 0 };
}

/** The peak exceeds twice the median, that is, it is more than one median above it. */
export function isOutlier(medianValue: number, max: number): boolean {
    return max > 2 * medianValue && max - medianValue > medianValue;
}

/** First month after the analysis: past the selected month, and never past the month in progress. */
function getAnchorMonth(selectedMonth: Date, now: Date): Date {
    return earliest([addMonths(startOfMonth(selectedMonth), 1), startOfMonth(now)]);
}

interface Series {
    name: string;
    values: number[];
}

/** One value per month and category; a month without records stays at zero. */
function collectSeries(
    txsPerMonth: Transaction[][],
    categories: Category[],
    view: HierarchyView,
    labels: CategoryLabels
): Map<string | null, Series> {
    const series = new Map<string | null, Series>();
    txsPerMonth.forEach((txs, monthIndex) => {
        for (const item of aggregateByCategory(txs, categories, view, labels)) {
            const entry = series.get(item.categoryId) ?? { name: item.name, values: new Array<number>(txsPerMonth.length).fill(0) };
            entry.values[monthIndex] = item.amount;
            series.set(item.categoryId, entry);
        }
    });
    return series;
}

function describeCategory(
    categoryId: string | null,
    name: string,
    values: number[],
    subcategories: CategoryMetrics[]
): CategoryMetrics {
    const medianValue = median(values);
    const max = values.length > 0 ? Math.max(...values) : 0;
    return {
        categoryId,
        name,
        median: medianValue,
        min: values.length > 0 ? Math.min(...values) : 0,
        max,
        monthsWithRecords: values.filter((v) => v > 0).length,
        trend: computeTrend(values),
        outlier: isOutlier(medianValue, max),
        subcategories,
    };
}

const byMedian = (a: CategoryMetrics, b: CategoryMetrics) => b.median - a.median || a.name.localeCompare(b.name);

function describeTotal(values: number[]): TotalMetrics {
    return {
        median: median(values),
        trend: computeTrend(values),
        averageReference: values.length > 0 ? values.reduce((acc, v) => acc + v, 0) / values.length : 0,
    };
}

function describeCategories(
    type: 'income' | 'expense',
    txsPerMonth: Transaction[][],
    input: BuildMedianTrendsInput,
    monthCount: number
): CategoryMetrics[] {
    const { categories, labels } = input;
    const typed = txsPerMonth.map((txs) => txs.filter((tx) => tx.type === type));
    const parents = collectSeries(typed, categories, 'parents', labels);
    const children = collectSeries(typed, categories, 'children', labels);
    const zeros = new Array<number>(monthCount).fill(0);

    const catalogRoots = categories.filter(
        (c) => !c.parentId && ((c.type === type && c.isActive) || parents.has(c.id))
    );
    const names = new Map<string | null, string>(catalogRoots.map((c) => [c.id, c.name]));
    for (const [key, { name }] of parents) if (!names.has(key)) names.set(key, name);

    return Array.from(names.entries())
        .map(([key, name]) => {
            const subcategories = categories
                .filter((c) => c.parentId === key && ((c.type === type && c.isActive) || children.has(c.id)))
                .map((c) => describeCategory(c.id, c.name, children.get(c.id)?.values ?? zeros, []))
                .sort(byMedian);
            return describeCategory(key, name, parents.get(key)?.values ?? zeros, subcategories);
        })
        .sort(byMedian);
}

function findOutlierMonths(
    months: string[],
    expenseTotals: number[],
    txsPerMonth: Transaction[][],
    input: BuildMedianTrendsInput
): OutlierMonth[] {
    const expenses = txsPerMonth.map((txs) => txs.filter((tx) => tx.type === 'expense'));
    const responsible = new Map<number, OutlierMonth['categories']>();

    for (const [categoryId, { name, values }] of collectSeries(expenses, input.categories, 'parents', input.labels)) {
        const medianValue = median(values);
        values.forEach((amount, index) => {
            if (!isOutlier(medianValue, amount)) return;
            responsible.set(index, [...(responsible.get(index) ?? []), { categoryId, name, amount, median: medianValue }]);
        });
    }

    return Array.from(responsible.entries())
        .sort(([a], [b]) => a - b)
        .map(([index, list]) => ({
            month: months[index],
            expense: expenseTotals[index],
            categories: list.sort((a, b) => b.amount - a.amount),
        }));
}

export function buildMedianTrends(input: BuildMedianTrendsInput): MedianTrends {
    const { selectedMonth, now, txsByMonth } = input;
    const anchor = getAnchorMonth(selectedMonth, now);
    const candidates = Array.from({ length: TARGET_MONTHS }, (_, i) =>
        format(subMonths(anchor, TARGET_MONTHS - i), 'yyyy-MM')
    );

    const isBehaviour = (tx: Transaction) => tx.type !== 'transfer' && !tx.isAdjustment;
    // Only months before the first record are missing data; later empty months are real zeros.
    const firstRecordKey = [...txsByMonth.entries()]
        .filter(([, txs]) => txs.some(isBehaviour))
        .map(([key]) => key)
        .sort()[0];
    const firstIndex = firstRecordKey === undefined ? -1 : candidates.findIndex((key) => key >= firstRecordKey);
    const months = firstIndex === -1 ? [] : candidates.slice(firstIndex);

    const movements = months.map((key) => (txsByMonth.get(key) ?? []).filter((tx) => tx.type !== 'transfer'));
    const txsPerMonth = movements.map((txs) => txs.filter(isBehaviour));
    const totals = txsPerMonth.map(getMonthlyTotals);
    const expenseTotals = totals.map((t) => t.expense);
    const { income, expense } = getMonthlyTotals(movements.flat().filter((tx) => tx.isAdjustment));

    const outlierMonths = findOutlierMonths(months, expenseTotals, txsPerMonth, input);
    const outlierKeys = new Set(outlierMonths.map((m) => m.month));
    const withoutOutliers = expenseTotals.filter((_, i) => !outlierKeys.has(months[i]));

    return {
        period: {
            from: months[0] ?? null,
            to: months.at(-1) ?? null,
            months,
            monthsUsed: months.length,
            targetMonths: TARGET_MONTHS,
        },
        totals: {
            income: describeTotal(totals.map((t) => t.income)),
            expense: describeTotal(expenseTotals),
            net: describeTotal(totals.map((t) => t.net)),
            expenseWithoutOutliers: {
                median: withoutOutliers.length > 0 ? median(withoutOutliers) : null,
                monthsUsed: withoutOutliers.length,
            },
        },
        outlierMonths,
        adjustments: { income, expense },
        categories: {
            expense: describeCategories('expense', txsPerMonth, input, months.length),
            income: describeCategories('income', txsPerMonth, input, months.length),
        },
    };
}
