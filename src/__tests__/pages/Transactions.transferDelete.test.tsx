import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import TransactionsPage from '@/pages/Transactions';
import { db } from '@/lib/db';
import { useUIStore } from '@/store/ui';

describe('TransactionsPage - borrar transferencia', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        useUIStore.setState({ toasts: [], confirm: vi.fn().mockResolvedValue(true) });

        await db.transactions.clear();
        await db.accounts.clear();
        await db.categories.clear();

        // Estado posterior a transferir 30.000 de "src" a "dst"
        await db.accounts.bulkAdd([
            { id: 'src', name: 'Origen', type: 'bank', calculatedBalance: 70000, actualBalance: 70000, currency: 'COP', isActive: true },
            { id: 'dst', name: 'Destino', type: 'bank', calculatedBalance: 80000, actualBalance: 80000, currency: 'COP', isActive: true },
        ]);
        const base = { type: 'transfer' as const, amount: 30000, description: 'Transferencia', date: Date.now(), tagIds: [], createdAt: Date.now(), updatedAt: Date.now(), transferId: 't1' };
        await db.transactions.bulkAdd([
            { ...base, id: 'out', accountId: 'src', categoryId: 'transfer-out' },
            { ...base, id: 'in', accountId: 'dst', categoryId: 'transfer-in' },
        ]);
    });

    it('revierte calculatedBalance y actualBalance en ambas cuentas', async () => {
        const { container } = render(<TransactionsPage />);

        await waitFor(() => expect(container.querySelectorAll('button.text-red-600').length).toBe(2));
        fireEvent.click(container.querySelectorAll('button.text-red-600')[0]);

        await waitFor(async () => expect(await db.transactions.count()).toBe(0));

        const src = await db.accounts.get('src');
        const dst = await db.accounts.get('dst');
        expect(src).toMatchObject({ calculatedBalance: 100000, actualBalance: 100000 });
        expect(dst).toMatchObject({ calculatedBalance: 50000, actualBalance: 50000 });
    });
});
