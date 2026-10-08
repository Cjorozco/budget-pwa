import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import TransactionsPage from '@/pages/Transactions';
import { db } from '@/lib/db';
import { useUIStore } from '@/store/ui';

describe('TransactionsPage - botón de editar', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        useUIStore.setState({ toasts: [] });

        await db.transactions.clear();
        await db.accounts.clear();
        await db.categories.clear();

        await db.accounts.bulkAdd([
            { id: 'a', name: 'Cuenta A', type: 'bank', calculatedBalance: 70000, currency: 'COP', isActive: true },
            { id: 'b', name: 'Cuenta B', type: 'bank', calculatedBalance: 80000, currency: 'COP', isActive: true },
        ]);
        await db.categories.add({ id: 'cat-exp', name: 'Restaurantes', type: 'expense', color: '#ef4444', usageCount: 1, isActive: true });

        const base = { date: Date.now(), tagIds: [], createdAt: Date.now(), updatedAt: Date.now() };
        await db.transactions.bulkAdd([
            { ...base, id: 'exp', type: 'expense', amount: 1000, description: 'Almuerzo', accountId: 'a', categoryId: 'cat-exp' },
            { ...base, id: 'out', type: 'transfer', amount: 30000, description: 'Transferencia', accountId: 'a', categoryId: 'transfer-out', transferId: 't1' },
            { ...base, id: 'in', type: 'transfer', amount: 30000, description: 'Transferencia', accountId: 'b', categoryId: 'transfer-in', transferId: 't1' },
        ]);
    });

    it('muestra editar solo en transacciones normales; las transferencias solo se pueden borrar', async () => {
        const { container } = render(<TransactionsPage />);

        await waitFor(() => expect(container.querySelectorAll('button.text-red-600').length).toBe(3));

        // Un solo lápiz (el del gasto) y 3 botones de borrar
        expect(container.querySelectorAll('svg.lucide-pencil').length).toBe(1);
    });
});
