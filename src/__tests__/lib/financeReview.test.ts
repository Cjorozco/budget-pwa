import { describe, expect, it } from 'vitest';
import { analyzeFinances, findRecurringExpenses } from '@/lib/financeReview';
import type { BudgetItem, Category, Transaction } from '@/lib/types';

const categories: Category[] = [
    { id: 'utilities', name: 'Servicios básicos', type: 'expense', color: '', usageCount: 0, isActive: true },
    { id: 'other', parentId: 'utilities', name: 'Autres', seedKey: 'Servicios básicos › Otros', type: 'expense', color: '', usageCount: 0, isActive: true },
    { id: 'errand', name: 'Gastos por encargo', type: 'expense', color: '', usageCount: 0, isActive: true },
];
const date = (month: number) => new Date(2026, month - 1, 12).getTime();
function movement(id: string, month: number, changes: Partial<Transaction> = {}): Transaction {
    return {
        id, type: 'expense', amount: 100, description: 'Internet casa', date: date(month),
        accountId: 'account-a', categoryId: 'other', tagIds: [], createdAt: date(month), updatedAt: date(month), ...changes,
    };
}

describe('finance review', () => {
    it('finds repeated generic descriptions by direction and leaves a family payment pending', () => {
        const result = analyzeFinances([
            movement('a', 6),
            movement('b', 6, { description: ' Internet CASA ' }),
            movement('c', 6, { description: 'Dinero de mamá para transporte y mano de obra', type: 'income' }),
            movement('adjustment', 6, { isAdjustment: true }),
        ], categories, date(6), date(7));

        expect(result.genericUsage[0]?.matches.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
        expect(result.patterns[0]?.kind).toBe('specific');
        expect(result.patterns[0]?.matches.map((entry) => entry.id)).toEqual(['a', 'b']);
        expect(result.uncertain.map((entry) => entry.id)).toEqual(['c']);
    });

    it('counts only valid pairs of positive transfer entries, including pairs across the cutoff', () => {
        const result = analyzeFinances([
            movement('out', 5, { type: 'transfer', transferId: 'pair', categoryId: 'transfer-out' }),
            movement('in', 6, { type: 'transfer', transferId: 'pair', categoryId: 'transfer-in', accountId: 'account-b' }),
            movement('unpaired', 6, { type: 'transfer', transferId: 'unpaired', categoryId: 'transfer-out' }),
        ], categories, date(6), date(7));

        expect(result.transferCount).toBe(1);
        expect(result.reviewTransfers.map((entry) => entry.id)).toEqual(['unpaired']);
    });
});

describe('fixed expense review', () => {
    const target = new Date(2026, 6, 1);
    const history = [movement('a', 4, { amount: 95 }), movement('b', 5, { amount: 101 }), movement('c', 6)];
    it('suggests the median of three prior months and skips an equivalent budget item', () => {
        const budget: BudgetItem = { id: 'existing', type: 'expense', name: 'Internet casa', amount: 105, month: '2026-07', createdAt: 0, updatedAt: 0 };
        expect(findRecurringExpenses(history, categories, [], target)[0]?.candidate.amount).toBe(100);
        expect(findRecurringExpenses(history, categories, [budget], target)).toEqual([]);
    });

    it('excludes missing months, multiple payments per month, reconciliations, and third-party expenses', () => {
        expect(findRecurringExpenses(history.slice(1), categories, [], target)).toEqual([]);
        expect(findRecurringExpenses([...history, movement('duplicate', 5)], categories, [], target)).toEqual([]);
        expect(findRecurringExpenses(history.map((entry) => ({ ...entry, isAdjustment: true })), categories, [], target)).toEqual([]);
        expect(findRecurringExpenses(history.map((entry) => ({ ...entry, categoryId: 'errand' })), categories, [], target)).toEqual([]);
    });
});
