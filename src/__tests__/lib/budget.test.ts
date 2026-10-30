import { describe, it, expect } from 'vitest';
import {
  getItemMonth,
  buildActualBudgetCandidates,
  candidatesToBudgetItems,
} from '@/lib/budget';
import type { BudgetItem, Category, Transaction } from '@/lib/types';

describe('Budget domain logic', () => {
  describe('getItemMonth', () => {
    it('returns month if explicitly present on item', () => {
      const item: BudgetItem = {
        id: '1',
        month: '2026-11',
        name: 'Internet',
        amount: 80000,
        type: 'expense',
        createdAt: new Date(2026, 0, 1).getTime(),
      };
      expect(getItemMonth(item)).toBe('2026-11');
    });

    it('falls back to formatted createdAt for legacy items without month', () => {
      const date = new Date(2026, 7, 15); // August 2026
      const item: BudgetItem = {
        id: '2',
        name: 'Arriendo',
        amount: 1200000,
        type: 'expense',
        createdAt: date.getTime(),
      };
      expect(getItemMonth(item)).toBe('2026-08');
    });
  });

  describe('buildActualBudgetCandidates', () => {
    const categories: Category[] = [
      {
        id: 'cat-food',
        name: 'Alimentación',
        type: 'expense',
        color: '#f97316',
        usageCount: 0,
        isActive: true,
      },
      {
        id: 'cat-super',
        name: 'Supermercado',
        parentId: 'cat-food',
        type: 'expense',
        color: '#ef4444',
        usageCount: 0,
        isActive: true,
      },
      {
        id: 'cat-rest',
        name: 'Restaurantes',
        parentId: 'cat-food',
        type: 'expense',
        color: '#eab308',
        usageCount: 0,
        isActive: true,
      },
      {
        id: 'cat-housing',
        name: 'Vivienda',
        type: 'expense',
        color: '#3b82f6',
        usageCount: 0,
        isActive: true,
      },
      {
        id: 'cat-salary',
        name: 'Salario',
        type: 'income',
        color: '#10b981',
        usageCount: 0,
        isActive: true,
      },
      {
        id: 'cat-bonus',
        name: 'Bonificaciones',
        parentId: 'cat-salary',
        type: 'income',
        color: '#34d399',
        usageCount: 0,
        isActive: true,
      },
    ];

    it('keeps child categories separate and sums amounts within each subcategory', () => {
      const txs: Transaction[] = [
        {
          id: 'tx-1',
          type: 'expense',
          amount: 150000,
          description: 'Mercado semanal',
          date: Date.now(),
          categoryId: 'cat-super',
          tagIds: [],
          accountId: 'acc-1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'tx-2',
          type: 'expense',
          amount: 50000,
          description: 'Cena con amigos',
          date: Date.now(),
          categoryId: 'cat-rest',
          tagIds: [],
          accountId: 'acc-1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const candidates = buildActualBudgetCandidates(txs, categories, 'Sin categoría');

      expect(candidates).toEqual([
        { name: 'Supermercado', amount: 150000, type: 'expense', categoryId: 'cat-super' },
        { name: 'Restaurantes', amount: 50000, type: 'expense', categoryId: 'cat-rest' },
      ]);
    });

    it('handles categories without parents, uncategorized items, and income/expenses separation', () => {
      const txs: Transaction[] = [
        // Income in a subcategory
        {
          id: 'tx-inc-1',
          type: 'income',
          amount: 2500000,
          description: 'Nómina',
          date: Date.now(),
          categoryId: 'cat-salary',
          tagIds: [],
          accountId: 'acc-1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'tx-inc-2',
          type: 'income',
          amount: 500000,
          description: 'Bono de desempeño',
          date: Date.now(),
          categoryId: 'cat-bonus',
          tagIds: [],
          accountId: 'acc-1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        // Expense root category
        {
          id: 'tx-exp-1',
          type: 'expense',
          amount: 1200000,
          description: 'Arriendo',
          date: Date.now(),
          categoryId: 'cat-housing',
          tagIds: [],
          accountId: 'acc-1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        // Expense uncategorized
        {
          id: 'tx-exp-2',
          type: 'expense',
          amount: 45000,
          description: 'Gasto no categorizado',
          date: Date.now(),
          categoryId: '',
          tagIds: [],
          accountId: 'acc-1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        // Transfer should be ignored
        {
          id: 'tx-transfer',
          type: 'transfer',
          amount: 300000,
          description: 'Paso a ahorros',
          date: Date.now(),
          categoryId: '',
          tagIds: [],
          accountId: 'acc-1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const candidates = buildActualBudgetCandidates(txs, categories, 'Sin categoría');

      // Incomes come first, then expenses (each sorted descending by amount)
      expect(candidates).toEqual([
        { name: 'Salario', amount: 2500000, type: 'income', categoryId: 'cat-salary' },
        { name: 'Bonificaciones', amount: 500000, type: 'income', categoryId: 'cat-bonus' },
        {
          name: 'Vivienda',
          amount: 1200000,
          type: 'expense',
          categoryId: 'cat-housing',
        },
        {
          name: 'Sin categoría',
          amount: 45000,
          type: 'expense',
          categoryId: undefined,
        },
      ]);
    });

    it('ignores zero or negative amount transactions', () => {
      const txs: Transaction[] = [
        {
          id: 'tx-zero',
          type: 'expense',
          amount: 0,
          description: 'Test 0',
          date: Date.now(),
          categoryId: 'cat-housing',
          tagIds: [],
          accountId: 'acc-1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const candidates = buildActualBudgetCandidates(txs, categories);
      expect(candidates).toEqual([]);
    });
  });

  describe('candidatesToBudgetItems', () => {
    it('converts candidates to BudgetItem records with unique ids and target month', () => {
      const candidates = [
        {
          name: 'Alimentación',
          amount: 350000,
          type: 'expense' as const,
          categoryId: 'cat-food',
        },
        {
          name: 'Salario',
          amount: 2500000,
          type: 'income' as const,
          categoryId: 'cat-salary',
        },
      ];

      const items = candidatesToBudgetItems(candidates, '2026-11');

      expect(items).toHaveLength(2);
      expect(items[0].month).toBe('2026-11');
      expect(items[0].name).toBe('Alimentación');
      expect(items[0].amount).toBe(350000);
      expect(items[0].type).toBe('expense');
      expect(items[0].categoryId).toBe('cat-food');
      expect(items[0].id).toBeDefined();
      expect(items[0].createdAt).toBeGreaterThan(0);

      expect(items[1].month).toBe('2026-11');
      expect(items[1].name).toBe('Salario');
      expect(items[1].amount).toBe(2500000);
      expect(items[1].type).toBe('income');
      expect(items[1].id).not.toBe(items[0].id);
    });
  });
});
