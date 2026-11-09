import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import {
    buildMonthlyHistory,
    getHistoryFileName,
    loadMonthlyHistory,
    type BuildHistoryInput,
} from '@/lib/reports/monthlyHistory';
import { accounts, categories, labels, makeBudgetItem, makeTx, reserves, ts } from './fixtures';

const NOW = new Date(2026, 10, 9, 10, 30);

function build(overrides: Partial<BuildHistoryInput>) {
    return buildMonthlyHistory({
        selectedMonth: NOW,
        range: '12',
        transactions: [],
        categories,
        budgetItems: [],
        accounts,
        reserves,
        now: NOW,
        labels,
        currency: 'COP',
        ...overrides,
    });
}

const expenseIn = (month: number, amount: number, categoryId = 'cat-1a') =>
    makeTx({ type: 'expense', amount, date: ts(2026, month, 10), categoryId });

describe('range of months', () => {
    it('starts at the first month with data, not at the edge of the window', () => {
        const history = build({ transactions: [expenseIn(8, 100)] });
        expect(history.range.from).toBe('2026-08');
        expect(history.months.map((m) => m.month)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
    });

    it('limits the window to the last 6 months ending at the selected month', () => {
        const history = build({ range: '6', transactions: [expenseIn(1, 100), expenseIn(7, 200)] });
        expect(history.range).toMatchObject({ from: '2026-07', to: '2026-11' });
        expect(history.transactions).toHaveLength(1);
    });

    it('ends at the month selected in Reports', () => {
        const history = build({ selectedMonth: new Date(2026, 8, 15), transactions: [expenseIn(9, 100), expenseIn(10, 900)] });
        expect(history.range.to).toBe('2026-09');
        expect(history.months.at(-1)?.totals.expense).toBe(100);
    });

    it('returns only the selected month for the single-month range', () => {
        const history = build({ range: 'month', transactions: [expenseIn(10, 900), expenseIn(11, 50)] });
        expect(history.months.map((m) => m.month)).toEqual(['2026-11']);
    });

    it('reaches back to the oldest data with the all-time range', () => {
        const old = makeTx({ type: 'expense', amount: 5, date: ts(2024, 3, 1) });
        const history = build({ range: 'all', transactions: [old] });
        expect(history.range.from).toBe('2024-03');
        expect(history.months).toHaveLength(33);
    });

    it('keeps months without data in the series and flags them', () => {
        const history = build({ transactions: [expenseIn(8, 100), expenseIn(10, 100)] });
        expect(history.months.find((m) => m.month === '2026-09')).toMatchObject({
            hasData: false,
            totals: { income: 0, expense: 0, net: 0 },
        });
    });

    it('reports no data when nothing falls in the range', () => {
        const history = build({ range: 'month' });
        expect(history.months).toHaveLength(1);
        expect(history.months[0].hasData).toBe(false);
    });

    it('drops the last millisecond of a month exactly as the screens do', () => {
        const edge = makeTx({ type: 'expense', amount: 70, date: new Date(2026, 9, 31, 23, 59, 59, 999).getTime() });
        expect(build({ transactions: [edge] }).transactions).toHaveLength(0);
    });
});

describe('partial months', () => {
    it('marks the current month as partial with the days elapsed', () => {
        const history = build({ transactions: [expenseIn(11, 100)] });
        expect(history.months.at(-1)).toMatchObject({ isPartial: true, daysElapsed: 9, daysInMonth: 30 });
    });

    it('marks past months as complete', () => {
        const history = build({ transactions: [expenseIn(10, 100)] });
        expect(history.months[0]).toMatchObject({ isPartial: false, daysElapsed: 31, daysInMonth: 31 });
    });

    it('treats a future month as partial with no elapsed days', () => {
        const history = build({ range: 'month', selectedMonth: new Date(2026, 11, 1) });
        expect(history.months[0]).toMatchObject({ isPartial: true, daysElapsed: 0 });
    });
});

describe('summary', () => {
    it('leaves the current partial month out of the averages', () => {
        const history = build({ transactions: [expenseIn(9, 100), expenseIn(10, 300), expenseIn(11, 9000)] });
        expect(history.range.completeMonths).toBe(2);
        expect(history.summary.expense).toEqual({ average: 200, median: 200, min: 100, max: 300 });
    });

    it('takes the middle value as median with an odd number of months', () => {
        const history = build({ transactions: [expenseIn(8, 100), expenseIn(9, 100), expenseIn(10, 700)] });
        expect(history.summary.expense).toMatchObject({ average: 300, median: 100 });
    });

    it('leaves reconciliation adjustments out of the averages but inside the month totals', () => {
        const adjustment = makeTx({ type: 'expense', amount: 500, date: ts(2026, 10, 2), isAdjustment: true, categoryId: 'cat-adj' });
        const history = build({ transactions: [expenseIn(10, 100), adjustment] });
        expect(history.summary.expense?.average).toBe(100);
        expect(history.summary.expenseByCategory.map((c) => c.categoryId)).toEqual(['cat-1']);
        expect(history.months[0].totals.expense).toBe(600);
        expect(history.months[0].adjustments).toEqual({ income: 0, expense: 500 });
    });

    it('averages a category over all complete months, including those at zero', () => {
        const history = build({
            transactions: [expenseIn(8, 300, 'cat-2'), expenseIn(9, 100), expenseIn(10, 100)],
        });
        expect(history.summary.expenseByCategory.find((c) => c.categoryId === 'cat-2')).toEqual({
            categoryId: 'cat-2',
            name: 'Categoría 2',
            average: 100,
            median: 0,
            min: 0,
            max: 300,
            activeMonths: 1,
        });
    });

    it('keeps one series under the current name when a category was renamed', () => {
        const renamed = categories.map((c) => (c.id === 'cat-2' ? { ...c, name: 'Nombre nuevo' } : c));
        const history = build({ categories: renamed, transactions: [expenseIn(9, 100, 'cat-2'), expenseIn(10, 300, 'cat-2')] });
        expect(history.summary.expenseByCategory).toMatchObject([
            { categoryId: 'cat-2', name: 'Nombre nuevo', average: 200, activeMonths: 2 },
        ]);
    });

    it('ignores months that only have a budget', () => {
        const history = build({
            transactions: [expenseIn(10, 400)],
            budgetItems: [makeBudgetItem({ type: 'expense', amount: 50, month: '2026-08' })],
        });
        expect(history.range.completeMonths).toBe(1);
        expect(history.summary.expense?.average).toBe(400);
    });

    it('has no statistics when there are no complete months', () => {
        const history = build({ range: 'month', transactions: [expenseIn(11, 100)] });
        expect(history.summary).toEqual({ income: null, expense: null, expenseByCategory: [] });
    });
});

describe('months and transactions', () => {
    it('matches the sum of the months with the sum of the movements', () => {
        const income = makeTx({ type: 'income', amount: 2000, date: ts(2026, 10, 1), categoryId: 'cat-inc' });
        const history = build({ transactions: [expenseIn(9, 100), expenseIn(10, 300), income] });
        const sumMonths = history.months.reduce((acc, m) => acc + m.totals.expense + m.totals.income, 0);
        const sumMovements = history.transactions.reduce((acc, t) => acc + t.amount, 0);
        expect(sumMonths).toBe(sumMovements);
    });

    it('excludes transfers from the movements', () => {
        const transfer = makeTx({ type: 'transfer', amount: 40, date: ts(2026, 10, 3) });
        expect(build({ transactions: [transfer] }).transactions).toEqual([]);
    });

    it('sorts movements from oldest to newest with local dates', () => {
        const history = build({ transactions: [expenseIn(10, 2), expenseIn(9, 1)] });
        expect(history.transactions.map((t) => t.date)).toEqual(['2026-09-10', '2026-10-10']);
    });

    it('counts demo and pending-review movements per month', () => {
        const demo = makeTx({ id: 'demo-1', type: 'expense', amount: 1, date: ts(2026, 10, 3) });
        const pending = makeTx({ type: 'expense', amount: 1, date: ts(2026, 10, 3), isAmbiguous: true });
        expect(build({ transactions: [demo, pending] }).months[0].dataQuality).toEqual({
            transactionCount: 2,
            pendingReviewCount: 1,
            demoTransactionCount: 1,
        });
    });

    it('takes one balance snapshot for the whole file', () => {
        expect(build({}).balanceAtExport).toEqual({
            totalRealBalance: 1500000,
            totalReserved: 400000,
            totalAvailable: 1100000,
        });
    });
});

describe('getHistoryFileName', () => {
    it('uses only the months of the range', () => {
        const history = build({ transactions: [expenseIn(8, 123456)] });
        expect(getHistoryFileName(history, 'json')).toBe('historial-2026-08_2026-11.json');
    });

    it('uses a single month when the range has one', () => {
        expect(getHistoryFileName(build({ range: 'month' }), 'md')).toBe('historial-2026-11.md');
    });
});

describe('loadMonthlyHistory', () => {
    beforeEach(async () => {
        await Promise.all([
            db.transactions.clear(),
            db.categories.clear(),
            db.budgetItems.clear(),
            db.accounts.clear(),
            db.reserves.clear(),
        ]);
        await db.categories.bulkAdd(categories);
        await db.accounts.bulkAdd(accounts);
        await db.reserves.bulkAdd(reserves);
        await db.transactions.bulkAdd([expenseIn(9, 100), expenseIn(10, 300), expenseIn(11, 50)]);
    });

    const load = (range: BuildHistoryInput['range']) =>
        loadMonthlyHistory({ selectedMonth: new Date(2026, 9, 15), range, now: NOW, labels });

    it('reads only the requested window', async () => {
        const history = await load('month');
        expect(history.months.map((m) => m.month)).toEqual(['2026-10']);
        expect(history.transactions).toHaveLength(1);
    });

    it('reads every month up to the selected one with the all-time range', async () => {
        const history = await load('all');
        expect(history.months.map((m) => m.month)).toEqual(['2026-09', '2026-10']);
    });

    it('works without network and writes nothing to the console', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const consoleSpies = (['log', 'info', 'debug', 'warn', 'error'] as const).map((m) => vi.spyOn(console, m));

        await load('12');

        expect(fetchSpy).not.toHaveBeenCalled();
        consoleSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
        vi.restoreAllMocks();
    });
});
