import { describe, expect, it } from 'vitest';
import {
    buildMedianTrends,
    computeTrend,
    isOutlier,
    median,
    type BuildMedianTrendsInput,
} from '@/lib/reports/medianTrends';
import type { Transaction } from '@/lib/types';
import { categories, labels, makeTx, ts } from './fixtures';

const NOW = new Date(2026, 10, 9, 10, 30);
const PERIOD = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];

type Row = { type?: 'income' | 'expense'; categoryId?: string; isAdjustment?: boolean };

/** One transaction per period month with the given amount; zeros create no record. */
function series(amounts: number[], row: Row = {}): Array<[string, Transaction]> {
    const start = PERIOD.length - amounts.length;
    return amounts.flatMap((amount, index): Array<[string, Transaction]> => {
        if (amount === 0) return [];
        const key = PERIOD[start + index];
        const month = Number(key.slice(5));
        return [[key, makeTx({ type: row.type ?? 'expense', amount, date: ts(2026, month, 10), categoryId: row.categoryId ?? 'cat-2', isAdjustment: row.isAdjustment })]];
    });
}

function build(rows: Array<[string, Transaction]>, overrides: Partial<BuildMedianTrendsInput> = {}) {
    const txsByMonth = new Map<string, Transaction[]>();
    for (const [key, tx] of rows) txsByMonth.set(key, [...(txsByMonth.get(key) ?? []), tx]);
    return buildMedianTrends({ selectedMonth: NOW, now: NOW, txsByMonth, categories, labels, ...overrides });
}

const expenseRow = (result: ReturnType<typeof build>, id: string) =>
    result.categories.expense.find((c) => c.categoryId === id);

describe('median', () => {
    it('takes the middle value of an odd series regardless of order', () => {
        expect(median([300, 100, 200])).toBe(200);
    });

    it('averages the two central values of an even series', () => {
        expect(median([100, 400, 200, 300])).toBe(250);
    });

    it('counts months at zero', () => {
        expect(median([0, 0, 0, 900, 100])).toBe(0);
    });

    it('is zero for an empty series', () => {
        expect(median([])).toBe(0);
    });
});

describe('computeTrend', () => {
    it('compares the median of the last 3 months with the previous 3', () => {
        expect(computeTrend([100, 120, 110, 150, 165, 180])).toEqual({ change: 55, percent: 50 });
    });

    it('reports a decrease as negative', () => {
        expect(computeTrend([200, 200, 200, 150, 150, 150])).toEqual({ change: -50, percent: -25 });
    });

    it('does not apply when the previous median is zero', () => {
        expect(computeTrend([0, 0, 0, 100, 100, 100])).toBeNull();
    });

    it('does not apply when the recent median is zero', () => {
        expect(computeTrend([100, 100, 100, 0, 0, 0])).toBeNull();
    });

    it('does not apply with fewer than 6 months', () => {
        expect(computeTrend([100, 100, 200, 200, 200])).toBeNull();
    });

    it('measures the percent against the size of a negative base', () => {
        expect(computeTrend([-100, -100, -100, -50, -50, -50])).toEqual({ change: 50, percent: 50 });
    });
});

describe('isOutlier', () => {
    it('flags a maximum above twice the median', () => {
        expect(isOutlier(100, 201)).toBe(true);
    });

    it('does not flag a maximum of exactly twice the median', () => {
        expect(isOutlier(100, 200)).toBe(false);
    });

    it('flags any spending when the median is zero', () => {
        expect(isOutlier(0, 50)).toBe(true);
    });

    it('does not flag a series without records', () => {
        expect(isOutlier(0, 0)).toBe(false);
    });
});

describe('period', () => {
    it('uses the 6 closed months before the month in progress', () => {
        const result = build(series([1, 1, 1, 1, 1, 1]));
        expect(result.period).toEqual({ from: '2026-05', to: '2026-10', months: PERIOD, monthsUsed: 6, targetMonths: 6 });
    });

    it('leaves out the month in progress even when it has records', () => {
        const current = makeTx({ type: 'expense', amount: 9999, date: ts(2026, 11, 2), categoryId: 'cat-2' });
        const result = build([...series([100, 100, 100, 100, 100, 100]), ['2026-11', current]]);
        expect(result.totals.expense.median).toBe(100);
        expect(result.period.to).toBe('2026-10');
    });

    it('includes a selected month that is already closed', () => {
        const result = build(series([1, 1, 1, 1, 1, 1]), { selectedMonth: new Date(2026, 8, 15) });
        expect(result.period).toMatchObject({ to: '2026-09', monthsUsed: 5 });
    });

    it('never reaches the month in progress for a future selected month', () => {
        const result = build(series([1, 1, 1, 1, 1, 1]), { selectedMonth: new Date(2027, 1, 1) });
        expect(result.period.to).toBe('2026-10');
    });

    it('uses the months available and says how many', () => {
        const result = build(series([100, 200, 300]));
        expect(result.period).toMatchObject({ from: '2026-08', monthsUsed: 3, targetMonths: 6 });
        expect(result.totals.expense.median).toBe(200);
    });

    it('counts an empty month after the first record as zero', () => {
        const result = build(series([100, 0, 0, 100, 0, 100]));
        expect(result.period.monthsUsed).toBe(6);
        expect(result.totals.expense.median).toBe(50);
    });

    it('does not start the period on a month that only has adjustments', () => {
        const early = makeTx({ type: 'expense', amount: 500, date: ts(2026, 8, 2), isAdjustment: true, categoryId: 'cat-adj' });
        const result = build([['2026-08', early], ...series([100])]);
        expect(result.period).toMatchObject({ from: '2026-10', monthsUsed: 1 });
    });

    it('stays empty without data', () => {
        const result = build([]);
        expect(result.period).toEqual({ from: null, to: null, months: [], monthsUsed: 0, targetMonths: 6 });
        expect(result.totals.expense).toEqual({ median: 0, trend: null, averageReference: 0 });
    });
});

describe('category metrics', () => {
    it('reports median, range, months with records and trend', () => {
        const row = expenseRow(build(series([100, 0, 100, 200, 300, 200])), 'cat-2');
        expect(row).toMatchObject({
            median: 150,
            min: 0,
            max: 300,
            monthsWithRecords: 5,
            trend: { change: 100, percent: 100 },
            outlier: false,
        });
    });

    it('marks a one-month spike as an outlier', () => {
        expect(expenseRow(build(series([100, 100, 100, 100, 100, 900])), 'cat-2')?.outlier).toBe(true);
    });

    it('rolls subcategories up and nests them under their category', () => {
        const rows = [...series([100, 100, 100, 100, 100, 100], { categoryId: 'cat-1a' }), ...series([50, 50, 50, 50, 50, 50], { categoryId: 'cat-1b' })];
        const row = expenseRow(build(rows), 'cat-1');
        expect(row?.median).toBe(150);
        expect(row?.subcategories.map((s) => [s.categoryId, s.median])).toEqual([['cat-1a', 100], ['cat-1b', 50]]);
    });

    it('shows a subcategory without records at zero', () => {
        const row = expenseRow(build(series([100, 100, 100, 100, 100, 100], { categoryId: 'cat-1a' })), 'cat-1');
        expect(row?.subcategories.find((s) => s.categoryId === 'cat-1b')).toEqual({
            categoryId: 'cat-1b',
            name: 'Subcategoría 1B',
            median: 0,
            min: 0,
            max: 0,
            monthsWithRecords: 0,
            trend: null,
            outlier: false,
            subcategories: [],
        });
    });

    it('shows a category without records at zero', () => {
        expect(expenseRow(build(series([100])), 'cat-1')).toMatchObject({ median: 0, monthsWithRecords: 0 });
    });

    it('keeps income categories apart', () => {
        const result = build(series([1000, 1000, 1000, 1000, 1000, 1000], { type: 'income', categoryId: 'cat-inc-1' }));
        expect(result.categories.income[0]).toMatchObject({ categoryId: 'cat-inc', median: 1000 });
        expect(result.categories.expense.map((c) => c.categoryId)).not.toContain('cat-inc');
    });

    it('keeps the current name when a category was renamed', () => {
        const renamed = categories.map((c) => (c.id === 'cat-2' ? { ...c, name: 'Nombre nuevo' } : c));
        expect(expenseRow(build(series([100, 100]), { categories: renamed }), 'cat-2')?.name).toBe('Nombre nuevo');
    });

    it('hides a deactivated category only while it has no records', () => {
        const inactive = categories.map((c) => (c.id === 'cat-2' ? { ...c, isActive: false } : c));
        expect(expenseRow(build(series([100], { categoryId: 'cat-1a' }), { categories: inactive }), 'cat-2')).toBeUndefined();
        expect(expenseRow(build(series([100]), { categories: inactive }), 'cat-2')).toBeDefined();
    });

    it('groups records of a deleted category as uncategorized', () => {
        const result = build(series([70], { categoryId: 'gone' }));
        expect(result.categories.expense.find((c) => c.categoryId === null)).toMatchObject({ name: 'Sin categoría', median: 70 });
    });
});

describe('period totals', () => {
    const income = () => series([1000, 1000, 1000, 2000, 2000, 2000], { type: 'income', categoryId: 'cat-inc' });

    it('reports median, trend and the average only as a reference', () => {
        const result = build([...income(), ...series([100, 100, 100, 100, 100, 700])]);
        expect(result.totals.income).toEqual({ median: 1500, trend: { change: 1000, percent: 100 }, averageReference: 1500 });
        expect(result.totals.expense).toEqual({ median: 100, trend: { change: 0, percent: 0 }, averageReference: 200 });
    });

    it('computes the median of the monthly net', () => {
        const result = build([...income(), ...series([100, 100, 100, 100, 100, 700])]);
        expect(result.totals.net.median).toBe(1100);
        expect(result.totals.net.trend).toEqual({ change: 1000, percent: 111 });
    });

    it('leaves adjustments out of the medians and reports them apart', () => {
        const adjustments = series([0, 0, 0, 0, 0, 5000], { isAdjustment: true, categoryId: 'cat-adj' });
        const incomeAdjustment = series([0, 0, 0, 0, 40, 0], { type: 'income', isAdjustment: true, categoryId: 'cat-adj' });
        const result = build([...series([100, 100, 100, 100, 100, 100]), ...adjustments, ...incomeAdjustment]);
        expect(result.totals.expense.median).toBe(100);
        expect(result.adjustments).toEqual({ income: 40, expense: 5000 });
        expect(expenseRow(result, 'cat-adj')).toMatchObject({ median: 0, monthsWithRecords: 0 });
    });

    it('ignores transfers', () => {
        const transfer = makeTx({ type: 'transfer', amount: 800, date: ts(2026, 10, 3) });
        const result = build([...series([100, 100, 100, 100, 100, 100]), ['2026-10', transfer]]);
        expect(result.totals.expense.median).toBe(100);
    });

    it('lists the outlier month with the category responsible', () => {
        const result = build(series([100, 100, 100, 100, 100, 900]));
        expect(result.outlierMonths).toEqual([
            { month: '2026-10', expense: 900, categories: [{ categoryId: 'cat-2', name: 'Categoría 2', amount: 900, median: 100 }] },
        ]);
    });

    it('takes the median of the expenses of months without spikes', () => {
        const rows = [...series([100, 110, 120, 130, 140, 900]), ...series([10, 10, 10, 10, 10, 10], { categoryId: 'cat-1a' })];
        expect(build(rows).totals.expenseWithoutOutliers).toEqual({ median: 130, monthsUsed: 5 });
    });

    it('lists every category behind the same outlier month', () => {
        const rows = [...series([100, 100, 100, 100, 100, 900]), ...series([50, 50, 50, 50, 50, 500], { categoryId: 'cat-1a' })];
        expect(build(rows).outlierMonths[0].categories.map((c) => c.categoryId)).toEqual(['cat-2', 'cat-1']);
    });

    it('has no median without spikes when every month is an outlier', () => {
        const rows = [...series([900, 0, 0]), ...series([0, 900, 0], { categoryId: 'cat-1a' }), ...series([0, 0, 900], { categoryId: 'cat-adj' })];
        const result = build(rows);
        expect(result.outlierMonths).toHaveLength(3);
        expect(result.totals.expenseWithoutOutliers).toEqual({ median: null, monthsUsed: 0 });
    });
});
