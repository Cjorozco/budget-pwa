import type { Account, BudgetItem, Category, Reserve, Transaction } from '@/lib/types';

/** Generic test data: invented names and round amounts, never real user data. */
export const ts = (year: number, month: number, day: number, hour = 12): number =>
    new Date(year, month - 1, day, hour).getTime();

let nextId = 0;

export function makeTx(overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date'>): Transaction {
    nextId += 1;
    return {
        id: `tx-${nextId}`,
        description: 'Movimiento de prueba',
        categoryId: 'cat-1a',
        tagIds: [],
        accountId: 'acc-a',
        createdAt: overrides.date,
        updatedAt: overrides.date,
        ...overrides,
    };
}

export function makeBudgetItem(overrides: Partial<BudgetItem> & Pick<BudgetItem, 'type' | 'amount'>): BudgetItem {
    nextId += 1;
    return {
        id: `budget-${nextId}`,
        month: '2026-10',
        name: `Rubro ${nextId}`,
        createdAt: ts(2026, 10, 1),
        ...overrides,
    };
}

const category = (id: string, name: string, type: Category['type'], parentId?: string): Category => ({
    id,
    name,
    type,
    parentId,
    color: '#336699',
    usageCount: 0,
    isActive: true,
});

export const categories: Category[] = [
    category('cat-1', 'Categoría 1', 'expense'),
    category('cat-1a', 'Subcategoría 1A', 'expense', 'cat-1'),
    category('cat-1b', 'Subcategoría 1B', 'expense', 'cat-1'),
    category('cat-2', 'Categoría 2', 'expense'),
    category('cat-adj', 'Ajuste', 'expense'),
    category('cat-inc', 'Ingreso A', 'income'),
    category('cat-inc-1', 'Ingreso A1', 'income', 'cat-inc'),
];

export const accounts: Account[] = [
    { id: 'acc-a', name: 'Cuenta A', type: 'bank', calculatedBalance: 1000000, actualBalance: 1200000, currency: 'COP', isActive: true },
    { id: 'acc-b', name: 'Cuenta B', type: 'cash', calculatedBalance: 300000, currency: 'COP', isActive: true },
    { id: 'acc-off', name: 'Cuenta C', type: 'bank', calculatedBalance: 999000, currency: 'COP', isActive: false },
];

export const reserves: Reserve[] = [
    { id: 'res-a', accountId: 'acc-a', amount: 400000, description: 'Reserva A', isActive: true, createdAt: ts(2026, 1, 1), updatedAt: ts(2026, 1, 1) },
    { id: 'res-off', accountId: 'acc-a', amount: 111000, description: 'Reserva B', isActive: false, createdAt: ts(2026, 1, 1), updatedAt: ts(2026, 1, 1) },
];

export const labels = { uncategorized: 'Sin categoría', parentFallback: 'Categorías principales' };
