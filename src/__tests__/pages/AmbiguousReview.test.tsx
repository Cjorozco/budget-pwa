import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import AmbiguousReviewPage from '@/pages/AmbiguousReview';
import { db } from '@/lib/db';
import { useUIStore } from '@/store/ui';
import type { Account, Transaction } from '@/lib/types';

const seed = async (balances: Pick<Account, 'calculatedBalance' | 'actualBalance'>, type: Transaction['type']) => {
    await db.accounts.add({ id: 'acc', name: 'Cuenta', type: 'bank', currency: 'COP', isActive: true, ...balances });
    await db.transactions.add({
        id: 'tx',
        accountId: 'acc',
        categoryId: 'cat',
        type,
        amount: 30000,
        description: 'Movimiento dudoso',
        date: Date.now(),
        tagIds: [],
        isAmbiguous: true,
        aiConfidence: 0.4,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
};

const deleteTheTransaction = async () => {
    const { container } = render(<AmbiguousReviewPage />);

    await waitFor(() => expect(container.querySelector('button.bg-red-50')).not.toBeNull());
    fireEvent.click(container.querySelector('button.bg-red-50')!);

    await waitFor(async () => expect(await db.transactions.count()).toBe(0));
};

describe('AmbiguousReviewPage - borrar movimiento', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        useUIStore.setState({ toasts: [], confirm: vi.fn().mockResolvedValue(true) });

        await db.transactions.clear();
        await db.accounts.clear();
        await db.categories.clear();
    });

    it('devuelve un gasto a calculatedBalance y actualBalance', async () => {
        await seed({ calculatedBalance: 70000, actualBalance: 65000 }, 'expense');

        await deleteTheTransaction();

        expect(await db.accounts.get('acc')).toMatchObject({ calculatedBalance: 100000, actualBalance: 95000 });
    });

    it('descuenta un ingreso de calculatedBalance y actualBalance', async () => {
        await seed({ calculatedBalance: 130000, actualBalance: 125000 }, 'income');

        await deleteTheTransaction();

        expect(await db.accounts.get('acc')).toMatchObject({ calculatedBalance: 100000, actualBalance: 95000 });
    });

    it('revierte actualBalance aunque valga 0', async () => {
        await seed({ calculatedBalance: 70000, actualBalance: 0 }, 'expense');

        await deleteTheTransaction();

        expect(await db.accounts.get('acc')).toMatchObject({ calculatedBalance: 100000, actualBalance: 30000 });
    });

    it('no crea actualBalance si la cuenta no lo tiene', async () => {
        await seed({ calculatedBalance: 70000 }, 'expense');

        await deleteTheTransaction();

        const account = await db.accounts.get('acc');
        expect(account?.calculatedBalance).toBe(100000);
        expect(account?.actualBalance).toBeUndefined();
    });
});
