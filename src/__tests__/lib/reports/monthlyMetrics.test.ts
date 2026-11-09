import { describe, expect, it } from 'vitest';
import { toMinorUnits } from '@/lib/money';
import {
    aggregateByCategory,
    getBalanceSummary,
    getFixedBudgetSummary,
    getMonthlyTotals,
    getMonthRange,
    isPendingReview,
} from '@/lib/reports/monthlyMetrics';
import { accounts, categories, labels, makeBudgetItem, makeTx, reserves, ts } from './fixtures';

describe('getMonthRange', () => {
    it('spans the first and last millisecond of the local month', () => {
        const range = getMonthRange(new Date(2026, 1, 15));
        expect(range.monthKey).toBe('2026-02');
        expect(range.start).toBe(new Date(2026, 1, 1, 0, 0, 0, 0).getTime());
        expect(range.end).toBe(new Date(2026, 1, 28, 23, 59, 59, 999).getTime());
    });
});

describe('getMonthlyTotals', () => {
    const date = ts(2026, 10, 5);

    it('adds income and expense but ignores transfers', () => {
        const totals = getMonthlyTotals([
            makeTx({ type: 'income', amount: 1000, date }),
            makeTx({ type: 'expense', amount: 300, date }),
            makeTx({ type: 'transfer', amount: 700, date }),
        ]);
        expect(totals).toEqual({ income: 1000, expense: 300, net: 700 });
    });

    it('keeps reconciliation adjustments inside the totals', () => {
        const totals = getMonthlyTotals([
            makeTx({ type: 'expense', amount: 300, date }),
            makeTx({ type: 'expense', amount: 50, date, isAdjustment: true }),
        ]);
        expect(totals.expense).toBe(350);
    });

    it('reports a negative net when expenses exceed income', () => {
        expect(getMonthlyTotals([makeTx({ type: 'expense', amount: 300, date })]).net).toBe(-300);
    });
});

describe('getBalanceSummary', () => {
    it('prefers the declared balance, skips inactive rows and subtracts reserves', () => {
        expect(getBalanceSummary(accounts, reserves)).toEqual({
            totalRealBalance: 1500000,
            totalReserved: 400000,
            totalAvailable: 1100000,
        });
    });

    it('can be negative when reserves exceed the balance', () => {
        const summary = getBalanceSummary([accounts[1]], [{ ...reserves[0], amount: 500000 }]);
        expect(summary.totalAvailable).toBe(-200000);
    });
});

describe('aggregateByCategory', () => {
    const date = ts(2026, 10, 5);
    const txs = [
        makeTx({ type: 'expense', amount: 100, date, categoryId: 'cat-1a' }),
        makeTx({ type: 'expense', amount: 200, date, categoryId: 'cat-1b' }),
        makeTx({ type: 'expense', amount: 700, date, categoryId: 'cat-2' }),
    ];

    it('rolls subcategories up to their parent and sorts by amount', () => {
        const result = aggregateByCategory(txs, categories, 'parents', labels);
        expect(result.map((r) => [r.categoryId, r.name, r.amount, r.percentage])).toEqual([
            ['cat-2', 'Categoría 2', 700, 70],
            ['cat-1', 'Categoría 1', 300, 30],
        ]);
    });

    it('keeps subcategories apart in the children view and names their parent', () => {
        const result = aggregateByCategory(txs, categories, 'children', labels);
        expect(result.find((r) => r.categoryId === 'cat-1a')).toMatchObject({
            name: 'Subcategoría 1A',
            parentName: 'Categoría 1',
            amount: 100,
        });
    });

    it('groups transactions whose category no longer exists as uncategorized', () => {
        const orphan = [makeTx({ type: 'expense', amount: 90, date, categoryId: 'gone' })];
        expect(aggregateByCategory(orphan, categories, 'parents', labels)).toMatchObject([
            { categoryId: null, name: 'Sin categoría', amount: 90 },
        ]);
    });

    it('uses the fallback label when the parent category was deleted', () => {
        const orphanChild = [{ ...categories[1], id: 'cat-x', parentId: 'parent-gone' }];
        const result = aggregateByCategory(
            [makeTx({ type: 'expense', amount: 10, date, categoryId: 'cat-x' })],
            orphanChild,
            'parents',
            labels
        );
        expect(result).toMatchObject([{ categoryId: 'parent-gone', name: 'Categorías principales' }]);
    });

    it('sums to the month total in both views', () => {
        const sum = (view: 'parents' | 'children') =>
            aggregateByCategory(txs, categories, view, labels).reduce((acc, r) => acc + r.amount, 0);
        expect(sum('parents')).toBe(1000);
        expect(sum('children')).toBe(1000);
    });
});

describe('getFixedBudgetSummary', () => {
    const items = [
        makeBudgetItem({ type: 'expense', amount: 1000, name: 'Gasto fijo A' }),
        makeBudgetItem({ type: 'expense', amount: 3000, name: 'Gasto fijo B' }),
        makeBudgetItem({ type: 'income', amount: 5000, name: 'Ingreso fijo' }),
        makeBudgetItem({ type: 'expense', amount: 9999, month: '2026-09' }),
    ];

    it('summarizes only the requested month', () => {
        const summary = getFixedBudgetSummary(items, '2026-10', { income: 2500, expense: 3000 });
        expect(summary).toMatchObject({
            plannedIncome: 5000,
            plannedExpense: 4000,
            plannedAvailable: 1000,
            expenseUsedPercent: 75,
            incomeReceivedPercent: 50,
            expenseDifference: 1000,
            status: 'within',
        });
    });

    it('keeps items in stored order, as the Reports list shows them', () => {
        const summary = getFixedBudgetSummary(items, '2026-10', { income: 0, expense: 0 });
        expect(summary.expenseItems.map((i) => i.name)).toEqual(['Gasto fijo A', 'Gasto fijo B']);
    });

    it('marks the budget as exceeded', () => {
        const summary = getFixedBudgetSummary(items, '2026-10', { income: 0, expense: 5000 });
        expect(summary.status).toBe('exceeded');
        expect(summary.expenseDifference).toBe(-1000);
    });

    it('reports no budget with zero percentages', () => {
        const summary = getFixedBudgetSummary([], '2026-10', { income: 10, expense: 10 });
        expect(summary).toMatchObject({ status: 'no_budget', expenseUsedPercent: 0, incomeReceivedPercent: 0 });
    });

    it('places legacy items without month by their creation date', () => {
        const legacy = makeBudgetItem({ type: 'expense', amount: 700, month: undefined, createdAt: ts(2026, 10, 20) });
        expect(getFixedBudgetSummary([legacy], '2026-10', { income: 0, expense: 0 }).plannedExpense).toBe(700);
    });
});

describe('isPendingReview', () => {
    const base = { type: 'expense' as const, amount: 1, date: ts(2026, 10, 5) };

    it('flags ambiguous and low-confidence transactions only', () => {
        expect(isPendingReview(makeTx({ ...base, isAmbiguous: true }))).toBe(true);
        expect(isPendingReview(makeTx({ ...base, aiConfidence: 0.5 }))).toBe(true);
        expect(isPendingReview(makeTx({ ...base, aiConfidence: 0.9 }))).toBe(false);
        expect(isPendingReview(makeTx(base))).toBe(false);
    });
});

describe('toMinorUnits', () => {
    it('keeps whole pesos for a currency without decimals', () => {
        expect(toMinorUnits(1234567, 0)).toBe(1234567);
    });

    it('converts to cents for a currency with decimals', () => {
        expect(toMinorUnits(1234.5, 2)).toBe(123450);
    });

    it('rounds halves away from zero, like the amounts on screen', () => {
        expect(toMinorUnits(2.5, 0)).toBe(3);
        expect(toMinorUnits(-2.5, 0)).toBe(-3);
    });

    it('never returns negative zero', () => {
        expect(Object.is(toMinorUnits(-0.4, 0), 0)).toBe(true);
    });
});
